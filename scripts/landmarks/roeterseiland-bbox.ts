import fs from 'node:fs';
const A = [122601.68, 486292.94];
for (const id of ['roeterseiland-rec-a', 'nieuwe-achtergracht-253754']) {
  const f = JSON.parse(fs.readFileSync(`scripts/building-recipes/houses/${id}/facts.json`, 'utf8'));
  const rings: number[][][] = f.bagFootprintRD;
  const pts = rings.flat();
  const xs = pts.map(p => p[0] - A[0]), zs = pts.map(p => A[1] - p[1]);
  console.log(id, 'bag rings', rings.length, 'x', Math.min(...xs).toFixed(0), Math.max(...xs).toFixed(0), 'z', Math.min(...zs).toFixed(0), Math.max(...zs).toFixed(0), 'survey polys', f.surveyFootprintPolygonsRD?.length);
  console.log('  neighbours', f.neighboursRD.map((n: any) => `${n.id.slice(-8)}:${n.heightM}`).join(' '));
}
const f = JSON.parse(fs.readFileSync('scripts/building-recipes/houses/roeterseiland-rec-a/facts.json', 'utf8'));
for (const n of f.neighboursRD) {
  const xs = n.ringRD.map((p: number[]) => p[0] - A[0]), zs = n.ringRD.map((p: number[]) => A[1] - p[1]);
  console.log(n.id.slice(-16), n.heightM, 'x', Math.min(...xs).toFixed(0), Math.max(...xs).toFixed(0), 'z', Math.min(...zs).toFixed(0), Math.max(...zs).toFixed(0));
}
