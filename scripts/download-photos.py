"""Downloads the stock photos listed in scripts/photos.json into public/images.
Run: python3 scripts/download-photos.py"""
import json, os, urllib.request
from concurrent.futures import ThreadPoolExecutor

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = os.path.join(root, "public", "images")
spec = json.load(open(os.path.join(root, "scripts", "photos.json")))

def url(pid, w, h):
    return f"https://images.pexels.com/photos/{pid}/pexels-photo-{pid}.jpeg?auto=compress&cs=tinysrgb&fit=crop&w={w}&h={h}"

jobs = []
for key, val in spec.items():
    if key.startswith("_"):
        continue
    if key.startswith("products/"):
        for i, pid in enumerate(val, 1):
            jobs.append((f"{key}-{i}.jpg", pid, 1000, 1250))
    else:
        pid, w, h = val
        jobs.append((key, pid, w, h))

def fetch(job):
    path, pid, w, h = job
    dest = os.path.join(out, path)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    req = urllib.request.Request(url(pid, w, h), headers={"User-Agent": "Mozilla/5.0"})
    data = urllib.request.urlopen(req, timeout=60).read()
    if data[:2] != b"\xff\xd8":
        raise RuntimeError(f"not a JPEG: {path}")
    open(dest, "wb").write(data)
    return path

with ThreadPoolExecutor(8) as ex:
    done = list(ex.map(fetch, jobs))
print(f"{len(done)} photos saved to public/images")
