// GL program census (#299): INIT_JS for motion-stutter.mjs. Records which material/object uses each three.js program and a
// program-count timeline. Pair with DUMP_JS="$(cat scripts/perf/gl-program-census-dump.js)" GL_COUNTERS=1. Not for timing runs (it traverses the scene).
(() => {
  const seen = new Map(); window.__progOwners = seen; let n = 0;
  const rec = (r, scene) => {
    scene.traverse(o => {
      const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of ms) {
        const p = r.properties.get(m)?.currentProgram; if (!p) continue;
        let e = seen.get(p); if (!e) seen.set(p, e = new Map());
        const path = []; let q = o; while (q && path.length < 5) { path.push((q.name || q.type) + (q.isInstancedMesh ? '[I]' : '')); q = q.parent; }
        const k = `${m.type}#${m.name || ''}#uuid:${m.uuid.slice(0, 6)} @ ${path.join(' < ')}`;
        if (e.size < 40) e.set(k, (e.get(k) || 0) + 1);
      }
      for (const dm of [o.customDepthMaterial, o.customDistanceMaterial]) if (dm) { const p = r.properties.get(dm)?.currentProgram; if (p) { let e = seen.get(p); if (!e) seen.set(p, e = new Map()); e.set(`customDepth ${dm.type} on ${o.name || o.type}`, 1); } }
    });
  };
  const tick = () => {
    const r = window.canalRecallGame?.vectorMap?.host?.renderer;
    if (r && !r.__progWrapped) {
      r.__progWrapped = true; const orig = r.render;
      r.render = function (scene, cam) { const out = orig.call(this, scene, cam); if ((n++ % 20) === 0) { try { rec(this, scene); } catch (e) {} } return out; };
    }
    if (r) { const tl = (window.__progTl ||= []); const n2 = r.info.programs.length; if (!tl.length || tl[tl.length - 1][1] !== n2) tl.push([Math.round(performance.now()), n2, window.canalRecallGame?.state, Math.round(window.canalRecallGame?.player?.distancePx ?? 0)]); }
    setTimeout(tick, 250);
  };
  tick();
})();
