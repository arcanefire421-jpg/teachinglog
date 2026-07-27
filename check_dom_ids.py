import re
from pathlib import Path

root = Path(__file__).resolve().parent
html = (root / "index.html").read_text(encoding="utf-8")
js = (root / "app.js").read_text(encoding="utf-8")

html_ids = set(re.findall(r'\bid="([^"]+)"', html))
js_ids = set(re.findall(r'\$\("([^"]+)"\)', js))
missing = sorted(js_ids - html_ids)
print(f"HTML IDs: {len(html_ids)}")
print(f"JS $() IDs: {len(js_ids)}")
if missing:
    print("Missing IDs:")
    for item in missing:
        print(item)
    raise SystemExit(1)
print("All JS $() IDs exist in HTML.")
