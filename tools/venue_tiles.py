#!/usr/bin/env python3
"""
Downloads satellite map tiles for one event venue, so the GPS map works with no internet at the pits.

    python3 tools/venue_tiles.py arizona 32.462 -111.312 32.484 -111.284

Arguments: the venue id (the folder name, same as `id` in frontend/src/telemetry-v2/config/venues.ts), then the
south-west and north-east corners as latitude longitude. Writes frontend/public/tiles/<venue>/{z}/{x}/{y}.jpg for
zooms 14-18, the standard web map tile layout Leaflet reads. Already-downloaded tiles are skipped, so it can be
re-run after a network error.

Imagery: USDA NAIP aerial photos through USGS The National Map (public domain, US only).
  zoom <= 16: USGS's cached tiles (USGSImageryOnly), the fast path; they stop at 16 (~2 m per pixel).
  zoom 17-18: cut from the full-resolution NAIP service (0.3-0.6 m per pixel). It takes ~30 s per request
              whatever the size and times out on large areas, so it's asked for 4 x 4 tile blocks (1024 px),
              which Pillow cuts into tiles.

Needs Pillow (pip install pillow).
"""

import io
import math
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from PIL import Image

CACHED = "https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}"
NAIP = (
    "https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer/exportImage"
    "?bbox={x0},{y0},{x1},{y1}&bboxSR=3857&imageSR=3857&size={px},{px}&format=jpg&f=image"
)
ZOOMS = range(14, 19)
MAX_CACHED_ZOOM = 16
BLOCK = 4  # tiles per side in one NAIP request
HALF_WORLD = 20037508.342789244  # web mercator, metres from the centre to the edge


def tile_xy(lat: float, lon: float, z: int) -> tuple[int, int]:
    n = 2**z
    x = int((lon + 180) / 360 * n)
    y = int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n)
    return x, y


def get(u: str) -> bytes:
    for attempt in range(4):
        try:
            with urllib.request.urlopen(u, timeout=120) as r:
                body = r.read()
            if not body.startswith(b"\xff\xd8"):  # the services answer errors as 200 + JSON/HTML
                raise ValueError(body[:120])
            return body
        except Exception as e:  # network blips and 504s: back off and retry
            err = e
            time.sleep(2 * (attempt + 1))
    raise RuntimeError(err)


def save(out: Path, body: bytes):
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(body)


def fetch(job: tuple[int, int, int, list[tuple[int, int, Path]]]) -> str:
    """One cached tile (zoom <= 16), or one BLOCK x BLOCK block of NAIP cut into the tiles listed."""
    z, bx, by, tiles = job
    todo = [t for t in tiles if not t[2].exists()]
    if not todo:
        return "skip"
    try:
        if z <= MAX_CACHED_ZOOM:
            x, y, out = todo[0]
            save(out, get(CACHED.format(z=z, x=x, y=y)))
            return "ok"
        size = 2 * HALF_WORLD / 2**z
        x0 = -HALF_WORLD + bx * size
        y1 = HALF_WORLD - by * size
        u = NAIP.format(x0=x0, y0=y1 - BLOCK * size, x1=x0 + BLOCK * size, y1=y1, px=256 * BLOCK)
        img = Image.open(io.BytesIO(get(u))).convert("RGB")
        for x, y, out in todo:
            px, py = (x - bx) * 256, (y - by) * 256
            buf = io.BytesIO()
            img.crop((px, py, px + 256, py + 256)).save(buf, "JPEG", quality=85)
            save(out, buf.getvalue())
        return "ok"
    except Exception as e:
        return f"fail {z}/{bx}/{by}: {e}"


def main():
    venue = sys.argv[1]
    s, w, n, e = map(float, sys.argv[2:6])
    root = Path(__file__).resolve().parent.parent / "frontend" / "public" / "tiles" / venue
    jobs = []
    for z in ZOOMS:
        x0, y0 = tile_xy(n, w, z)
        x1, y1 = tile_xy(s, e, z)
        tile = lambda x, y: (x, y, root / str(z) / str(x) / f"{y}.jpg")
        if z <= MAX_CACHED_ZOOM:
            jobs += [(z, x, y, [tile(x, y)]) for x in range(x0, x1 + 1) for y in range(y0, y1 + 1)]
        else:  # blocks aligned to BLOCK, clipped to the area
            for bx in range(x0 - x0 % BLOCK, x1 + 1, BLOCK):
                for by in range(y0 - y0 % BLOCK, y1 + 1, BLOCK):
                    ts = [tile(x, y) for x in range(max(bx, x0), min(bx + BLOCK, x1 + 1)) for y in range(max(by, y0), min(by + BLOCK, y1 + 1))]
                    jobs.append((z, bx, by, ts))
    print(f"{sum(len(j[3]) for j in jobs)} tiles in {len(jobs)} requests -> {root}")
    results = {"ok": 0, "skip": 0}
    with ThreadPoolExecutor(4) as pool:
        for i, r in enumerate(pool.map(fetch, jobs), 1):
            if r in results:
                results[r] += 1
            else:
                print(r, flush=True)
            if i % 20 == 0:
                print(f"  {i}/{len(jobs)} requests", flush=True)
    failed = len(jobs) - results["ok"] - results["skip"]
    print(f"done: {results['ok']} requests downloaded, {results['skip']} already there, {failed} failed (re-run to retry)")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
