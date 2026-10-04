import { writeFile } from 'node:fs/promises';
const session = process.env.SAFARI_SESSION || '887A2855-1529-4530-A6D4-50541C8159F2';
const base = `http://127.0.0.1:4447/session/${session}`;
async function call(path, body) {
  const r = await fetch(base + path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
  const data = await r.json();
  if (data.value?.error) throw new Error(JSON.stringify(data.value));
  return data.value;
}
const execute = script => call('/execute/sync', { script, args: [] });
const modes = [];
for (const look of ['cartoon', 'procedural', 'photo']) {
  const mode = await call('/execute/async', { script: `const done=arguments[arguments.length-1],t=window.canalRecallGame.vectorMap._threeBuildings; t.setLook(arguments[0]).then(()=>{const deadline=performance.now()+45000;const poll=()=>{if(t.pending.length||t.inflight.size){if(performance.now()>deadline)return done({error:'Chunk install timeout'});return setTimeout(poll,100);}done({look:t.look,stats:t.stats(),atlasWidth:t.material.uniforms.cells.value.image.width});};poll();}).catch(e=>done({error:String(e)}));`, args: [look] });
  modes.push(mode);
  if (mode.error || mode.atlasWidth !== 128 || mode.stats.textureMB > 29.5) throw new Error(JSON.stringify(mode));
}
const report = await execute(`const g=window.canalRecallGame,t=g.vectorMap._threeBuildings;return {userAgent:navigator.userAgent,look:t.look,detailZoom:t.detailZoom,pixelRatio:g.vectorMap.map.getPixelRatio(),stats:t.stats(),errors:window.__safariErrors,atlas:[...t.materials].map(([look,m])=>({look,width:m.uniforms.cells.value.image.width}))};`);
report.modes = modes;
report.textureBuild = await call('/execute/async', { script: `const done=arguments[arguments.length-1],t=window.canalRecallGame.vectorMap._threeBuildings,start=performance.now();let previous=start,active=true,gaps=[];function frame(now){gaps.push(now-previous);previous=now;if(active)requestAnimationFrame(frame);}requestAnimationFrame(frame);window.CanalRecallThreeBuildings.buildLookTextures(t.THREE,'photo',4,128).then(set=>{active=false;const result={durationMs:performance.now()-start,animationFrames:gaps.length,maxFrameGapMs:Math.max(...gaps),bytes:set.colour.userData.bytes+set.mask.userData.bytes};set.colour.dispose();set.mask.dispose();done(result);}).catch(e=>done({error:String(e)}));`, args: [] });
await writeFile('artifacts/mobile-textures/safari-report.json', JSON.stringify(report, null, 2));
await writeFile('artifacts/mobile-textures/safari-game.png', Buffer.from(await call('/screenshot'), 'base64'));
console.log(JSON.stringify(report));
