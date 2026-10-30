// Likeness sheet per bridge (lane bridge-fidelity 2026-10-14): the rectified water-side face from the boat panorama |
// the kit's body rendered orthographically from the same side at the same px/m | a 50 % overlay, with the opening count
// and the material family, photo (hand reading, build-bridge-hints.ts HAND) vs model, and a PASS / FAIL line.
//
//   npx tsx scripts/bridge-reference/sheet.ts BRU0073 BRU0009        # artifacts/bridges/<id>/sheet.png
//   npx tsx scripts/bridge-reference/sheet.ts --named [--docs]       # every named bridge; --docs copies the Reguliersgracht
//                                                                    # (BRU0073) and Torensluis sheets to docs/images/bridges/
//
// The model is the game's own cell build (groundCell.buildCell, near ring): the deck body and top within the bridge,
// the water and quay walls beside it, flat-shaded. Vertical registration: the model's deck top at the face middle sits on
// the deck edge the face reader found in the photo (classify.ts `dz`), so camera-height errors do not shift the overlay.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import sharp from 'sharp';
import { GroundStore, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { buildCell, type BuiltCell, type GroundLayer } from '../../src/canalRecall/ownGround/groundCell.ts';
import { bridgeFacts, FAMILY_PALETTE } from '../../src/canalRecall/ownGround/bridgeKit.ts';
import { rdToLngLat } from '../../src/canalRecall/facade/rdNew.ts';
import { bridgeFace, topAt, type BridgeFace } from './geometry.ts';
import { HAND } from '../own-ground/build-bridge-hints.ts';
import { NAMED } from './named.ts';

const ROOT = 'public/data/extracts/amsterdam';
const store = new GroundStore(async path => { const file = join(ROOT, path); if (!existsSync(file)) throw new Error(`${path}: missing`); const b = readFileSync(file); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); });
const cells = new Map<string, BuiltCell>();
async function cell(key: string): Promise<BuiltCell> {
  if (!cells.has(key)) { await store.prepareCell(key); cells.set(key, buildCell(await store.cellInput(key, 0))); }
  return cells.get(key)!;
}
const local = (p: { x: number; y: number }) => { const [lng, lat] = rdToLngLat(p); return toLocal(lng, lat); };

const LAYERS: Partial<Record<GroundLayer, [number, number, number] | null>> = { deckBody: null, deckTop: null, quay: null, water: [0.24, 0.33, 0.33] };

export interface Render { rgba: Uint8ClampedArray; width: number; height: number; drawn: number }

/** Orthographic render of the built cells around `face`, onto the photo crop's frame. */
export async function renderFace(face: BridgeFace, view: { flipped: boolean; ppm: number; width: number; height: number; topZ: number; side: number }, dz: number): Promise<Render> {
  const mid = local(face.mid), u2 = local({ x: face.mid.x + face.u.x * 10, y: face.mid.y + face.u.y * 10 });
  const ul = Math.hypot(u2[0] - mid[0], u2[1] - mid[1]), U = [(u2[0] - mid[0]) / ul, (u2[1] - mid[1]) / ul], Nn = [-U[1], U[0]];
  const keys = GroundStore.neighbours(store.cellAt(mid[0], mid[1])).filter(k => store.covers(k));
  const built = await Promise.all(keys.map(cell));
  // Vertical registration: the deck top at the face middle on the photo's deck edge.
  const zGame = store.surface.height(mid[0], mid[1]), shift = topAt(face, 0) + dz - zGame;
  const { width: W, height: H, ppm, topZ, flipped, side } = view, a0 = face.deck[0] - 3, a1 = face.deck[1] + 3;
  const rgba = new Uint8ClampedArray(W * H * 4), depth = new Float32Array(W * H).fill(-Infinity);
  for (let i = 0; i < W * H; i++) { rgba[i * 4] = 214; rgba[i * 4 + 1] = 220; rgba[i * 4 + 2] = 226; rgba[i * 4 + 3] = 255; }
  const view3 = [Nn[0] * side, Nn[1] * side, 0], light = norm([view3[0] * 0.55 + U[0] * 0.25, view3[1] * 0.55 + U[1] * 0.25, 0.8]);
  let drawn = 0;
  for (const c of built) for (const [layer, fixed] of Object.entries(LAYERS) as [GroundLayer, [number, number, number] | null][]) {
    const m = c.layers[layer];
    if (!m) continue;
    const p = m.positions, idx = m.indices, col = m.colors;
    const reachAcross = layer === 'water' ? face.halfWidth + 25 : layer === 'quay' ? face.halfWidth + 6 : face.halfWidth + 3;
    for (let t = 0; t < idx.length; t += 3) {
      const v = [idx[t], idx[t + 1], idx[t + 2]];
      const pts = v.map(i => { const dx = p[i * 3] - mid[0], dy = p[i * 3 + 1] - mid[1]; return { a: dx * U[0] + dy * U[1], c: dx * Nn[0] + dy * Nn[1], z: p[i * 3 + 2] + shift }; });
      const ca = (pts[0].a + pts[1].a + pts[2].a) / 3, cc = (pts[0].c + pts[1].c + pts[2].c) / 3;
      if (ca < a0 - 1 || ca > a1 + 1 || Math.abs(cc) > reachAcross) continue;
      // Only what stands between the far face and the camera: drop water behind the bridge's far half.
      if (layer === 'water' && cc * side < -face.halfWidth) continue;
      // Quay walls along the canal under the span stand in front of the arches in an oblique view: only the abutments' quays.
      if (layer === 'quay' && !process.env.SHEET_QUAY && ca > face.deck[0] + 1 && ca < face.deck[1] - 1) continue;
      const P3 = v.map(i => [p[i * 3], p[i * 3 + 1], p[i * 3 + 2]]);
      const e1 = [P3[1][0] - P3[0][0], P3[1][1] - P3[0][1], P3[1][2] - P3[0][2]], e2 = [P3[2][0] - P3[0][0], P3[2][1] - P3[0][1], P3[2][2] - P3[0][2]];
      const n = norm([e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]);
      const lit = 0.5 + 0.5 * Math.abs(n[0] * light[0] + n[1] * light[1] + n[2] * light[2]);
      const base = fixed ?? (col ? [0, 1, 2].map(k => (col[v[0] * 3 + k] + col[v[1] * 3 + k] + col[v[2] * 3 + k]) / 3) : [0.6, 0.6, 0.6]);
      const rgb = base.map(x => Math.round(255 * Math.min(1, x * lit)));
      const scr = pts.map(q => ({ x: (flipped ? a1 - q.a : q.a - a0) * ppm, y: (topZ - q.z) * ppm, d: q.c * side }));
      const minX = Math.max(0, Math.floor(Math.min(...scr.map(q => q.x)))), maxX = Math.min(W - 1, Math.ceil(Math.max(...scr.map(q => q.x))));
      const minY = Math.max(0, Math.floor(Math.min(...scr.map(q => q.y)))), maxY = Math.min(H - 1, Math.ceil(Math.max(...scr.map(q => q.y))));
      if (minX > maxX || minY > maxY) continue;
      const [A, B, C] = scr, den = (B.y - C.y) * (A.x - C.x) + (C.x - B.x) * (A.y - C.y);
      if (Math.abs(den) < 1e-9) continue;
      for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
        const sx = x + 0.5, sy = y + 0.5, w0 = ((B.y - C.y) * (sx - C.x) + (C.x - B.x) * (sy - C.y)) / den, w1 = ((C.y - A.y) * (sx - C.x) + (A.x - C.x) * (sy - C.y)) / den, w2 = 1 - w0 - w1;
        if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
        const d = w0 * A.d + w1 * B.d + w2 * C.d, k = y * W + x;
        if (d <= depth[k]) continue;
        depth[k] = d; rgba[k * 4] = rgb[0]; rgba[k * 4 + 1] = rgb[1]; rgba[k * 4 + 2] = rgb[2]; drawn++;
      }
    }
  }
  return { rgba, width: W, height: H, drawn };
}
function norm(v: number[]): number[] { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

export async function sheet(id: string): Promise<{ id: string; verdict: string; file: string } | null> {
  const face = bridgeFace(id), readingFile = `artifacts/bridges/${id}/reading.json`;
  if (!face || !existsSync(readingFile)) return null;
  const reading = JSON.parse(readFileSync(readingFile, 'utf8'));
  const v = reading.views[0];
  if (!v) return null;
  const tag = v.side > 0 ? 'p' : 'm', photo = `artifacts/bridges/${id}/photo-${tag}.jpg`;
  const r = await renderFace(face, { flipped: v.flipped, ppm: v.ppm, width: v.width, height: v.height, topZ: v.topZ, side: v.side }, v.reading.dz);
  const model = await sharp(Buffer.from(r.rgba.buffer), { raw: { width: r.width, height: r.height, channels: 4 } }).png().toBuffer();
  const photoRaw = await sharp(photo).ensureAlpha().raw().toBuffer();
  const over = Buffer.alloc(photoRaw.length);
  for (let i = 0; i < over.length; i += 4) { for (let k = 0; k < 3; k++) over[i + k] = (photoRaw[i + k] + r.rgba[i + k]) >> 1; over[i + 3] = 255; }
  const overlay = await sharp(over, { raw: { width: r.width, height: r.height, channels: 4 } }).png().toBuffer();
  // Model facts: what the kit drew (cell stats) and the palette it used.
  let drawnArches: number | null = null, kind = '?';
  for (const c of cells.values()) { const d = c.stats.bridges.decks.find(x => x.id === id); if (d) { drawnArches = d.arches; kind = d.kind; } }
  const facts = bridgeFacts(id), hand = HAND[id];
  const photoArches = hand?.arches ?? null, photoFamily = hand?.family ?? null;
  const modelFamily = facts?.family ?? (kind === 'arch' ? 'brick-red (default)' : kind);
  const archOk = photoArches === null || drawnArches === photoArches || (kind === 'bascule');
  const famOk = photoFamily === null || modelFamily === photoFamily;
  const verdict = archOk && famOk && r.drawn > 0 ? 'PASS' : 'FAIL';
  const PW = 1400, scale = PW / r.width, ph = Math.max(40, Math.round(r.height * scale));
  const panel = (b: Buffer | string) => sharp(b).resize({ width: PW, height: ph, fit: 'fill' }).png().toBuffer();
  const [p1, p2, p3] = await Promise.all([panel(photo), panel(model), panel(overlay)]);
  const lines = [
    `${id} ${face.name} — ${reading.views.length} boat view(s); this face: ${v.pano} (${v.year}, ${v.distM} m, ${v.obliquityDeg}°), ${v.ppm.toFixed(0)} px/m; model: the kit (${kind}) from the same side, ortho, same px/m`,
    `openings photo ${photoArches ?? '–'} | model ${drawnArches ?? '–'}    family photo ${photoFamily ?? '–'} | model ${modelFamily}    parapet photo ${hand?.parapet ?? '–'} | model ${facts?.parapet ?? 'kit default'}    ${verdict}`,
  ];
  const label = (t: string) => Buffer.from(`<svg width="${PW}" height="26"><rect width="${PW}" height="26" fill="#1d1d1d"/><text x="8" y="18" font-size="15" fill="#eee" font-family="Helvetica, sans-serif">${esc(t)}</text></svg>`);
  const parts: { input: Buffer; top: number; left: number }[] = [];
  let y = 0;
  for (const [t, img] of [[lines[0], null], ['photo (rectified water-side face, Gemeente Amsterdam panoramas CC BY 4.0)', p1], ['model (bridge kit, orthographic)', p2], ['50 % overlay', p3], [lines[1], null]] as [string, Buffer | null][]) {
    parts.push({ input: label(t), top: y, left: 0 }); y += 26;
    if (img) { parts.push({ input: img, top: y, left: 0 }); y += ph + 4; }
  }
  mkdirSync(`artifacts/bridges/${id}`, { recursive: true });
  const file = `artifacts/bridges/${id}/sheet.png`;
  await sharp({ create: { width: PW, height: y, channels: 3, background: '#000' } }).composite(parts).png({ palette: true, quality: 85, compressionLevel: 9 }).toFile(file);
  return { id, verdict: `${verdict} (openings ${photoArches ?? '–'}/${drawnArches ?? '–'}, family ${photoFamily ?? '–'}/${modelFamily})`, file };
}

// ------------------------------------------------------------------ aimed (perspective) sheets
// A movable bridge's portal or masts stand above the face crop and the Singelgracht at the Haarlemmerpoort has no boat
// mission: these sheets put the aimed panorama view (thumb.ts, the public thumbnail endpoint) beside the own ground
// rendered from the same camera (position, heading, pitch 4°, horizontal fov), every ground layer within 90 m.
const PERSPECTIVE_COLOURS: Partial<Record<GroundLayer, [number, number, number]>> = {
  land: [0.55, 0.52, 0.47], park: [0.36, 0.48, 0.26], square: [0.66, 0.62, 0.56], parking: [0.36, 0.36, 0.38], asphalt: [0.29, 0.29, 0.31],
  klinker: [0.5, 0.32, 0.26], cycle: [0.62, 0.27, 0.24], paving: [0.72, 0.69, 0.64], gravel: [0.66, 0.6, 0.5], kerb: [0.88, 0.86, 0.82],
  paint: [0.95, 0.95, 0.95], water: [0.24, 0.33, 0.33], quay: [0.43, 0.36, 0.32], deckTop: [0.55, 0.54, 0.52], tram: [0.15, 0.15, 0.16], bollard: [0.45, 0.16, 0.12],
};
export async function renderAimed(face: BridgeFace, cam: { x: number; y: number; zNAP: number }, headingDeg: number, pitchDeg: number, fovDeg: number, W: number, H: number): Promise<Render> {
  const mid = local(face.mid), C = local({ x: cam.x, y: cam.y });
  const keys = [...new Set([mid, C].flatMap(q => GroundStore.neighbours(store.cellAt(q[0], q[1]))))].filter(k => store.covers(k));
  const built = await Promise.all(keys.map(cell));
  // Game z = NAP − shift, the shift from the deck middle (the face's top there in NAP against the riding surface).
  const shift = topAt(face, 0) - store.surface.height(mid[0], mid[1]), cz = cam.zNAP - shift;
  const h = headingDeg * Math.PI / 180, p = pitchDeg * Math.PI / 180;
  const f = [Math.sin(h) * Math.cos(p), Math.cos(h) * Math.cos(p), Math.sin(p)], r = [Math.cos(h), -Math.sin(h), 0];
  const up = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const k = (W / 2) / Math.tan(fovDeg * Math.PI / 360);
  const rgba = new Uint8ClampedArray(W * H * 4), depth = new Float32Array(W * H).fill(Infinity);
  for (let i = 0; i < W * H; i++) { const sky = i / W / H; rgba[i * 4] = 200 - 30 * sky; rgba[i * 4 + 1] = 214 - 20 * sky; rgba[i * 4 + 2] = 230; rgba[i * 4 + 3] = 255; }
  const light = norm([0.3, -0.4, 0.85]);
  let drawn = 0;
  for (const c of built) for (const [layer, m] of Object.entries(c.layers) as [GroundLayer, BuiltCell['layers'][GroundLayer]][]) {
    if (!m) continue;
    const pos = m.positions, idx = m.indices, col = m.colors, fixed = PERSPECTIVE_COLOURS[layer];
    for (let t = 0; t < idx.length; t += 3) {
      const v = [idx[t], idx[t + 1], idx[t + 2]];
      const q = v.map(i => { const d = [pos[i * 3] - C[0], pos[i * 3 + 1] - C[1], pos[i * 3 + 2] - cz]; return { x: d[0] * r[0] + d[1] * r[1], y: d[0] * up[0] + d[1] * up[1] + d[2] * up[2], z: d[0] * f[0] + d[1] * f[1] + d[2] * f[2] }; });
      if (q.some(e => e.z < 0.5) || q.every(e => e.z > 90)) continue;
      const P3 = v.map(i => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]]);
      const e1 = [P3[1][0] - P3[0][0], P3[1][1] - P3[0][1], P3[1][2] - P3[0][2]], e2 = [P3[2][0] - P3[0][0], P3[2][1] - P3[0][1], P3[2][2] - P3[0][2]];
      const n = norm([e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]);
      const lit = 0.55 + 0.45 * Math.abs(n[0] * light[0] + n[1] * light[1] + n[2] * light[2]);
      const base = col && (layer === 'deckBody' || !fixed) ? [0, 1, 2].map(j => (col[v[0] * 3 + j] + col[v[1] * 3 + j] + col[v[2] * 3 + j]) / 3) : fixed ?? [0.6, 0.6, 0.6];
      const rgb = base.map(x => Math.round(255 * Math.min(1, x * lit)));
      const s = q.map(e => ({ x: W / 2 + e.x / e.z * k, y: H / 2 - e.y / e.z * k, d: e.z }));
      const minX = Math.max(0, Math.floor(Math.min(...s.map(e => e.x)))), maxX = Math.min(W - 1, Math.ceil(Math.max(...s.map(e => e.x))));
      const minY = Math.max(0, Math.floor(Math.min(...s.map(e => e.y)))), maxY = Math.min(H - 1, Math.ceil(Math.max(...s.map(e => e.y))));
      if (minX > maxX || minY > maxY || (maxX - minX) * (maxY - minY) > W * H * 4) continue;
      const [A, B, Cc] = s, den = (B.y - Cc.y) * (A.x - Cc.x) + (Cc.x - B.x) * (A.y - Cc.y);
      if (Math.abs(den) < 1e-9) continue;
      // Ground layers drawn over each other at the same height: a small bias by draw order keeps bands over the land.
      const bias = layer === 'land' || layer === 'park' || layer === 'water' ? 0.03 : 0;
      for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
        const sx = x + 0.5, sy = y + 0.5, w0 = ((B.y - Cc.y) * (sx - Cc.x) + (Cc.x - B.x) * (sy - Cc.y)) / den, w1 = ((Cc.y - A.y) * (sx - Cc.x) + (A.x - Cc.x) * (sy - Cc.y)) / den, w2 = 1 - w0 - w1;
        if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
        // Perspective-correct depth: interpolate 1/z.
        const iz = w0 / A.d + w1 / B.d + w2 / Cc.d, d = 1 / iz + bias, kk = y * W + x;
        if (d >= depth[kk]) continue;
        depth[kk] = d; rgba[kk * 4] = rgb[0]; rgba[kk * 4 + 1] = rgb[1]; rgba[kk * 4 + 2] = rgb[2]; drawn++;
      }
    }
  }
  return { rgba, width: W, height: H, drawn };
}

export async function aimedSheet(id: string, verdictNote: string): Promise<{ id: string; verdict: string; file: string } | null> {
  const face = bridgeFace(id);
  if (!face) return null;
  const { aimedViews } = await import('./thumb.ts');
  const views = await aimedViews(id, 2);
  if (!views.length) return null;
  const parts: { input: Buffer; top: number; left: number }[] = [];
  const PW = 900, PH = Math.round(900 / 1.6);
  const label = (t: string) => Buffer.from(`<svg width="${PW * 3}" height="26"><rect width="${PW * 3}" height="26" fill="#1d1d1d"/><text x="8" y="18" font-size="15" fill="#eee" font-family="Helvetica, sans-serif">${esc(t)}</text></svg>`);
  let y = 0;
  parts.push({ input: label(`${id} ${face.name} — aimed panorama views (Gemeente Amsterdam, CC BY 4.0) | the own ground from the same camera (heading, pitch 4°, fov) | 50 % overlay`), top: y, left: 0 }); y += 26;
  for (const v of views) {
    const params = new URL(v.url).searchParams, heading = Number(params.get('heading')), fov = Number(params.get('fov')), pitch = Number(params.get('pitch'));
    const { cachedJson } = await import('../pand-reference/core.ts');
    const record = await cachedJson(`https://api.data.amsterdam.nl/panorama/panoramas/${v.pano}/`);
    const [lng, lat, hPub] = record.geometry.coordinates, rd = (await import('../../src/canalRecall/facade/rdNew.ts')).lngLatToRd([lng, lat]);
    const zNAP = Number.isFinite(hPub) && hPub > 0 ? hPub - 43.5 : topAt(face, 0) + 2.4;
    const r = await renderAimed(face, { x: rd.x, y: rd.y, zNAP }, heading, pitch, fov, PW, PH);
    const photo = await sharp(v.file).resize(PW, PH, { fit: 'fill' }).ensureAlpha().raw().toBuffer();
    const over = Buffer.alloc(photo.length);
    for (let i = 0; i < over.length; i += 4) { for (let j = 0; j < 3; j++) over[i + j] = (photo[i + j] + r.rgba[i + j]) >> 1; over[i + 3] = 255; }
    const raw = (b: Buffer | Uint8ClampedArray) => sharp(Buffer.from(b), { raw: { width: PW, height: PH, channels: 4 } }).png().toBuffer();
    const [a, b, c] = await Promise.all([raw(photo), raw(r.rgba), raw(over)]);
    parts.push({ input: label(`${v.pano}, ${v.distM} m, ${v.angleDeg}° off the deck axis`), top: y, left: 0 }); y += 26;
    parts.push({ input: a, top: y, left: 0 }, { input: b, top: y, left: PW }, { input: c, top: y, left: PW * 2 }); y += PH + 4;
  }
  parts.push({ input: label(verdictNote), top: y, left: 0 }); y += 26;
  const file = `artifacts/bridges/${id}/sheet.png`;
  await sharp({ create: { width: PW * 3, height: y, channels: 3, background: '#000' } }).composite(parts).png({ palette: true, quality: 85, compressionLevel: 9 }).toFile(file);
  return { id, verdict: verdictNote, file };
}

/** Bascule sheets: aimed views; the verdict is the hand reading of the photo against the style the kit drew. */
const BASCULE_NOTES: Record<string, string> = {
  BRU0242: 'photo: timber double ophaalbrug, white portals with balance beams over both leaves, white rail, 8 segmental arches | model: portal style (basculeStyle), white',
  BRU0151: 'photo: basement bascule, no portal; red-and-white signal masts and barrier boxes at both ends, bridge-keeper\'s house | model: basement style (masts, barrier boxes, leaf kerbs)',
  BRU0149: 'photo: basement bascule under tram wires, no portal; red-and-white masts, barrier boxes, signals | model: basement style',
  BRU0345: 'photo: basement bascule, no portal (the overhead "balance-beam" in the report is not in the panoramas); masts, barrier boxes, white tube railings | model: basement style',
  BRU0272: 'photo (Mariniersbrug, Dijksgracht): green steel basement bascule, red-and-white masts, green lattice truss parapets, brick piers; register says timber | model: basement style, green (the kit has no truss parapet)',
};

async function main(): Promise<void> {
  await store.init();
  const ids = process.argv.includes('--named') ? [...NAMED] : process.argv.slice(2).filter(a => !a.startsWith('--'));
  const out: { id: string; verdict: string; file: string }[] = [];
  for (const id of ids) {
    try { const s = BASCULE_NOTES[id] ? await aimedSheet(id, BASCULE_NOTES[id]) : await sheet(id); if (s) { out.push(s); console.log(s.id, s.verdict, s.file); } else console.log(id, 'no reading/face'); } catch (e) { console.log(id, 'error', String(e).slice(0, 160)); }
    if (cells.size > 30) cells.clear();
  }
  writeFileSync('artifacts/bridges/sheets.json', JSON.stringify(out, null, 1));
  if (process.argv.includes('--docs')) {
    mkdirSync('docs/images/bridges', { recursive: true });
    for (const [id, name] of [['BRU0073', 'reguliersgracht-bru0073'], ['BRU0038', 'reguliersgracht-keizersgracht-bru0038'], ['BRU0009', 'torensluis-bru0009']]) {
      const f = `artifacts/bridges/${id}/sheet.png`;
      // Under 300 KB for the repository: 1000 px wide, 64-colour palette.
      if (existsSync(f)) await sharp(f).resize({ width: 760 }).png({ palette: true, colours: 32, dither: 0.3, compressionLevel: 9 }).toFile(`docs/images/bridges/${name}.png`);
    }
  }
}
if (import.meta.url === `file://${process.argv[1]}`) main().catch(e => { console.error(e); process.exit(1); });
