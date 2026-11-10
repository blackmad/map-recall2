(() => { const r = window.canalRecallGame.vectorMap.host.renderer; const gl = r.getContext();
 const h = s => { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return (x >>> 0).toString(16); };
 return { tl: window.__progTl, progs: r.info.programs.map((p, i) => { const sh = gl.getAttachedShaders(p.program) || []; const src = sh.map(s => gl.getShaderSource(s)).join('\n----\n');
  const nU = gl.getProgramParameter(p.program, gl.ACTIVE_UNIFORMS); const un = []; for (let j = 0; j < nU; j++) un.push(gl.getActiveUniform(p.program, j).name);
  const defs = [...new Set((src.match(/^#define [A-Z_0-9]+.*$/gm) || []))];
  const stripped = src.replace(/^#define SHADER_NAME.*$/gm, '');
  return { i, name: p.name, type: p.type, usedTimes: p.usedTimes, key: p.cacheKey.slice(0, 400), keyHash: h(p.cacheKey), srcHash: h(src), srcHashNoDefs: h(src.replace(/^#define.*$/gm, '')), bodyHash: h(stripped.split('----').map(s => s.replace(/^[\s\S]*?void main/m, 'void main')).join('|')), len: src.length, defs, uniforms: un, owners: [...(window.__progOwners.get(p) || new Map()).entries()] };
 }) }; })()
