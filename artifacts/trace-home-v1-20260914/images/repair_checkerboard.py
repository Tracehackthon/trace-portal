"""Repair these two checkerboard-baked bird assets without repainting their identity.
User-authorized local processing for task trace-home-v1-prototype-20260914.
No source files are modified. See repaired/repair-manifest.json for verified outputs.
"""
from pathlib import Path
import argparse
import hashlib
import json
import numpy as np
import cv2
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "repaired"
CONFIG = {
    "perched": {
        "source": "B2-bird-perched-alpha-retry.png",
        "source_sha256": "cc63d1359d2a89d6b6be2dc45d58e61ecff1eeab60974b631ceb1654e3a029e1",
        "interior_background_seeds": [(822, 734)],
        "foot_anchor": [852, 812],
        "eye_anchor": [1045, 307],
        "protected_foreground_samples": {"white_belly": [952, 518], "white_neck": [1012, 364], "eye": [1045, 307], "leg": [852, 774]},
    },
    "takeoff": {
        "source": "C-bird-takeoff.png",
        "source_sha256": "00702abe62d72904c57e6adc6585ec77bda5b03f327cc234f0cb3e5526bce41e",
        "interior_background_seeds": [(819, 868)],
        "foot_anchor": [829, 970],
        "eye_anchor": [1112, 473],
        "protected_foreground_samples": {"white_belly": [999, 691], "white_neck": [1082, 532], "eye": [1112, 473], "leg": [827, 924]},
    },
}

def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def segment(rgb, background_seeds):
    f = rgb.astype(np.float32)
    chroma = np.ptp(f, axis=2)
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32)
    mean = cv2.boxFilter(gray, -1, (25, 25))
    std = np.sqrt(np.maximum(0, cv2.boxFilter(gray * gray, -1, (25, 25)) - mean * mean))

    # Neutral checker tiles alternate rapidly. The bird is chromatic/dark OR
    # a smooth pale foreground region. This preserves the white belly rather
    # than treating every light pixel as background.
    chromatic = ((chroma > 10) & (gray < 250)) | (gray < 158)
    smooth_pale = (std < 14) & (gray > 205)
    seeds = (chromatic | smooth_pale).astype(np.uint8)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(seeds, 8)
    largest = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
    main = labels == largest
    near_main = ndi.distance_transform_edt(~main)
    keep = [largest]
    for i in range(1, n):
        if i != largest and stats[i, cv2.CC_STAT_AREA] >= 20 and np.min(near_main[labels == i]) <= 5:
            keep.append(i)
    seeds = np.isin(labels, keep).astype(np.uint8)

    # Only a 3 px local closure; no hand-drawn silhouette or geometric cutout.
    closed = cv2.morphologyEx(seeds, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8)).astype(bool)
    filled = ndi.binary_fill_holes(closed)
    holes = filled & ~closed
    n, hole_labels, stats, _ = cv2.connectedComponentsWithStats(holes.astype(np.uint8), 8)
    keep_hole_ids = []
    for x, y in background_seeds:
        label = int(hole_labels[y, x])
        if label == 0:
            raise RuntimeError(f"Background evidence seed {(x, y)} is not in an enclosed neutral gap")
        keep_hole_ids.append(label)
    # This explicit evidence point preserves the real checker-filled aperture
    # between the legs. Other enclosed pale areas belong to bird plumage.
    mask = filled & ~np.isin(hole_labels, keep_hole_ids)

    # 0.55 px antialiasing only. Decontaminate this narrow edge band by sampling
    # the nearest 1 px-eroded foreground. White checker pixels cannot survive
    # as a gray/white matte halo. The opaque interior is not recolored.
    blurred = cv2.GaussianBlur(mask.astype(np.float32), (5, 5), 0.55)
    alpha = np.rint(np.clip(blurred, 0, 1) * 255).astype(np.uint8)
    alpha[alpha < 3] = 0
    alpha[alpha > 252] = 255
    core = cv2.erode(mask.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool)
    _, indices = ndi.distance_transform_edt(~core, return_indices=True)
    edge = (alpha > 0) & ~core
    clean_rgb = rgb.copy()
    clean_rgb[edge] = rgb[indices[0][edge], indices[1][edge]]
    clean_rgb[alpha == 0] = 0
    return clean_rgb, alpha, {
        "chroma_threshold": 10, "dark_gray_threshold": 158,
        "texture_window_px": 25, "pale_std_max": 14, "pale_gray_min": 205,
        "closure_px": 3, "edge_sigma_px": 0.55,
        "preserved_interior_background_seeds_xy": background_seeds,
        "edge_rgb_modified_pixels": int(edge.sum()),
        "opaque_core_pixels_unchanged": int(core.sum()),
    }

def repair(name):
    config = CONFIG[name]
    source = ROOT / "originals" / config["source"]
    if sha256(source) != config["source_sha256"]:
        raise RuntimeError(f"Source hash mismatch; this repair is specific to the inspected source: {source}")
    rgb = np.array(Image.open(source).convert("RGB"))
    clean_rgb, alpha, method = segment(rgb, config["interior_background_seeds"])
    bbox = Image.fromarray(alpha).getbbox()
    pad = 8
    crop = [max(0, bbox[0]-pad), max(0, bbox[1]-pad), min(rgb.shape[1], bbox[2]+pad), min(rgb.shape[0], bbox[3]+pad)]
    rgba = Image.fromarray(np.dstack((clean_rgb, alpha)), "RGBA")
    full = OUT / f"bird-{name}-full.png"
    rgba.save(full)
    sprite = rgba.crop(crop)
    dest = OUT / f"bird-{name}.png"
    sprite.save(dest)
    Image.fromarray(alpha).save(OUT / f"bird-{name}-alpha.png")
    for label, color in [("deep-green", (7, 60, 49, 255)), ("mid-gray", (112, 116, 119, 255))]:
        bg = Image.new("RGBA", sprite.size, color)
        bg.alpha_composite(sprite)
        bg.convert("RGB").save(OUT / f"bird-{name}-check-{label}.png")

    a = np.array(sprite.getchannel("A"))
    samples = {}
    for label, (x, y) in config["protected_foreground_samples"].items():
        samples[label] = {"source_xy": [x,y], "alpha": int(alpha[y,x]), "rgb_original": rgb[y,x].tolist(), "rgb_output": clean_rgb[y,x].tolist()}
        if alpha[y,x] != 255:
            raise RuntimeError(f"Protected foreground sample lost: {name}/{label}")
    for x,y in config["interior_background_seeds"]:
        if alpha[y,x] != 0:
            raise RuntimeError("Interior leg aperture was not preserved")
    result = {
        "asset_id": f"bird-{name}", "status": "repaired_candidate_pending_visual_review",
        "source_path": str(source), "source_sha256": sha256(source), "source_size": [rgb.shape[1], rgb.shape[0]],
        "full_rgba_path": str(full), "full_rgba_sha256": sha256(full),
        "path": str(dest), "sha256": sha256(dest), "mode": "RGBA", "size": list(sprite.size),
        "source_alpha_bbox_ltrb_exclusive": list(bbox), "source_crop_ltrb_exclusive": crop,
        "cropped_alpha_bbox_ltrb_exclusive": list(sprite.getchannel("A").getbbox()),
        "alpha_min": int(a.min()), "alpha_max": int(a.max()), "transparent_pixels": int((a==0).sum()),
        "semi_transparent_pixels": int(((a>0)&(a<255)).sum()), "opaque_pixels": int((a==255).sum()),
        "foot_anchor_source_xy": config["foot_anchor"],
        "foot_anchor_cropped_xy": [config["foot_anchor"][0]-crop[0], config["foot_anchor"][1]-crop[1]],
        "eye_anchor_source_xy": config["eye_anchor"],
        "eye_anchor_cropped_xy": [config["eye_anchor"][0]-crop[0], config["eye_anchor"][1]-crop[1]],
        "anchor_note": "Manual visual registration hints, not anatomical ground truth. Apply one common source-pixel scale; do not equalize cropped image widths.",
        "protected_foreground_samples": samples, "method": method,
        "limitations": ["Original antialias matte is irrecoverably mixed with the checkerboard; nearest-interior color decontamination estimates only a narrow edge band.", "Fine pale feather filaments smaller than 1–2 source pixels may be simplified.", "Two still poses do not provide a natural wing-beat animation."],
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    (OUT / f"bird-{name}-metadata.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    return result

if __name__ == "__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--pose", choices=["perched", "takeoff", "all"], default="all")
    args=parser.parse_args()
    OUT.mkdir(exist_ok=True)
    for pose in (list(CONFIG) if args.pose=="all" else [args.pose]):
        repair(pose)
