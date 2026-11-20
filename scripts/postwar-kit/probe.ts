/**
 * What the game's generic path draws today for the sampled post-1965 housing members (artifacts/postwar-kit/sample.json):
 * the world pipeline's game chain and meshBuildingFor, photo look. Writes artifacts/postwar-kit/probe[-on].json.
 *   node --import tsx scripts/postwar-kit/probe.ts [--on]
 */
import fs from 'node:fs';
import path from 'node:path';
if (process.argv.includes('--on')) (globalThis as { __canalRecallPostwarKit?: boolean }).__canalRecallPostwarKit = true;
const { gameChain, loadTile } = await import('../world/pipeline.ts');
const { meshBuildingFor } = await import('../../src/canalRecall/threeBuildingFeatures.ts');
const { rgbToLab } = await import('../../src/canalRecall/look/brickTone.ts');
const ROOT = path.resolve(import.meta.dirname, '../..');
const OUT = path.join(ROOT, 'artifacts/postwar-kit');
const sample = JSON.parse(fs.readFileSync(path.join(OUT, 'sample.json'), 'utf8')) as Record<string, any>;
const want = new Set(Object.entries(sample).filter(([, r]) => r.photo).map(([id]) => `NL.IMBAG.Pand.${id}`));
const tileOf = (lng: number, lat: number) => { const n = 2 ** 14; return `${Math.floor((lng + 180) / 360 * n)}/${Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n)}`; };
const tiles = new Set(Object.values(sample).filter((r: any) => r.photo).map((r: any) => tileOf(r.centroid[0], r.centroid[1])));
const chain = gameChain();
const out: Record<string, unknown> = {};
for (const t of tiles) for (const row of await loadTile(t, chain)) {
  const f = row.styled, id = String(f.properties.id ?? '');
  if (!want.has(id) || out[id.slice(14)]) continue;
  const b = meshBuildingFor(f as never, 'photo') as any;
  const lab = b?.wallHex ? rgbToLab([1, 3, 5].map(i => parseInt(b.wallHex.slice(i, i + 2), 16)) as [number, number, number]) : null;
  out[id.slice(14)] = { wallHex: b?.wallHex, L: lab ? Math.round(lab[0]) : null, a: lab ? Math.round(lab[1]) : null, b: lab ? Math.round(lab[2]) : null, style: b?.style, upper: b?.layers?.upper, ground: b?.layers?.ground,
    postwarKit: b?.postwarKit, facadeMappedColour: f.properties.facadeMappedColour, materialPrior: f.properties.facadeMaterialColourPrior, sideColourSource: f.properties.sideColourSource, buildingType: f.properties.buildingType, year: f.properties.constructionYear, extras: b?.extras };
}
fs.writeFileSync(path.join(OUT, process.argv.includes('--on') ? 'probe-on.json' : 'probe.json'), JSON.stringify(out, null, 1));
console.log(Object.keys(out).length, 'of', want.size);
