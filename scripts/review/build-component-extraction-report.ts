/** Review local-model boxes against the exact supplied raster. */
import fs from 'node:fs/promises';
const root='.cache/facade-assessment/components-v1';
const r=JSON.parse(await fs.readFile(root+'/qwen-extraction.json','utf8'));
const out='public/data/facade-review-galleries/head-on-3d-v1';
const escape=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const colours:Record<string,string>={window:'#00bfff',door:'#ff9400',balcony:'#ee00ff'};
const features=r.status==='candidate'?r.result.features:[];
const shapes=features.map((f:any)=>{const [x,y,x1,y1]=f.bbox;return `<g><rect x="${x*1000}" y="${y*1000}" width="${(x1-x)*1000}" height="${(y1-y)*1000}" fill="none" stroke="${colours[f.kind]}" stroke-width="2"/><title>${escape(f.id)} · ${f.kind} · ${f.confidence}</title></g>`;}).join('');
const cvRoot='.cache/facade-assessment/banana-head-on-v1/auto-components-strip1/';
await fs.copyFile(cvRoot+'candidate-overlay.png',out+'/component-candidates.png');
await fs.writeFile(out+'/components-review.html',`<!doctype html><meta name="viewport" content="width=device-width"><title>Facade component extraction</title><style>body{font:16px system-ui;background:#f5f3ee;color:#24352e;margin:24px}main{position:relative;max-width:1400px}img{width:100%;display:block}svg{position:absolute;inset:0;width:100%;height:100%}a{color:inherit}</style><h1>Automatic component candidates</h1><h2>Image-based detector</h2><p>Blue opening candidates; green balcony candidates; orange tentative door. These require visual review.</p><img style="max-width:1400px;width:100%" src="component-candidates.png"><h2>Local Qwen comparison</h2><p>Model output status: ${escape(r.status)}. Invalid coordinates are rejected, not silently rescaled.</p><p>Candidate output, not accepted geometry. ${features.length} boxes · ${Math.round((r.latencyMs??0)/1000)} seconds · no API charge.</p><p>Blue: windows · orange: doors · magenta: balcony slab/railing. Hover boxes for IDs.</p><main><img src="strip1-generated.png"><svg viewBox="0 0 1000 1000" preserveAspectRatio="none">${shapes}</svg></main><p><a href="/canal-drive/facade-texture-demo.html">Back to 3D demo</a></p>`);
console.log({status:r.status,features:features.length});
