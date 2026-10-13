/**
 * Precision sampling for the detached-opening check (geometryAudit.ts `auditOpenings`): pick fail-grade issues from
 * a list of landmark GLBs (deterministic, spread over each model), render each in context, square-on and grazing with
 * the flagged assembly boxed, and write a contact sheet plus a JSON list to classify by eye.
 *
 *   npx tsx scripts/landmarks/detached-openings-sample.ts --ids=a,b,c [--per=2] [--kind=floating|overhang|buried] [--severity=any] [--out=dir] [--all]
 *   --glb-dir=dir   read <id>.glb from another directory (before/after comparisons)
 *   --at=x,y,z      only issues whose box contains/near this point (before/after of one spot)
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {ShotRenderer, type Shot, type V3} from './geometry-audit-shots';
import {loadMaterialSoup} from './material-soup';
import {normalForBearing} from '../../src/canalRecall/landmarks/facadeCompare';
import {auditOpenings, type OpeningIssue} from '../../src/canalRecall/landmarks/geometryAudit';

const ROOT = path.resolve(import.meta.dirname, '../..');
const arg = (k: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const size = (b: {min: V3; max: V3}) => Math.hypot(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]);

export function sampleShots(i: Pick<OpeningIssue, 'min' | 'max' | 'centre' | 'wallBearing'>, out: string): Shot[] {
  const [nx, nz] = normalForBearing(i.wallBearing ?? 180);
  const d = Math.max(3, size(i)) * 2.2;
  const at = (front: number, side: number, k = 1): V3 => [i.centre[0] + nx * d * k * front + nz * d * k * side, i.centre[1] + 1 * k, i.centre[2] + nz * d * k * front - nx * d * k * side];
  const overlay = {boxes: [{min: i.min, max: i.max}]};
  return [
    {eye: at(1, 0.6, 3.5), target: i.centre, fov: 50, width: 520, height: 400, out: `${out}-context.png`, overlay},
    {eye: at(1, 0.45), target: i.centre, fov: 50, width: 520, height: 400, out: `${out}-front.png`, overlay},
    {eye: at(0.22, 1.3), target: i.centre, fov: 50, width: 520, height: 400, out: `${out}-grazing.png`, overlay},
  ];
}

async function main() {
  const ids = (arg('ids') ?? '').split(',').filter(Boolean);
  const per = Number(arg('per') ?? 2), kind = arg('kind'), all = process.argv.includes('--all');
  const out = path.resolve(arg('out') ?? path.join(ROOT, 'artifacts/geometry-audit/precision'));
  const glbDir = arg('glb-dir') ?? path.join(ROOT, 'public/canal-drive/models');
  const at = arg('at')?.split(',').map(Number);
  fs.mkdirSync(out, {recursive: true});
  const r = new ShotRenderer();
  const rows: Record<string, unknown>[] = [];
  const cells: {label: string; files: string[]}[] = [];
  for (const id of ids) {
    const file = path.join(glbDir, `${id}.glb`);
    const s = await loadMaterialSoup(file);
    let issues = auditOpenings(s).issues.filter(i => (arg('severity') === 'any' || i.severity === 'fail') && (!kind || i.kind === kind));
    if (at) issues = issues.filter(i => [0, 1, 2].every(k => at[k] >= i.min[k] - 1 && at[k] <= i.max[k] + 1));
    // Spread: every n-th issue in a stable order (by position), not just the worst.
    issues.sort((a, b) => a.centre[0] - b.centre[0] || a.centre[2] - b.centre[2] || a.centre[1] - b.centre[1]);
    const pick = all ? issues : Array.from({length: Math.min(per, issues.length)}, (_, k) => issues[Math.floor((k + 0.5) * issues.length / Math.min(per, issues.length))]);
    console.log(`${id}: ${issues.length} fail issues, sampling ${pick.length}`);
    for (const [k, i] of pick.entries()) {
      const tag = `${id}-${k}`;
      const shots = sampleShots(i, path.join(out, tag));
      for (const sh of shots) await r.shoot(file, sh);
      const label = `${tag} ${i.kind} ${i.materials.join('+')} gap ${i.gap.toFixed(2)} off ${Math.round(i.outside * 100)}% c=(${i.centre.map(v => v.toFixed(1)).join(',')}) size ${(i.max[0] - i.min[0]).toFixed(1)}x${(i.max[1] - i.min[1]).toFixed(1)}x${(i.max[2] - i.min[2]).toFixed(1)}`;
      rows.push({tag, id, kind: i.kind, materials: i.materials, gap: i.gap, outside: i.outside, centre: i.centre, min: i.min, max: i.max, wallBearing: i.wallBearing});
      cells.push({label, files: shots.map(x => x.out)});
      console.log('  ' + label);
    }
  }
  await r.close();
  fs.writeFileSync(path.join(out, 'samples.json'), JSON.stringify(rows, null, 1));
  // One sheet per 6 samples: three views per row with a caption strip.
  for (let p = 0; p * 6 < cells.length; p++) {
    const page = cells.slice(p * 6, p * 6 + 6), W = 520, H = 400, CAP = 26;
    const comps: sharp.OverlayOptions[] = [];
    page.forEach((c, row) => {
      const y = row * (H + CAP);
      const esc = c.label.replace(/&/g, '&amp;').replace(/</g, '&lt;');
      comps.push({input: Buffer.from(`<svg width="${3 * W}" height="${CAP}"><rect width="100%" height="100%" fill="#222"/><text x="6" y="18" font-size="15" font-family="monospace" fill="#fff">${esc}</text></svg>`), left: 0, top: y});
      c.files.forEach((f, k) => comps.push({input: f, left: k * W, top: y + CAP}));
    });
    await sharp({create: {width: 3 * W, height: page.length * (H + CAP), channels: 3, background: '#000'}}).composite(comps).png().toFile(path.join(out, `sheet-${p}.png`));
  }
  console.log(`wrote ${out}`);
}

if (process.argv[1]?.endsWith('detached-openings-sample.ts')) await main();
