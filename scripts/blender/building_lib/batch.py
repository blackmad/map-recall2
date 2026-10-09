"""Portable IR loading, evidence binding, and resumable build bookkeeping."""
import hashlib
import json
import math
import re
from pathlib import Path


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, allow_nan=False).encode()).hexdigest()


def load_inputs(recipe_dir, ir_paths=(), manifest_path=None):
    """Explicit inputs replace the default catalog. Manifest paths are relative."""
    paths = [Path(p) for p in ir_paths]
    if manifest_path:
        manifest_path = Path(manifest_path).resolve()
        manifest = json.loads(manifest_path.read_text())
        if manifest.get('schemaVersion') != 1 or not isinstance(manifest.get('recipes'), list):
            raise ValueError('Batch manifest requires schemaVersion: 1 and recipes: [path, ...]')
        for path in manifest['recipes']:
            if not isinstance(path, str):
                raise ValueError('Manifest recipe entries must be file paths')
            paths.append(manifest_path.parent / path)
    explicit = bool(ir_paths) or manifest_path is not None
    if not explicit:
        paths = sorted(Path(recipe_dir).glob('*.json'))
    records = []
    seen = set()
    for path in paths:
        path = path.resolve()
        try:
            recipe = json.loads(path.read_text())
            identifier = recipe.get('id') if isinstance(recipe, dict) else None
            if not isinstance(identifier, str) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]*', identifier):
                raise ValueError('Recipe id must be a safe filename identifier')
            if identifier in seen:
                raise ValueError(f'Duplicate recipe id: {identifier}')
            seen.add(identifier)
            records.append({'path': str(path), 'id': identifier, 'recipe': recipe})
        except (OSError, ValueError, TypeError) as error:
            records.append({'path': str(path), 'id': None, 'errors': [str(error)]})
    return records, explicit


def evidence_for(recipe, evidence_root):
    if recipe.get('synthetic'):
        return {}
    root = Path(evidence_root).resolve()
    relative = recipe.get('sourceBundle')
    if not isinstance(relative, str) or not relative:
        raise ValueError('Real building requires sourceBundle')
    path = (root / relative).resolve()
    if not path.is_relative_to(root):
        raise ValueError('Evidence bundle must be inside evidence root')
    bundle = json.loads(path.read_text())
    if bundle.get('ownerId') != recipe.get('buildingId') or not recipe.get('buildingId'):
        raise ValueError('Evidence owner does not match buildingId')
    if bundle.get('geometryRevision') != recipe.get('geometryRevision') or not recipe.get('geometryRevision'):
        raise ValueError('Evidence geometry revision does not match recipe')
    physical = bundle.get('physicalFacade')
    placement = recipe.get('placement')
    observed = physical.get('frontage') if isinstance(physical, dict) else None
    authored = placement.get('frontageLocal') if isinstance(placement, dict) else None
    def valid_frontage(value):
        return isinstance(value, list) and len(value) == 2 and all(
            isinstance(point, list) and len(point) == 2 and all(
                isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) for v in point)
            for point in value) and math.dist(*value) > 0
    if not valid_frontage(observed) or not valid_frontage(authored):
        raise ValueError('Evidence and placement require ordered physical frontage endpoints')
    if max(math.dist(a,b) for a,b in zip(observed, authored)) > .04:
        raise ValueError('Evidence physical frontage does not match ordered placement frontage')
    frame=placement.get('sourceRDFrame')
    if frame is not None:
        plane=physical.get('plane')
        endpoints=[plane.get(key) for key in ('start','end')] if isinstance(plane,dict) else []
        rdpoints=[[p.get('x'),p.get('y')] for p in endpoints] if len(endpoints)==2 and all(isinstance(p,dict) for p in endpoints) else None
        if not valid_frontage(rdpoints):
            raise ValueError('Source RD frame requires bound physicalFacade.plane endpoints')
        if not isinstance(frame,dict) or frame.get('buildingId')!=recipe['buildingId'] or frame.get('geometryRevision')!=recipe['geometryRevision']:
            raise ValueError('Source RD frame owner/revision does not match evidence')
        anchor=frame.get('anchorRD');axis=frame.get('xAxisRD')
        finite_pair=lambda p:isinstance(p,list) and len(p)==2 and all(isinstance(v,(int,float)) and not isinstance(v,bool) and math.isfinite(v) for v in p)
        if not finite_pair(anchor) or not finite_pair(axis):raise ValueError('Source RD frame requires finite anchor and axis')
        projected=[anchor,[anchor[k]+axis[k]*math.dist(*authored) for k in (0,1)]]
        if max(math.dist(a,b) for a,b in zip(projected,rdpoints))>.04:
            raise ValueError('Source RD frame does not match ordered physicalFacade.plane')
    return bundle


def fingerprint(recipe, bundle, library_hash, rendered=False):
    return digest({'recipe': recipe, 'evidence': bundle, 'library': library_hash, 'rendered': rendered})


def can_resume(record, key, output_root, artifact_root):
    if record.get('status') != 'built' or record.get('fingerprint') != key:
        return False
    identifier = record['id']
    expected = [Path(output_root) / (identifier + '.glb'), Path(artifact_root) / (identifier + '.blend')]
    files = record.get('files', {})
    return all(str(path.resolve()) in files for path in expected) and all(
        Path(path).is_file() and value == hashlib.sha256(Path(path).read_bytes()).hexdigest()
        for path, value in files.items()) and all(Path(path).is_file() for path in record.get('renders', []))


def atomic_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(value, indent=2, allow_nan=False) + '\n')
    temporary.replace(path)
