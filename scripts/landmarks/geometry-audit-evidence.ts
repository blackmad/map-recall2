/**
 * Evidence shots for the landmark geometry audit: for each top offender, a close-up of its worst detached opening
 * (square-on and grazing along the wall, so a gap reads as sky between window and wall) and of its largest visible
 * z-fight patch (plain, then with the two fighting surfaces tinted magenta/cyan). Writes a contact sheet.
 * Called by `npm run audit:glb -- --geometry-shots`.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {ShotRenderer, type Shot, type V3} from './geometry-audit-shots';
import {loadMaterialSoup} from './material-soup';
import {normalForBearing} from '../../src/canalRecall/landmarks/facadeCompare';
import type {GeometryAuditReport, OpeningIssue, ZFightPatch} from '../../src/canalRecall/landmarks/geometryAudit';
import type {MaterialSoup} from '../../src/canalRecall/landmarks/facadeCompare';

const triCoords = (s: MaterialSoup, tris: number[]) => tris.flatMap(t => [0, 1, 2].flatMap(k => { const v = s.indices[t * 3 + k]; return [s.positions[v * 3], s.positions[v * 3 + 1], s.positions[v * 3 + 2]]; }));
const size = (b: {min: V3; max: V3}) => Math.hypot(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]);

export function openingShots(i: OpeningIssue, out: string): Shot[] {
  const [nx, nz] = normalForBearing(i.wallBearing ?? 180);
  const d = Math.max(3, size(i)) * 2.2;
  const at = (front: number, side: number): V3 => [i.centre[0] + nx * d * front + nz * d * side, i.centre[1] + 1, i.centre[2] + nz * d * front - nx * d * side];
  const overlay = {boxes: [{min: i.min, max: i.max}]};
  return [
    {eye: at(1, 0.45), target: i.centre, fov: 50, out: `${out}-front.png`, overlay},
    {eye: at(0.22, 1.3), target: i.centre, fov: 50, out: `${out}-grazing.png`, overlay},
  ];
}

export function zfightShots(p: ZFightPatch, s: MaterialSoup, out: string): Shot[] {
  const n = p.normal, r = Math.max(5, size(p) * 0.8);
  // Look down onto roofs from 35 degrees; at walls from the front, slightly off-axis.
  const eye: V3 = p.orientation === 'roof'
    ? [p.centre[0] + r * 0.7, p.centre[1] + r * 0.7, p.centre[2] + r * 0.7]
    : [p.centre[0] + n[0] * r + n[2] * r * 0.4, p.centre[1] + n[1] * r + 1.5, p.centre[2] + n[2] * r - n[0] * r * 0.4];
  return [
    {eye, target: p.centre, fov: 50, out: `${out}-plain.png`},
    {eye, target: p.centre, fov: 50, out: `${out}-overlay.png`, overlay: {boxes: [{min: p.min, max: p.max}], tris: [{p: triCoords(s, p.trisA), color: 0xff00ff}, {p: triCoords(s, p.trisB), color: 0x00ffff}]}},
  ];
}

export async function geometryShots(items: {id: string; file: string; geometry: GeometryAuditReport}[], outDir: string, top = 15): Promise<void> {
  fs.mkdirSync(outDir, {recursive: true});
  const r = new ShotRenderer();
  const cells: {id: string; caption: string; files: string[]}[] = [];
  try {
    for (const it of [...items].sort((a, b) => b.geometry.score - a.geometry.score).slice(0, top)) {
      const g = it.geometry;
      const s = await loadMaterialSoup(it.file);
      const opening = g.openings.issues.find(i => i.severity === 'fail') ?? g.openings.issues[0];
      if (opening) {
        const shots = openingShots(opening, path.join(outDir, `${it.id}-opening`));
        for (const sh of shots) await r.shoot(it.file, sh);
        cells.push({id: it.id, caption: `${opening.kind} ${opening.materials.join('+')} gap ${opening.gap.toFixed(2)} m, ${Math.round(opening.outside * 100)}% off wall, ${Math.round(opening.buried * 100)}% buried`, files: shots.map(x => x.out)});
      }
      const patch = g.zfight.patches.find(p => !p.near);
      if (patch && patch.area >= 0.25) {
        const shots = zfightShots(patch, s, path.join(outDir, `${it.id}-zfight`));
        for (const sh of shots) await r.shoot(it.file, sh);
        cells.push({id: it.id, caption: `z-fight ${patch.area.toFixed(1)} m2 ${patch.orientation} ${patch.materials.join('/')} at y ${patch.y}`, files: shots.map(x => x.out)});
      }
      console.log('geometry shots', it.id);
    }
  } finally { await r.close(); }
  // Contact sheet: one row per cell, two 450 px tiles.
  const W = 900, H = 310, rows: Buffer[] = [];
  for (const c of cells) {
    const tiles = await Promise.all(c.files.map(f => sharp(f).resize(450, 310, {fit: 'cover'}).png().toBuffer()));
    const label = Buffer.from(`<svg width="${W}" height="24"><rect width="100%" height="100%" fill="white"/><text x="6" y="17" font-family="sans-serif" font-size="14">${c.id}: ${c.caption.replace(/[<&>]/g, '')}</text></svg>`);
    rows.push(await sharp({create: {width: W, height: H + 24, channels: 3, background: '#fff'}})
      .composite([{input: label, top: 0, left: 0}, ...tiles.map((t, i) => ({input: t, top: 24, left: i * 450}))]).png().toBuffer());
  }
  if (rows.length) {
    await sharp({create: {width: W, height: rows.length * (H + 24), channels: 3, background: '#fff'}})
      .composite(rows.map((b, i) => ({input: b, top: i * (H + 24), left: 0}))).png().toFile(path.join(outDir, 'contact.png'));
    console.log(`geometry contact sheet: ${path.join(outDir, 'contact.png')}`);
  }
}
