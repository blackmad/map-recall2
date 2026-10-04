/** Verify irregular replacements retain nearby buildings and restore them when hidden. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
const catalogue = JSON.parse(fs.readFileSync('src/canalRecall/landmarks/manualCatalogue.json', 'utf8'));
// Complete-city tiles use canonical OSM and BAG identities. A made-up BAG
// prefix silently leaves the generic parent visible beneath an original mesh.
for (const spec of catalogue) for (const id of spec.suppressOsmIds) {
  assert.match(id, /^(?:[nwr][0-9]+|NL\.IMBAG\.Pand\.[0-9]{16})$/, `${spec.id}: unsupported suppression identity ${id}`);
}
const exactIds = ['embassy-free-mind', 'anne-frank-house', 'rembrandt-house', 'moco-museum', 'museum-van-loon', 'het-schip', 'scheepvaarthuis', 'rialto', 'kriterion', 'de-bijenkorf', 'gashouder', 'stadsschouwburg', 'tuschinski', 'pathe-city', 'oude-kerk', 'nieuwe-kerk', 'buiksloterkerk', 'english-reformed-church', 'de-papegaai', 'de-hallen', 'huis-bartolotti', 'hart-museum', 'amsterdam-museum', 'national-holocaust-museum', 'hollandsche-schouwburg', 'jewish-museum', 'portuguese-synagogue', 'homomonument', 'micropia-ledenlokalen', 'artis-entrance', 'hortus-greenhouses', 'arcam', 'brakke-grond', 'frascati', 'boom-chicago', 'foam', 'huis-marseille', 'ons-lieve-heer-op-solder', 'agnietenkapel', 'lab111', 'occii', 'ketelhuis', 'wereldmuseum-amsterdam', 'dutch-resistance-museum', 'allard-pierson', 'dominicuskerk', 'vredeskerk', 'badhuistheater', 'cinecenter', 'studiok', 'groote-museum', 'artis-library', 'de-dokwerker', 'willet-holthuysen', 'amsterdam-pipe-museum', 'athenaeum', 'scheltema', 'haarlemmermeerstation', 'begijnhofkapel', 'huis-de-pinto', 'amsterdam-tulip-museum', 'ot301', 'cavia', 'orgelpark', 'houten-huys', 'herepoort-bergpoort', 'huis-aan-drie-grachten', 'de-dolphijn', 'rode-hoed', 'theater-amsterdam', 'vondelpark-open-air-theater', 'vondelpark-bandstand', 'oost-indisch-huis', 'het-veem', 'tobacco-theater', 'plein-theater', 'hash-marihuana-hemp-museum', 'hemp-gallery', 'madame-tussauds'];
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
} finally {
  delete globalThis.window;
}
console.log('Exact building suppression, neighbor preservation and hidden-model restoration passed.');
