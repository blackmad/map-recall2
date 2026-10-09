#!/usr/bin/env python3
"""Archive cached canalhouse inputs without fetching, publishing, or staging Git."""
import argparse
import hashlib
import json
from pathlib import Path
from datetime import datetime, timezone

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--inventory', required=True)
parser.add_argument('--destination', required=True)
parser.add_argument('--stage', required=True, help='Private directory with register extracts and near-perspective crops')
parser.add_argument('--reviews', default='', help='Comma-separated review filenames in references directory')
parser.add_argument('--references', default='docs/references/canalhouse-recipes')
args = parser.parse_args()
root = Path.cwd().resolve()
destination = Path(args.destination).resolve()
if destination == root or root in destination.parents:
    raise SystemExit('Private archive must be outside the public game repository')
if not (destination / '.git').exists():
    raise SystemExit('Destination must be an existing private archive checkout')
inventory = json.loads(Path(args.inventory).read_text())
refs = Path(args.references)
changed = []
verified = 0

def digest(data):
    return hashlib.sha256(data).hexdigest()

for entry in inventory['entries']:
    model = entry['address'].lower().replace(' ', '-')
    # Identity comes from the admission, not the address label.
    admission_path = refs / (model + '-source-admission.json')
    admission = json.loads(admission_path.read_text())
    recipe_input = json.loads((refs / (model + '-recipe-input.json')).read_text())
    model = recipe_input['id']
    if admission['officialIdentity']['pandId'] != entry['cachedOwnerId']:
        raise ValueError('Canonical Pand association mismatch')
    if '/' in model or model.startswith('.'):
        raise ValueError('Unsafe canonical ID')
    pack = destination / 'models' / model
    manifest_path = pack / 'manifest.json'
    prior = json.loads(manifest_path.read_text()) if manifest_path.exists() else None
    if prior and prior['modelId'] != model:
        raise ValueError('Canonical pack identity mismatch')
    files = list(prior['files']) if prior else []
    def copy(source, relative, kind, expected=None, **metadata):
        global verified
        data = Path(source).read_bytes()
        sha = digest(data)
        if expected and sha != expected:
            raise ValueError(f'Source checksum mismatch: {source}')
        target = pack / relative
        if target.exists() and target.read_bytes() != data:
            raise ValueError(f'Refusing to overwrite prior source: {target}')
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        if digest(target.read_bytes()) != sha:
            raise ValueError(f'Archive checksum mismatch: {target}')
        if not any(f['path'] == relative for f in files):
            files.append(dict(path=relative, kind=kind, sha256=sha, bytes=len(data), **metadata))
            verified += 1
            changed.append(str(target.relative_to(destination)))
    raw_sources = {
        '3dbag': admission['sourceProvenance']['raw3DBag'],
        'bag': admission['officialIdentity']['pandSource'],
        'vbo': admission['officialIdentity']['vboSource'],
    }
    for label, record in raw_sources.items():
        source = Path(record.get('rawPath', record.get('path')))
        copy(source, f'raw/{label}-original-collection.json', 'original-cached-api-body', record['sha256'], url=record['url'], accessState='Cached original bytes; no new HTTP request')
        sidecar = Path(str(source) + '.source.json')
        if sidecar.exists():
            copy(sidecar, f'raw/{label}-request-provenance.json', 'cached-retrieval-provenance')
    for image in entry['images']:
        cached_manifest = json.loads(Path(image['manifestPath']).read_text())
        record = next(r for r in cached_manifest['records'] if r['id'] == entry['selectedFacade'].replace(':e:', '_e_'))
        view = record['images'][image['tier']]
        # Associate originals with the actual selected cached-view metadata.
        if view['panoramaId'] != image['panoramaId'] or view['sha256'] != image['sha256']:
            raise ValueError('Cached view association mismatch')
        copy(image['originalPath'], f"raw/{image['panoramaId']}.jpg", 'original-cached-panorama', view['panoramaSha256'], url=view['url'], captureDate=view['date'], rights='Not independently verified; private research only')
        if cached_manifest.get('kind') == 'derived-neighbor-camera-projections':
            parent = cached_manifest['derivedFrom']
            original_manifest = Path(parent['manifestPath'])
            if digest(original_manifest.read_bytes()) != parent['manifestSha256']:
                raise ValueError('Original camera manifest checksum mismatch')
            original_record = next(r for r in json.loads(original_manifest.read_text())['records'] if r['id'] == parent['recordId'])
            if original_record['images'][image['tier']]['panoramaSha256'] != view['panoramaSha256']:
                raise ValueError('Derived camera does not match its original panorama')
            copy(original_manifest, f"raw/panorama-source-{parent['manifestSha256']}.json", 'original-cached-processing-manifest')
            copy(image['manifestPath'], f"processed/panorama-{cached_manifest['sourceHash']}.json", 'derived-neighbor-camera-manifest')
        else:
            copy(image['manifestPath'], f"raw/panorama-{cached_manifest['sourceHash']}.json", 'original-cached-processing-manifest')
        copy(image['path'], f"processed/{image['tier']}.jpg", 'derived-cached-perspective', image['sha256'], panoramaId=view['panoramaId'])
    for suffix in ['source-admission', 'survey', 'recipe-input']:
        copy(refs / f'{model}-{suffix}.json', f'processed/{model}-{suffix}.json', 'derived-authoring-input')
    for name in filter(None, args.reviews.split(',')):
        copy(refs / name, f'processed/{name}', 'bounded-review')
    generation = admission['sourceProvenance']['registerGeneration']
    register_source = Path('/Users/blackmad/Code/map-recall2-source-data') / generation / 'normalized' / 'records.json.gz'
    if not register_source.exists():
        raise ValueError('Referenced private register generation missing')
    for n in [entry['address'].split()[-1]]:
        stage = Path(args.stage)
        copy(stage / f'{n}-register.json', 'processed/register-extract.json', 'derived-register-extract')
        near_source = stage / f'{n}-near-perspective.jpg'
        if not near_source.is_file():
            # Current preparation selects a recorded full/ground tier; older
            # stages used the separate legacy near-perspective filename.
            near_source = Path(admission['houses'][0]['sources']['nearImage'])
        copy(near_source, 'processed/near-perspective.jpg', 'derived-perspective')
    manifest = dict(schemaVersion=1, modelId=model, pandId=entry['cachedOwnerId'], archivedAt=prior['archivedAt'] if prior else datetime.now(timezone.utc).isoformat(), remoteSync='pending', registerOriginalGeneration=generation, registerOriginalSha256=digest(register_source.read_bytes()), rawRegisterPageAccess='No new page fetch; extract derived from existing private generation', beeldbankAccess='No new fetch; unresolved archive questions deferred', files=files)
    manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
    changed.append(str(manifest_path.relative_to(destination)))
    readme = pack / 'README.md'
    readme.write_text(f'# {entry["address"]}\n\nCanonical Pand {entry["cachedOwnerId"]}. Cached originals and processed inputs are separated in manifest.json. No current page retrieval, calibration, rights clearance or production acceptance is implied. Remote sync pending.\n')
    changed.append(str(readme.relative_to(destination)))
print(json.dumps(dict(models=len(inventory['entries']), verifiedFiles=verified, changedPaths=changed)))
