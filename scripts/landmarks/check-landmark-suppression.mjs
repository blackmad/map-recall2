/** Verify irregular replacements retain nearby buildings and restore them when hidden. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const catalogue = JSON.parse(fs.readFileSync('src/canalRecall/landmarks/manualCatalogue.json', 'utf8'));
// Complete-city tiles use canonical OSM and BAG identities. A made-up BAG
// prefix silently leaves the generic parent visible beneath an original mesh.
for (const spec of catalogue) for (const id of spec.suppressOsmIds) {
  assert.match(id, /^(?:[nwr][0-9]+|NL\.IMBAG\.Pand\.[0-9]{16})$/, `${spec.id}: unsupported suppression identity ${id}`);
}
const exactIds = ['embassy-free-mind', 'anne-frank-house', 'rembrandt-house', 'moco-museum', 'museum-van-loon', 'het-schip', 'scheepvaarthuis', 'rialto', 'kriterion', 'de-bijenkorf', 'gashouder', 'stadsschouwburg', 'tuschinski', 'pathe-city', 'oude-kerk', 'nieuwe-kerk', 'buiksloterkerk', 'english-reformed-church', 'de-papegaai', 'de-hallen', 'huis-bartolotti', 'hart-museum', 'amsterdam-museum', 'national-holocaust-museum', 'hollandsche-schouwburg', 'jewish-museum', 'portuguese-synagogue', 'homomonument', 'micropia-ledenlokalen', 'artis-entrance', 'hortus-greenhouses', 'arcam', 'brakke-grond', 'frascati', 'boom-chicago', 'foam', 'huis-marseille', 'ons-lieve-heer-op-solder', 'agnietenkapel', 'lab111', 'occii', 'ketelhuis', 'wereldmuseum-amsterdam', 'dutch-resistance-museum', 'allard-pierson', 'dominicuskerk', 'vredeskerk', 'badhuistheater', 'cinecenter', 'studiok', 'groote-museum', 'artis-library', 'de-dokwerker', 'willet-holthuysen', 'amsterdam-pipe-museum', 'athenaeum', 'scheltema', 'haarlemmermeerstation', 'begijnhofkapel', 'huis-de-pinto', 'amsterdam-tulip-museum', 'ot301', 'cavia', 'orgelpark', 'houten-huys', 'herepoort-bergpoort', 'huis-aan-drie-grachten', 'de-dolphijn', 'rode-hoed', 'theater-amsterdam', 'vondelpark-open-air-theater', 'vondelpark-bandstand', 'oost-indisch-huis', 'het-veem', 'tobacco-theater', 'plein-theater', 'hash-marihuana-hemp-museum', 'hemp-gallery', 'madame-tussauds', 'amsterdam-dungeon', 'sint-jorishof', 'walloon-church', 'schreierstoren', 'huize-lydia', 'eye-filmmuseum', 'royal-theater-carre', 'sint-nicolaas', 'rijksmuseum', 'silodam'];
exactIds.push('westerkerk', 'montelbaanstoren-amsterdam', 'sexmuseum-venustempel', 'oude-lutherse-kerk', 'kattenkabinet', 'pianola-museum');
exactIds.push('munttoren-amsterdam', 'national-monument-on-the-dam', 'de-beurs-van-berlage');
exactIds.push('magna-plaza');
const magna = catalogue.find(spec => spec.id === 'magna-plaza');
const venues = JSON.parse(fs.readFileSync('scripts/landmarks/venue-footprints.json', 'utf8'));
const magnaSource = venues.find(source => source.id === magna.id);
assert.ok(magna.suppressOsmIds.includes(`NL.IMBAG.Pand.${magnaSource.tags['ref:bag']}`),
  'Magna Plaza must suppress its surveyed BAG carrier in complete-city tiles');
for (const id of exactIds) {
  const spec = catalogue.find(spec => spec.id === id);
  assert.ok(spec, id);
  assert.equal(spec.spatialSuppression, false, `${id}: padded rectangles would hide neighboring buildings`);
  assert.ok(spec.suppressOsmIds.length, `${id}: exact building IDs still required`);
}
// The older church roof patch crosses the current parent boundary: only its
// exact identity is replaced, never the separate historic house beside it.
const dominicus = catalogue.find(spec => spec.id === 'dominicuskerk');
assert.ok(dominicus.suppressOsmIds.includes('w749599657'));
for (const neighbor of ['w266621396', 'NL.IMBAG.Pand.0363100012179327']) {
  assert.equal(dominicus.suppressOsmIds.includes(neighbor), false);
}
// Exercise the runtime methods without creating a WebGL context.
globalThis.window = {CanalRecallThree: {THREE: {}}, CanalRecallSignatureLandmarks: {}};
try {
  const source = fs.readFileSync('public/canal-drive/js/signature-landmarks-source.js', 'utf8');
  const {SignatureLandmarks} = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const layer = Object.create(SignatureLandmarks.prototype);
  const exact = catalogue.find(spec => spec.id === 'het-schip');
  const spatial = catalogue.find(spec => spec.id === 'stedelijk-museum');
  assert.ok(spatial);
  Object.assign(layer, {enabled: true, suppressing: true, _entries: [{spec: exact}, {spec: spatial}]});
  assert.deepEqual(layer.shownFootprints(), [spatial.footprint]);
  assert.deepEqual(layer.shownSuppressOsmIds(), [...exact.suppressOsmIds, ...spatial.suppressOsmIds]);
  layer.enabled = false;
  assert.deepEqual(layer.shownFootprints(), []);
  assert.deepEqual(layer.shownSuppressOsmIds(), []);
  layer.enabled = true;
  layer.suppressing = false;
  assert.deepEqual(layer.shownFootprints(), []);
  assert.deepEqual(layer.shownSuppressOsmIds(), []);
  const material = {}, group = {traverse: visit => visit({isMesh: true, material})};
  Object.assign(layer, {enabled: true, suppressing: true, depthBiasEnabled: true,
    shown: new Set([exact.id]), onHostWallOpeningsChanged() {}, onSuppressionChanged() {},
    manageBasemapFilter: false, map: {triggerRepaint() {}}, _entries: [{spec: exact, group}]});
  layer._applySuppression();
  assert.equal(material.polygonOffset, true, 'standalone basemap fallback retains its legacy bias');
  assert.equal(material.polygonOffsetFactor, -32);
  layer.setDepthBiasEnabled(false);
  assert.equal(material.polygonOffset, false, 'complete-city host draws overlapping roofs with normal depth');
  assert.equal(material.polygonOffsetFactor, 0);
  assert.equal(material.polygonOffsetUnits, 0);
  assert.ok(layer.shownSuppressOsmIds().includes(exact.suppressOsmIds[0]));
  layer.setDepthBiasEnabled(true);
  assert.equal(material.polygonOffset, true, 'fallback can restore its bias');
  const notifications = [];
  layer.onSuppressionChanged = () => notifications.push(layer.shownSuppressOsmIds());
  layer.enabled = false;
  layer._applySuppression();
  assert.deepEqual(notifications.at(-1), [], 'disabling immediately tells host shell/roof layers to restore fallback');
  layer.enabled = true;
  layer._applySuppression();
  assert.deepEqual(notifications.at(-1), exact.suppressOsmIds, 'reenabling a loaded model restores the exact mask');
  const count = notifications.length;
  layer._applySuppression();
  assert.equal(notifications.length, count, 'unchanged masks do not trigger repeated host updates');
  layer._entries = [];
  layer.shown.clear();
  layer._applySuppression();
  assert.deepEqual(notifications.at(-1), [], 'removal or post-insertion rollback restores every host fallback');
  // Exercise the real host refresh and independent roof renderer together.
  // No WebGL is needed to prove visibility changes preserve mesh ownership.
  const context = vm.createContext({window: globalThis.window, console});
  vm.runInContext(fs.readFileSync('public/canal-drive/js/pyramidal-roofs.bundle.js', 'utf8'), context);
  vm.runInContext(fs.readFileSync('public/canal-drive/js/vector-map.js', 'utf8') + '\nglobalThis.VectorBasemap = VectorBasemap;', context);
  const roof = {ids: [exact.suppressOsmIds[0]], mesh: {visible: true}};
  const neighbor = {ids: ['wSeparateNeighbor'], mesh: {visible: true}};
  const roofs = Object.create(globalThis.window.CanalRecallPyramidalRoofs.PyramidalRoofs.prototype);
  Object.assign(roofs, {_entries: [roof, neighbor], map: {triggerRepaint() {}}});
  const host = Object.create(context.VectorBasemap.prototype);
  const shellMasks = [];
  Object.assign(host, {map: {getLayer() {return false;}}, _syncHostWallOpenings() {},
    _buildingsFromTiles: true, _appearanceFeatures: [], _signatureLandmarks: layer,
    _pyramidalRoofs: roofs, _threeBuildings: {setHidden(reason, ids) {shellMasks.push([...ids]);}}});
  layer.onSuppressionChanged = () => host._refreshBuildingSuppression();
  layer._entries = [{spec: exact, group}];
  layer._applySuppression();
  assert.equal(roof.mesh.visible, false, 'loaded replacement hides the independent roof');
  assert.equal(neighbor.mesh.visible, true, 'separate neighboring roof is retained');
  assert.deepEqual(shellMasks.at(-1), exact.suppressOsmIds);
  layer.enabled = false;
  layer._applySuppression();
  assert.equal(roof.mesh.visible, true, 'disabled replacement restores the same roof mesh');
  assert.deepEqual(shellMasks.at(-1), []);
  assert.equal(roofs._entries[0], roof, 'visibility updates preserve the original roof geometry');
} finally {
  delete globalThis.window;
}
console.log('Exact building suppression, neighbor preservation and hidden-model restoration passed.');
