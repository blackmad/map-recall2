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
type Proposal = { material: string; colourFamily: string; confidence: number; visible: boolean; rationale: string };

const arg = (name: string) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const inputFile = path.resolve(arg('input') || 'public/data/extracts/amsterdam/buildings-colored.geojson');
const outputDirectory = path.resolve(arg('output') || '.cache/facade-review');
const limit = Math.max(1, Number(arg('limit') || 24));
const maxAttempts = Math.max(limit, Number(arg('max-attempts') || limit * 8));
const radius = Math.max(5, Number(arg('radius') || 45));
const onlyOsmId = arg('osm-id');
const model = arg('model');
const materials = ['brick', 'stone', 'plaster-stucco', 'concrete', 'glass', 'metal', 'wood', 'ceramic-tile', 'mixed', 'other', 'not-visible', 'uncertain'] as const;
const colours = ['red', 'brown', 'yellow', 'cream', 'white', 'grey', 'black', 'blue', 'green', 'mixed', 'unknown'] as const;

function centre(geometry: Geometry): Point {
  const points = geometry.type === 'Polygon' ? geometry.coordinates.flat() : geometry.coordinates.flat(2);
  return [points.reduce((sum, point) => sum + point[0], 0) / points.length, points.reduce((sum, point) => sum + point[1], 0) / points.length];
}
const score = (building: Building) => createHash('sha1').update(String(building.properties.osmId || building.id || '')).digest('hex');

async function fetchJson<T>(url: URL | string): Promise<T> {
  const response = await fetch(url, { headers: { 'User-Agent': 'MapRecallFacadeReview/1.0' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return await response.json() as T;
}

async function downloadImage(url: string, file: string) {
  try { await readFile(file); return; } catch { /* cache miss */ }
  const response = await fetch(url, { headers: { Accept: 'image/*', 'User-Agent': 'MapRecallFacadeReview/1.0' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  if (!response.headers.get('content-type')?.startsWith('image/')) throw new Error(`Not an image: ${url}`);
  await writeFile(file, Buffer.from(await response.arrayBuffer()));
}

async function propose(imageFile: string): Promise<Proposal | undefined> {
  if (!model) return undefined;
  const prompt = `Classify the dominant intended BUILDING FACADE. Ignore sky, road, plants, vehicles, windows, doors and roof. Material and colour are separate: all red/brown/yellow masonry units are material "brick". If the intended facade is occluded or ambiguous choose not-visible or uncertain. Material must be one of: ${materials.join(', ')}. Colour must be one of: ${colours.join(', ')}. Return JSON: material, colourFamily, confidence 0..1, visible boolean, rationale.`;
  const response = await fetch('http://127.0.0.1:11434/api/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, stream: false, format: 'json', messages: [{ role: 'user', content: prompt, images: [(await readFile(imageFile)).toString('base64')] }], options: { temperature: 0 } }),
  });
  if (!response.ok) throw new Error(`Ollama HTTP ${response.status}`);
  const result = await response.json() as { message?: { content?: string } };
  const value = JSON.parse(result.message?.content || '{}') as Proposal;
  if (!materials.includes(value.material as typeof materials[number]) || !colours.includes(value.colourFamily as typeof colours[number])) throw new Error('invalid model label');
  value.confidence = Math.max(0, Math.min(1, Number(value.confidence) || 0));
  return value;
}

function html(items: unknown[]) {
  const embedded = JSON.stringify(items).replaceAll('<', '\\u003c');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Façade review</title><style>
:root{font:15px system-ui;color:#17202a;background:#eeeae2}*{box-sizing:border-box}body{margin:0}header{position:sticky;top:0;z-index:2;display:flex;gap:10px;align-items:center;padding:12px 18px;background:#17202af2;color:#fff}header strong{font-size:18px}button,select,input{font:inherit}button{border:0;border-radius:7px;padding:9px 13px;cursor:pointer}.primary{background:#1677a5;color:#fff}.muted{background:#e5e7eb}.progress{margin-left:auto}.card{max-width:1050px;margin:20px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 5px 24px #0002}.photo{display:block;width:100%;max-height:64vh;object-fit:contain;background:#222}.meta{padding:14px 18px;color:#4b5563}.meta strong{color:#111827}.controls{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:0 18px 18px}label{display:grid;gap:5px;font-weight:650}.wide{grid-column:1/-1}.proposal{padding:10px;background:#f2f6f8;border-radius:7px}.actions{display:flex;gap:10px;align-items:center}.actions a{margin-left:auto}@media(max-width:650px){.controls{grid-template-columns:1fr}.card{margin:0;border-radius:0}}</style></head><body>
<header><strong>Amsterdam façade review</strong><button id="prev" class="muted">← Previous</button><button id="next" class="primary">Save & next →</button><button id="export" class="muted">Export JSON</button><span id="progress" class="progress"></span></header><main id="app"></main><script>
const items=${embedded},materials=${JSON.stringify(materials)},colours=${JSON.stringify(colours)},storageKey='mapRecall.facadeReview.v1';let labels=JSON.parse(localStorage.getItem(storageKey)||'{}'),index=0;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const options=(xs,v)=>xs.map(x=>'<option '+(x===v?'selected':'')+'>'+esc(x)+'</option>').join('');
function save(){const x=items[index];if(!x)return;labels[x.osmId]={osmId:x.osmId,panoId:x.panoId,observedAt:x.observedAt,material:document.querySelector('#material').value,colourFamily:document.querySelector('#colour').value,notes:document.querySelector('#notes').value,reviewedAt:new Date().toISOString(),source:'human-panorama'};localStorage.setItem(storageKey,JSON.stringify(labels))}
function render(){const x=items[index];progress.textContent=items.length?(index+1)+' / '+items.length+' · '+Object.keys(labels).length+' reviewed':'No views';if(!x){app.innerHTML='<p>No usable views.</p>';return}const old=labels[x.osmId]||x.proposal||{};app.innerHTML='<article class="card"><img class="photo" src="'+esc(x.image)+'"><div class="meta"><strong>'+esc(x.name||x.osmId)+'</strong> · '+esc(x.osmId)+' · '+esc(x.observedAt)+' · heading '+esc(x.heading)+'°</div><div class="controls"><label>Façade material<select id="material">'+options(materials,old.material||'uncertain')+'</select></label><label>Dominant colour<select id="colour">'+options(colours,old.colourFamily||'unknown')+'</select></label>'+(x.proposal?'<div class="proposal wide"><strong>Model proposal:</strong> '+esc(x.proposal.material)+' / '+esc(x.proposal.colourFamily)+' ('+Math.round(x.proposal.confidence*100)+'%) — '+esc(x.proposal.rationale)+'</div>':'')+'<label class="wide">Notes / occlusion<input id="notes" value="'+esc(old.notes||'')+'"></label><div class="actions wide"><button class="muted" onclick="quick(\'not-visible\')">Not visible</button><button class="muted" onclick="quick(\'uncertain\')">Uncertain</button><a href="'+esc(x.sourceUrl)+'" target="_blank">Panorama metadata</a></div></div></article>'}
window.quick=v=>{material.value=v;save();index=Math.min(items.length-1,index+1);render()};next.onclick=()=>{save();index=Math.min(items.length-1,index+1);render()};prev.onclick=()=>{save();index=Math.max(0,index-1);render()};document.querySelector('#export').onclick=()=>{save();const blob=new Blob([JSON.stringify({schemaVersion:1,attribution:'Panoramabeelden Gemeente Amsterdam, CC BY 4.0',labels:Object.values(labels)},null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='facade-labels.json';a.click();URL.revokeObjectURL(a.href)};render();
</script></body></html>`;
}

const collection = JSON.parse(await readFile(inputFile, 'utf8')) as { features: Building[] };
let candidates = collection.features.filter(feature => feature.geometry && feature.properties.osmId);
if (onlyOsmId) candidates = candidates.filter(feature => String(feature.properties.osmId) === onlyOsmId);
else candidates = candidates.sort((a, b) => score(a).localeCompare(score(b))).slice(0, maxAttempts);
await mkdir(path.join(outputDirectory, 'images'), { recursive: true });

const items: Record<string, unknown>[] = [];
const rejections: Array<{ osmId: string; reason: string }> = [];
for (let index = 0; index < candidates.length; index++) {
  if (items.length >= limit) break;
  const building = candidates[index], [lon, lat] = centre(building.geometry), osmId = String(building.properties.osmId);
  const query = new URL('https://api.data.amsterdam.nl/panorama/thumbnail/');
  query.search = new URLSearchParams({ lat: String(lat), lon: String(lon), radius: String(radius), width: '1400', fov: '70', horizon: '0.34', aspect: '1.6' }).toString();
  try {
    const thumbnail = await fetchJson<Thumbnail>(query);
    if (!thumbnail || !thumbnail.pano_id || !thumbnail.url) {
      rejections.push({ osmId, reason: 'no-panorama-in-radius' });
      process.stdout.write(`${index + 1}/${candidates.length} ${osmId} → no panorama within ${radius} m\n`);
      continue;
    }
    const pano = await fetchJson<Record<string, unknown>>(`https://api.data.amsterdam.nl/panorama/panoramas/${encodeURIComponent(thumbnail.pano_id)}/`);
    const imageName = `${osmId.replaceAll(/[^a-zA-Z0-9_-]/g, '_')}.jpg`, imageFile = path.join(outputDirectory, 'images', imageName);
    await downloadImage(thumbnail.url, imageFile);
    let proposal: Proposal | undefined;
    try { proposal = await propose(imageFile); } catch (error) { process.stderr.write(`model skipped for ${osmId}: ${String(error)}\n`); }
    items.push({ osmId, name: building.properties.name || '', centre: [lon, lat], panoId: thumbnail.pano_id, heading: thumbnail.heading, observedAt: pano.timestamp, image: `images/${imageName}`, sourceUrl: (pano._links as { self?: { href?: string } } | undefined)?.self?.href, thumbnailUrl: thumbnail.url, proposal });
    process.stdout.write(`${index + 1}/${candidates.length} ${osmId} → ${thumbnail.pano_id} (${items.length}/${limit} usable)\n`);
  } catch (error) {
    rejections.push({ osmId, reason: String(error) });
    process.stderr.write(`skipped ${osmId}: ${String(error)}\n`);
  }
}
const manifest = { schemaVersion: 1, generatedAt: new Date().toISOString(), input: path.relative(process.cwd(), inputFile), source: { name: 'Kernregistratie Panoramabeelden Gemeente Amsterdam', license: 'CC BY 4.0', api: 'https://api.data.amsterdam.nl/panorama/' }, selection: { requestedUsable: limit, attempted: items.length + rejections.length, usable: items.length, rejected: rejections.length, radiusMetres: radius }, model: model || null, rejections, items };
await writeFile(path.join(outputDirectory, 'manifest.json'), JSON.stringify(manifest, null, 2));
await writeFile(path.join(outputDirectory, 'index.html'), html(items));
process.stdout.write(`Wrote ${items.length} review items to ${path.relative(process.cwd(), outputDirectory)}/index.html\n`);
