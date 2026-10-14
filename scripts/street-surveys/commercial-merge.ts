/**
 * Commercial-street survey, phase B: merge crops (staging/pand-reference*), capture dates, ground-floor uses
 * (block-face uses.json) and the final face id (what intake actually discovered) into the street index, and flag the
 * pands that need large-tier / bespoke treatment.
 *
 *   node --import tsx scripts/street-surveys/commercial-merge.ts --street=Kinkerstraat
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const street = arg('street') ?? 'Kinkerstraat';
const file = path.join('scripts/street-surveys/streets', `${street.toLowerCase()}.json`);
const doc = JSON.parse(await fs.readFile(file, 'utf8'));
const read = (f: string) => fs.readFile(f, 'utf8').then(JSON.parse).catch(() => null);

// The faces that exist are the intake outputs (discovery.json), not the proposals: some proposals merged, split at bends or failed.
const prefix = arg('prefix') ?? 'kinker';
doc.proposedFaces ??= doc.faces;
const actual: any[] = [];
for (const d of (await fs.readdir('scripts/block-face/faces')).filter(n => n.startsWith(prefix + '-')).sort()) {
  const disc = await read(path.join('scripts/block-face/faces', d, 'discovery.json')), strip = await read(path.join('scripts/block-face/faces', d, 'strip.json'));
  if (!disc) continue;
  const mine = doc.pands.filter((p: any) => disc.members.includes(p.pandId));
  const nums = mine.flatMap((p: any) => p.numbers as number[]);
  actual.push({id: d, side: mine[0]?.side ?? null, numbers: nums.length ? [Math.min(...nums), Math.max(...nums)] : null, pandCount: disc.members.length, surveyedPands: mine.length, extraNoAddressPands: disc.members.length - mine.length, members: disc.members, seed: disc.seed,
    stripDate: strip?.date ?? null, stripCoverage: strip?.coverage ?? null, stripPx: strip ? [strip.width, strip.height] : null, ends: disc.ends});
}
doc.faces = actual;
const faceOf = new Map<string, string>();
for (const f of actual) for (const id of f.members) faceOf.set(id, f.id);
const usesBy = new Map<string, any>();
for (const f of doc.faces) {
  if (!f.discovered) continue;
  const u = await read(path.join('scripts/block-face/faces', f.id, 'uses.json'));
  for (const p of u?.pands ?? []) usesBy.set(p.pandId, p);
}
const bearing = (n: number[]) => Math.round((Math.atan2(n[0], n[1]) * 180 / Math.PI + 360) % 360);
const angDiff = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

for (const p of doc.pands) {
  const ref = await read(`staging/pand-reference/${p.pandId}/reference.json`);
  p.face = faceOf.get(p.pandId) ?? null;
  p.faceNote = p.face ? undefined : (p.proposedFace ? `proposed ${p.proposedFace} but intake did not discover it as a member` : 'no frontage on the street');
  if (ref) {
    const wallBearing = ref.wall?.outwardBearingDeg ?? null, want = p.survey?.normal ? bearing(p.survey.normal) : null;
    const otherFronts = (ref.otherWalls ?? []).filter((w: any) => w.nearestRoadM <= 15 && w.facingRoad >= 0.7 && w.lengthM >= 6).length;
    p.crop = {
      path: ref.images?.front ? `staging/pand-reference/${p.pandId}/front.jpg` : null, status: ref.status, panoId: ref.primary?.panoId ?? null,
      capturedAt: ref.primary?.timestamp?.slice(0, 10) ?? null, altCapturedAt: ref.alt?.timestamp?.slice(0, 10) ?? null,
      washedOut: ref.quality?.frontWashedOut ?? null, foliage: ref.quality?.frontFoliage ?? null, obliquityDeg: ref.primary?.obliquityDeg ?? null,
      wallBearingDeg: wallBearing, streetFrontBearingDeg: want, wallIsStreetFront: wallBearing === null || want === null ? null : angDiff(wallBearing, want) < 25,
      altWashedOut: ref.quality?.altWashedOut ?? null, swapped: !!ref.swapped,
    };
    if (p.crop.wallIsStreetFront === false) {
      const w = await read(`staging/pand-reference-walls/${p.pandId}/walls.json`);
      const hit = (w?.walls ?? []).find((x: any) => want !== null && angDiff(x.bearing, want) < 25 && x.crop);
      p.crop.streetWall = hit ? {path: `staging/pand-reference-walls/${p.pandId}/${hit.tag}.jpg`, capturedAt: hit.capturedAt, lengthM: hit.lengthM, washedOut: hit.washedOut ?? null} : null;
    }
    p.roadFronts = 1 + otherFronts;
  } else p.crop = null;
  const u = usesBy.get(p.pandId);
  if (u) {
    p.uses = {addresses: u.addresses, groundGebruiksdoel: [...new Set(u.groundUnits.map((g: any) => g.use))], groundAreaM2: u.groundUnits.reduce((s: number, g: any) => s + (g.areaM2 || 0), 0),
      osm: u.osm.map((b: any) => ({name: b.tags.name ?? null, category: b.tags.shop ? `shop=${b.tags.shop}` : b.tags.amenity ? `amenity=${b.tags.amenity}` : b.tags.craft ? `craft=${b.tags.craft}` : b.tags.office ? `office=${b.tags.office}` : b.tags.tourism ? `tourism=${b.tags.tourism}` : null, osmId: `${b.type}/${b.id}`, match: b.match}))};
  }
  const flags: string[] = [], s = p.survey ?? {};
  if (s.frontage) {
    if (s.frontWidthM > 12) flags.push(`wide-${s.frontWidthM}m`);
    if (s.footprintAreaM2 > 1500) flags.push(`large-footprint-${s.footprintAreaM2}m2`);
    if ((p.roadFronts ?? 1) >= 4) flags.push(`${p.roadFronts}-fronts`); else if ((p.roadFronts ?? 1) >= 2 && p.numbers.length >= 1) flags.push(`${p.roadFronts}-road-fronts`);
    if (p.styleGroup === '1980s-infill' && s.frontWidthM > 12) flags.push('infill-wider-than-12m');
  }
  if (p.crop && p.crop.wallIsStreetFront === false) flags.push(p.crop.streetWall ? 'street-wall-from-all-walls' : 'crop-not-street-front-NO-STREET-WALL');
  if (!p.crop || !p.crop.path) flags.push('no-crop');
  else if (p.crop.status !== 'ok') flags.push(`crop-${p.crop.status}`);
  p.flags = flags;
}
doc.mergedAt = new Date().toISOString().slice(0, 10);
await fs.writeFile(file, JSON.stringify(doc, null, 1) + '\n');
const count = (k: (p: any) => string) => { const m: Record<string, number> = {}; for (const p of doc.pands) m[k(p)] = (m[k(p)] ?? 0) + 1; return m; };
console.log('style x side', JSON.stringify(count(p => `${p.styleGroup}/${p.side}`)));
console.log('flags', JSON.stringify(count(p => p.flags.join('+') || 'none')));
