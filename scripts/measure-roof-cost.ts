// Triangle cost of the three.js building layer on real tiles: the whole chunk and the roofs alone,
// plus which roof kinds each style drew. Usage: npx tsx scripts/measure-roof-cost.ts [14/x/y ...]
import { readFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { decorateFacade } from '../src/canalRecall/genericFacades.ts';
import { decorateRoof, fitRect, localOuterRing, roofTrianglesForOutline } from '../src/canalRecall/roofMesh.ts';
import { ORIGIN } from '../src/canalRecall/threeBuildingFeatures.ts';
import { buildFeatureChunk, meshBuildingFor } from '../src/canalRecall/threeBuildingFeatures.ts';
import { shortBuildingId } from '../src/canalRecall/buildingFacts.ts';
import { decorateBuildingFeature } from '../src/canalRecall/buildingTilesBrowser.ts';

const root = 'public/data/extracts/amsterdam';
const lonLatTile = (lng: number, lat: number, z = 14) => { const n = 2 ** z, r = lat * Math.PI / 180; return [Math.floor((lng + 180) / 360 * n), Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n)]; };
const spots: Record<string, [number, number]> = { keizersgracht: [4.889273, 52.364094], rozengracht: [4.8599, 52.3613], zaanstraat: [4.874565, 52.389553] };
const tiles = process.argv.slice(2).length ? process.argv.slice(2) : Object.values(spots).map(([a, b]) => `14/${lonLatTile(a, b).join('/')}`);
const readGz = (p: string) => JSON.parse(gunzipSync(readFileSync(p)).toString('utf8'));
for (const t of [...new Set(tiles)]) {
  const [z, x, y] = t.split('/');
  const fc = readGz(`${root}/building-tiles/${z}/${x}/${y}.geojson.gz`);
  const factsPath = `${root}/building-facts/${z}/${x}/${y}.json.gz`;
  const facts = existsSync(factsPath) ? readGz(factsPath).buildings ?? {} : {};
  const feats = fc.features.map((f: any) => {
    const row = facts[shortBuildingId(String(f.properties.id ?? ''))];
    if (row) f.properties.constructionYear = row[0];
    return decorateRoof(decorateFacade(decorateBuildingFeature(f, new Map())));
  });
  const kinds: Record<string, number> = {};
  const perKind: Record<string, [number, number]> = {};
  let roofTris = 0;
  for (const f of feats) {
    if (!f.properties.roofPlanned) continue;
    const b = meshBuildingFor(f, 'photo');
    if (!b?.roof) continue;
    const plan = b.roof.plan;
    const key = `${f.properties.facadeStyle}:${plan.kind}${plan.kind === 'gable' ? `/${plan.gable}` : ''}`;
    kinds[key] = (kinds[key] ?? 0) + 1;
    const kx = 111_320 * Math.cos(ORIGIN.lat * Math.PI / 180);
    const n = roofTrianglesForOutline(b.polygons[0][0], ORIGIN, plan, b.heightM, b.roof.dims, kx).length;
    const kk = plan.kind === 'gable' ? `gable/${plan.gable}` : plan.kind;
    roofTris += n; perKind[kk] = [(perKind[kk]?.[0] ?? 0) + n, (perKind[kk]?.[1] ?? 0) + 1];
  }
  // Why the rest keep a flat lid.
  const why: Record<string, number> = {};
  for (const f of feats) {
    const p = f.properties;
    if (p.roofPlanned) continue;
    const ring = localOuterRing(f.geometry), rect = ring ? fitRect(ring) : null;
    const reason = !p.facade ? 'no-facade' : (p.roofShape && p.roofShape !== 'flat') || Number(p.roofEavesHeightM) > 0 ? 'tagged-roof'
      : Number(p.minHeight) > 0.5 ? 'part' : !rect ? `no-rect` : rect.coverage < 0.88 || rect.maxDev > 1.0 ? `not-rect:${p.facadeStyle}` : `flat:${p.facadeStyle}`;
    why[reason] = (why[reason] ?? 0) + 1;
  }
  const walls = buildFeatureChunk(feats, 'photo');
  const roofedOnly = buildFeatureChunk(feats.filter((f: any) => f.properties.roofPlanned), 'photo');
  const extras = buildFeatureChunk(feats, 'photo', 'extras');
  console.log(`${t}: ${feats.length} buildings, ${feats.filter((f: any) => f.properties.roofPlanned).length} roofed; walls chunk ${walls.indices.length / 3} tris (roofed buildings ${roofedOnly.indices.length / 3}), extras ${extras.indices.length / 3}`);
  console.log('   flat because', Object.entries(why).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}=${n}`).join(' '));
  console.log(`   roof tris ${roofTris}; mean per kind`, Object.entries(perKind).sort((a, b) => b[1][0] - a[1][0]).map(([k, [t, n]]) => `${k}=${Math.round(t / n)}x${n}`).join(' '));
  console.log('  ', Object.entries(kinds).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}=${n}`).join(' '));
}
