// Export each street-furniture model once as a GLB and write the catalogue the galleries read (lane #170):
//
//   npx tsx scripts/street-furniture/export-models.ts [--extract=public/data/extracts/amsterdam/street-furniture]
//
// Writes public/canal-drive/models/street-furniture/<id>.glb (vertex colours, flat normals, one material; slot faces
// in a representative instance colour) and public/canal-drive/street-furniture/catalogue.json: id, name, kind, modelUrl,
// triangles, instances placed (from the published extract through placement.ts, the ride's own rules), source,
// measurements and the panorama each was measured from. Deterministic: no timestamps beyond the extract's retrievedAt.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { Document, NodeIO } from '@gltf-transform/core';
import { FURNITURE_MODELS, FURNITURE_MODEL_IDS, isSlot, linearOf, type FurnitureModelId } from '../../src/canalRecall/streetFurniture/models.ts';
import { instancesOf } from '../../src/canalRecall/streetFurniture/placement.ts';
import { STREET_FURNITURE_TONES as T } from '../../src/canalRecall/look/palette.ts';

const arg = (n: string, d: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const MODELS_DIR = 'public/canal-drive/models/street-furniture', CATALOGUE = 'public/canal-drive/street-furniture/catalogue.json';
const thumb = (pano: string, heading: number) => `https://api.data.amsterdam.nl/panorama/thumbnail/${pano}/?heading=${heading}&width=600&aspect=1.25&horizon=0.4`;

type Entry = { name: string; kind: string; subtypes: string; source: string; measured: string[]; prior: string[]; photo: { panoId: string; heading: number; distanceM: number; recordId: string } | null; slotSample: string | null };
/** What each model is, where its numbers come from (scripts/street-furniture/measure.ts readings, models.ts header). */
export const ENTRIES: Record<FurnitureModelId, Entry> = {
  container: { name: 'Underground container top (rest drum)', kind: 'container', subtypes: 'rest, gft, textiel; BGT afvalbak columns as unknown', source: 'Gemeente Amsterdam huishoudelijkafval register (active, UNDERGROUND) + BGT bak/afvalbak; the Amsterdam Standaard column (#212)',
    measured: ['column 1.19 m (1.16-1.22 m, four panoramas)', '0.86 m wide with a 0.50 m flat front panel between angled corner strips, 0.80 m deep (face-on panoramas, 2026-11-07)', 'stainless drum in the front slope between the corner strips', 'fraction band 0.15 m on the slope; lift shaft in the fraction colour', 'lift mushroom 0.35 m', 'floor plate 1.56 m', 'body NCS 7000 graphite #56595b'],
    prior: ['chamfer run 0.30 m', 'column set 0.15 m behind the plate centre', 'GFT green and textile red bands'], photo: { panoId: 'recording_2025-06-18_08-56-14_01425', heading: 338, distanceM: 6.74, recordId: 'afval-102570' }, slotSample: T.fraction.rest },
  'container-glas': { name: 'Underground container top (glass)', kind: 'container', subtypes: 'glas', source: 'Gemeente Amsterdam huishoudelijkafval register: fractieOmschrijving Glas (#212)',
    measured: ['the same column with one round throw-in hole (~0.20 m) in the slope under the yellow band', 'yellow band and lift shaft'], prior: [], photo: { panoId: 'recording_2025-09-29_09-14-27_01854', heading: 280, distanceM: 6.69, recordId: 'afval-47128' }, slotSample: T.fraction.glas },
  'container-papier': { name: 'Underground container top (paper)', kind: 'container', subtypes: 'papier', source: 'Gemeente Amsterdam huishoudelijkafval register: fractieOmschrijving Papier (#212)',
    measured: ['the same column: wide dark slot on the slope under the blue band, light flap below', 'blue band 0.15 m (57671)'], prior: ['slot 0.38 m wide'], photo: { panoId: 'recording_2025-07-31_07-49-05_00984', heading: 46, distanceM: 7.96, recordId: 'afval-57671' }, slotSample: T.fraction.papier },
  'lamp-lantern': { name: 'Canal lantern', kind: 'lamp', subtypes: 'lantern (Centrum quiet streets and quays)', source: 'BGT paal/lichtmast; style by stadsdeel Centrum and road class (a prior)',
    measured: ['4.09 m to the finial', 'lantern 0.70 x 0.45 m, its bottom at 3.16 m', 'shaft 0.11 m', 'Amsterdam maroon post'], prior: ['base flutes and ladder bar simplified'], photo: { panoId: 'recording_2025-06-16_04-42-37_03213', heading: 321, distanceM: 7.79, recordId: 'bgt-G0363.332362d06b3648abbece87d34bc4ab9b' }, slotSample: null },
  'lamp-pole': { name: 'Hooked lamp pole', kind: 'lamp', subtypes: 'pole (everywhere else; height by road class)', source: 'BGT paal/lichtmast',
    measured: ['7.6 m to the curl on a residential Pijp street', 'arm reach 1.0 m', 'bowl 0.36 m', 'light grey'], prior: ['height by road class: 5 m paths to 10 m primary roads', 'straight-arm modern poles drawn as the hook'], photo: { panoId: 'recording_2025-09-29_07-24-00_00797', heading: 284, distanceM: 7.76, recordId: 'bgt-G0363.3976ec9ccc8549d7ad9f679605241811' }, slotSample: null },
  bin: { name: 'Litter bin', kind: 'bin', subtypes: '-', source: 'none: no open register places Amsterdam litter bins (BGT afvalbak rows are container columns)',
    measured: ['1.11 x 0.57 m beside the Nassaukade abri'], prior: ['octagonal drum, domed lid'], photo: { panoId: '2025_10_02_06_52_49_00943', heading: 88, distanceM: 7.75, recordId: 'bgt-G0363.1a551ad5ace6464cacf11049a76751d4' }, slotSample: null },
  'bike-rack': { name: 'Bike hoop (nietje)', kind: 'bike-rack', subtypes: 'fietsenrek', source: 'BGT straatmeubilair/fietsenrek (107 points city-wide)',
    measured: [], prior: ['0.75 x 0.70 m hoop', 'five hoops 0.9 m apart per point'], photo: null, slotSample: null },
  abri: { name: 'Tram and bus shelter (abri)', kind: 'abri', subtypes: 'abri', source: 'BGT straatmeubilair/abri',
    measured: ['2.47 m high', '4.11 m long (two bays)', 'ad panel 1.27 x 1.78 m'], prior: ['depth 1.4 m', 'glass left open (rails only)'], photo: { panoId: '2025_10_02_06_52_49_00943', heading: 88, distanceM: 7.75, recordId: 'bgt-G0363.1a551ad5ace6464cacf11049a76751d4' }, slotSample: T.posters[1] },
  'ad-column': { name: 'Advertising column (reclamezuil)', kind: 'ad-column', subtypes: 'reclamezuil', source: 'BGT straatmeubilair/reclamezuil',
    measured: ['4.6-4.8 m to the finial', 'body 1.9-2.0 m across', 'cornice band and roof 0.87 m', 'grey-green roof'], prior: ['poster tone per column from six sampled posters'], photo: { panoId: 'recording_2025-06-16_03-46-32_00582', heading: 6, distanceM: 6.63, recordId: 'bgt-G0363.36dae26f0b4143d19e2e55b0b92045b3' }, slotSample: T.posters[2] },
};

async function writeGlb(id: FurnitureModelId, slotHex: string | null): Promise<{ bytes: number; triangles: number }> {
  const m = FURNITURE_MODELS[id](), doc = new Document(), buffer = doc.createBuffer();
  const colours = Float32Array.from(m.colours), slot = slotHex ? linearOf(slotHex) : [0.5, 0.5, 0.5];
  for (let i = 0; i < colours.length; i += 3) if (isSlot(colours[i], colours[i + 1], colours[i + 2])) colours.set(slot, i);
  // glTF is y-up: the model's z-up metres turn to (x, z, -y).
  const pos = new Float32Array(m.positions.length);
  for (let i = 0; i < pos.length; i += 3) { pos[i] = m.positions[i]; pos[i + 1] = m.positions[i + 2]; pos[i + 2] = -m.positions[i + 1]; }
  const nrm = new Float32Array(pos.length);
  for (let i = 0; i < pos.length; i += 9) {
    const ax = pos[i + 3] - pos[i], ay = pos[i + 4] - pos[i + 1], az = pos[i + 5] - pos[i + 2], bx = pos[i + 6] - pos[i], by = pos[i + 7] - pos[i + 1], bz = pos[i + 8] - pos[i + 2];
    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    for (let k = 0; k < 3; k++) nrm.set([nx, ny, nz], i + k * 3);
  }
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(pos).setBuffer(buffer))
    .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(nrm).setBuffer(buffer))
    .setAttribute('COLOR_0', doc.createAccessor().setType('VEC3').setArray(colours).setBuffer(buffer))
    .setMaterial(doc.createMaterial('street-furniture').setRoughnessFactor(0.82).setMetallicFactor(0));
  const mesh = doc.createMesh(id).addPrimitive(prim);
  doc.createScene(id).addChild(doc.createNode(id).setMesh(mesh));
  const glb = await new NodeIO().writeBinary(doc);
  writeFileSync(`${MODELS_DIR}/${id}.glb`, glb);
  return { bytes: glb.byteLength, triangles: m.triangles };
}

async function main(): Promise<void> {
  const dir = arg('extract', 'public/data/extracts/amsterdam/street-furniture');
  const index = JSON.parse(readFileSync(`${dir}/index.json`, 'utf8'));
  const placed: Record<string, number> = {};
  for (const f of readdirSync(`${dir}/tiles`)) for (const r of JSON.parse(gunzipSync(readFileSync(`${dir}/tiles/${f}`)).toString()).items) for (const i of instancesOf(r)) placed[i.model] = (placed[i.model] ?? 0) + 1;
  mkdirSync(MODELS_DIR, { recursive: true }); mkdirSync('public/canal-drive/street-furniture', { recursive: true });
  const models = [];
  for (const id of FURNITURE_MODEL_IDS) {
    const e = ENTRIES[id], g = await writeGlb(id, e.slotSample);
    models.push({ id, name: e.name, kind: e.kind, category: 'street-furniture', subtypes: e.subtypes, modelUrl: `./models/street-furniture/${id}.glb`, triangles: g.triangles, glbBytes: g.bytes,
      instances: placed[id] ?? 0, source: e.source, measured: e.measured, prior: e.prior,
      photo: e.photo ? { ...e.photo, thumbnail: thumb(e.photo.panoId, e.photo.heading), licence: 'Gemeente Amsterdam panoramas, CC BY 4.0' } : null });
  }
  const catalogue = { version: 1, category: 'street-furniture', generator: 'scripts/street-furniture/export-models.ts', extract: 'public/data/extracts/amsterdam/street-furniture', extractRetrievedAt: index.retrievedAt,
    instances: models.reduce((s, m) => s + m.instances, 0), models };
  writeFileSync(CATALOGUE, JSON.stringify(catalogue, null, 1) + '\n');
  for (const m of models) console.log(`${m.id.padEnd(13)} ${String(m.triangles).padStart(4)} tris ${String(m.glbBytes).padStart(6)} B  ${String(m.instances).padStart(7)} placed`);
  console.log(`wrote ${CATALOGUE}: ${catalogue.instances} instances`);
}
void main();
