/** Cache the ordered OSM A10 route as the enrichment priority boundary. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

type NodeElement = { type: 'node'; id: number; lat: number; lon: number };
type WayElement = { type: 'way'; id: number; nodes: number[] };
type RelationElement = { type: 'relation'; id: number; members: Array<{ type: string; ref: number; role: string }>; tags: Record<string, string> };
type OsmResponse = { version: string; generator: string; elements: Array<NodeElement | WayElement | RelationElement> };
const outputDirectory = path.resolve('.cache/building-enrichment');
const rawFile = path.join(outputDirectory, 'a10-osm-relation-165334.json');
const outputFile = path.join(outputDirectory, 'a10-boundary.geojson');
await mkdir(outputDirectory, { recursive: true });
let response: OsmResponse;
try { response = JSON.parse(await readFile(rawFile, 'utf8')) as OsmResponse; }
catch {
  const remote = await fetch('https://api.openstreetmap.org/api/0.6/relation/165334/full.json', { headers: { 'User-Agent': 'MapRecallBuildingEnrichment/1.0' } });
  if (!remote.ok) throw new Error(`OSM HTTP ${remote.status}`);
  response = await remote.json() as OsmResponse;
  await writeFile(rawFile, JSON.stringify(response));
}
const nodes = new Map(response.elements.filter((x): x is NodeElement => x.type === 'node').map(node => [node.id, node]));
const ways = new Map(response.elements.filter((x): x is WayElement => x.type === 'way').map(way => [way.id, way]));
const relation = response.elements.find((x): x is RelationElement => x.type === 'relation' && x.id === 165334);
if (!relation) throw new Error('OSM A10 relation 165334 missing');
const routeWays = relation.members.filter(member => member.type === 'way' && member.role === 'forward').map(member => ways.get(member.ref)).filter((way): way is WayElement => Boolean(way));
const remaining = new Map(routeWays.map(way => [way.id, way]));
const first = routeWays[0];
const nodeIds: number[] = [...first.nodes];
remaining.delete(first.id);
while (remaining.size) {
  const end = nodeIds.at(-1);
  const next = [...remaining.values()].find(way => way.nodes[0] === end || way.nodes.at(-1) === end);
  if (!next) break;
  const ordered = next.nodes[0] === end ? next.nodes : [...next.nodes].reverse();
  nodeIds.push(...ordered.slice(1));
  remaining.delete(next.id);
  if (nodeIds.at(-1) === nodeIds[0]) break;
}
if (remaining.size) process.stderr.write(`A10 polygon used the closed connected route; ${remaining.size} branch/duplicate ways were not needed\n`);
if (nodeIds[0] !== nodeIds.at(-1)) nodeIds.push(nodeIds[0]);
const coordinates = nodeIds.map(id => {
  const node = nodes.get(id);
  if (!node) throw new Error(`A10 node ${id} missing`);
  return [node.lon, node.lat];
});
const collection = { type: 'FeatureCollection', metadata: { generatedAt: new Date().toISOString(), source: 'OpenStreetMap relation 165334', license: 'ODbL 1.0', relationVersion: relation.tags, points: coordinates.length }, features: [{ type: 'Feature', properties: { name: 'Inside A10', priorityTier: 1 }, geometry: { type: 'Polygon', coordinates: [coordinates] } }] };
await writeFile(outputFile, JSON.stringify(collection, null, 2));
process.stdout.write(`Wrote ${coordinates.length}-point A10 boundary to ${path.relative(process.cwd(), outputFile)}\n`);
