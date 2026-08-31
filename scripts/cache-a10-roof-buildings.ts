/** Cache active BAG buildings inside the A10, using the sourced OSM route polygon. */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
type Point = [number, number];
type BagFeature = { type: 'Feature'; id: string; properties: Record<string, unknown>; geometry: { type: 'Polygon'; coordinates: Point[][] } };
type OsmNode = { type: 'node'; id: number; lat: number; lon: number };
type OsmWay = { type: 'way'; id: number; nodes: number[] };
type OsmRelation = { type: 'relation'; id: number; members: Array<{ type: string; ref: number; role: string }> };
const root = path.resolve('.cache/roof-enrichment'), outputFile = path.join(root, 'a10-bag-buildings.geojson');
const refresh = process.argv.includes('--refresh'), wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
await mkdir(root, { recursive: true });
if (!refresh) { try { const old = JSON.parse(await readFile(outputFile, 'utf8')) as { features: unknown[] }; if (old.features.length) { process.stdout.write(`Using ${old.features.length} cached A10 BAG buildings\n`); process.exit(0); } } catch { /* miss */ } }
async function fetchJson<T>(url: string): Promise<T> { let error: unknown; for (let attempt = 0; attempt < 5; attempt++) { try { const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'MapRecallRoofEnrichment/1.0' } }); if (response.ok) return await response.json() as T; error = new Error(`HTTP ${response.status}: ${url}`); } catch (caught) { error = caught; } await wait(500 * 2 ** attempt); } throw error; }
const osmFile = path.join(root, 'a10-osm-relation-165334.json');
let osm: { elements: Array<OsmNode | OsmWay | OsmRelation> };
try { osm = JSON.parse(await readFile(osmFile, 'utf8')); } catch { osm = await fetchJson('https://api.openstreetmap.org/api/0.6/relation/165334/full.json'); await writeFile(osmFile, JSON.stringify(osm)); }
const nodes = new Map(osm.elements.filter((x): x is OsmNode => x.type === 'node').map(x => [x.id, x]));
const ways = new Map(osm.elements.filter((x): x is OsmWay => x.type === 'way').map(x => [x.id, x]));
const relation = osm.elements.find((x): x is OsmRelation => x.type === 'relation' && x.id === 165334); if (!relation) throw new Error('A10 relation missing');
const routeWays = relation.members.filter(x => x.type === 'way' && x.role === 'forward').map(x => ways.get(x.ref)).filter((x): x is OsmWay => Boolean(x));
const remaining = new Map(routeWays.map(x => [x.id, x])), first = routeWays[0], route = [...first.nodes]; remaining.delete(first.id);
while (remaining.size && route.at(-1) !== route[0]) { const end = route.at(-1), next = [...remaining.values()].find(x => x.nodes[0] === end || x.nodes.at(-1) === end); if (!next) break; const ordered = next.nodes[0] === end ? next.nodes : [...next.nodes].reverse(); route.push(...ordered.slice(1)); remaining.delete(next.id); }
if (route.at(-1) !== route[0]) route.push(route[0]);
const ring: Point[] = route.map(id => { const n = nodes.get(id); if (!n) throw new Error(`A10 node ${id} missing`); return [n.lon, n.lat]; });
const contains = ([x, y]: Point) => { let inside = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside; } return inside; };
const bounds = ring.reduce((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [Infinity, Infinity, -Infinity, -Infinity]);
const active = new Set(['Pand in gebruik', 'Pand in gebruik (niet ingemeten)', 'Bouw gestart', 'Bouwvergunning verleend']);
let next: string | undefined = `https://api.pdok.nl/kadaster/bag/ogc/v2/collections/pand/items?bbox=${bounds.join(',')}&limit=1000&f=json`, fetched = 0;
const features: BagFeature[] = [];
while (next) { const page = await fetchJson<{ features: BagFeature[]; links?: Array<{ rel: string; href: string }> }>(next); fetched += page.features.length; for (const feature of page.features) { const outer = feature.geometry.coordinates[0], centre: Point = [outer.reduce((s, p) => s + p[0], 0) / outer.length, outer.reduce((s, p) => s + p[1], 0) / outer.length]; if (active.has(String(feature.properties.status)) && contains(centre)) { feature.properties = { ...feature.properties, buildingId: `bag:${feature.properties.identificatie}` }; features.push(feature); } } next = page.links?.find(x => x.rel === 'next')?.href; process.stdout.write(`${fetched} BAG bbox records → ${features.length} inside A10\n`); }
if (features.length < 50_000) throw new Error(`Implausible A10 building count: ${features.length}`);
const output = { type: 'FeatureCollection', metadata: { schemaVersion: 1, generatedAt: new Date().toISOString(), bagSource: 'PDOK BAG OGC API v2', bagLicense: 'Public Domain Mark 1.0', boundarySource: 'OpenStreetMap relation 165334', boundaryLicense: 'ODbL 1.0', fetched }, features };
const temporary = `${outputFile}.tmp`; await writeFile(temporary, JSON.stringify(output)); await rename(temporary, outputFile);
await writeFile(path.join(root, 'a10-boundary.geojson'), JSON.stringify({ type: 'Feature', properties: { source: 'OSM relation 165334' }, geometry: { type: 'Polygon', coordinates: [ring] } }, null, 2));
process.stdout.write(`Wrote ${features.length} roof candidates\n`);
