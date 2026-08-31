/** Build a queryable SQLite catalog and static pipeline dashboard from cached artifacts. */
import { DatabaseSync } from 'node:sqlite';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

type Point = [number, number];
type Geometry = { type: 'Polygon'; coordinates: Point[][] } | { type: 'MultiPolygon'; coordinates: Point[][][] };
type Feature = { id: string; properties: Record<string, unknown>; geometry: Geometry };
type Item = { buildingId: string; bagId?: string; osmId?: string; panoId: string; observedAt?: string; heading?: number; image: string; panoramaImage?: string; proposal?: Record<string, unknown> };
type Manifest = { generatedAt: string; model?: string; selection?: Record<string, unknown>; items: Item[]; rejections: Array<{ buildingId: string; reason: string }> };
type LabelsFile = { labels?: Array<Record<string, unknown>> };

const arg = (name: string) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(arg('root') || '.cache/building-enrichment');
const bagFile = path.join(root, 'bag-buildings.geojson');
const panoramaDirectory = path.join(root, 'panorama');
const humanFile = arg('human-labels') ? path.resolve(arg('human-labels')!) : undefined;
await mkdir(root, { recursive: true });

const bag = JSON.parse(await readFile(bagFile, 'utf8')) as { metadata?: Record<string, unknown>; features: Feature[] };
const a10 = JSON.parse(await readFile(path.join(root, 'a10-boundary.geojson'), 'utf8')) as { features: Array<{ geometry: { coordinates: Point[][] } }> };
const a10Ring = a10.features[0].geometry.coordinates[0];
const centre = (geometry: Geometry): Point => {
  const points = geometry.type === 'Polygon' ? geometry.coordinates.flat() : geometry.coordinates.flat(2);
  return [points.reduce((sum, p) => sum + p[0], 0) / points.length, points.reduce((sum, p) => sum + p[1], 0) / points.length];
};
const ringContains = ([x, y]: Point, ring: Point[]) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const dam: Point = [4.8936, 52.3728];
const distanceFromDam = ([lon, lat]: Point) => Math.hypot((lon - dam[0]) * Math.cos(lat * Math.PI / 180), lat - dam[1]) * 111_320;
let manifest: Manifest = { generatedAt: new Date().toISOString(), items: [], rejections: [] };
try { manifest = JSON.parse(await readFile(path.join(panoramaDirectory, 'manifest.json'), 'utf8')) as Manifest; } catch { /* panoramas not built */ }
let humanLabels: Array<Record<string, unknown>> = [];
if (humanFile) humanLabels = (JSON.parse(await readFile(humanFile, 'utf8')) as LabelsFile).labels || [];

const databaseFile = path.join(root, 'enrichment.sqlite');
const db = new DatabaseSync(databaseFile);
db.exec(`
  PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;
  DROP TABLE IF EXISTS buildings; DROP TABLE IF EXISTS observations; DROP TABLE IF EXISTS annotations; DROP TABLE IF EXISTS rejections;
  CREATE TABLE buildings (
    building_id TEXT PRIMARY KEY, bag_id TEXT, osm_id TEXT, build_year INTEGER,
    status TEXT, use_type TEXT, priority_region TEXT NOT NULL, distance_from_dam_m REAL NOT NULL,
    geometry_json TEXT NOT NULL, properties_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS observations (
    observation_id TEXT PRIMARY KEY, building_id TEXT NOT NULL, source TEXT NOT NULL,
    observed_at TEXT, heading REAL, image_path TEXT, panorama_path TEXT, metadata_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS annotations (
    building_id TEXT NOT NULL, observation_id TEXT, annotator_type TEXT NOT NULL,
    model TEXT, facade_material TEXT, facade_colour TEXT, roof_material TEXT,
    typology TEXT, facade_visible INTEGER, roof_visible INTEGER, confidence REAL,
    rationale TEXT, accepted_for_now INTEGER NOT NULL DEFAULT 0, annotated_at TEXT,
    payload_json TEXT NOT NULL, PRIMARY KEY (building_id, annotator_type)
  );
  CREATE TABLE IF NOT EXISTS rejections (building_id TEXT PRIMARY KEY, reason TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS annotations_material ON annotations(facade_material);
  CREATE INDEX IF NOT EXISTS annotations_typology ON annotations(typology);
`);
const insertBuilding = db.prepare('INSERT INTO buildings VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
const insertObservation = db.prepare('INSERT INTO observations VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
const insertAnnotation = db.prepare('INSERT INTO annotations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
const insertRejection = db.prepare('INSERT INTO rejections VALUES (?, ?)');
db.exec('BEGIN');
for (const feature of bag.features) {
  const p = feature.properties, id = String(p.buildingId || `bag:${p.identificatie}`);
  const point = centre(feature.geometry), insideA10 = ringContains(point, a10Ring);
  insertBuilding.run(id, p.identificatie ?? null, p.osmId ?? null, p.bouwjaar ?? null, p.status ?? null, p.gebruiksdoel ?? null, insideA10 ? 'inside-a10' : 'outside-a10', distanceFromDam(point), JSON.stringify(feature.geometry), JSON.stringify(p));
}
for (const item of manifest.items) {
  const observationId = `panorama:${item.panoId}:${item.buildingId}`;
  insertObservation.run(observationId, item.buildingId, 'amsterdam-panorama', item.observedAt ?? null, item.heading ?? null, item.image, item.panoramaImage ?? null, JSON.stringify(item));
  if (item.proposal) {
    const p = item.proposal;
    insertAnnotation.run(item.buildingId, observationId, 'model', manifest.model ?? null, p.facadeMaterial ?? null, p.facadeColour ?? null, p.roofMaterial ?? null, p.typology ?? null, p.facadeVisible === true ? 1 : 0, p.roofVisible === true ? 1 : 0, p.confidence ?? null, p.rationale ?? null, 1, manifest.generatedAt, JSON.stringify(p));
  }
}
for (const label of humanLabels) {
  const id = String(label.buildingId || '');
  if (!id) continue;
  insertAnnotation.run(id, label.panoId ? `panorama:${label.panoId}:${id}` : null, 'human', null, label.facadeMaterial ?? null, label.facadeColour ?? null, label.roofMaterial ?? null, label.typology ?? null, null, null, 1, label.notes ?? null, 1, label.reviewedAt ?? null, JSON.stringify(label));
}
for (const rejection of manifest.rejections) insertRejection.run(rejection.buildingId, rejection.reason);
db.exec('COMMIT');

async function directoryBytes(directory: string): Promise<number> {
  let total = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    total += entry.isDirectory() ? await directoryBytes(file) : (await stat(file)).size;
  }
  return total;
}
const distributions = (column: string) => db.prepare(`SELECT COALESCE(${column}, 'unknown') label, COUNT(*) count FROM annotations WHERE annotator_type='model' GROUP BY ${column} ORDER BY count DESC`).all();
const summary = {
  generatedAt: new Date().toISOString(), cacheBytes: await directoryBytes(root), buildings: bag.features.length,
  insideA10Buildings: Number((db.prepare("SELECT COUNT(*) count FROM buildings WHERE priority_region='inside-a10'").get() as { count: number }).count),
  observations: manifest.items.length, modelLabels: manifest.items.filter(item => item.proposal).length,
  humanLabels: humanLabels.length, rejections: manifest.rejections.length, model: manifest.model || null,
  selection: manifest.selection || {}, facadeMaterials: distributions('facade_material'), roofMaterials: distributions('roof_material'), typologies: distributions('typology'),
};
await writeFile(path.join(root, 'summary.json'), JSON.stringify(summary, null, 2));
const samples = manifest.items.slice(-120).reverse().map(item => ({ ...item, panoramaMetadata: undefined, buildingProperties: undefined }));
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Building enrichment pipeline</title><style>
:root{font:15px system-ui;color:#18222c;background:#ece9e2}body{margin:0}header{padding:24px max(20px,5vw);background:#172a36;color:white}main{max-width:1300px;margin:auto;padding:24px}.cards,.charts,.samples{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px}.card,section{background:white;border-radius:12px;padding:18px;box-shadow:0 3px 16px #0001}.number{font-size:32px;font-weight:750}.muted{color:#64717c}.bar{display:grid;grid-template-columns:130px 1fr 45px;gap:8px;align-items:center;margin:8px 0}.track{height:9px;background:#e5e7eb;border-radius:9px}.fill{height:100%;background:#1682a8;border-radius:9px}.samples{grid-template-columns:repeat(auto-fill,minmax(270px,1fr))}.sample{padding:0;overflow:hidden}.sample img{width:100%;height:180px;object-fit:cover;background:#222}.sample div{padding:12px}a{color:#08779d}h2{margin-top:30px}</style></head><body><header><h1>Amsterdam building enrichment</h1><p>Cached evidence → machine proposals → human corrections → training/export catalog</p></header><main><div id="app"></div></main><script>
const s=${JSON.stringify(summary).replaceAll('<', '\\u003c')},samples=${JSON.stringify(samples).replaceAll('<', '\\u003c')};const fmt=n=>new Intl.NumberFormat().format(n),bytes=n=>(n/1024/1024).toFixed(1)+' MB';
const chart=(title,rows)=>'<section><h3>'+title+'</h3>'+rows.map((r,i)=>'<div class="bar"><span>'+r.label+'</span><span class="track"><span class="fill" style="display:block;width:'+Math.round(100*r.count/rows[0].count)+'%"></span></span><b>'+r.count+'</b></div>').join('')+'</section>';
app.innerHTML='<div class="cards">'+[['BAG buildings',fmt(s.buildings)],['Inside A10 priority',fmt(s.insideA10Buildings)],['Panorama observations',fmt(s.observations)],['Machine labels',fmt(s.modelLabels)],['Human corrections',fmt(s.humanLabels)],['Rejected views',fmt(s.rejections)],['Cache size',bytes(s.cacheBytes)]].map(x=>'<div class="card"><div class="number">'+x[1]+'</div><div class="muted">'+x[0]+'</div></div>').join('')+'</div><h2>Label distributions</h2><div class="charts">'+chart('Façade materials',s.facadeMaterials)+chart('Visible roof materials',s.roofMaterials)+chart('Dutch typologies',s.typologies)+'</div><h2>Recent samples</h2><p><a href="panorama/index.html">Open human review UI →</a></p><div class="samples">'+samples.map(x=>'<article class="card sample"><img src="panorama/'+x.image+'"><div><b>'+x.buildingId+'</b><br>'+(x.proposal?x.proposal.facadeMaterial+' / '+x.proposal.facadeColour+' · '+x.proposal.typology:'unclassified')+'<br><span class="muted">'+(x.observedAt||'')+'</span></div></article>').join('')+'</div>';
</script></body></html>`;
await writeFile(path.join(root, 'index.html'), html);
db.close();
process.stdout.write(`Cataloged ${summary.buildings} buildings and ${summary.observations} observations in ${path.relative(process.cwd(), databaseFile)}\n`);
