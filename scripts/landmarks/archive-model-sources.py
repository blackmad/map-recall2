#!/usr/bin/env python3
"""Archive cached landmark research byte-for-byte into a PRIVATE research repo.
Default mode copies local caches only. --fetch-missing captures explicitly recorded
source responses; --screenshot-url captures only explicitly selected source pages.
No Git writes, authenticated requests, arbitrary tmp/Downloads scans or page crawling.
Run from the game repo: python3 scripts/landmarks/archive-model-sources.py --destination ../map-recall2-source-data
Objects are content-addressed; readable model files preserve source filenames,
and manifests retain every original path/name and raw-versus-derived provenance.
"""
import argparse
import hashlib
import json
import mimetypes
import os
import re
import shutil
import time
import urllib.request
import urllib.parse
import urllib.error
from concurrent.futures import ThreadPoolExecutor
import subprocess
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

SUFFIXES = ('-footprints', '-specs', '-spec', '-pois', '-poi', '-review', '-sources', '-research')
SOURCE_SUFFIXES = {'.json', '.geojson', '.jpg', '.jpeg', '.png', '.webp', '.avif', '.pdf', '.html', '.txt', '.md', '.xml', '.skp', '.jp2', '.tif', '.tiff'}
RENDER_NAMES = re.compile(r'(?:gallery|live[-_]|neutral|screenshot|placement-proof|review-proof|game[-_]|render)', re.I)
TMP_TERMS = re.compile(r'(?:reference|ref[-_.]|source|photo|front\.(?:jpg|jpeg)|bag|osm|ahn|archive|directions|roof-summary|routing-near|vbo|register|monument|architect|operator)', re.I)
ALIASES = {'our-lord-attic': 'ons-lieve-heer-op-solder', 'eye': 'eye-filmmuseum', 'ing': 'ing-house', 'bijenkorf': 'de-bijenkorf', 'canal-museum': 'canals-museum'}
# Explicitly user-authorized original imports, not an invitation to scan Downloads.
IMPORTS = {'eye-filmmuseum': ['Gebouw.skp', 'eyeaf.skp', 'eyeaf (1).skp'], 'de-bijenkorf': ['Bijenkorf_Amsterdam[1].skp'], 'silodam': ['Silodam[1][1].skp']}
# This worker knows how these ING cache files were saved. Unknown cache format stays unknown.
RAW_TMP = {'ing-osm.json', 'ing-bag.json', 'ing-3dbag.json', 'ing-archive-results.json', 'ing-archive-search.html'}
NORMALIZED_TMP = {'ing-access-osm.json', 'ing-archive-completed.json', 'ing-vbo.json', 'ing-roof-summary.json', 'ing-routing-near.json'}
ING_CACHE_URLS = {
 'ing-reference.jpg': 'https://mvsa-architects.com/media/images/ING_F12_FOLDER.width-1160.jpg',
 'ing-front.jpg': 'https://mvsa-architects.com/media/images/Architect-Offices-ING-House-Kantor.2e16d0ba.fill-898x540.jpg',
 'ing-osm.json': 'https://api.openstreetmap.org/api/0.6/way/57856367/full.json',
 'ing-bag.json': 'https://api.pdok.nl/kadaster/bag/ogc/v2/collections/pand/items?identificatie=0363100012068127&f=json',
 'ing-3dbag.json': 'https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.0363100012068127',
 'ing-directions.pdf': 'https://www.lexence.com/wp-content/uploads/2025/02/Routebeschrijving-2.pdf',
 'ing-directions.png': 'https://www.lexence.com/wp-content/uploads/2025/02/Routebeschrijving-2.pdf',
 'ing-archive-photo-1.jpg': 'https://images.memorix.nl/ams/thumb/640x480/f2871915-970e-e736-1cb7-549319b7f60b.jpg',
 'ing-archive-photo-2.jpg': 'https://images.memorix.nl/ams/thumb/640x480/759b9ad1-e067-6ace-7623-440952330fb8.jpg',
}

def walk(value):
    yield value
    if isinstance(value, dict):
        for item in value.values():
            yield from walk(item)
    elif isinstance(value, list):
        for item in value:
            yield from walk(item)

def load(path):
    try:
        return json.loads(path.read_text())
    except (ValueError, UnicodeError, OSError):
        return None

def stem(path):
    value = path.stem
    for suffix in SUFFIXES:
        if value.endswith(suffix):
            return value[:-len(suffix)]
    return value

def urls(value):
    return sorted({s.rstrip('.,;)') for item in walk(value) if isinstance(item, str) for s in re.findall(r'https?://[^\s<>"\']+', item)})

def used_urls(value):
    """Only explicitly recorded reference/source URLs; no page link crawling."""
    result = set()
    direct = {'sourceurl', 'sourceurls', 'referenceurl', 'referenceurls', 'referenceimages', 'referenceimage', 'imageurl', 'photourl', 'photourls', 'url', 'primarysources', 'registerurl', 'pageurl'}
    def visit(item, context=False):
        if isinstance(item, dict):
            for key, data in item.items():
                # href/link navigation in downloaded API responses is not evidence read.
                if key.lower() in {'links', 'href', 'download', 'downloadlist', 'deepzoom', 'topview', 'thumb'}:
                    continue
                visit(data, context or key.lower() in direct)
        elif isinstance(item, list):
            for data in item:
                visit(data, context)
        elif context and isinstance(item, str) and item.startswith(('http://', 'https://')) and not any(c in item for c in '\n <>'):
            result.add(item)
    visit(value)
    return result

def capture_url(request, dest, max_bytes):
    """Persist exact HTTP body + metadata; even failures stay explicit, never accept JS shell as full content."""
    url = request['url']
    query = {key.lower() for key in urllib.parse.parse_qs(urllib.parse.urlsplit(url).query)}
    identity = hashlib.sha256(url.encode()).hexdigest()
    metadata_path = dest / 'captures' / (identity + '.json')
    old = load(metadata_path) if metadata_path.exists() else None
    if old and old.get('success') and (dest / old['archiveObject']).exists():
        return {**old, 'modelIds': request['modelIds'], 'sourceRecords': request['sourceRecords']}
    record = {**request, 'retrievedAt': datetime.now(timezone.utc).isoformat(), 'captureState': 'newly-captured-current-response-not-claimed-historically-read', 'rights': 'PRIVATE research only; upstream copyright/restrictions unchanged.', 'success': False}
    if query.intersection({'apikey', 'api_key', 'access_token', 'token', 'authorization', 'password', 'signature'}):
        record['failure'] = 'Skipped credential-bearing or signed URL; no authenticated requests.'
        return record
    try:
        time.sleep(.1)
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (private architectural research archive)', 'Accept': '*/*'})
        try:
            response = urllib.request.urlopen(req, timeout=30)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            record.update(httpStatus=response.status, finalUrl=response.url, contentType=response.headers.get('Content-Type', ''), httpLastModified=response.headers.get('Last-Modified'))
            declared = response.headers.get('Content-Length')
            if declared and int(declared) > max_bytes:
                raise ValueError('HTTP body exceeds size guard; requires manual/LFS follow-up')
            body = response.read(max_bytes + 1)
            if len(body) > max_bytes:
                raise ValueError('HTTP body exceeds size guard; requires manual/LFS follow-up')
        sha = hashlib.sha256(body).hexdigest()
        target = dest / 'objects/sha256' / sha[:2] / sha
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.exists():
            target.write_bytes(body)
        record.update(archiveObject=str(target.relative_to(dest)), sha256=sha, bytes=len(body), representation='raw-http-response-body', success=200 <= record['httpStatus'] < 300)
        if 'html' in record['contentType'].lower():
            text = body.decode('utf-8', errors='replace')
            shell = any(marker in text.lower() for marker in ['<pic-mediabank', 'enable javascript', 'javascript is required'])
            record['renderedContentState'] = 'known-javascript-shell-lacks-rendered-search-results' if shell else 'raw-HTML-only-rendered-equivalence-not-verified'
        if not record['success']:
            record['failure'] = 'HTTP error body archived; not accepted as source content'
    except Exception as error:
        record['failure'] = str(error)[:250]
    metadata_path.parent.mkdir(parents=True, exist_ok=True)
    metadata_path.write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n')
    return record

def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()

def readable_copy(dest, folder, filename, object_path, sha):
    """Keep immutable object bytes; filename collisions retain both versions."""
    clean = re.sub(r'[^\w .()\[\]-]+', '-', Path(filename).name).strip(' .') or 'source'
    clean = clean[:180]
    folder.mkdir(parents=True, exist_ok=True)
    target = folder / clean
    if target.exists() and digest(target) != sha:
        name = Path(clean)
        target = folder / (name.stem + '-' + sha[:12] + name.suffix)
    if not target.exists():
        try:
            os.link(object_path, target)
        except OSError:
            shutil.copyfile(object_path, target)
    if digest(target) != sha:
        raise ValueError('Readable source checksum mismatch: ' + str(target))
    return str(target.relative_to(dest))

def capture_filename(capture):
    parts = urllib.parse.urlsplit(capture['url'])
    label = parts.hostname + '-' + (urllib.parse.unquote(parts.path).strip('/') or 'index')
    label = re.sub(r'[^a-zA-Z0-9_.-]+', '-', label)[:130]
    media_type = capture.get('contentType', '').split(';')[0].strip().lower()
    extension = {'text/html': '.html', 'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png', 'image/avif': '.avif', 'image/webp': '.webp', 'application/json': '.json', 'text/plain': '.txt', 'image/jp2': '.jp2'}.get(media_type, mimetypes.guess_extension(media_type) or '.bin')
    if label.lower().endswith(extension):
        label = label[:-len(extension)]
    return label + '-' + hashlib.sha256(capture['url'].encode()).hexdigest()[:10] + extension

def screenshot_source(url, repo, dest):
    """Explicit one-page helper; never invoke for the whole capture queue."""
    identity = hashlib.sha256(url.encode()).hexdigest()
    temporary = dest / 'captures' / ('rendered-' + identity + '.png')
    temporary.parent.mkdir(parents=True, exist_ok=True)
    javascript = r"""
import {chromium} from '@playwright/test';
import fs from 'node:fs';
const args=JSON.parse(fs.readFileSync(0,'utf8'));
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const response=await page.goto(args.url,{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForTimeout(1500);
 await page.screenshot({path:args.path,fullPage:true,timeout:30000});
 process.stdout.write(JSON.stringify({finalUrl:page.url(),httpStatus:response?.status(),viewport:{width:1440,height:1000}}));
}finally{await browser.close()}
"""
    try:
        run = subprocess.run(['node', '--input-type=module', '-e', javascript], cwd=repo, input=json.dumps({'url': url, 'path': str(temporary)}), capture_output=True, text=True, timeout=75)
    except subprocess.TimeoutExpired:
        run = subprocess.CompletedProcess([], 124, stdout='', stderr='')
    record = {'url': url, 'retrievedAt': datetime.now(timezone.utc).isoformat(), 'representation': 'derived-rendered-browser-screenshot-not-raw-HTTP', 'captureState': 'explicit-current-page-screenshot-not-claimed-historical', 'success': False}
    if run.returncode == 0 and temporary.exists():
        sha = digest(temporary)
        target = dest / 'objects/sha256' / sha[:2] / sha
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.exists():
            shutil.copyfile(temporary, target)
        record.update(json.loads(run.stdout), archiveObject=str(target.relative_to(dest)), sha256=sha, bytes=temporary.stat().st_size, contentType='image/png', success=True)
        if record.get('httpStatus', 0) >= 400:
            record.update(success=False, failure='Rendered HTTP error page retained; not accepted as source content.')
        temporary.unlink()
    else:
        record['failure'] = 'Browser source capture failed; return code ' + str(run.returncode)
    (dest / 'captures' / ('rendered-' + identity + '.json')).write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n')
    return record

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--destination', required=True, type=Path)
    parser.add_argument('--repo', type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument('--downloads', type=Path, default=Path.home() / 'Downloads')
    parser.add_argument('--screenshot-url', action='append', default=[], help='Explicit recorded source page to capture with Playwright; never automatic bulk browser work')
    parser.add_argument('--fetch-missing', action='store_true', help='Capture explicitly recorded source pages/images currently, never historical-read claim')
    parser.add_argument('--fetch-limit', type=int, help='Optional bound on requests for staged backfill')
    parser.add_argument('--http-max-bytes', type=int, default=90_000_000)
    parser.add_argument('--verify', action='store_true', help='Also rehash every stored object after copying')
    args = parser.parse_args()
    repo, dest = args.repo.resolve(), args.destination.resolve()
    if repo == dest or repo in dest.parents:
        raise SystemExit('Destination must be outside the game repository (private source repository).')
    dest.mkdir(parents=True, exist_ok=True)
    output = subprocess.run(['node', '--import', 'tsx', '--input-type=module', '-e', "import {MANUAL_LANDMARKS} from './src/canalRecall/landmarks/manualModels.ts';process.stdout.write(JSON.stringify(MANUAL_LANDMARKS))"], cwd=repo, check=True, capture_output=True, text=True)
    models = {m['id']: m for m in json.loads(output.stdout)}
    catalogue_count = len(models)
    for path in (repo / 'scripts/landmarks').glob('*-spec.json'):
        pending = load(path)
        if isinstance(pending, dict) and pending.get('id') and pending.get('modelUrl') and pending['id'] not in models:
            models[pending['id']] = {**pending, 'catalogueState': 'source-ready-or-planned-not-in-runtime-catalogue'}
    keys = defaultdict(set)
    for mid, model in models.items():
        for key in [mid, model.get('landmarkId'), *model.get('relatedLandmarkIds', []), *model.get('suppressOsmIds', [])]:
            if key:
                keys[key].add(mid)
    for alias, mid in ALIASES.items():
        if mid in models:
            keys[alias].add(mid)
    files, parsed, associations, groups = {}, {}, defaultdict(set), defaultdict(set)
    research_roots = [repo / 'scripts/landmarks', repo / 'docs/references']
    for root in research_roots:
        for path in sorted(root.rglob('*')):
            if path.is_file() and path.suffix.lower() in SOURCE_SUFFIXES:
                # Landmark source folder contains records; browser proof HTML is a render.
                if root.name == 'landmarks' and path.suffix != '.json':
                    continue
                files[path] = 'structured-research' if path.suffix == '.json' else 'cached-reference'
                data = load(path) if path.suffix == '.json' else None
                parsed[path] = data
                if data is not None:
                    for value in walk(data):
                        if isinstance(value, str) and value in keys:
                            associations[path].update(keys[value])
                for key, mids in keys.items():
                    if path.stem == key or path.stem.startswith(key + '-') or key in path.parts:
                        associations[path].update(mids)
                if associations[path]:
                    groups[stem(path)].update(associations[path])
    catalogue_path = repo / 'src/canalRecall/landmarks/manualCatalogue.json'
    files[catalogue_path] = 'catalogue-snapshot'
    parsed[catalogue_path] = None
    associations[catalogue_path].update(models)
    # Shared spec families establish the owner mapping for corresponding footprint files.
    for path in files:
        associations[path].update(groups.get(stem(path), set()))
        for token in [*path.parts, *path.stem.split('_')]:
            associations[path].update(groups.get(token, set()))
    for root in (repo / 'artifacts/landmarks').glob('*/references'):
        for path in sorted(root.rglob('*')):
            if path.is_file() and path.suffix.lower() in SOURCE_SUFFIXES:
                files[path] = 'cached-reference'
                parsed[path] = load(path) if path.suffix == '.json' else None
                associations[path].update(groups.get(root.parent.name, set()))
                associations[path].update(keys.get(root.parent.name, set()))
    # Explicit local reference paths embedded in these research records are retained,
    # never arbitrary whole-city datasets or unrelated user files.
    missing = defaultdict(list)
    for record, data in list(parsed.items()):
        for value in walk(data):
            if not isinstance(value, str) or len(value) > 500 or '\n' in value:
                continue
            if not (value.startswith('/tmp/') or value.startswith('docs/references/') or value.startswith('artifacts/landmarks/')):
                continue
            path = Path(value) if value.startswith('/') else repo / value
            if path.suffix.lower() not in SOURCE_SUFFIXES:
                continue
            if RENDER_NAMES.search(path.name):
                continue
            owners = associations[record]
            if path.is_file():
                files[path] = 'cached-reference'
                associations[path].update(owners)
                if path not in parsed:
                    parsed[path] = load(path) if path.suffix == '.json' else None
            else:
                for mid in owners or {'_unassigned'}:
                    missing[mid].append({'path': value, 'referencedBy': str(record.relative_to(repo)), 'state': 'missing-local-cache'})
    # Bounded model-prefix glob only; excludes gallery/live screenshots and JS bundles.
    for prefix, owners in {**{mid: {mid} for mid in models}, **{key: mids for key, mids in groups.items()}, **{a: {m} for a, m in ALIASES.items() if m in models}}.items():
        if not re.fullmatch(r'[a-z0-9-]+', prefix) or len(prefix) < 3:
            continue
        for path in Path('/tmp').glob(prefix + '-*'):
            if path.is_file() and path.suffix.lower() in SOURCE_SUFFIXES and TMP_TERMS.search(path.name) and not RENDER_NAMES.search(path.name):
                files[path] = 'temporary-source-cache'
                associations[path].update(owners)
                parsed[path] = load(path) if path.suffix == '.json' else None
    for mid, names in IMPORTS.items():
        for name in names:
            path = args.downloads / name
            if path.is_file():
                files[path] = 'user-provided-original-import'
                associations[path].add(mid)
            else:
                missing[mid].append({'path': str(path), 'state': 'missing-authorized-original-import'})
    snapshot = subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=repo, check=True, capture_output=True, text=True).stdout.strip()
    status = subprocess.run(['git', 'status', '--porcelain', '--untracked-files=all'], cwd=repo, check=True, capture_output=True, text=True).stdout.splitlines()
    dirty = {line[3:]: line[:2] for line in status}
    now = datetime.now(timezone.utc).isoformat()
    manifests = {mid: {'modelId': mid, 'modelName': model['name'], 'placementAndIdentitySnapshot': model, 'snapshotCommit': snapshot, 'archivedAt': now, 'rights': 'PRIVATE research archive only. Source copyright and restrictions remain. Asset original-project licence does not license its references.', 'files': [], 'sourceUrls': set(urls(model)), 'accessState': {'localInventory': 'cached-files-copied-or-explicitly-missing', 'webSources': 'URLs-only-unless-original-body-or-current-capture-confirmed', 'historicalReading': 'Assertions/access notes preserved in structured research; current capture does not retroactively verify reading'}, 'missingLocalFiles': missing[mid]} for mid, model in models.items()}
    manifests['_unassigned'] = {'modelId': '_unassigned', 'notes': 'Preserved research whose precise model ownership is unresolved; not silently omitted or falsely attributed.', 'files': [], 'sourceUrls': set(), 'missingLocalFiles': missing['_unassigned'], 'snapshotCommit': snapshot, 'archivedAt': now}
    copied, total, oversized = {}, 0, []
    for path, category in sorted(files.items(), key=lambda pair: str(pair[0])):
        size = path.stat().st_size
        sha = digest(path)
        target = dest / 'objects/sha256' / sha[:2] / sha
        if size > 90_000_000:
            oversized.append({'sourcePath': str(path), 'bytes': size, 'sha256': sha, 'action': 'Requires Git LFS coordination; copied intact but do not stage as ordinary Git blob.'})
        if not target.exists():
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(path, target)
            total += size
        if args.verify and digest(target) != sha:
            raise SystemExit('Checksum failure: ' + str(path))
        data = parsed.get(path)
        source_urls = set(urls(data))
        if path.name in ING_CACHE_URLS:
            source_urls.add(ING_CACHE_URLS[path.name])
        owners = associations[path] or {'_unassigned'}
        rel = str(path.relative_to(repo)) if path.is_relative_to(repo) else None
        representation = ('original-import-bytes' if category == 'user-provided-original-import' else 'raw-http-response-body' if path.name in RAW_TMP else 'normalized-source-record' if path.name in NORMALIZED_TMP else 'structured-research-snapshot-not-raw-http' if category == 'structured-research' else 'derived-PDF-preview' if path.name == 'ing-directions.png' else 'image-or-document-source-bytes' if path.suffix.lower() != '.json' else 'cached-JSON-format-not-independently-verified-as-raw-http')
        entry = {'sourcePath': str(path), 'repositoryPath': rel, 'originalFilename': path.name, 'archiveObject': str(target.relative_to(dest)), 'sha256': sha, 'bytes': size, 'mediaType': mimetypes.guess_type(path.name)[0], 'category': category, 'representation': representation, 'sourceUrls': sorted(source_urls), 'sourceModifiedAt': datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat(), 'snapshotState': dirty.get(rel, 'tracked-at-snapshot-HEAD') if rel else 'external-local-cache-at-archive-time', 'ownership': 'Matched cached record identities/spec family/file prefix; shared bundles can serve multiple models. Inspect structured records for per-part assertions.', 'rights': 'Retain original restrictions; PRIVATE research only, no open-license claim.'}
        if category == 'user-provided-original-import':
            entry['provenance'] = 'User-authorized original SketchUp import/reference; upstream source URL/licence not known from local file. Does not imply final native house-style mesh copied or derived from every original byte.'
        for mid in owners:
            manifests[mid]['files'].append(dict(entry))
            manifests[mid]['sourceUrls'].update(source_urls)
        copied[str(path)] = {'sha256': sha, 'owners': sorted(owners)}
    requests = {}
    cached_raw = set()
    for path, category in files.items():
        owners = associations[path] or {'_unassigned'}
        data = parsed.get(path)
        evidence_urls = used_urls(data)
        if path.name in ING_CACHE_URLS:
            evidence_urls.add(ING_CACHE_URLS[path.name])
            if path.name in RAW_TMP or path.suffix.lower() in {'.jpg', '.pdf'}:
                cached_raw.add(ING_CACHE_URLS[path.name])
        for url in evidence_urls:
            request = requests.setdefault(url, {'url': url, 'modelIds': set(), 'sourceRecords': set()})
            request['modelIds'].update(owners)
            request['sourceRecords'].add(str(path.relative_to(repo)) if path.is_relative_to(repo) else str(path))
    for mid, model in models.items():
        for url in used_urls(model):
            request = requests.setdefault(url, {'url': url, 'modelIds': set(), 'sourceRecords': set()})
            request['modelIds'].add(mid)
            request['sourceRecords'].add('runtime model attribution/source snapshot')
    planned = [{**r, 'modelIds': sorted(r['modelIds']), 'sourceRecords': sorted(r['sourceRecords']), 'cacheState': 'known-original-body-already-archived' if u in cached_raw else 'raw-body-not-confirmed-in-current-local-inventory', 'captureEligible': '/binaries/' not in u and not re.search(r'\.(?:glb|gltf|skp|obj|zip)(?:[?#]|$)', u, re.I), 'captureScopeNote': 'Recorded source URL; imported-mesh binary variants require separate deliberate capture, not page/image backfill.' if '/binaries/' in u else 'Explicitly used source/reference URL; no crawling.'} for u, r in sorted(requests.items())]
    (dest / 'capture-requests.json').write_text(json.dumps({'plannedAt': now, 'policy': 'Only explicitly recorded references/source URLs; no page-link crawling. Current capture is not proof of historical reading.', 'requests': planned}, ensure_ascii=False, indent=2) + '\n')
    # Existing captures remain associated on a non-network rerun.
    selected = [r for r in planned if r['url'] not in cached_raw and r['captureEligible']]
    if args.fetch_limit is not None:
        selected = selected[:args.fetch_limit]
    fetched = []
    if args.fetch_missing:
        with ThreadPoolExecutor(max_workers=4) as pool:
            fetched = list(pool.map(lambda r: capture_url(r, dest, args.http_max_bytes), selected))
    fetched_by_url = {r['url']: r for r in fetched}
    for request in planned:
        prior_path = dest / 'captures' / (hashlib.sha256(request['url'].encode()).hexdigest() + '.json')
        capture = fetched_by_url.get(request['url']) or (load(prior_path) if prior_path.exists() else None)
        for mid in request['modelIds']:
            manifests[mid].setdefault('webCaptures', []).append(capture or {**request, 'captureState': request['cacheState'], 'success': request['url'] in cached_raw})
    if len(args.screenshot_url) > 10:
        raise SystemExit('At most10explicit source screenshots per run; keep browser work bounded.')
    for url in args.screenshot_url:
        if url not in requests:
            raise SystemExit('Screenshot URL must already be explicitly recorded as a used source/reference.')
        query_keys = {key.lower() for key in urllib.parse.parse_qs(urllib.parse.urlsplit(url).query)}
        if query_keys.intersection({'apikey', 'api_key', 'access_token', 'token', 'authorization', 'password', 'signature'}):
            raise SystemExit('Credential-bearing source screenshots are excluded.')
        screenshot_source(url, repo, dest)
    for mid, manifest in manifests.items():
        manifest['sourceUrls'] = sorted(manifest['sourceUrls'])
        manifest['coverage'] = {'archivedLocalFiles': len(manifest['files']), 'sourceURLsRecorded': len(manifest['sourceUrls']), 'cachedImages': sum(f['mediaType'] is not None and f['mediaType'].startswith('image/') for f in manifest['files']), 'rawHttpBodies': sum(bool(c.get('archiveObject')) for c in manifest.get('webCaptures', [])), 'successfulRawHttpBodies': sum(bool(c.get('archiveObject')) and c.get('success', False) for c in manifest.get('webCaptures', [])), 'rawWebImages': sum(bool(c.get('archiveObject')) and c.get('success', False) and c.get('contentType', '').startswith('image/') for c in manifest.get('webCaptures', [])), 'limits': ['Local files and confirmed raw web captures are recorded separately; a URL alone does not mean the page or photo is cached. --fetch-missing optionally captures its current response.', 'Normalized footprints/research preserve assertions and embedded surveys but are not represented as original HTTP response bytes.', 'Absent cache files/access-restricted dossiers require separate follow-up; no completeness claim.']}
        folder = dest / 'models' / mid
        folder.mkdir(parents=True, exist_ok=True)
        for entry in manifest['files']:
            entry['readableArchivePath'] = readable_copy(dest, folder / 'files', entry['originalFilename'], dest / entry['archiveObject'], entry['sha256'])
            entry['modelRelativePath'] = str(Path(entry['readableArchivePath']).relative_to(folder.relative_to(dest)))
        manifest['webCaptures'] = [dict(capture) for capture in manifest.get('webCaptures', [])]
        for capture in manifest['webCaptures']:
            if capture.get('archiveObject'):
                # Copy record before attaching this model-specific path to shared captures.
                capture['readableArchivePath'] = readable_copy(dest, folder / 'webpages', capture_filename(capture), dest / capture['archiveObject'], capture['sha256'])
                capture['modelRelativePath'] = str(Path(capture['readableArchivePath']).relative_to(folder.relative_to(dest)))
        for request in planned:
            if mid not in request['modelIds']:
                continue
            rendered_path = dest / 'captures' / ('rendered-' + hashlib.sha256(request['url'].encode()).hexdigest() + '.json')
            rendered = load(rendered_path) if rendered_path.exists() else None
            if rendered and rendered.get('archiveObject'):
                rendered['readableArchivePath'] = readable_copy(dest, folder / 'webpages', capture_filename(rendered), dest / rendered['archiveObject'], rendered['sha256'])
                rendered['modelRelativePath'] = str(Path(rendered['readableArchivePath']).relative_to(folder.relative_to(dest)))
                manifest.setdefault('renderedCaptures', []).append(rendered)
        lines = ['# ' + manifest.get('modelName', mid), '', 'PRIVATE research only. Original rights and restrictions remain; model asset licences do not license reference photos or pages.', '', 'Readable cached sources are in `files/`; actual captured HTTP bodies are in `webpages/`. The manifest distinguishes raw bytes, normalized research, current HTTP responses and optional derived screenshots.', '', '| File | Representation |', '| --- | --- |']
        for entry in manifest['files']:
            path = Path(entry['modelRelativePath'])
            lines.append('| [' + entry['originalFilename'].replace('|', '-') + '](' + urllib.parse.quote(str(path)) + ') | ' + entry['representation'] + ' |')
        for capture in manifest.get('webCaptures', []):
            path = capture.get('modelRelativePath')
            if path:
                local = Path(path)
                lines.append('| [' + Path(path).name + '](' + urllib.parse.quote(str(local)) + ') | ' + capture.get('representation', 'raw-http-response-body') + ('; HTTP failure body' if not capture.get('success') else '') + ' |')
        for capture in manifest.get('renderedCaptures', []):
            path = capture.get('modelRelativePath')
            if path:
                lines.append('| [' + Path(path).name + '](' + urllib.parse.quote(path) + ') | Derived browser screenshot; HTTP ' + str(capture.get('httpStatus', 'unknown')) + ' |')
        (folder / 'README.md').write_text('\n'.join(lines) + '\n')
        (folder / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    all_http = {c['url']: c for m in manifests.values() for c in m.get('webCaptures', []) if c.get('archiveObject')}
    index = {'schemaVersion': 1, 'archivedAt': now, 'sourceRepository': str(repo), 'snapshotCommit': snapshot, 'catalogueModels': catalogue_count, 'manifestModelsIncludingPending': len(models), 'modelsWithLocalFiles': sum(bool(m['files']) for mid, m in manifests.items() if mid != '_unassigned'), 'sourceFiles': len(copied), 'uniqueObjects': len({v['sha256'] for v in copied.values()}), 'newObjectBytesCopied': total, 'oversizedObjectsRequiringLFS': oversized, 'unassignedFiles': len(manifests['_unassigned']['files']), 'modelManifests': {mid: 'models/' + mid + '/manifest.json' for mid in sorted(manifests)}, 'sourceFileInventory': copied, 'policy': 'PRIVATE research only. No source relicensing. Default local-copy mode; optional explicit-source HTTP capture and selected screenshots retain retrieval metadata. Preserve original bytes and paths. Shared content is deduplicated by SHA256.', 'workingTreeSnapshot': [line for line in status if line[3:] in {str(p.relative_to(repo)) for p in files if p.is_relative_to(repo)}], 'script': 'scripts/landmarks/archive-model-sources.py', 'captureRequests': len(planned), 'eligibleCaptureRequests': sum(r['captureEligible'] for r in planned), 'archiveScriptSha256': digest(Path(__file__)), 'capturesAttemptedThisRun': len(fetched), 'capturesSuccessfulThisRun': sum(r.get('success', False) for r in fetched), 'totalHTTPBodyCaptures': len(all_http), 'totalSuccessfulHTTPBodyCaptures': sum(c.get('success', False) for c in all_http.values()), 'confirmedLocalOriginalSourceURLs': len(cached_raw)}
    (dest / 'archive-index.json').write_text(json.dumps(index, ensure_ascii=False, indent=2) + '\n')
    # Managed section documents paths that were just materialized, preserving root prose.
    start, end = '<!-- BEGIN MODEL SOURCE DIRECTORY -->', '<!-- END MODEL SOURCE DIRECTORY -->'
    section = [start, '## Model source directory', '', 'Readable source bytes and raw webpage/image captures were materialized by the archive script. Filenames retain extensions; SHA suffixes distinguish collisions. `objects/sha256/` remains the immutable deduplicated byte store. All references remain PRIVATE research with their original rights.', '', 'Optional source-page screenshots use `--screenshot-url URL` only for explicitly recorded pages; they are derived browser evidence, stored separately from raw HTTP snapshots.', '', '| Model | Cached sources | HTTP bodies |', '| --- | ---: | ---: |']
    for mid, manifest in sorted(manifests.items()):
        section.append('| [' + mid + '](models/' + mid + '/README.md) | ' + str(len(manifest['files'])) + ' | ' + str(sum(bool(c.get('archiveObject')) for c in manifest.get('webCaptures', []))) + ' |')
    section.append(end)
    readme = dest / 'README.md'
    text = readme.read_text() if readme.exists() else '# Private landmark source archive\n'
    if start in text and end in text:
        text = text[:text.index(start)] + '\n'.join(section) + text[text.index(end) + len(end):]
    else:
        text += '\n' + '\n'.join(section) + '\n'
    readme.write_text(text)
    print(json.dumps({k: index[k] for k in ['catalogueModels', 'modelsWithLocalFiles', 'sourceFiles', 'uniqueObjects', 'newObjectBytesCopied', 'unassignedFiles', 'oversizedObjectsRequiringLFS']}, indent=2))

if __name__ == '__main__':
    main()
