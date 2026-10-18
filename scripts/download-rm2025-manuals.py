"""Archive every document marked latest on official RM2025 announcement 1768.

Preserves the official PDF bytes, validates them with PyMuPDF, and records
the source metadata and SHA-256 hashes. Existing verified files are reused.
"""

from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from hashlib import sha256
from html import unescape
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.request import Request, urlopen

import pymupdf


SOURCE_URL = "https://www.robomaster.com/zh-CN/resource/pages/announcement/1768"
REPO_ROOT = Path(__file__).resolve().parents[1]
OUTPUT = REPO_ROOT / "materials/documents/source/robomaster/2025"
MANIFEST = OUTPUT / "latest-manifest.json"
SNAPSHOT = OUTPUT / "announcement-1768.html"
SLUGS = [
    "robot-construction-specifications-v2.0.0",
    "university-championship-rules-v2.1.0",
    "university-championship-participation-south-v2.0.0",
    "university-championship-participation-central-v2.0.0",
    "university-championship-participation-east-v2.0.0",
    "university-championship-participation-finals-v2.0.0",
    "university-league-rules-v1.1.1",
    "university-league-participation-general-v1.1.0",
    "university-league-participation-northwest-v2.0.0",
    "university-league-participation-zhejiang-v2.0.0",
    "university-league-participation-fujian-v2.0.0",
    "university-league-participation-shandong-v2.0.0",
    "university-league-participation-guangxi-v2.0.0",
    "university-league-participation-liaoning-v2.0.0",
    "university-league-participation-shanghai-v2.0.0",
    "university-league-participation-southwest-v2.0.0",
    "competition-rules-and-construction-supplement-2024-11-29",
    "referee-system-serial-protocol-appendix-v1.9.0",
    "referee-system-serial-protocol-0x0303-explanation",
]


def timestamp():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class LatestRows(HTMLParser):
    def __init__(self):
        super().__init__()
        self.rows = []
        self.row = None
        self.anchor = None

    def handle_starttag(self, tag, attrs):
        if tag == "tr":
            self.row = {"text": [], "links": []}
        elif tag == "a" and self.row is not None:
            self.anchor = {"url": dict(attrs).get("href", ""), "text": []}

    def handle_data(self, data):
        if self.row is not None:
            self.row["text"].append(data)
        if self.anchor is not None:
            self.anchor["text"].append(data)

    def handle_endtag(self, tag):
        if tag == "a" and self.anchor is not None and self.row is not None:
            self.row["links"].append(self.anchor)
            self.anchor = None
        if tag == "tr" and self.row is not None:
            if "最新" in " ".join(self.row["text"]):
                self.rows.append(self.row)
            self.row = None


def download(url):
    request = Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept-Encoding": "identity"})
    with urlopen(request, timeout=120) as response:
        return response.read(), response.geturl(), dict(response.headers)


def verify_pdf(path):
    data = path.read_bytes()
    if not data.startswith(b"%PDF-"):
        raise ValueError("Downloaded bytes do not begin with PDF magic")
    with pymupdf.open(path) as document:
        if document.is_encrypted:
            raise ValueError("PDF is encrypted")
        if document.page_count < 1:
            raise ValueError("PDF contains no pages")
        for page_index in range(document.page_count):
            page = document.load_page(page_index)
            if page.rect.width <= 0 or page.rect.height <= 0:
                raise ValueError(f"Invalid page dimensions on page {page_index + 1}")
        return {
            "byte_size": len(data),
            "sha256": sha256(data).hexdigest(),
            "verification_status": "verified-pdf-open-all-pages",
            "pdf_page_count": document.page_count,
            "pdf_magic": data[:8].decode("ascii", errors="replace"),
            "verified_at_utc": timestamp(),
        }


def fetch_document(entry):
    path = REPO_ROOT / entry["path"]
    try:
        if path.exists():
            entry.update(verify_pdf(path))
            entry["download_action"] = "reused-existing-verified-file"
        else:
            data, resolved_url, headers = download(entry["url"])
            temporary = path.with_suffix(".pdf.part")
            temporary.write_bytes(data)
            verification = verify_pdf(temporary)
            temporary.replace(path)
            entry.update(verification)
            entry.update({
                "download_action": "downloaded-official-bytes",
                "downloaded_at_utc": timestamp(),
                "resolved_url": resolved_url,
                "http_content_type": headers.get("Content-Type"),
                "http_content_length": headers.get("Content-Length"),
                "http_last_modified": headers.get("Last-Modified"),
                "http_etag": headers.get("ETag"),
            })
    except Exception as error:
        entry["verification_status"] = "failed"
        entry["error"] = str(error)
    return entry


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    if not SNAPSHOT.exists():
        data, _, _ = download(SOURCE_URL)
        SNAPSHOT.write_bytes(data)
    snapshot_bytes = SNAPSHOT.read_bytes()
    parser = LatestRows()
    parser.feed(snapshot_bytes.decode("utf-8"))
    if len(parser.rows) != len(SLUGS):
        raise RuntimeError(f"Official table has {len(parser.rows)} latest rows; expected {len(SLUGS)}. Review before downloading.")

    entries = []
    for index, (row, slug) in enumerate(zip(parser.rows, SLUGS), start=1):
        if len(row["links"]) != 1:
            raise RuntimeError(f"Latest row {index} has {len(row['links'])} links")
        link = row["links"][0]
        title = re.sub(r"\s+", " ", "".join(link["text"])).strip()
        row_text = re.sub(r"\s+", " ", " ".join(row["text"])).strip()
        date = re.findall(r"\d{4}\.\d{2}\.\d{2}", row_text)
        version = re.search(r"[Vv]\s*(\d+\.\d+\.\d+)", title)
        path = OUTPUT / f"rm2025-{slug}.pdf"
        entries.append({
            "index": index,
            "title": unescape(title),
            "version": version.group(1) if version else None,
            "publication_date": date[-1].replace(".", "-") if date else None,
            "official_status": "latest",
            "url": unescape(link["url"]),
            "path": path.relative_to(REPO_ROOT).as_posix(),
            "verification_status": "pending",
        })

    manifest = {
        "source_url": SOURCE_URL,
        "competition_season": "RM2025",
        "selection": "Every PDF row marked latest on announcement 1768, including competition manuals, supplements and protocol documents.",
        "captured_at_utc": datetime.fromtimestamp(SNAPSHOT.stat().st_mtime, timezone.utc).isoformat(timespec="seconds"),
        "announcement_snapshot": SNAPSHOT.relative_to(REPO_ROOT).as_posix(),
        "announcement_snapshot_sha256": sha256(snapshot_bytes).hexdigest(),
        "expected_document_count": len(entries),
        "verification_method": "Official bytes preserved. PDF magic checked; PyMuPDF opened document and loaded every page. This checks readability, not semantic correctness or official signatures.",
        "documents": entries,
    }

    def save_manifest():
        manifest["verified_document_count"] = sum(e["verification_status"].startswith("verified") for e in entries)
        manifest["total_pdf_bytes"] = sum(e.get("byte_size", 0) for e in entries)
        manifest["updated_at_utc"] = timestamp()
        MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    save_manifest()
    priority = fetch_document(entries[1])
    save_manifest()
    print(json.dumps({"priority": priority}, ensure_ascii=True), flush=True)
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = [executor.submit(fetch_document, entry) for entry in entries if entry is not priority]
        for future in as_completed(futures):
            entry = future.result()
            save_manifest()
            print(json.dumps({"index": entry["index"], "path": entry["path"], "status": entry["verification_status"], "bytes": entry.get("byte_size"), "pages": entry.get("pdf_page_count"), "error": entry.get("error")}, ensure_ascii=True), flush=True)
    save_manifest()
    print(json.dumps({"verified": manifest["verified_document_count"], "expected": len(entries), "total_pdf_bytes": manifest["total_pdf_bytes"]}, ensure_ascii=True), flush=True)
    return 0 if manifest["verified_document_count"] == len(entries) else 1


if __name__ == "__main__":
    raise SystemExit(main())
