"""Read-only existing FontTools inspection. Prints JSON; never saves font bytes."""
import hashlib
import json
import sys
from pathlib import Path
import fontTools
from fontTools.ttLib import TTFont

sys.stdout.reconfigure(encoding="utf-8")
root = Path(__file__).resolve().parents[3]
manifest_path = Path(__file__).with_name("approved-assets.candidate.json")
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
fonts = [a for a in manifest["assets"] if a["kind"] in ("original-variable-font", "page-fixed-copy-subset")]
sets = {}
records = []
for asset in fonts:
    p = root / asset["sourcePath"]
    actual = hashlib.sha256(p.read_bytes()).hexdigest().upper()
    if actual != asset["sha256"]:
        raise RuntimeError(f"Font hash changed: {asset['key']}")
    with TTFont(p, lazy=False, recalcTimestamp=False) as font:
        points = set(font.getBestCmap())
        sets[asset["key"]] = points
        records.append({"key": asset["key"], "path": asset["sourcePath"], "sha256": actual, "cmapCount": len(points), "actualAxes": [{"tag": a.axisTag, "min": a.minValue, "default": a.defaultValue, "max": a.maxValue} for a in font["fvar"].axes]})
union = set().union(*(v for k, v in sets.items() if k.startswith("font.fixed.")))
matrix = []
for record in records:
    points = sets[record["key"]]
    record["missingFromFixedUnion"] = len(union - points)
    if record["key"].startswith("font.fixed."):
        matrix.append({"key": record["key"], "missingFromOtherPageCmaps": {k: len(v - points) for k, v in sets.items() if k.startswith("font.fixed.") and k.endswith(record["key"].split(".")[-1])}})
sample = "动态输入：龘、𠮷与🙂"
report = {"task": manifest["task"], "readOnly": True, "fontToolsVersion": fontTools.__version__, "manifestSha256": hashlib.sha256(manifest_path.read_bytes()).hexdigest().upper(), "fontCount": len(records), "fixedSubsetCmapUnionCount": len(union), "fonts": records, "crossPageCoverage": matrix, "dynamicProbe": {"text": sample, "purpose": "Counterexample/coverage inspection only, not rendered proof", "missing": {k: [f"U+{p:04X}" for p in sorted(set(map(ord, sample)) - v)] for k,v in sets.items()}}, "limits": ["cmap membership only; not shaping, actual FontFace selection, line breaks or browser verification", "Union is the existing subset cmap union, not all current DOM strings and not arbitrary user content", "Full CN fonts are not all Unicode; platform fallback remains necessary"]}
print(json.dumps(report, ensure_ascii=False, indent=2))
