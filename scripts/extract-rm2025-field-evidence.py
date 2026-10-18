"""Extract auditable field references from the archived official RM2025 rules.

Run after download-rm2025-manuals.py. Requires pypdf and Poppler's pdftoppm.
The official PDF is opened read-only; all outputs are derived materials.
"""

import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import shutil
import subprocess

from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "materials/documents/source/robomaster/2025/rm2025-university-championship-rules-v2.1.0.pdf"
AUDIT = ROOT / "materials/documents/derived/audits/rm2025-field"
IMAGES = ROOT / "materials/images/derived/inputs/rm2025-field-reference"
REFERENCES = {
    "version_change": [3, 4],
    "field_overview": [35, 36, 37],
    "exchange_station_and_slot": [55, 56, 57, 58, 87, 88, 89, 90, 91, 92, 93],
    "central_highland_and_crossing": [60, 61, 109, 112],
    "gold_resource_island": [62, 63],
    "silver_resource_island": [64],
    "ores": [72, 73],
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pdftoppm", default=shutil.which("pdftoppm"))
    args = parser.parse_args()
    if not args.pdftoppm:
        parser.error("pdftoppm was not found; pass --pdftoppm with its absolute path")
    AUDIT.mkdir(parents=True, exist_ok=True)
    IMAGES.mkdir(parents=True, exist_ok=True)
    pages = [{"pdf_page": n + 1, "text": page.extract_text()} for n, page in enumerate(PdfReader(SOURCE).pages)]
    record = {"source": SOURCE.relative_to(ROOT).as_posix(), "sha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(), "pages": pages}
    (AUDIT / "rules-pages.json").write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")
    (AUDIT / "rules-full-text.txt").write_text("\n\n".join(f"===== PDF PAGE {p['pdf_page']} =====\n{p['text']}" for p in pages), encoding="utf-8")

    def render(number):
        prefix = IMAGES / f"rules-p{number:03d}"
        subprocess.run([args.pdftoppm, "-f", str(number), "-l", str(number), "-scale-to", "1800", "-png", "-singlefile", str(SOURCE), str(prefix)], check=True, capture_output=True)
        path = prefix.with_suffix(".png")
        return {"pdf_page": number, "path": path.relative_to(ROOT).as_posix(), "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}

    with ThreadPoolExecutor(max_workers=3) as pool:
        rendered = list(pool.map(render, sorted({n for group in REFERENCES.values() for n in group})))
    manifest = {"source_pdf": record["source"], "source_sha256": record["sha256"], "page_numbering": "1-based PDF page; agrees with printed page on inspected reference pages", "render_command": "pdftoppm -f PAGE -l PAGE -scale-to 1800 -png -singlefile SOURCE PREFIX", "reference_groups": REFERENCES, "pages": rendered}
    (IMAGES / "sources.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"source_pages": len(pages), "reference_pages": len(rendered), "images": str(IMAGES)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
