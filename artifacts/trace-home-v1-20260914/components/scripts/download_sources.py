"""Download only pinned official source files. Never execute upstream scripts."""
import hashlib
import json
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXPECTED_ROOT = Path(r"D:\AGeneral Workspace\AI-powered\harness\artifacts\trace-home-v1-20260914\components").resolve()
assert ROOT == EXPECTED_ROOT, "Unexpected writer root"
TASK = "trace-home-v1-assets-20260914"
PACKAGE_HASH = "FEC12772D27033E54E9EDB811486DE7C749DB5AFF054BF1BA3DE06628DC00CD7"
BASELINE = "2f4377864aa353dcecb3f60005d884b11486c84e"
SPECS = [
    dict(id="liquidglassjs", repo="Amir-Abushanab/liquid-glass-js", commit="07ad06ea197a07269af56da83d1fc9498bca94f5", license="MIT", status="material-candidate-not-runtime-verified", demo="https://amir-abushanab.github.io/liquid-glass-js/", files=["LICENSE", "README.md", "docs/GOTCHAS.md", "packages/core/package.json"], prefix="packages/core/src/", functions=["mountGlassShape", "buildAlphaDisplacementMap", "mountAlphaGlass", "createGlassSurface"], constraints=["Filters the target's SourceGraphic, not arbitrary content behind it; supply aligned scene pixels and keep text separate.", "Shape, geometry and material-map changes require displacement-map regeneration; do not regenerate per frame.", "Upstream TypeScript needs a local build; no page framework migration is implied."]),
    dict(id="animejs", repo="juliangarnier/anime", commit="01b81be1df6843ccfe0a71c0699a746bf740dd77", license="MIT", status="offline-esm-vendor-candidate", demo="https://animejs.com/documentation/svg/", files=["LICENSE.md", "README.md", "package.json", "dist/bundles/anime.esm.js", "dist/bundles/anime.esm.min.js"], functions=["morphTo", "createMotionPath", "createDrawable", "createTimeline"], constraints=["Animation engine only; not glass material or bird artwork.", "No Trace runtime, DOM animation or performance acceptance has run."]),
    dict(id="magicui-animated-beam", repo="magicuidesign/magicui", commit="52bc69354621e5cd7c9bc84a0e42b42f2d0c07b1", license="MIT", status="react-source-requires-port", demo="https://magicui.design/docs/components/animated-beam", files=["LICENSE.md", "apps/www/registry/magicui/animated-beam.tsx", "apps/www/registry/example/animated-beam-multiple-inputs.tsx", "apps/www/registry/example/animated-beam-multiple-outputs.tsx"], functions=["AnimatedBeam", "updatePath (component-local)"], constraints=["Depends on React, motion/react and a project-local cn helper; not directly runnable in vanilla desktop.", "Container ResizeObserver does not track every animated node position.", "Port coordinate measurement and paired path/gradient structure, not the entire UI framework."]),
    dict(id="codrops-shape-morph-reference-only", repo="codrops/ShapeMorphIdeas", commit="eeb7a4f4d7cf580bf8f0b8fb921f1af10f5ffce7", license="RESOURCE-TERMS-REVIEW-REQUIRED; demo5.js header says MIT", status="reference-only-do-not-distribute", demo="https://tympanus.net/Development/ShapeMorphIdeas/index5.html", files=["README.md", "js/demo5.js", "index5.html", "css/demo5.css"], functions=["Blob.reveal", "Blob.unreveal", "MorphingBG.initEvents"], constraints=["README resource terms restrict as-is redistribution and pluginized versions; JS header MIT does not resolve resource-wide scope.", "Do not import, bundle or distribute this reference until licensing scope is resolved.", "Original hides other shapes and reveals fullscreen; Trace needs scene-local expansion and persistent context."]),
    dict(id="rizzy-liquid-glass", repo="rizzytoday/liquid-glass", commit="841af14fb3eb9653d24aacf4eb049c9f389db1ef", license="MIT", status="lightweight-rounded-rect-fallback", demo="https://rizzy.today/liquid-glass/", files=["LICENSE", "README.md", "package.json", "core/liquid-glass.js"], functions=["createLiquidGlass", "buildDisplacementMap", "createFilterSVG"], constraints=["Full refraction requires Chromium backdrop-filter SVG support; UA detection is not a Trace shell acceptance test.", "Map geometry is roundRect; clip-path alone does not make organic-rim refraction.", "Large surfaces, parent opacity and resize map-cache growth require performance testing."]),
]

def get_bytes(url):
    events = []
    for attempt in range(1, 3):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "Trace-asset-preparation/1.0", "Accept": "application/vnd.github+json" if "api.github.com" in url else "*/*"})
            with urllib.request.urlopen(request, timeout=30) as response:
                data = response.read()
            return data, events
        except Exception as exc:
            events.append({"attempt": attempt, "error": str(exc)})
            if attempt == 2:
                raise
            time.sleep(1)

def main():
    manifest = {"task_id": TASK, "context_package_sha256": PACKAGE_HASH, "git_baseline": BASELINE, "created_at_utc": datetime.now(timezone.utc).isoformat(), "writer_root": str(ROOT), "policy": "Source preparation only; no upstream script execution or UI integration", "components": [], "validation": {"runtime_rendering": "not-run", "visual_acceptance": "not-run", "file_protocol_integration": "not-run"}}
    for spec in SPECS:
        tree_url = f"https://api.github.com/repos/{spec['repo']}/git/trees/{spec['commit']}?recursive=1"
        data, api_retries = get_bytes(tree_url)
        tree = json.loads(data)
        assert not tree.get("truncated"), spec["id"] + " truncated tree"
        entries = {entry["path"]: entry for entry in tree["tree"] if entry["type"] == "blob"}
        selected = set(spec["files"])
        if spec.get("prefix"):
            selected.update(p for p in entries if p.startswith(spec["prefix"]))
        missing = selected.difference(entries)
        if missing:
            raise RuntimeError(f"Missing pinned paths for {spec['id']}: {missing}")
        item = {k: v for k, v in spec.items() if k not in ("files", "prefix")}
        item["source_tree_url"] = tree_url
        item["source_tree_retries"] = api_retries
        item["downloaded_files"] = []
        for path in sorted(selected):
            url = f"https://raw.githubusercontent.com/{spec['repo']}/{spec['commit']}/{path}"
            raw, retries = get_bytes(url)
            blob_sha = hashlib.sha1(f"blob {len(raw)}\0".encode() + raw).hexdigest()
            assert blob_sha == entries[path]["sha"], f"Git blob mismatch: {path}"
            dest = ROOT / "originals" / spec["id"] / path
            assert dest.resolve().is_relative_to(ROOT)
            dest.parent.mkdir(parents=True, exist_ok=True)
            if dest.exists() and dest.read_bytes() != raw:
                raise RuntimeError(f"Refusing to overwrite changed original: {dest}")
            dest.write_bytes(raw)
            item["downloaded_files"].append({"path": dest.relative_to(ROOT).as_posix(), "source_url": url, "upstream_path": path, "bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest().upper(), "git_blob_sha1": blob_sha, "git_blob_verified": True, "retries": retries})
            print(f"downloaded {spec['id']}/{path} {len(raw)} bytes", flush=True)
        version_path = "packages/core/package.json" if spec["id"] == "liquidglassjs" else "package.json"
        local_package = ROOT / "originals" / spec["id"] / version_path
        item["version"] = json.loads(local_package.read_text(encoding="utf-8")).get("version") if local_package.exists() else "commit-snapshot"
        manifest["components"].append(item)
        (ROOT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("DOWNLOAD_COMPLETE", flush=True)

if __name__ == "__main__":
    main()
