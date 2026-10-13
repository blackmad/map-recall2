/**
 * The painted cells behind the material slots (look/palette.ts `SLOT_CELL`):
 * brick (the Bricks057 photo, neutralised and lifted like the city's bay
 * cells), stucco, stone, door, glass, roof tiles/slate/flat and plain white.
 *
 * Shared by the recipe look (buildingRecipe/recipeLook.ts, one CanvasTexture
 * per cell) and the city look atlas (look/cityLook.ts, one layer per cell in
 * the building texture array). Moved verbatim from recipeLook.ts on
 * 2026-10-13 so both draw the same pixels.
 */
import {paintRoofCell} from '../roofCells.ts';

/** Brick cell: the city's bay-texture wall (Bricks057 photo + mortar coursing), neutralised and lifted like calmBayLayers('photo'). */
export function paintBrickCanvas(doc: Document, brick?: CanvasImageSource | null): HTMLCanvasElement {
  const size = 336, canvas = doc.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d', {willReadFrequently: true})!;
  if (brick) for (let y = 0; y < size; y += 112) for (let x = 0; x < size; x += 112) ctx.drawImage(brick, x, y, 112, 112);
  else {
    // Fallback when the photo cannot load: stretcher bond with per-brick variation.
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let row = 0, y = 0; y < size; y += 14, row++) for (let x = -(row % 2) * 24; x < size; x += 48) { const v = 150 + rnd() * 50; ctx.fillStyle = `rgb(${v},${v * 0.92},${v * 0.86})`; ctx.fillRect(x, y, 48, 14); }
  }
  ctx.strokeStyle = 'rgba(235,223,205,0.18)'; ctx.lineWidth = 1.7;
  for (let row = 0, y = 6; y < size; y += 14, row++) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke();
    for (let x = (row % 2) * 24; x < size; x += 48) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 14); ctx.stroke(); }
  }
  const image = ctx.getImageData(0, 0, size, size), px = image.data;
  let mean = 0;
  for (let i = 0; i < px.length; i += 4) mean += (px[i] + px[i + 1] + px[i + 2]) / 3;
  mean /= px.length / 4;
  const lift = mean > 0 ? Math.min(2.4, 225 / mean) : 1;
  for (let i = 0; i < px.length; i += 4) {
    const lum = (px[i] + px[i + 1] + px[i + 2]) / 3, neutral = Math.min(255, (lum + (mean - lum) * 0.7) * lift);
    px[i] = px[i + 1] = px[i + 2] = neutral; px[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

/** Glass pane (UV 0..1 per pane): the city's lifted photo-look gradient plus a soft sky reflection. */
export function paintGlassCanvas(doc: Document): HTMLCanvasElement {
  const canvas = doc.createElement('canvas'); canvas.width = 64; canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  // Canvas y runs down; texture v runs up (flipY), so the top of the canvas is the top of the pane.
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, '#8aa1b0'); g.addColorStop(0.5, '#4d606c'); g.addColorStop(1, '#3c474e');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 128);
  ctx.fillStyle = 'rgba(235,242,248,0.16)';
  ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(34, 0); ctx.lineTo(4, 70); ctx.lineTo(-20, 70); ctx.closePath(); ctx.fill();
  return canvas;
}

export function paintDoorCanvas(doc: Document): HTMLCanvasElement {
  const canvas = doc.createElement('canvas'); canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = 'rgba(0,0,0,0.10)';
  for (let x = 0; x < 128; x += 16) ctx.fillRect(x, 0, 1.5, 128);
  return canvas;
}
/** Plaster: near-white fine grain with a few darker specks and faint trowel streaks (no mortar courses, no brick photo). */
export function paintStuccoCanvas(doc: Document): HTMLCanvasElement {
  const canvas = doc.createElement('canvas'); canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!, image = ctx.createImageData(128, 128);
  let seed = 23; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let y = 0; y < 128; y++) {
    const streak = (rnd() - 0.5) * 3;
    for (let x = 0; x < 128; x++) {
      const i = (y * 128 + x) * 4, speck = rnd() < 0.012 ? -14 : 0, v = 243 + (rnd() - 0.5) * 8 + streak + speck;
      image.data[i] = image.data[i + 1] = image.data[i + 2] = v; image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}
export function paintStoneCanvas(doc: Document): HTMLCanvasElement {
  const canvas = doc.createElement('canvas'); canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!, image = ctx.createImageData(128, 128);
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < image.data.length; i += 4) { const v = 228 + (rnd() - 0.5) * 16; image.data[i] = image.data[i + 1] = image.data[i + 2] = v; image.data[i + 3] = 255; }
  ctx.putImageData(image, 0, 0);
  ctx.fillStyle = 'rgba(80,70,60,0.18)'; ctx.fillRect(0, 0, 128, 1.5);
  return canvas;
}
export function roofCanvas(doc: Document, kind: 'tile' | 'slate' | 'flat'): HTMLCanvasElement {
  const data = paintRoofCell(kind, false), size = Math.round(Math.sqrt(data.length / 4)), canvas = doc.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!, image = ctx.createImageData(size, size);
  for (let i = 0; i < data.length; i += 4) { image.data[i] = data[i]; image.data[i + 1] = data[i + 1]; image.data[i + 2] = data[i + 2]; image.data[i + 3] = 255; }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

/**
 * City look only (`?cityLook=1`): the 20th-century brick (BAG year from 1915, look/cityLook.ts `BRICK20_FROM`).
 * Machine-pressed brick reads lighter and more even than the hand-made canal brick: the same Bricks057 photo,
 * keeping less of its per-brick variation, lifted to a higher mean, with finer, lighter joints.
 */
export const BRICK20_CELL_MEAN = 238;
export function paintBrick20Canvas(doc: Document, brick?: CanvasImageSource | null): HTMLCanvasElement {
  const size = 336, canvas = doc.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d', {willReadFrequently: true})!;
  if (brick) for (let y = 0; y < size; y += 112) for (let x = 0; x < size; x += 112) ctx.drawImage(brick, x, y, 112, 112);
  else {
    let seed = 13; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let row = 0, y = 0; y < size; y += 14, row++) for (let x = -(row % 2) * 24; x < size; x += 48) { const v = 165 + rnd() * 30; ctx.fillStyle = `rgb(${v},${v * 0.93},${v * 0.88})`; ctx.fillRect(x, y, 48, 14); }
  }
  ctx.strokeStyle = 'rgba(245,240,230,0.26)'; ctx.lineWidth = 1.2;
  for (let row = 0, y = 6; y < size; y += 14, row++) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke();
    for (let x = (row % 2) * 24; x < size; x += 48) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 14); ctx.stroke(); }
  }
  const image = ctx.getImageData(0, 0, size, size), px = image.data;
  let mean = 0;
  for (let i = 0; i < px.length; i += 4) mean += (px[i] + px[i + 1] + px[i + 2]) / 3;
  mean /= px.length / 4;
  const lift = mean > 0 ? Math.min(2.6, BRICK20_CELL_MEAN / mean) : 1;
  for (let i = 0; i < px.length; i += 4) {
    const lum = (px[i] + px[i + 1] + px[i + 2]) / 3, neutral = Math.min(255, (lum + (mean - lum) * 0.82) * lift);
    px[i] = px[i + 1] = px[i + 2] = neutral; px[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

/**
 * City look only: smooth white render for materials named `white` / `cream` / `ivory` (241 legacy landmark models
 * use them for white walls and white trim alike): the stucco's level with almost no grain and no specks, so a
 * cornice or a window surround does not read as rough plaster.
 */
export function paintWhiteStuccoCanvas(doc: Document): HTMLCanvasElement {
  const canvas = doc.createElement('canvas'); canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!, image = ctx.createImageData(128, 128);
  let seed = 31; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const i = (y * 128 + x) * 4, v = 246 + (rnd() - 0.5) * 3;
    image.data[i] = image.data[i + 1] = image.data[i + 2] = v; image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

/** Plain white (frame and paint slots): the tint is the whole colour. */
export function paintWhiteCanvas(doc: Document): HTMLCanvasElement {
  const c = doc.createElement('canvas'); c.width = c.height = 4;
  const x = c.getContext('2d')!; x.fillStyle = '#fff'; x.fillRect(0, 0, 4, 4);
  return c;
}
