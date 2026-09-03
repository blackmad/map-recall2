/**
 * Compile reviewed multi-model façade proposals into a self-contained procedural block demo.
 *
 * Caveat inherited from its input: only one of the six pilot targets is a building
 * (see FACADE_ENRICHMENT_DESIGN.md). The others are sheds, so this demo shows that the
 * grammar compiles into depth-correct geometry, not that the grammar is right.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (name: string) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(arg('root') || '.cache/facade-review');
const output = path.resolve(arg('output') || 'public/data/facade-block-demo/grammars.json');
type Label = Record<string, unknown> & { visibilityConfidence?: number };
type Result = { osmId: string; centre: [number, number]; proposals: Array<{ model: string; label?: Label }>; consensus: Record<string, unknown> };
const inference = JSON.parse(await readFile(path.join(root, 'facade-grammar-proposals.json'), 'utf8')) as { models: string[]; results: Result[] };
const footprints = JSON.parse(await readFile('public/data/extracts/amsterdam/buildings-colored.geojson', 'utf8')) as { features: Array<{ geometry: { type: string; coordinates: unknown }; properties: { osmId?: string } }> };
const anchor = inference.results.find(result => result.osmId === (arg('anchor') || 'w274039950')) || inference.results[0];
const distance = (result: Result) => Math.hypot((result.centre[0] - anchor.centre[0]) * 68_000, (result.centre[1] - anchor.centre[1]) * 111_000);
const selected = [...inference.results].sort((a, b) => distance(a) - distance(b)).slice(0, Math.min(4, inference.results.length));
const fields = ['visibleStoreys','bayCount','windowPattern','windowToWall','windowRecess','groundFloorType','entranceType','balconyType','facadeComposition','roofline','ornament','facadeMaterial','facadeColour','groundFloorDistinct','windowFrameColour'];
const buildings = selected.map((result, index) => {
  const ranked = result.proposals.flatMap(proposal => proposal.label ? [{ ...proposal, label: proposal.label } as { model: string; label: Label }] : []).sort((a, b) => Number(b.label.visibilityConfidence || 0) - Number(a.label.visibilityConfidence || 0));
  const grammar: Record<string, unknown> = {}, provenance: Record<string, string> = {};
  for (const field of fields) {
    if (field in result.consensus) { grammar[field] = result.consensus[field]; provenance[field] = 'model-consensus'; }
    else {
      const values = ranked.map(value => value.label[field]).filter(value => value !== undefined && value !== 'unknown');
      if (['visibleStoreys', 'bayCount'].includes(field)) {
        // Averaging a disputed count invents a value neither model saw. Measured agreement
        // says storeys disagree only by +/-1 while bay counts disagree outright, so a mean is
        // safe within one storey and dishonest beyond it. See FACADE_ENRICHMENT_DESIGN.md.
        const numbers = values.filter(value => typeof value === 'number').map(Number).sort((a, b) => a - b);
        const spread = numbers.length ? numbers[numbers.length - 1] - numbers[0] : Infinity;
        grammar[field] = numbers.length && spread <= 1 ? Math.round(numbers.reduce((sum, value) => sum + value, 0) / numbers.length) : null;
        provenance[field] = grammar[field] === null ? 'model-disputed-abstained' : 'model-disputed-within-one';
        continue;
      }
      grammar[field] = values[0] ?? null;
      provenance[field] = 'model-disputed';
    }
  }
  return { id: result.osmId, order: index, geometrySource: undefined as undefined | Record<string, unknown>, distanceFromAnchorMetres: Math.round(distance(result)), grammar, provenance, proposals: result.proposals };
});
const artifact = { schemaVersion: 1, generatedAt: new Date().toISOString(), title: 'Procedural façade study block', anchor: anchor.osmId, policy: { consensusPreferred: true, disputedCategoricalFallback: 'highest-visibility-confidence-model', disputedCountFallback: 'mean-within-one-storey-else-abstain', abstainedCountSource: 'measured-height-and-facade-width', status: 'machine-proposal' }, models: inference.models, buildings };
await mkdir(path.dirname(output), { recursive: true });
const STOREY_METRES = 3, BAY_METRES = 3.6;
const palette: Record<string, string> = { brown: '#765345', red: '#934e3d', yellow: '#c7aa70', cream: '#d4c7a8', white: '#d9d9d2', grey: '#898d8c', black: '#333536', blue: '#587589', green: '#687c67', mixed: '#8a7668', unknown: '#8d8174' };
const selectedById = new Map(buildings.map(building => [building.id, building]));
const buildingFeatures: unknown[] = [], openingFeatures: unknown[] = [];
const metresToDegrees = (x: number, y: number, latitude: number): [number, number] => [x / (111_320 * Math.cos(latitude * Math.PI / 180)), y / 111_320];
for (const feature of footprints.features) {
  const building = selectedById.get(String(feature.properties.osmId || ''));
  if (!building) continue;
  const polygon = feature.geometry.type === 'Polygon' ? feature.geometry.coordinates as number[][][] : (feature.geometry.coordinates as number[][][][])[0];
  const ring = polygon[0], latitude = ring.reduce((sum, point) => sum + point[1], 0) / ring.length;
  const edges = ring.slice(0, -1).map((point, index) => ({ a: point, b: ring[index + 1], length: Math.hypot((ring[index + 1][0] - point[0]) * 111_320 * Math.cos(latitude * Math.PI / 180), (ring[index + 1][1] - point[1]) * 111_320) }));
  const edge = edges.sort((a, b) => b.length - a.length)[0];
  // A measured building height beats a model counting storeys through foliage.
  const measuredHeight = Number(feature.properties.height);
  const storeySource = Number.isFinite(measuredHeight) && measuredHeight >= 3 ? 'measured-height'
    : building.grammar.visibleStoreys != null ? 'model-grammar' : 'default';
  const storeys = Math.max(2, Math.min(6, storeySource === 'measured-height' ? Math.round(measuredHeight / STOREY_METRES)
    : Number(building.grammar.visibleStoreys || 3)));
  const height = storeys * STOREY_METRES;
  buildingFeatures.push({ type: 'Feature', geometry: feature.geometry, properties: { id: building.id, kind: 'facade', height, storeys, storeySource, colour: palette[String(building.grammar.facadeColour)] || palette.unknown } });
  // Bay count is the least reliable grammar field, so an abstention falls back to the one
  // thing actually measured about the rhythm: how wide the facade is.
  const baySource = building.grammar.bayCount != null ? 'model-grammar' : 'derived-from-facade-width';
  const bays = Math.max(2, Math.min(8, baySource === 'model-grammar' ? Number(building.grammar.bayCount)
    : Math.round(edge.length / BAY_METRES)));
  const dx = edge.b[0] - edge.a[0], dy = edge.b[1] - edge.a[1], length = Math.hypot(dx, dy), nx = -dy / length, ny = dx / length;
  building.geometrySource = { storeySource, baySource, facadeWidthMetres: Number(edge.length.toFixed(1)) };
  const opening = (fraction: number, widthFraction: number, base: number, top: number, kind: string) => {
    const half = widthFraction / 2, p1 = [edge.a[0] + dx * (fraction - half), edge.a[1] + dy * (fraction - half)], p2 = [edge.a[0] + dx * (fraction + half), edge.a[1] + dy * (fraction + half)], offset = metresToDegrees(nx * .22, ny * .22, latitude);
    const q1 = [p1[0] + offset[0], p1[1] + offset[1]], q2 = [p2[0] + offset[0], p2[1] + offset[1]];
    openingFeatures.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [[p1, p2, q2, q1, p1]] }, properties: { id: building.id, kind, base, height: top, colour: kind === 'door' ? '#d9d2bf' : '#203944' } });
  };
  for (let floor = 1; floor < storeys; floor++) for (let bay = 0; bay < bays; bay++) opening((bay + .5) / bays, .52 / bays, floor * 3 + .65, floor * 3 + 2.35, 'window');
  const doorCount = building.grammar.entranceType === 'single-residential' ? 1 : Math.min(3, bays);
  for (let door = 0; door < doorCount; door++) opening((door + .5) / doorCount, .28 / doorCount, .05, 2.35, 'door');
}
await writeFile(path.join(path.dirname(output), 'world.geojson'), `${JSON.stringify({ type: 'FeatureCollection', features: [...buildingFeatures, ...openingFeatures] })}\n`);
await writeFile(output, `${JSON.stringify(artifact, null, 2)}\n`);
const measured = buildings.filter(building => building.geometrySource?.storeySource === 'measured-height').length;
const derivedBays = buildings.filter(building => building.geometrySource?.baySource === 'derived-from-facade-width').length;
process.stdout.write(`Compiled ${buildings.length} façade grammars around ${anchor.osmId}: ${measured} use measured height, ${derivedBays} derive bays from façade width.\n`);
