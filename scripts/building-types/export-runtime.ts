/**
 * Publish the confirmed building-type instances of the pilot areas for the opt-in runtime (`?buildingTypes=1`).
 *
 *   node --import tsx scripts/building-types/export-runtime.ts --areas=sonderbuur,comenius
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
const areas = arg('areas', 'sonderbuur,comenius').split(',');
const out = 'public/canal-drive/building-types';
fs.mkdirSync(out, {recursive: true});
const round = (v: number, d: number) => +v.toFixed(d);
const instances: any[] = [], units = new Set<string>(), held: Record<string, string> = {};
for (const area of areas) {
  const dir = path.join('staging/building-types', area);
  const input = JSON.parse(fs.readFileSync(path.join(dir, 'instances.json'), 'utf8')) as {anchor: Anchor};
  const report = JSON.parse(fs.readFileSync(path.join(dir, 'report.json'), 'utf8')) as {chunkGroundNapM: number; groups: any[]; instancesDetail: any[]};
  const placements = new Map((JSON.parse(fs.readFileSync(path.join(dir, 'placements.json'), 'utf8')).placements as any[]).map(p => [p.pand, p]));
  const nominal = new Map(report.groups.map(g => [g.key as string, g.nominal as {L: number; W: number; eaves: number; ridge?: number}]));
  for (const d of report.instancesDetail) {
    if (d.held) { held[d.pandId] = d.held; continue; }
    const key = [d.type, d.variant, d.storeys, d.roofUsed, d.ridge, d.groundMode].join('|'), n = nominal.get(key);
    if (!n) throw new Error(`no group ${key}`);
    const unit = key.replace(/\|/g, '__'), t = placements.get(d.pandId).transform;
    const [lng, lat] = localToLngLat(input.anchor, [t.positionChunk[0], t.positionChunk[2]]);
    // yaw (rad) takes front +z to the world normal (sin yaw, cos yaw) in east/south; compass bearing of the front:
    const front = bearingDeg(Math.sin(t.yawRad), Math.cos(t.yawRad));
    units.add(unit);
    instances.push({
      pand: d.pandId, unit, anchor: [round(lng, 8), round(lat, 8)], northOffsetDegrees: round((front - 180 + 360) % 360, 3),
      scale: [round(d.lengthM / n.L, 4), round(d.eavesM / n.eaves, 4), round(d.widthM / n.W, 4)], variant: d.variant,
      // Altitude the instance is lifted by in the game's own frame: the basemap ground is flat at 0 (as for street chunks).
      groundAltitudeMetres: 0, groundNapM: round(t.positionEastNapSouth[1], 2), area,
    });
  }
}
for (const unit of units) {
  const area = areas.find(a => fs.existsSync(path.join('staging/building-types', a, 'types', `${unit}.glb`)))!;
  fs.copyFileSync(path.join('staging/building-types', area, 'types', `${unit}.glb`), path.join(out, `${unit}.glb`));
}
fs.writeFileSync(path.join(out, 'instances.json'), JSON.stringify(instances) + '\n');
console.log(`${instances.length} instances, ${units.size} units, ${Object.keys(held).length} held`, [...units]);
