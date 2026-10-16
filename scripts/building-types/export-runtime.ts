/**
 * Publish the confirmed building-type instances of the pilot areas for the runtime (default on since 2026-10-16).
 *
 *   node --import tsx scripts/building-types/export-runtime.ts --areas=sonderbuur,comenius
 *   node --import tsx scripts/building-types/export-runtime.ts --areas=nwsub-a,nwsub-b --merge   # keep the already published instances of other areas
 *
 * Reads  staging/building-types/<area>/{instances,placements,report}.json + types/<unit>.glb (build.ts output)
 * Writes public/canal-drive/building-types/<unit>.glb (one shared mesh per design unit, only units that have a confirmed instance)
 *        public/canal-drive/building-types/instances.json  [{pand, unit, anchor, northOffsetDegrees, scale, variant, groundAltitudeMetres, ...}]
 * Held pands (variants.json `hold`: design not confirmed from a photo) are NOT exported and keep their OSM/BAG extrusion.
 * `northOffsetDegrees` is the loader's convention (surveyed placement: 0 = glTF +X east, -Z north; clockwise positive):
 * the unit's front (+z) points at compass bearing 180 + northOffsetDegrees.
 */
import fs from 'node:fs';
import path from 'node:path';
import {localToLngLat, bearingDeg, type Anchor} from '../../src/canalRecall/buildingTypes/geometry.ts';

const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const areas = arg('areas', 'sonderbuur,comenius').split(','), merge = process.argv.includes('--merge');
const out = 'public/canal-drive/building-types';
fs.mkdirSync(out, {recursive: true});
const round = (v: number, d: number) => +v.toFixed(d);
const instances: any[] = [], units = new Set<string>(), held: Record<string, string> = {};
if (merge && fs.existsSync(path.join(out, 'instances.json'))) {
  // --merge: instances of areas that are not re-exported stay exactly as published (their unit files stay too).
  for (const i of JSON.parse(fs.readFileSync(path.join(out, 'instances.json'), 'utf8')) as any[]) if (!areas.includes(i.area)) instances.push(i);
}
const kept = instances.length;
// Several areas can produce the same unit (type, variant, storeys, roof, ridge, ground). Each area's build sizes the unit
// mesh at its own median, so one canonical mesh per unit is chosen (see below) and every instance's scale is computed against THAT mesh's nominal size.
type Nominal = {L: number; W: number; eaves: number; ridge?: number};
const canon = new Map<string, {area: string; members: number; nominal: Nominal}>();
const candidates = new Map<string, {area: string; members: number; nominal: Nominal}[]>();
for (const area of areas) {
  const rep = JSON.parse(fs.readFileSync(path.join('staging/building-types', area, 'report.json'), 'utf8')) as {groups: any[]};
  for (const g of rep.groups) {
    const unit = (g.key as string).replace(/\|/g, '__');
    (candidates.get(unit) ?? candidates.set(unit, []).get(unit)!).push({area, members: g.members, nominal: g.nominal});
  }
}
// Canonical mesh per unit: the area whose nominal frontage is closest to the member-weighted median over all areas (so no instance is
// stretched more than the neighbourhood-to-neighbourhood spread of the type, e.g. 4.7-5.6 m terraced-house frontages around 5.0 m), ties to the larger group.
for (const [unit, list] of candidates) {
  const sorted = [...list].sort((a, b) => a.nominal.L - b.nominal.L), total = list.reduce((t, c) => t + c.members, 0);
  let acc = 0, median = sorted[0].nominal.L;
  for (const c of sorted) { acc += c.members; if (acc >= total / 2) { median = c.nominal.L; break; } }
  canon.set(unit, [...list].sort((a, b) => Math.abs(a.nominal.L - median) - Math.abs(b.nominal.L - median) || b.members - a.members)[0]);
}
for (const area of areas) {
  const dir = path.join('staging/building-types', area);
  const input = JSON.parse(fs.readFileSync(path.join(dir, 'instances.json'), 'utf8')) as {anchor: Anchor};
  const report = JSON.parse(fs.readFileSync(path.join(dir, 'report.json'), 'utf8')) as {chunkGroundNapM: number; groups: any[]; instancesDetail: any[]};
  const placements = new Map((JSON.parse(fs.readFileSync(path.join(dir, 'placements.json'), 'utf8')).placements as any[]).map(p => [p.pand, p]));
  for (const d of report.instancesDetail) {
    if (d.held) { held[d.pandId] = d.held; continue; }
    const key = [d.type, d.variant, d.storeys, d.roofUsed, d.ridge, d.groundMode, ...(d.sides ? [d.sides] : []), ...(d.mirrored ? ['mirror'] : [])].join('|');
    const unit = key.replace(/\|/g, '__'), n = canon.get(unit)?.nominal;
    if (!n) throw new Error(`no group ${key}`);
    const t = placements.get(d.pandId).transform;
    const [lng, lat] = localToLngLat(input.anchor, [t.positionChunk[0], t.positionChunk[2]]);
    // yaw (rad) takes front +z to the world normal (sin yaw, cos yaw) in east/south; compass bearing of the front:
    const front = bearingDeg(Math.sin(t.yawRad), Math.cos(t.yawRad));
    units.add(unit);
    instances.push({
      pand: d.pandId, unit, anchor: [round(lng, 8), round(lat, 8)], northOffsetDegrees: round((front - 180 + 360) % 360, 3),
      scale: [round(d.lengthM / n.L, 4), round(d.eavesM / n.eaves, 4), round(d.widthM / n.W, 4)], variant: d.variant,
      // Altitude the instance is lifted by in the game's own frame: the basemap ground is flat at 0 (as for street chunks).
      groundAltitudeMetres: 0, groundNapM: round(t.positionEastNapSouth[1], 2), area,
      ...(d.absorbed?.length ? {alsoSuppress: d.absorbed} : {}),
    });
  }
}
for (const unit of units) {
  const area = canon.get(unit)!.area;
  fs.copyFileSync(path.join('staging/building-types', area, 'types', `${unit}.glb`), path.join(out, `${unit}.glb`));
}
fs.writeFileSync(path.join(out, 'instances.json'), JSON.stringify(instances) + '\n');
console.log(`${instances.length} instances (${kept} kept, ${instances.length - kept} exported), ${units.size} exported units, ${Object.keys(held).length} held`, [...units]);
