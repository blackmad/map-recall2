#!/usr/bin/env python3
"""Cache official BAG relations and reproduce a bounded street-group inventory.

No spatial nearest-address assignment. Native geometries retain every ring.
Default emits pending requests for root-owned acquisition. --fetch enables curl.
"""
import argparse
import datetime
import gzip
import hashlib
import json
from pathlib import Path
import subprocess
import urllib.parse

ROOT = Path(__file__).resolve().parents[2]
ARCHIVE_RELATIVE = 'streets/jan-evertsen-canopy-rollout-20261006'
ARCHIVE = ROOT.parent / 'map-recall2-source-data' / ARCHIVE_RELATIVE
CACHE = ARCHIVE / 'raw/bag'
OUTPUT = ROOT / 'docs/references/jan-evertsen-pilot/bag-rollout-inventory.json'
CONTROL = OUTPUT.parent
BASE = 'https://api.data.amsterdam.nl/v1/bag/'
PILOTS = ['0363100012118917', '0363100012096187', '0363100012088014', '0363100012072380', '0363100012096804']
GROUPS = [('jan-evertsen-even-west', 94, 140), ('jan-evertsen-even-east', 68, 92), ('jan-evertsen-odd-west', 91, 123), ('jan-evertsen-odd-east', 59, 89)]

def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()

def sha(data):
    return hashlib.sha256(data).hexdigest()

def links(obj, field):
    value = obj.get('_links', {}).get(field, [])
    return value if isinstance(value, list) else [value] if value else []

def rows(data, name):
    return data.get('_embedded', {}).get(name, []) if data else []

def url(table, **params):
    return BASE + table + '?' + urllib.parse.urlencode(params)

def positions(coordinates):
    if coordinates and isinstance(coordinates[0], (int, float)):
        yield coordinates[:2]
    else:
        for child in coordinates:
            yield from positions(child)

class Sources:
    def __init__(self, offline, limit, read_only=False):
        self.offline, self.limit, self.count = offline, limit, 0
        self.read_only = read_only
        self.manifest_path = CONTROL / 'bag-source-provenance.json'
        original_manifest = CACHE / 'provenance.json'
        if not original_manifest.exists():
            original_manifest = ARCHIVE / 'processed/bag/provenance.json'
        if not original_manifest.exists():
            original_manifest = self.manifest_path
        self.manifest = json.loads(original_manifest.read_text()) if original_manifest.exists() else {'schemaVersion': 1, 'sources': {}, 'attempts': []}
        self.pending = []
        self.expanded = {}
        if not read_only:
            CACHE.mkdir(parents=True, exist_ok=True)
        for path in CACHE.glob('*.json'):
            if path.name in ('provenance.json', 'pending-requests.json'):
                continue
            try:
                self.ingest(json.loads(path.read_text()), path.name)
            except (ValueError, OSError):
                pass

    def ingest(self, data, source_file):
        if not isinstance(data, dict):
            return
        self_links = links(data, 'self')
        if self_links and data.get('identificatie'):
            address = self_links[0]['href']
            self.expanded[address] = data
            self.manifest.setdefault('embeddedSources', {})[address] = {'originalFile': source_file, 'originalSHA256': sha((CACHE / source_file).read_bytes())}
        for value in data.get('_embedded', {}).values():
            for child in value if isinstance(value, list) else [value]:
                self.ingest(child, source_file)

    def get(self, address):
        key = sha(address.encode())[:20]
        record = self.manifest['sources'].get(address)
        path = CACHE / (record['file'] if record else key + '.json')
        if path.exists():
            try:
                data = json.loads(path.read_text())
                if not record:
                    self.manifest['sources'][address] = {'file': path.name, 'sha256': sha(path.read_bytes()), 'access': 'cached-original-response', 'recordedAt': now()}
                self.ingest(data, path.name)
                return data
            except (ValueError, OSError):
                pass
        if address in self.expanded:
            return self.expanded[address]
        if self.offline or self.count >= self.limit:
            self.pending.append(address)
            return None
        self.count += 1
        started = now()
        temporary = path.with_suffix('.download')
        process = subprocess.run(['curl', '--retry', '4', '--retry-all-errors', '--retry-delay', '2', '--connect-timeout', '12', '--max-time', '45', '-fsSL', address, '-o', str(temporary)], capture_output=True, text=True)
        attempt = {'url': address, 'attemptedAt': started, 'completedAt': now(), 'curlExitCode': process.returncode, 'retryPolicy': '4 retries, all errors, bounded 2 second delay'}
        try:
            if process.returncode:
                raise ValueError(process.stderr.strip()[-1800:])
            data = json.loads(temporary.read_text())
            temporary.replace(path)
            self.manifest['sources'][address] = {'file': path.name, 'sha256': sha(path.read_bytes()), 'access': 'acquired-original-response', 'acquiredAt': now()}
            self.ingest(data, path.name)
            attempt['access'] = 'success'
            print('acquired', address, flush=True)
            return data
        except (OSError, ValueError) as error:
            attempt.update(access='request-failed-retry-on-later-pass', error=str(error))
            self.pending.append(address)
            temporary.unlink(missing_ok=True)
            print('pending', address, str(error)[:120], flush=True)
            return None
        finally:
            self.manifest['attempts'].append(attempt)
            self.save()

    def save(self):
        self.manifest_path.write_text(json.dumps(self.manifest, indent=2) + '\n')

def native_inventory():
    """Installed corridor tiles, indexed by genuine extract identity."""
    result = {}
    # This corridor lies within these tiles; include adjacent columns for group ends.
    for x in range(8411, 8414):
        path = ROOT / f'public/data/extracts/amsterdam/building-tiles/14/{x}/5384.geojson.gz'
        if not path.exists():
            continue
        checksum = sha(path.read_bytes())
        for feature in json.loads(gzip.decompress(path.read_bytes()))['features']:
            identifier = feature.get('properties', {}).get('id')
            if identifier:
                result[identifier] = {'sourcePath': str(path.relative_to(ROOT)), 'sourceSHA256': checksum, 'properties': feature['properties'], 'geometry': feature['geometry'], 'nativeScale': 1}
    return result

def main():
    global CACHE
    parser = argparse.ArgumentParser()
    parser.add_argument('--offline', action='store_true')
    parser.add_argument('--fetch', action='store_true')
    parser.add_argument('--max-requests', type=int, default=250)
    parser.add_argument('--pilot-only', action='store_true')
    parser.add_argument('--cache', '--cache-dir', dest='cache_dir', type=Path, help='Explicit cache directory override; default is the canonical companion raw/bag directory.')
    parser.add_argument('--read-only-cache', action='store_true', help='Reuse companion originals without writing their provenance or fetching.')
    args = parser.parse_args()
    if args.fetch and not args.cache_dir:
        parser.error('Fetching requires an explicit --cache staging directory; the canonical companion cache is read-only.')
    if args.cache_dir:
        CACHE = args.cache_dir.resolve()
    if not args.cache_dir and not CACHE.is_dir():
        parser.error('Companion source pack is missing. Fetch source commit cb1a9905bdc5067fc742de741aeb5c88b460567a in map-recall2-source-data, or pass --cache-dir pointing to its raw/bag directory. Existing inventory was not changed.')
    source = Sources(args.offline or args.read_only_cache or not args.fetch, args.max_requests, args.read_only_cache or not args.cache_dir)
    natives = native_inventory()
    pilot_source = ROOT / 'artifacts/canopy-rollout/raw/bag-pilot-retry.json'
    seed = rows(json.loads(pilot_source.read_text()), 'panden') if pilot_source.exists() else []
    seed_by_id = {item['identificatie']: item for item in seed}
    pilots = []
    for identifier in PILOTS:
        embedded_pand = next((obj for href, obj in source.expanded.items() if '/panden/' in href and obj.get('identificatie') == identifier and not obj.get('eindGeldigheid') and not obj.get('datumActueelTot')), None)
        direct_url = BASE + 'panden/' + identifier
        direct_path = CACHE / (sha(direct_url.encode())[:20] + '.json')
        pand = source.get(direct_url) if direct_path.exists() else seed_by_id.get(identifier) or embedded_pand or source.get(direct_url)
        record = {'pandId': identifier, 'native': natives.get('NL.IMBAG.Pand.' + identifier), 'addresses': [], 'endedVboVersions': [], 'relationshipState': 'pending'}
        if pand:
            incomplete = False
            record.update(status=pand.get('statusOmschrijving'), year=pand.get('oorspronkelijkBouwjaar'), officialGeometry=pand.get('geometrie'))
            for relation in links(pand, 'bevatVerblijfsobjecten'):
                vbo = source.get(relation['href'])
                if not vbo:
                    incomplete = True
                    continue
                if vbo.get('eindGeldigheid') or vbo.get('datumActueelTot'):
                    record['endedVboVersions'].append({'vboId': vbo['identificatie'], 'volgnummer': vbo.get('volgnummer'), 'eindGeldigheid': vbo.get('eindGeldigheid'), 'datumActueelTot': vbo.get('datumActueelTot'), 'source': relation['href']})
                    continue
                for addr_relation in links(vbo, 'heeftHoofdadres') + links(vbo, 'heeftNevenadres'):
                    address = source.get(addr_relation['href'])
                    if not address:
                        incomplete = True
                        continue
                    street_links = links(address, 'ligtAanOpenbareruimte')
                    street = source.get(street_links[0]['href']) if street_links else None
                    if not street:
                        incomplete = True
                    record['addresses'].append({'vboId': vbo['identificatie'], 'nummeraanduidingId': address['identificatie'], 'street': street.get('naam') if street else None, 'huisnummer': address.get('huisnummer'), 'huisletter': address.get('huisletter'), 'huisnummertoevoeging': address.get('huisnummertoevoeging'), 'postcode': address.get('postcode'), 'vboSource': relation['href'], 'addressSource': addr_relation['href'], 'streetSource': street_links[0]['href'] if street_links else None})
            if record['addresses']:
                record['relationshipState'] = 'official-pand-vbo-address-chain-partial' if incomplete else 'official-pand-vbo-address-chain'
        pilots.append(record)

    addresses, page_complete = [], False
    if not args.pilot_only:
        streets = source.get(url('openbareruimtes', naam='Jan Evertsenstraat', _pageSize=100))
        for street in rows(streets, 'openbareruimtes'):
            if street.get('naam') != 'Jan Evertsenstraat':
                continue
            page_url = url('nummeraanduidingen', **{'ligtAanOpenbareruimte.identificatie': street['identificatie'], 'huisnummer[gte]': 59, 'huisnummer[lte]': 140, '_pageSize': 100, '_expandScope': 'adresseertVerblijfsobject,adresseertVerblijfsobject.ligtInPanden'})
            for _ in range(8):
                page = source.get(page_url)
                if not page:
                    break
                addresses.extend(rows(page, 'nummeraanduidingen'))
                next_links = links(page, 'next')
                if not next_links:
                    page_complete = True
                    break
                page_url = next_links[0]['href']

    groups = []
    for group, low, high in GROUPS:
        by_pand, unresolved = {}, []
        expected = set(range(low, high + 1, 2))
        for address in addresses:
            number = address.get('huisnummer')
            if number not in expected:
                continue
            if address.get('eindGeldigheid') or address.get('datumActueelTot'):
                continue
            related = links(address, 'adresseertVerblijfsobject')
            expanded = address.get('_embedded', {}).get('adresseertVerblijfsobject')
            vbo = expanded if isinstance(expanded, dict) else source.get(related[0]['href']) if related else None
            pand_links = links(vbo, 'ligtInPanden') if vbo else []
            if vbo and (vbo.get('eindGeldigheid') or vbo.get('datumActueelTot')):
                unresolved.append({'huisnummer': number, 'nummeraanduidingId': address['identificatie'], 'reason': 'address-points-to-ended-vbo-version; current-parent-not-admitted'})
                continue
            if not pand_links:
                unresolved.append({'huisnummer': number, 'nummeraanduidingId': address['identificatie'], 'reason': 'official-vbo-pand-chain-pending'})
                continue
            for relation in pand_links:
                identifier = relation['identificatie']
                pand_expanded = vbo.get('_embedded', {}).get('ligtInPanden', [])
                if isinstance(pand_expanded, dict):
                    pand_expanded = [pand_expanded]
                pand = next((p for p in pand_expanded if p.get('identificatie') == identifier), None) or source.get(relation['href'])
                item = by_pand.setdefault(identifier, {'pandId': identifier, 'sourceAddressGroup': group, 'addresses': [], 'native': natives.get('NL.IMBAG.Pand.' + identifier), 'status': pand.get('statusOmschrijving') if pand else None, 'year': pand.get('oorspronkelijkBouwjaar') if pand else None, 'officialGeometry': pand.get('geometrie') if pand else None, 'visualAdmission': 'withheld-current-row-source-and-independent-review-required'})
                item['addresses'].append({'huisnummer': number, 'huisletter': address.get('huisletter'), 'huisnummertoevoeging': address.get('huisnummertoevoeging'), 'nummeraanduidingId': address['identificatie'], 'vboId': vbo['identificatie'], 'pandSource': relation['href'], 'addressSource': links(address, 'self')[0]['href'] if links(address, 'self') else None})
        seen = {a.get('huisnummer') for a in addresses if not a.get('eindGeldigheid') and not a.get('datumActueelTot')}
        groups.append({'id': group, 'label': f'Jan Evertsenstraat {low}–{high}', 'physicalBuildings': list(by_pand.values()), 'resolvedPhysicalBuildingCount': len(by_pand), 'installedNativeBuildingCount': sum(bool(item['native']) for item in by_pand.values()), 'currentNativeIdentityCount': sum(bool(item['native']) and item['status'] == 'Pand in gebruik' for item in by_pand.values()), 'visualEligibleBuildingCount': 0, 'unresolvedAddresses': unresolved, 'unresolvedBaseHouseNumbers': sorted(expected - seen), 'addressPaginationComplete': page_complete})
        points = [point for item in by_pand.values() if item['native'] for point in positions(item['native']['geometry']['coordinates'])]
        groups[-1]['installedNativeBoundsWGS84'] = [min(p[0] for p in points), min(p[1] for p in points), max(p[0] for p in points), max(p[1] for p in points)] if points else None
    # The complete street pages also carry the forward address/VBO/Pand chain.
    # Reuse it when an expanded Pand omits reverse VBO backlinks.
    for pilot in pilots:
        if pilot['addresses']:
            continue
        for group in groups:
            for building in group['physicalBuildings']:
                if building['pandId'] != pilot['pandId']:
                    continue
                pilot['addresses'] = [dict(address, street='Jan Evertsenstraat', streetSource=url('openbareruimtes', naam='Jan Evertsenstraat', _pageSize=100)) for address in building['addresses']]
                pilot['relationshipState'] = 'official-address-vbo-pand-chain'
    output = {'schemaVersion': 1, 'generatedAt': now(), 'status': 'official-identity-discovery-not-visual-admission', 'officialDocumentation': 'https://api.data.amsterdam.nl/v1/docs/datasets/bag%40v1.html', 'provenance': str(source.manifest_path.relative_to(ROOT)) if source.manifest_path.is_relative_to(ROOT) else str(source.manifest_path), 'pilotSeed': {'path': str(pilot_source.relative_to(ROOT)), 'sha256': sha(pilot_source.read_bytes())} if pilot_source.exists() else None, 'geometryPolicy': 'Use exact extract identities; preserve native polygon holes and scale. No nearest-address assignment.', 'pilots': pilots, 'groups': groups, 'pendingSourceRequests': sorted(set(source.pending) - source.expanded.keys()), 'historicalAddress94Claim': 'unverified; contemporary official address relationships must be resolved before attaching a historic source address to pilot'}
    previous = json.loads(OUTPUT.read_text()) if OUTPUT.exists() else {}
    if previous.get('sourceArchive'):
        output['sourceArchive'] = previous['sourceArchive']
    else:
        output['sourceArchive'] = {'repository': 'blackmad/map-recall2-source-data', 'path': ARCHIVE_RELATIVE, 'rawBagPath': ARCHIVE_RELATIVE + '/raw/bag', 'commit': None, 'accessState': 'canonical-source-pack-sync-pending'}
    output['sourceArchive']['rawBagSources'] = [{'path': ARCHIVE_RELATIVE + '/raw/bag/' + path.name, 'sha256': sha(path.read_bytes())} for path in sorted(CACHE.glob('*.json')) if len(path.stem) == 20 and all(c in '0123456789abcdef' for c in path.stem)]
    verified_pilot_numbers = {p['pandId']: sorted({a['huisnummer'] for a in p['addresses'] if a['street'] == 'Jan Evertsenstraat'}) for p in pilots}
    if verified_pilot_numbers[PILOTS[0]]:
        output['historicalAddress94Claim'] = {'status': 'former-pilot-address94-assumption-withdrawn', 'currentOfficialPilotHouseNumbers': {identifier: verified_pilot_numbers[identifier] for identifier in PILOTS[:2]}, 'notes': 'Contemporary official Pand/VBO/address chain identifies pilot126 and124. A historical group94–140 source is a group reference; it does not identify the pilot as house94. Historical renumbering is not asserted.'}
    OUTPUT.write_text(json.dumps(output, indent=2, ensure_ascii=False) + '\n')
    staged_cache = ROOT / 'artifacts/canopy-rollout/bag'
    request_list = [{'url': address, 'outputPath': str(staged_cache / (sha(address.encode())[:20] + '.json'))} for address in output['pendingSourceRequests']]
    CONTROL.mkdir(parents=True, exist_ok=True)
    (CONTROL / 'bag-pending-requests.json').write_text(json.dumps(request_list, indent=2) + '\n')
    source.save()
    print(json.dumps({'pilotsWithAddresses': sum(bool(p['addresses']) for p in pilots), 'resolvedBuildings': sum(g['resolvedPhysicalBuildingCount'] for g in groups), 'pendingRequests': len(output['pendingSourceRequests'])}))

if __name__ == '__main__':
    main()
