"""Standalone PDF extraction diagnostic tool."""
from pathlib import Path

def inspect_pdf(file_path: str) -> None:
    path = Path(file_path)
    if not path.exists():
        print(f"File not found: {file_path}")
        return

    print(f"=== File: {path.name} ===")
    print(f"Size: {path.stat().st_size:,} bytes")

    # pypdf inspection
    try:
        from pypdf import PdfReader
        reader = PdfReader(str(path))
        print(f"pypdf pages: {len(reader.pages)}")
        for i, page in enumerate(reader.pages):
            text = page.extract_text() or ""
            print(f"  Page {i+1}: {len(text)} chars | preview: {text[:200]!r}")
            if text and "\x00" in text:
                print(f"    [WARNING] null bytes found in page {i+1}")
    except Exception as e:
        print(f"pypdf error: {e}")

    # PyPDF2 inspection
    try:
        from PyPDF2 import PdfReader as PdfReader2
        reader2 = PdfReader2(str(path))
        print(f"\nPyPDF2 pages: {len(reader2.pages)}")
        for i, page in enumerate(reader2.pages):
            text = page.extract_text() or ""
            print(f"  Page {i+1}: {len(text)} chars | preview: {text[:200]!r}")
    except Exception as e:
        print(f"PyPDF2 error: {e}")

    # PDF structure info
    try:
        import re
        header = path.read_bytes()[:20]
        print(f"\nPDF header: {header!r}")
        if not header.startswith(b"%PDF"):
            print("[WARNING] File does not start with %PDF header")
    except Exception as e:
        print(f"header read error: {e}")


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python test_extraction.py <path-to-pdf>")
        sys.exit(1)
    inspect_pdf(sys.argv[1])
