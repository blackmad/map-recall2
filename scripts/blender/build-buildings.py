"""Validate and compile versioned building IR, singly or in resumable batches."""
import argparse
import hashlib
import json
import shutil
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LIBRARY = Path(__file__).parent / 'building_lib'
sys.path.insert(0, str(Path(__file__).parent))
from building_lib import VERSION
from building_lib.schema import validate
from building_lib.batch import atomic_json, can_resume, evidence_for, fingerprint, load_inputs
from building_lib.ir import resolve


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--building', action='append', default=[])
    parser.add_argument('--all', action='store_true')
    parser.add_argument('--ir', action='append', default=[], help='External recipe JSON; repeatable')
    parser.add_argument('--manifest', help='Version 1 manifest with recipes: [relative/path.json]')
    parser.add_argument('--resume', action='store_true')
    parser.add_argument('--validate-only', action='store_true')
    parser.add_argument('--render', action='store_true')
    parser.add_argument('--gallery', action='store_true')
    parser.add_argument('--evidence-root', default=str(ROOT / 'public/canal-drive/models/building-library/evidence'))
    parser.add_argument('--output-root', default=str(ROOT / 'public/canal-drive/models/building-library'))
    parser.add_argument('--artifact-root', default=str(ROOT / 'artifacts/building-library'))
    args = parser.parse_args(argv)
    records, explicit = load_inputs(LIBRARY / 'recipes', args.ir, args.manifest)
    if not (explicit or args.all or args.building or args.gallery):
        parser.error('Choose --building ID, --all, --ir FILE, --manifest FILE, or --gallery')
    known = {r['id'] for r in records}
    if set(args.building) - known:
        parser.error('Unknown building ID: ' + ', '.join(sorted(set(args.building) - known)))
    chosen = [r for r in records if args.all or (explicit and not args.building) or r['id'] in args.building]
    if not chosen and not args.gallery:
        parser.error('No recipes selected')
    # Malformed default-catalog files cannot silently disappear during --all.
    for record in chosen:
        if record.get('errors'):
            continue
        try:
            record['recipe'] = resolve(record['recipe'])
            errors = validate(record['recipe'])
            if errors:
                record['errors'] = errors
            else:
                record['bundle'] = evidence_for(record['recipe'], args.evidence_root)
        except (ValueError, KeyError, TypeError, OSError, IndexError, AssertionError) as error:
            record['errors'] = [str(error)]
    failed = [r for r in chosen if r.get('errors')]
    if args.validate_only:
        print(json.dumps({'valid': len(chosen) - len(failed), 'libraryVersion': VERSION,
                          'ids': [r['id'] for r in chosen if not r.get('errors')],
                          'failures': [{k: r[k] for k in ('path', 'id', 'errors')} for r in failed],
                          'evidenceCoverage': {r['id']: r.get('bundle', {}).get('coverage', []) for r in chosen if not r.get('errors')}}, indent=2))
        return 1 if failed else 0

    import bpy
    from building_lib.archetypes import build, source_overlay
    from building_lib.export import save_and_export
    from building_lib.review import render
    from building_lib.materials.blender import STATS
    out, art = Path(args.output_root).resolve(), Path(args.artifact_root).resolve()
    out.mkdir(parents=True, exist_ok=True)
    art.mkdir(parents=True, exist_ok=True)
    cache = ROOT / '.cache/blender-building-materials'
    manifest_file = out / 'manifest.json'
    manifest = json.loads(manifest_file.read_text()) if manifest_file.exists() else {
        'version': 1, 'units': 'metres', 'axes': 'glTF x=along frontage,y=up,z=towards street', 'models': []}
    state_file = art / 'batch-state.json'
    state = json.loads(state_file.read_text()) if state_file.exists() else {'schemaVersion': 1, 'buildings': {}}
    library_hash = hashlib.sha256(Path(__file__).read_bytes() + b''.join(
        p.read_bytes() for p in sorted(LIBRARY.rglob('*.py'))) + (LIBRARY / 'materials/catalog.json').read_bytes()).hexdigest()
    outcomes = []
    for record in chosen:
        identifier = record['id']
        state_key = identifier or record['path']
        if record.get('errors'):
            outcome = {'id': identifier, 'path': record['path'], 'status': 'failed-validation', 'errors': record['errors']}
            state['buildings'][state_key] = outcome
            outcomes.append(outcome)
            atomic_json(state_file, state)
            continue
        recipe, bundle = record['recipe'], record['bundle']
        key = fingerprint(recipe, bundle, library_hash, args.render)
        prior = state['buildings'].get(state_key, {})
        if args.resume and can_resume(prior, key, out, art):
            # Restore the public index if removed independently of model files.
            result = prior['result']
            manifest['models'] = [m for m in manifest['models'] if m['id'] != identifier] + [result]
            atomic_json(manifest_file, manifest)
            outcomes.append({'id': identifier, 'status': 'resumed'})
            print('BUILD_RESUMED ' + identifier, flush=True)
            continue
        started = time.perf_counter()
        try:
            # Complete exports and renders in staging before replacing prior assets.
            with tempfile.TemporaryDirectory(prefix='building-', dir=art) as staging:
                stage = Path(staging)
                stage_out, stage_art = stage / 'models', stage / 'artifacts'
                stage_out.mkdir(); stage_art.mkdir()
                objects = build(recipe, cache)
                source_overlay(recipe)
                result = save_and_export(recipe, objects, stage_out, stage_art)
                result.update(libraryVersion=VERSION, libraryHash=library_hash,
                              style=recipe.get('style','simple'),
                              recipeUrl='./models/building-library/' + identifier + '.recipe.json',
                              recipeHash=hashlib.sha256(json.dumps(recipe, sort_keys=True).encode()).hexdigest(),
                              evidenceBundleHash=hashlib.sha256(json.dumps(bundle, sort_keys=True).encode()).hexdigest(),
                              buildSeconds=time.perf_counter() - started, materialCache=dict(STATS),
                              evidenceCoverage=bundle.get('coverage', []))
                atomic_json(stage_out / (identifier + '.recipe.json'), recipe)
                if args.render:
                    render_started = time.perf_counter()
                    render(recipe, stage_art)
                    result['renderSeconds'] = time.perf_counter() - render_started
                for directory, destination in ((stage_out, out), (stage_art, art)):
                    for file in directory.iterdir():
                        if file.is_file():
                            shutil.move(str(file), destination / file.name)
            manifest['models'] = [m for m in manifest['models'] if m['id'] != identifier] + [result]
            atomic_json(manifest_file, manifest)
            files = [out / (identifier + '.glb'), art / (identifier + '.blend'), out / (identifier + '.recipe.json')]
            if args.render:
                files.extend(art / (identifier + '-' + view + '.png') for view in ('front','oblique','roof','ground'))
            outcome = {'id': identifier, 'path': record['path'], 'status': 'built', 'fingerprint': key,
                       'files': {str(p): hashlib.sha256(p.read_bytes()).hexdigest() for p in files},
                       'renders': [str(art / (identifier + '-' + view + '.png')) for view in ('front', 'oblique', 'roof', 'ground')] if args.render else [],
                       'result': result}
            print('BUILD_RESULT ' + json.dumps({k: result[k] for k in ('id', 'triangles', 'drawCalls', 'bytes', 'buildSeconds')}), flush=True)
        except Exception as error:
            outcome = {'id': identifier, 'path': record['path'], 'status': 'failed-build', 'errors': [str(error)]}
            print('BUILD_FAILED ' + json.dumps(outcome), flush=True)
        state['buildings'][state_key] = outcome
        outcomes.append(outcome)
        atomic_json(state_file, state)
    if args.gallery:
        from building_lib.gallery import build as gallery_build
        recipe = {'id': 'material-gallery', 'name': 'Material / component gallery', 'synthetic': True,
                  'height': 3, 'footprint': [[0, 0], [24, 0], [24, 12], [0, 12]], 'frontages': [{'width': 24}],
                  'storeys': [{'id': 'ground', 'bottom': 0, 'top': 3}], 'assumptions': ['Synthetic material samples.']}
        manifest['gallery'] = save_and_export(recipe, gallery_build(cache), out, art)
        atomic_json(manifest_file, manifest)
    (out / 'material-catalog.json').write_text((LIBRARY / 'materials/catalog.json').read_text())
    from building_lib.component_catalog import catalog as component_catalog
    atomic_json(out / 'component-catalog.json', component_catalog())
    report = {'schemaVersion': 1, 'libraryHash': library_hash,
              'built': sum(r['status'] == 'built' for r in outcomes),
              'resumed': sum(r['status'] == 'resumed' for r in outcomes),
              'failed': sum(r['status'].startswith('failed') for r in outcomes),
              'outcomes': [{k: v for k, v in r.items() if k != 'result'} for r in outcomes]}
    atomic_json(art / 'batch-report.json', report)
    print('BATCH_RESULT ' + json.dumps({k: report[k] for k in ('built', 'resumed', 'failed')}), flush=True)
    return 1 if report['failed'] else 0


if __name__ == '__main__':
    code = main(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:])
    if code:
        raise SystemExit(code)
