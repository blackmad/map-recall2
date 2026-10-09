"""Select a physical owner from reciprocal official records, never from proximity."""
import re


def resolve_cached_owner(selected, pand_records, explicit_id=None):
    parents = {url.rsplit('/', 1)[-1] for _, vbo in selected
               for url in vbo['properties'].get('pand.href', [])}
    if explicit_id is None and len(parents) != 1:
        raise ValueError('Address has no unique current cached Pand parent')
    if explicit_id is not None and not re.fullmatch(r'\d{16}', explicit_id):
        raise ValueError('Explicit owner requires an official16digit Pand ID')
    matches = [(path, pand) for path, pand in pand_records
               if pand['id'] in parents and pand['properties']['status'] == 'Pand in gebruik'
               and (explicit_id is None or pand['properties']['identificatie'] == explicit_id)]
    if not matches or any(pand != matches[0][1] for _, pand in matches):
        raise ValueError('Missing or ambiguous current cached Pand within address parents')
    path, pand = matches[0]
    relevant = [(p, v) for p, v in selected if pand['id'] in
                {url.rsplit('/', 1)[-1] for url in v['properties'].get('pand.href', [])}]
    children = {url.rsplit('/', 1)[-1] for url in pand['properties'].get('verblijfsobject.href', [])}
    if not relevant or any(v['id'] not in children for _, v in relevant):
        raise ValueError('Official address/Pand join is not reciprocal')
    return path, pand, relevant, sorted(parents)
