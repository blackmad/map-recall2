#!/usr/bin/env python3
"""
Build a compact Amsterdam GVB transit network from OVapi GTFS.

Downloads (or reuses) https://gtfs.ovapi.nl/nl/gtfs-nl.zip, keeps tram / metro /
ferry routes for agency GVB, and writes one representative trip + shape + stop
sequence per line into public/data/extracts/amsterdam/staging/transit-network.json.

Usage (from repo / transit worktree root):
  python3 scripts/build-amsterdam-transit-gtfs.py
  python3 scripts/build-amsterdam-transit-gtfs.py --gtfs=.cache/transit/gtfs-nl.zip
"""

from __future__ import annotations

import argparse
import csv
import json
import urllib.request
import zipfile
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE_DIR = ROOT / '.cache' / 'transit'
DEFAULT_ZIP = CACHE_DIR / 'gtfs-nl.zip'
DEFAULT_OUT = ROOT / 'public' / 'data' / 'extracts' / 'amsterdam' / 'transit-network.json'
GTFS_URL = 'https://gtfs.ovapi.nl/nl/gtfs-nl.zip'
USER_AGENT = 'map-recall2-transit-spike/0.1 (github.com/blackmad/map-recall2; research)'

# Amsterdam play bbox (same order of magnitude as the city extract)
WEST, SOUTH, EAST, NORTH = 4.72, 52.27, 5.08, 52.43
MODE_BY_TYPE = {'0': 'tram', '1': 'metro', '4': 'ferry'}


def in_ams(lat: str | None, lon: str | None) -> bool:
  try:
    la, lo = float(lat or ''), float(lon or '')
  except ValueError:
    return False
  return SOUTH <= la <= NORTH and WEST <= lo <= EAST


def ensure_gtfs(zip_path: Path, force: bool) -> Path:
  if zip_path.exists() and not force:
    return zip_path
  zip_path.parent.mkdir(parents=True, exist_ok=True)
  print(f'downloading {GTFS_URL} → {zip_path}')
  req = urllib.request.Request(
    GTFS_URL,
    headers={'User-Agent': USER_AGENT, 'Accept-Encoding': 'gzip'},
  )
  with urllib.request.urlopen(req, timeout=600) as resp, open(zip_path, 'wb') as out:
    while True:
      chunk = resp.read(1024 * 1024)
      if not chunk:
        break
      out.write(chunk)
  print(f'downloaded {zip_path.stat().st_size / 1e6:.1f} MB')
  return zip_path


def extract_zip(zip_path: Path, dest: Path) -> Path:
  if (dest / 'routes.txt').exists() and (dest / 'stop_times.txt').exists():
    return dest
  dest.mkdir(parents=True, exist_ok=True)
  print(f'unzipping into {dest}')
  with zipfile.ZipFile(zip_path) as zf:
    zf.extractall(dest)
  return dest


def read_csv(path: Path):
  with open(path, newline='', encoding='utf-8-sig') as f:
    yield from csv.DictReader(f)


def build(gtfs_dir: Path) -> dict:
  routes: dict[str, dict] = {}
  for r in read_csv(gtfs_dir / 'routes.txt'):
    if r['agency_id'] != 'GVB':
      continue
    if r['route_type'] not in MODE_BY_TYPE:
      continue
    routes[r['route_id']] = {
      'routeId': r['route_id'],
      'ref': r.get('route_short_name') or '',
      'name': r.get('route_long_name') or '',
      'mode': MODE_BY_TYPE[r['route_type']],
      'color': (r.get('route_color') or '').upper() or None,
      'textColor': (r.get('route_text_color') or '').upper() or None,
    }

  trips_by_route: dict[str, list] = defaultdict(list)
  for t in read_csv(gtfs_dir / 'trips.txt'):
    if t['route_id'] in routes:
      trips_by_route[t['route_id']].append(t)

  chosen_trip: dict[str, dict] = {}
  shape_ids: set[str] = set()
  for rid, trips in trips_by_route.items():
    with_shape = [t for t in trips if t.get('shape_id')]
    pick = (with_shape or trips)[0]
    chosen_trip[rid] = pick
    if pick.get('shape_id'):
      shape_ids.add(pick['shape_id'])

  shapes: dict[str, list] = defaultdict(list)
  for row in read_csv(gtfs_dir / 'shapes.txt'):
    sid = row['shape_id']
    if sid not in shape_ids:
      continue
    shapes[sid].append(
      (int(row['shape_pt_sequence']), float(row['shape_pt_lon']), float(row['shape_pt_lat']))
    )
  for sid in shapes:
    shapes[sid].sort()

  needed_trips = {t['trip_id']: rid for rid, t in chosen_trip.items()}
  stop_seq: dict[str, list] = defaultdict(list)
  needed_stops: set[str] = set()
  for row in read_csv(gtfs_dir / 'stop_times.txt'):
    rid = needed_trips.get(row['trip_id'])
    if rid is None:
      continue
    sid = row['stop_id']
    stop_seq[rid].append((int(row['stop_sequence']), sid))
    needed_stops.add(sid)
  for rid in stop_seq:
    stop_seq[rid].sort()

  stops: dict[str, dict] = {}
  for s in read_csv(gtfs_dir / 'stops.txt'):
    if s['stop_id'] not in needed_stops:
      continue
    lat, lon = s.get('stop_lat'), s.get('stop_lon')
    stops[s['stop_id']] = {
      'stopId': s['stop_id'],
      'name': s.get('stop_name') or '',
      'center': [float(lat), float(lon)] if lat and lon else None,
      'parentStation': s.get('parent_station') or None,
      'inAmsterdamBbox': in_ams(lat, lon),
    }

  lines = []
  for rid, meta in sorted(routes.items(), key=lambda x: (x[1]['mode'], x[1]['ref'])):
    trip = chosen_trip.get(rid)
    if not trip:
      continue
    seq = [sid for _, sid in stop_seq.get(rid, []) if sid in stops]
    sid = trip.get('shape_id')
    path = [[lat, lon] for _, lon, lat in shapes[sid]] if sid and sid in shapes else None
    lines.append({
      **meta,
      'tripId': trip['trip_id'],
      'headsign': trip.get('trip_headsign') or '',
      'directionId': trip.get('direction_id') or '',
      'stopIds': seq,
      'path': path,
    })

  return {
    'cityId': 'amsterdam',
    'source': 'OVapi GTFS NL (agency GVB); tram/metro/ferry only',
    'feed': GTFS_URL,
    'generatedNote': 'staging — one representative trip + shape per route',
    'counts': {
      'lines': len(lines),
      'byMode': {m: sum(1 for line in lines if line['mode'] == m) for m in ('tram', 'metro', 'ferry')},
      'stops': len(stops),
      'stopsInAmsterdamBbox': sum(1 for s in stops.values() if s['inAmsterdamBbox']),
      'linesWithPath': sum(1 for line in lines if line['path']),
      'linesWithStops': sum(1 for line in lines if line['stopIds']),
    },
    'lines': lines,
    'stops': stops,
  }


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument('--gtfs', type=Path, default=DEFAULT_ZIP)
  parser.add_argument('--out', type=Path, default=DEFAULT_OUT)
  parser.add_argument('--force-download', action='store_true')
  args = parser.parse_args()

  zip_path = ensure_gtfs(args.gtfs, args.force_download)
  gtfs_dir = extract_zip(zip_path, CACHE_DIR / 'gtfs-nl')
  network = build(gtfs_dir)
  args.out.parent.mkdir(parents=True, exist_ok=True)
  args.out.write_text(json.dumps(network, ensure_ascii=False))
  print(json.dumps(network['counts'], indent=2))
  print(f'wrote {args.out} ({args.out.stat().st_size} bytes)')


if __name__ == '__main__':
  main()
