/** Build a human-reviewable façade dataset from Amsterdam's CC BY 4.0 panoramas.
 * Usage: npm run build:facade-review -- --limit=24 [--model=qwen2.5vl:7b]
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

type Point = [number, number];
type Geometry = { type: 'Polygon'; coordinates: Point[][] } | { type: 'MultiPolygon'; coordinates: Point[][][] };
type Building = { id?: string | number; properties: Record<string, string | number | undefined>; geometry: Geometry };
type Thumbnail = { url: string; heading: number; pano_id: string };
type Proposal = { facadeMaterial: string; facadeColour: string; roofMaterial: string; typology: string; facadeVisible: boolean; roofVisible: boolean; confidence: number; rationale: string };

const arg = (name: string) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const inputFile = path.resolve(arg('input') || '.cache/building-enrichment/bag-buildings.geojson');
const outputDirectory = path.resolve(arg('output') || '.cache/building-enrichment/panorama');
const limit = Math.max(1, Number(arg('limit') || 24));
const maxAttempts = Math.max(limit, Number(arg('max-attempts') || limit * 8));
const radius = Math.max(5, Number(arg('radius') || 45));
const onlyOsmId = arg('osm-id');
const onlyBuildingId = arg('building-id');
const model = arg('model');
const panoramaSize = arg('panorama-size') || 'medium';
if (!['none', 'small', 'medium', 'full'].includes(panoramaSize)) throw new Error('--panorama-size must be none, small, medium or full');
const region = arg('region') || 'inside-a10';
if (!['inside-a10', 'all-amsterdam'].includes(region)) throw new Error('--region must be inside-a10 or all-amsterdam');
const fresh = process.argv.includes('--fresh');
const materials = ['brick', 'painted-brick', 'glazed-brick', 'stone', 'plaster-stucco', 'concrete', 'glass-curtain-wall', 'metal-cladding', 'wood-cladding', 'ceramic-cladding', 'fiber-cement', 'composite-panel', 'mixed', 'other', 'not-visible', 'uncertain'] as const;
const colours = ['red', 'brown', 'yellow', 'cream', 'white', 'grey', 'black', 'blue', 'green', 'mixed', 'unknown'] as const;
const roofMaterials = ['clay-tile', 'concrete-tile', 'slate', 'bitumen', 'zinc-metal', 'thatch', 'glass', 'green-vegetated', 'solar-dominant', 'mixed', 'other', 'flat-roof-not-visible', 'not-visible', 'uncertain'] as const;
const typologies = ['canal-house', 'amsterdam-school', 'historic-row-house', 'modern-row-house', 'gallery-apartment', 'apartment-block', 'detached-semi-detached', 'warehouse-industrial', 'office-commercial', 'civic-monumental', 'church-religious', 'modern-mixed-use', 'other', 'uncertain'] as const;

const wait = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));
async function fetchWithRetry(url: URL | string, init?: RequestInit): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(url, init);
      if (response.ok || (response.status < 500 && response.status !== 429)) return response;
      lastError = new Error(`HTTP ${response.status}: ${url}`);
    } catch (error) { lastError = error; }
    await wait(300 * 2 ** attempt);
  }
  throw lastError;
}

function centre(geometry: Geometry): Point {
  const points = geometry.type === 'Polygon' ? geometry.coordinates.flat() : geometry.coordinates.flat(2);
  return [points.reduce((sum, point) => sum + point[0], 0) / points.length, points.reduce((sum, point) => sum + point[1], 0) / points.length];
}
function ringContains([x, y]: Point, ring: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const dam: Point = [4.8936, 52.3728];
const distanceFromDam = (building: Building) => {
  const [lon, lat] = centre(building.geometry);
  return Math.hypot((lon - dam[0]) * Math.cos(lat * Math.PI / 180), lat - dam[1]);
};
const buildingId = (building: Building) => String(building.properties.buildingId || (building.properties.identificatie ? `bag:${building.properties.identificatie}` : '') || (building.properties.osmId ? `osm:${building.properties.osmId}` : '') || building.id || '');
const score = (building: Building) => createHash('sha1').update(buildingId(building)).digest('hex');

async function fetchJson<T>(url: URL | string): Promise<T> {
  const response = await fetchWithRetry(url, { headers: { 'User-Agent': 'MapRecallFacadeReview/1.0' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return await response.json() as T;
}

async function downloadImage(url: string, file: string) {
  try { await readFile(file); return; } catch { /* cache miss */ }
  const response = await fetchWithRetry(url, { headers: { Accept: 'image/*', 'User-Agent': 'MapRecallFacadeReview/1.0' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get('content-type') || '';
  const hasImageSignature = (bytes[0] === 0xff && bytes[1] === 0xd8) || (bytes[0] === 0x89 && bytes.subarray(1, 4).toString() === 'PNG');
  if (!contentType.startsWith('image/') && !hasImageSignature) throw new Error(`Not an image: ${url}`);
  await writeFile(file, bytes);
}

async function propose(imageFile: string): Promise<Proposal | undefined> {
  if (!model) return undefined;
  const prompt = `Classify the intended Amsterdam building, not the street, vegetation or vehicles. Treat facade material, facade colour, visible roof material and architectural typology as independent fields. "canal-house" is a narrow/deep historic canal-side typology and can have any material or colour. Only classify roof covering when it is genuinely visible; use flat-roof-not-visible when a flat roof is hidden by the viewpoint. Facade material: ${materials.join(', ')}. Facade colour: ${colours.join(', ')}. Roof material: ${roofMaterials.join(', ')}. Typology: ${typologies.join(', ')}. Return JSON with facadeMaterial, facadeColour, roofMaterial, typology, facadeVisible boolean, roofVisible boolean, confidence 0..1, rationale.`;
  const response = await fetchWithRetry('http://127.0.0.1:11434/api/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, stream: false, format: 'json', messages: [{ role: 'user', content: prompt, images: [(await readFile(imageFile)).toString('base64')] }], options: { temperature: 0 } }),
  });
  if (!response.ok) throw new Error(`Ollama HTTP ${response.status}`);
  const result = await response.json() as { message?: { content?: string } };
  const value = JSON.parse(result.message?.content || '{}') as Proposal;
  if (!materials.includes(value.facadeMaterial as typeof materials[number])
    || !colours.includes(value.facadeColour as typeof colours[number])
    || !roofMaterials.includes(value.roofMaterial as typeof roofMaterials[number])
    || !typologies.includes(value.typology as typeof typologies[number])) throw new Error('invalid model label');
  value.confidence = Math.max(0, Math.min(1, Number(value.confidence) || 0));
  return value;
}

function html(items: unknown[]) {
  const embedded = JSON.stringify(items).replaceAll('<', '\\u003c');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Façade review</title><style>
:root{font:15px system-ui;color:#17202a;background:#eeeae2}*{box-sizing:border-box}body{margin:0}header{position:sticky;top:0;z-index:2;display:flex;gap:10px;align-items:center;padding:12px 18px;background:#17202af2;color:#fff}header strong{font-size:18px}button,select,input{font:inherit}button{border:0;border-radius:7px;padding:9px 13px;cursor:pointer}.primary{background:#1677a5;color:#fff}.muted{background:#e5e7eb}.progress{margin-left:auto}.card{max-width:1050px;margin:20px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 5px 24px #0002}.photo{display:block;width:100%;max-height:64vh;object-fit:contain;background:#222}.meta{padding:14px 18px;color:#4b5563}.meta strong{color:#111827}.controls{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:0 18px 18px}label{display:grid;gap:5px;font-weight:650}.wide{grid-column:1/-1}.proposal{padding:10px;background:#f2f6f8;border-radius:7px}.actions{display:flex;gap:10px;align-items:center}.actions a{margin-left:auto}@media(max-width:650px){.controls{grid-template-columns:1fr}.card{margin:0;border-radius:0}}</style></head><body>
<header><strong>Amsterdam façade review</strong><button id="prev" class="muted">← Previous</button><button id="next" class="primary">Save & next →</button><button id="export" class="muted">Export JSON</button><span id="progress" class="progress"></span></header><main id="app"></main><script>
const items=${embedded},materials=${JSON.stringify(materials)},colours=${JSON.stringify(colours)},roofMaterials=${JSON.stringify(roofMaterials)},typologies=${JSON.stringify(typologies)},storageKey='mapRecall.facadeReview.v2';let labels=JSON.parse(localStorage.getItem(storageKey)||'{}'),index=0;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const options=(xs,v)=>xs.map(x=>'<option '+(x===v?'selected':'')+'>'+esc(x)+'</option>').join('');
function save(){const x=items[index];if(!x)return;labels[x.buildingId]={buildingId:x.buildingId,bagId:x.bagId,osmId:x.osmId,panoId:x.panoId,observedAt:x.observedAt,facadeMaterial:document.querySelector('#material').value,facadeColour:document.querySelector('#colour').value,roofMaterial:document.querySelector('#roof').value,typology:document.querySelector('#typology').value,notes:document.querySelector('#notes').value,reviewedAt:new Date().toISOString(),source:'human-panorama'};localStorage.setItem(storageKey,JSON.stringify(labels))}
function render(){const x=items[index];progress.textContent=items.length?(index+1)+' / '+items.length+' · '+Object.keys(labels).length+' reviewed':'No views';if(!x){app.innerHTML='<p>No usable views.</p>';return}const old=labels[x.buildingId]||x.proposal||{};app.innerHTML='<article class="card"><img class="photo" src="'+esc(x.image)+'"><div class="meta"><strong>'+esc(x.name||x.buildingId)+'</strong> · '+esc(x.buildingId)+' · '+esc(x.observedAt)+' · heading '+esc(x.heading)+'°</div><div class="controls"><label>Façade material<select id="material">'+options(materials,old.facadeMaterial||'uncertain')+'</select></label><label>Façade colour<select id="colour">'+options(colours,old.facadeColour||'unknown')+'</select></label><label>Visible roof material<select id="roof">'+options(roofMaterials,old.roofMaterial||'not-visible')+'</select></label><label>Dutch building typology<select id="typology">'+options(typologies,old.typology||'uncertain')+'</select></label>'+(x.proposal?'<div class="proposal wide"><strong>Model proposal:</strong> '+esc(x.proposal.facadeMaterial)+' / '+esc(x.proposal.facadeColour)+' · roof '+esc(x.proposal.roofMaterial)+' · '+esc(x.proposal.typology)+' ('+Math.round(x.proposal.confidence*100)+'%) — '+esc(x.proposal.rationale)+'</div>':'')+'<label class="wide">Notes / occlusion<input id="notes" value="'+esc(old.notes||'')+'"></label><div class="actions wide"><button class="muted" onclick="quick(\'not-visible\')">Façade not visible</button><button class="muted" onclick="quick(\'uncertain\')">Uncertain</button><a href="'+esc(x.sourceUrl)+'" target="_blank">Panorama metadata</a></div></div></article>'}
window.quick=v=>{material.value=v;save();index=Math.min(items.length-1,index+1);render()};next.onclick=()=>{save();index=Math.min(items.length-1,index+1);render()};prev.onclick=()=>{save();index=Math.max(0,index-1);render()};document.querySelector('#export').onclick=()=>{save();const blob=new Blob([JSON.stringify({schemaVersion:2,attribution:'Panoramabeelden Gemeente Amsterdam, CC BY 4.0',labels:Object.values(labels)},null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='building-appearance-human-labels.json';a.click();URL.revokeObjectURL(a.href)};render();
</script></body></html>`;
}

const collection = JSON.parse(await readFile(inputFile, 'utf8')) as { features: Building[] };
let a10Ring: Point[] | undefined;
if (region === 'inside-a10') {
  const a10 = JSON.parse(await readFile(path.resolve('.cache/building-enrichment/a10-boundary.geojson'), 'utf8')) as { features: Array<{ geometry: { coordinates: Point[][] } }> };
  a10Ring = a10.features[0]?.geometry.coordinates[0];
  if (!a10Ring?.length) throw new Error('A10 priority boundary is empty; run npm run cache:amsterdam-a10');
}
await mkdir(path.join(outputDirectory, 'images'), { recursive: true });
await mkdir(path.join(outputDirectory, 'panoramas'), { recursive: true });
const manifestFile = path.join(outputDirectory, 'manifest.json');
let priorItems: Record<string, unknown>[] = [], priorRejections: Array<{ buildingId: string; reason: string }> = [];
if (!fresh) {
  try {
    const prior = JSON.parse(await readFile(manifestFile, 'utf8')) as { items?: Record<string, unknown>[]; rejections?: Array<{ buildingId: string; reason: string }> };
    priorItems = prior.items || [];
    priorRejections = prior.rejections || [];
  } catch { /* first run */ }
}
const terminalRejections = priorRejections.filter(item => item.reason === 'no-panorama-in-radius');
const processed = new Set([...priorItems.map(item => String(item.buildingId)), ...terminalRejections.map(item => item.buildingId)]);
let candidates = collection.features.filter(feature => feature.geometry && buildingId(feature));
if (a10Ring) candidates = candidates.filter(feature => ringContains(centre(feature.geometry), a10Ring!));
if (onlyOsmId) candidates = candidates.filter(feature => String(feature.properties.osmId) === onlyOsmId);
else if (onlyBuildingId) candidates = candidates.filter(feature => buildingId(feature) === onlyBuildingId);
else candidates = candidates.sort((a, b) => distanceFromDam(a) - distanceFromDam(b) || score(a).localeCompare(score(b))).filter(feature => !processed.has(buildingId(feature))).slice(0, maxAttempts);

const items: Record<string, unknown>[] = [...priorItems];
const rejections: Array<{ buildingId: string; reason: string }> = [...priorRejections];
const initialUsable = items.length;
const generatedAt = new Date().toISOString();
const checkpoint = async () => {
  const partial = { schemaVersion: 2, generatedAt, input: path.relative(process.cwd(), inputFile), source: { name: 'Kernregistratie Panoramabeelden Gemeente Amsterdam', license: 'CC BY 4.0', api: 'https://api.data.amsterdam.nl/panorama/' }, selection: { region, ordering: 'distance-from-Dam-then-stable-id', candidateBuildings: candidates.length, requestedNewUsable: limit, totalAttempted: items.length + rejections.length, totalUsable: items.length, totalRejected: rejections.length, radiusMetres: radius, panoramaSize }, model: model || null, rejections, items };
  await writeFile(manifestFile, JSON.stringify(partial, null, 2));
  await writeFile(path.join(outputDirectory, 'machine-labels.json'), JSON.stringify({ schemaVersion: 2, generatedAt, model: model || null, labels: items.filter(item => item.proposal).map(item => ({ buildingId: item.buildingId, bagId: item.bagId, osmId: item.osmId, panoId: item.panoId, observedAt: item.observedAt, source: 'model-panorama', acceptedForNow: true, ...item.proposal as object })) }, null, 2));
};
for (let index = 0; index < candidates.length; index++) {
  if (items.length - initialUsable >= limit) break;
  const building = candidates[index], [lon, lat] = centre(building.geometry), id = buildingId(building);
  const query = new URL('https://api.data.amsterdam.nl/panorama/thumbnail/');
  query.search = new URLSearchParams({ lat: String(lat), lon: String(lon), radius: String(radius), width: '1400', fov: '70', horizon: '0.34', aspect: '1.6' }).toString();
  try {
    const thumbnail = await fetchJson<Thumbnail>(query);
    if (!thumbnail || !thumbnail.pano_id || !thumbnail.url) {
      rejections.push({ buildingId: id, reason: 'no-panorama-in-radius' });
      process.stdout.write(`${index + 1}/${candidates.length} ${id} → no panorama within ${radius} m\n`);
      continue;
    }
    const pano = await fetchJson<Record<string, unknown>>(`https://api.data.amsterdam.nl/panorama/panoramas/${encodeURIComponent(thumbnail.pano_id)}/`);
    const imageName = `${id.replaceAll(/[^a-zA-Z0-9_-]/g, '_')}.jpg`, imageFile = path.join(outputDirectory, 'images', imageName);
    await downloadImage(thumbnail.url, imageFile);
    let panoramaImage: string | null = null;
    if (panoramaSize !== 'none') {
      const links = pano._links as Record<string, { href?: string }> | undefined;
      const source = links?.[`equirectangular_${panoramaSize}`]?.href;
      if (source) {
        const panoramaName = `${thumbnail.pano_id.replaceAll(/[^a-zA-Z0-9_-]/g, '_')}-${panoramaSize}.jpg`;
        try {
          await downloadImage(source, path.join(outputDirectory, 'panoramas', panoramaName));
          panoramaImage = `panoramas/${panoramaName}`;
        } catch (error) { process.stderr.write(`source panorama cache skipped for ${id}: ${String(error)}\n`); }
      }
    }
    let proposal: Proposal | undefined;
    try { proposal = await propose(imageFile); } catch (error) { process.stderr.write(`model skipped for ${id}: ${String(error)}\n`); }
    for (let rejectionIndex = rejections.length - 1; rejectionIndex >= 0; rejectionIndex--) if (rejections[rejectionIndex].buildingId === id) rejections.splice(rejectionIndex, 1);
    items.push({ buildingId: id, bagId: building.properties.identificatie || null, osmId: building.properties.osmId || null, name: building.properties.name || '', centre: [lon, lat], buildingProperties: building.properties, panoId: thumbnail.pano_id, heading: thumbnail.heading, observedAt: pano.timestamp, image: `images/${imageName}`, panoramaImage, sourceUrl: (pano._links as { self?: { href?: string } } | undefined)?.self?.href, thumbnailUrl: thumbnail.url, panoramaMetadata: pano, proposal });
    await checkpoint();
    process.stdout.write(`${index + 1}/${candidates.length} ${id} → ${thumbnail.pano_id} (${items.length - initialUsable}/${limit} new usable)\n`);
  } catch (error) {
    rejections.push({ buildingId: id, reason: String(error) });
    await checkpoint();
    process.stderr.write(`skipped ${id}: ${String(error)}\n`);
  }
}
const manifest = { schemaVersion: 2, generatedAt, input: path.relative(process.cwd(), inputFile), source: { name: 'Kernregistratie Panoramabeelden Gemeente Amsterdam', license: 'CC BY 4.0', api: 'https://api.data.amsterdam.nl/panorama/' }, selection: { region, ordering: 'distance-from-Dam-then-stable-id', candidateBuildings: candidates.length, requestedNewUsable: limit, totalAttempted: items.length + rejections.length, totalUsable: items.length, totalRejected: rejections.length, radiusMetres: radius, panoramaSize }, model: model || null, rejections, items };
await writeFile(manifestFile, JSON.stringify(manifest, null, 2));
await writeFile(path.join(outputDirectory, 'machine-labels.json'), JSON.stringify({ schemaVersion: 2, generatedAt: manifest.generatedAt, model: model || null, labels: items.filter(item => item.proposal).map(item => ({ buildingId: item.buildingId, bagId: item.bagId, osmId: item.osmId, panoId: item.panoId, observedAt: item.observedAt, source: 'model-panorama', acceptedForNow: true, ...item.proposal as object })) }, null, 2));
await writeFile(path.join(outputDirectory, 'index.html'), html(items));
process.stdout.write(`Wrote ${items.length} review items to ${path.relative(process.cwd(), outputDirectory)}/index.html\n`);
