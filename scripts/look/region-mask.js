// In-page region mask for look measurements (scripts/look/sunny-frames.ts), run by live-play-shots.mjs MASK=1.
// Repaints the shared frame once with every mesh swapped for a flat ID material and every MapLibre layer hidden
// except the background (black):
//   buildings (facade chunks, recipe/landmark GLBs, roofs) -> MeshNormalMaterial (world normal, z-up: the shared
//     frame's camera matrices are identity, so "view" normal is the world normal; walls have blue ~128, roofs ~255);
//   own ground -> (255,0,0); trees -> (0,255,0); everything else drawn by three -> (255,255,0); sky/basemap -> black.
// The HUD is hidden by the caller (HUD_HIDE_CSS in live-play-shots.mjs). `window.__regionMaskRestore()` puts the
// materials and the layers back.
// Suppressed pands: the streamed facades hide a building a landmark or chunk replaces through the per-vertex `hidden`
// attribute (rendererShared/litFacadeMaterial.ts VERTEX_HIDE: 1 = suppressed). The ID materials discard those vertices
// the same way (HIDDEN_DISCARD), or the hidden generic prism comes back in the mask and covers the walls drawn in its
// place (chunk-look lane 2026-10-16: Bilderdijkstraat chunk walls were counted as generic walls).
(() => {
  const vm = canalRecallGame.vectorMap, frame = vm._sharedFrame, map = vm.map, THREE = frame.THREE;
  const normal = new THREE.MeshNormalMaterial({ flatShading: true });
  const flat = c => new THREE.MeshBasicMaterial({ color: new THREE.Color(c[0] / 255, c[1] / 255, c[2] / 255), toneMapped: false });
  const ground = flat([255, 0, 0]), tree = flat([0, 255, 0]), other = flat([255, 255, 0]);
  [normal, ground, tree, other].forEach(m => { m.side = THREE.DoubleSide; });
  const HIDDEN_DISCARD = 'if (hidden > 0.5 && hidden < 1.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);';
  const hideCache = new Map();
  const hideAware = m => {
    const c = m.clone();
    c.onBeforeCompile = s => {
      s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute float hidden;')
        .replace('#include <project_vertex>', `#include <project_vertex>\n${HIDDEN_DISCARD}`);
    };
    c.customProgramCacheKey = () => 'region-mask-hidden-' + m.uuid;
    return c;
  };
  // A mesh whose geometry carries `hidden` draws the ID material with the discard; every other mesh the plain one.
  const idMaterial = (o, m) => (o.geometry?.getAttribute?.('hidden') ? (hideCache.get(m) ?? hideCache.set(m, hideAware(m)).get(m)) : m);
  const kindOf = id => /ground/i.test(id) ? 'ground' : /tree/i.test(id) ? 'tree'
    : /facade|building|landmark|roof|recipe|kit|types|tile/i.test(id) ? 'building' : 'other';
  const saved = [], kinds = {};
  for (const entry of frame.registry.all()) {
    const kind = kindOf(entry.id); kinds[entry.id] = kind;
    const mat = kind === 'building' ? normal : kind === 'ground' ? ground : kind === 'tree' ? tree : other;
    entry.participant.wrapper.traverse(o => {
      if (!o.material) return;
      saved.push([o, o.material, o.customDepthMaterial]);
      // Meshes whose own shader displaces or culls vertices keep their geometry close enough for a mask.
      const id = idMaterial(o, mat);
      o.material = Array.isArray(o.material) ? o.material.map(() => id) : id;
    });
  }
  const layers = [];
  for (const layer of map.getStyle().layers) {
    if (layer.type === 'custom') continue;
    if (layer.type === 'background') { layers.push([layer.id, 'paint', 'background-color', map.getPaintProperty(layer.id, 'background-color')]); map.setPaintProperty(layer.id, 'background-color', '#000000'); continue; }
    layers.push([layer.id, 'layout', 'visibility', map.getLayoutProperty(layer.id, 'visibility')]);
    map.setLayoutProperty(layer.id, 'visibility', 'none');
  }
  const sky = map.getSky?.();
  if (map.setSky) map.setSky({ 'sky-color': '#000000', 'horizon-color': '#000000', 'fog-color': '#000000', 'sky-horizon-blend': 0, 'horizon-fog-blend': 0, 'fog-ground-blend': 0, 'atmosphere-blend': 0 });
  const toneMapping = frame.renderer.toneMapping;
  frame.renderer.toneMapping = THREE.NoToneMapping;
  map.triggerRepaint();
  window.__probe = { maskKinds: kinds };
  window.__regionMaskRestore = () => {
    for (const [o, m, d] of saved) { o.material = m; o.customDepthMaterial = d; }
    for (const [id, kind, prop, value] of layers) {
      try { if (kind === 'paint') map.setPaintProperty(id, prop, value ?? null); else map.setLayoutProperty(id, prop, value ?? 'visible'); } catch (_) { /* gone */ }
    }
    if (map.setSky) map.setSky(sky ?? {});
    frame.renderer.toneMapping = toneMapping;
    map.triggerRepaint();
  };
})();
