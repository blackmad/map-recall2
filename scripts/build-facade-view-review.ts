/** Build a local review UI that selects one usable façade view per BAG building. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

type Crop = {
  buildingId: string;
  viewRank?: number;
  image: string;
  panoId: string | null;
  observedAt: string | null;
  cameraDistanceMetres: number | null;
  heading: number;
  fov: number;
  triage?: { targetVisibility?: string; occlusion?: string; confidence?: number; rationale?: string };
};
const arg = (name: string) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(arg('root') || '.cache/building-enrichment/panorama');
const output = path.join(root, 'view-review');
await mkdir(output, { recursive: true });
const manifest = JSON.parse(await readFile(path.join(root, 'wide-crop-manifest.json'), 'utf8')) as { crops: Crop[] };
let triage: Array<Record<string, unknown>> = [];
try { triage = (JSON.parse(await readFile(path.join(root, 'facade-view-machine-proposals.json'), 'utf8')) as { proposals?: Array<Record<string, unknown>> }).proposals || []; } catch { /* proposals are optional */ }
const triageByView = new Map(triage.map((proposal) => [`${proposal.buildingId}|${proposal.panoId}`, proposal]));
const groups = new Map<string, Crop[]>();
for (const crop of manifest.crops) {
  const values = groups.get(crop.buildingId) || [];
  values.push({ ...crop, triage: triageByView.get(`${crop.buildingId}|${crop.panoId}`) });
  groups.set(crop.buildingId, values);
}
const items = [...groups.entries()].map(([buildingId, views]) => ({
  buildingId,
  views: views.sort((a, b) => (a.viewRank || 1) - (b.viewRank || 1)),
}));
const data = JSON.stringify(items).replaceAll('<', '\\u003c');
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Façade view review</title><style>
:root{font:15px system-ui;color:#17212a;background:#ebe8e1}*{box-sizing:border-box}body{margin:0}header{position:sticky;top:0;z-index:3;display:flex;gap:9px;align-items:center;padding:12px 18px;background:#172a36;color:white}button,select,input{font:inherit}button{border:0;border-radius:7px;padding:9px 12px;cursor:pointer}.primary{background:#1680a8;color:white}.muted{background:#e5e7eb}.progress{margin-left:auto}.card{max-width:1450px;margin:18px auto;padding:16px;background:white;border-radius:12px;box-shadow:0 4px 20px #0002}.views{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.view{display:grid;gap:7px;padding:6px;border:3px solid transparent;border-radius:10px;background:#edf1f3;cursor:pointer}.view.selected{border-color:#1680a8}.view img{display:block;width:100%;aspect-ratio:1.6;object-fit:cover;background:#222}.meta{font:12px monospace;color:#526269}.controls{display:grid;grid-template-columns:180px 1fr;gap:12px;margin-top:14px}.controls label{display:grid;gap:4px;font-weight:650}.actions{display:flex;gap:9px;margin-top:14px}@media(max-width:800px){.views{grid-template-columns:1fr}.controls{grid-template-columns:1fr}}</style></head><body>
<header><strong>Façade view review</strong><button id="prev" class="muted">← Previous</button><button id="next" class="primary">Save & next →</button><button id="import" class="muted">Import</button><button id="export" class="muted">Export</button><input id="file" type="file" hidden><span id="progress" class="progress"></span></header><main id="app"></main><script>
const items=${data},key='mapRecall.facadeViewReview.v1';let labels=JSON.parse(localStorage.getItem(key)||'{}'),index=0;const q=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function selected(){return q('.view.selected')?.dataset.pano||null}function save(){const x=items[index],quality=q('#quality').value,panoId=quality==='unusable'?null:selected(),view=x.views.find(v=>v.panoId===panoId);labels[x.buildingId]={schemaVersion:1,buildingId:x.buildingId,quality,selectedPanoId:panoId,selectedImage:view?.image||null,occlusion:q('#occlusion').value,notes:q('#notes').value,source:'human-panorama-view-selection',reviewedAt:new Date().toISOString()};localStorage.setItem(key,JSON.stringify(labels))}
function render(){const x=items[index],old=labels[x.buildingId]||{},suggested=[...x.views].filter(v=>Number(v.triage?.confidence||0)>=.7&&['full','partial'].includes(v.triage?.targetVisibility)).sort((a,b)=>(b.triage?.targetVisibility==='full'?2:1)-(a.triage?.targetVisibility==='full'?2:1)||Number(b.triage?.confidence||0)-Number(a.triage?.confidence||0))[0]||x.views[0],picked=old.selectedPanoId||suggested?.panoId;q('#progress').textContent=(index+1)+' / '+items.length+' · '+Object.keys(labels).length+' reviewed';q('#app').innerHTML='<article class="card"><h2>'+esc(x.buildingId)+'</h2><div class="views">'+x.views.map((v,i)=>'<div class="view '+(v.panoId===picked?'selected':'')+'" data-pano="'+esc(v.panoId)+'"><img src="../'+esc(v.image)+'"><div class="meta">View '+(v.viewRank||i+1)+' · '+esc(v.cameraDistanceMetres)+' m · '+esc(v.observedAt)+'<br>heading '+esc(v.heading)+'° · FOV '+esc(v.fov)+'°'+(v.triage?'<br><b>Model triage: '+esc(v.triage.targetVisibility)+' / '+esc(v.triage.occlusion)+' ('+Math.round(v.triage.confidence*100)+'%)</b> — '+esc(v.triage.rationale):'')+'</div></div>').join('')+'</div><div class="controls"><label>Evidence quality<select id="quality"><option value="full">Full façade visible</option><option value="partial">Useful partial façade</option><option value="unusable">No usable target view</option></select></label><label>Occlusion<select id="occlusion"><option value="none">None</option><option value="vegetation">Vegetation</option><option value="vehicle">Vehicle</option><option value="wrong-side-or-angle">Wrong side / angle</option><option value="other-building">Other building</option><option value="mixed">Mixed</option><option value="unknown">Unknown</option></select></label><label style="grid-column:1/-1">Notes<input id="notes" value="'+esc(old.notes||'')+'"></label></div></article>';q('#quality').value=old.quality||(Number(suggested?.triage?.confidence||0)>=.7&&suggested?.triage?.targetVisibility==='partial'?'partial':'full');q('#occlusion').value=old.occlusion||(Number(suggested?.triage?.confidence||0)>=.7?suggested?.triage?.occlusion:'none')||'none';document.querySelectorAll('.view').forEach(el=>el.onclick=()=>{document.querySelectorAll('.view').forEach(v=>v.classList.remove('selected'));el.classList.add('selected');if(q('#quality').value==='unusable')q('#quality').value='partial'})}
q('#next').onclick=()=>{save();index=Math.min(items.length-1,index+1);render()};q('#prev').onclick=()=>{save();index=Math.max(0,index-1);render()};q('#export').onclick=()=>{save();const blob=new Blob([JSON.stringify({schemaVersion:1,labels:Object.values(labels)},null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='facade-view-human-labels.json';a.click();URL.revokeObjectURL(a.href)};q('#import').onclick=()=>q('#file').click();q('#file').onchange=async e=>{const value=JSON.parse(await e.target.files[0].text());for(const label of value.labels||[])labels[label.buildingId]=label;localStorage.setItem(key,JSON.stringify(labels));render()};render();
</script></body></html>`;
await writeFile(path.join(output, 'index.html'), html);
process.stdout.write(`Wrote façade view review for ${items.length} buildings (${manifest.crops.length} candidate views)\n`);
