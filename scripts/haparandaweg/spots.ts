/**
 * Camera spots for the in-game shots: one per building (38 m out from the reference wall, facing it) plus the two street ends.
 *   node --import tsx scripts/haparandaweg/spots.ts   -> artifacts/haparandaweg/spots.json
 */
import fs from 'node:fs';
import { loadSpec } from './build.ts';

const spots: { name: string; at: [number, number]; face: [number, number] }[] = [
  { name: 'street-west-end', at: [4.87262, 52.39431], face: [4.8760, 52.3946] },
  { name: 'street-east-end', at: [4.87945, 52.39566], face: [4.8770, 52.3949] },
  { name: 'street-mid-west', at: [4.87440, 52.39446], face: [4.8775, 52.39500] },
  { name: 'street-mid-east', at: [4.87780, 52.39480], face: [4.8742, 52.39430] },
];
for (const f of fs.readdirSync('scripts/haparandaweg/specs').filter(f => f.endsWith('.json'))) {
  const id = f.replace('.json', ''), { spec, set } = loadSpec(id);
  const refFile = `artifacts/haparandaweg/ref/${spec.pandId}/reference.json`;
  if (!fs.existsSync(refFile)) continue;
  const ref = JSON.parse(fs.readFileSync(refFile, 'utf8'));
  if (!ref.wall) continue;
  const [a, b] = [ref.wall.startLngLat, ref.wall.endLngLat], mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const br = ref.wall.outwardBearingDeg * Math.PI / 180, k = 111320 * Math.cos(mid[1] * Math.PI / 180), dist = Number(process.env.DIST ?? 40);
  const at: [number, number] = [mid[0] + Math.sin(br) * dist / k, mid[1] + Math.cos(br) * dist / 111320];
  spots.push({ name: id, at, face: [mid[0], mid[1]] });
  void set;
}
fs.writeFileSync('artifacts/haparandaweg/spots.json', JSON.stringify(spots, null, 1));
console.log(spots.length, 'spots');
