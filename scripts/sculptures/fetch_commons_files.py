"""Download named Wikimedia Commons files (thumbnail of a given width) with licence/author provenance.

    python -I scripts/sculptures/fetch_commons_files.py <empty-out-dir> <width> "File:A.jpg" ["File:B.jpg" ...]

Writes the images plus provenance.json (title, licence, licenceUrl, author, date, sha1, downloadUrl) into out-dir.
Refuses NC/ND and unknown licences, like scripts/sculptures/licences.ts. Standard library only.
"""
import hashlib
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.error
import urllib.request

UA = {"User-Agent": "map-recall-sculpture-research/1.0 (open-data prototype)"}
out, width, titles = sys.argv[1], int(sys.argv[2]), sys.argv[3:]
os.makedirs(out, exist_ok=True)
strip = lambda s: re.sub(r"<[^>]+>", "", s or "").strip()
records = []


def fetch(url):
    """GET with backoff: upload.wikimedia.org answers 429 to bursts and to non-standard thumbnail widths."""
    for attempt in range(6):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers=UA)).read()
        except urllib.error.HTTPError as e:
            if e.code != 429 or attempt == 5:
                raise
            time.sleep(5 * 2 ** attempt)


for title in titles:
    q = urllib.parse.urlencode({"action": "query", "titles": title, "prop": "imageinfo", "iiprop": "url|extmetadata|sha1|size",
                                "iiurlwidth": width, "format": "json"})
    data = json.loads(fetch("https://commons.wikimedia.org/w/api.php?" + q))
    page = next(iter(data["query"]["pages"].values()))
    info = page["imageinfo"][0]
    meta = info["extmetadata"]
    lic = strip(meta.get("LicenseShortName", {}).get("value"))
    admitted = bool(re.search(r"^(CC0|Public domain|PD|CC BY(-SA)? [0-9.]+( [a-z]+)?)", lic, re.I)) and not re.search(r"NC|ND", lic)
    rec = {"title": page["title"], "licence": lic, "licenceUrl": meta.get("LicenseUrl", {}).get("value"),
           "author": strip(meta.get("Artist", {}).get("value")), "date": strip(meta.get("DateTimeOriginal", {}).get("value")),
           "originalSize": [info["width"], info["height"]], "sha1Original": info["sha1"], "descriptionUrl": info["descriptionurl"],
           "downloadUrl": info.get("thumburl") or info["url"], "admitted": admitted}
    if admitted:
        name = re.sub(r"[^A-Za-z0-9._-]+", "_", page["title"][5:])
        path = os.path.join(out, name)
        if os.path.exists(path):  # resume after a 429 abort
            body = open(path, "rb").read()
        else:
            time.sleep(1.5)
            body = fetch(rec["downloadUrl"])
            with open(path, "wb") as f:
                f.write(body)
        rec["local"], rec["sha256"] = name, hashlib.sha256(body).hexdigest()
    records.append(rec)
    print(rec["title"], "|", lic, "|", rec["author"], "|", "admitted" if admitted else "REFUSED")
with open(os.path.join(out, "provenance.json"), "w") as f:
    json.dump(records, f, indent=1, ensure_ascii=False)
