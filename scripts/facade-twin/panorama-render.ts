/**
 * Drawing a building into a panorama, and the panorama onto a building.
 *
 * Shared by the explorer and the registration review deck, which want the same
 * three pictures at different sizes and for different purposes: the explorer
 * browses many buildings at thumbnail scale, the deck judges one at a time as
 * large as the screen allows. Keeping one implementation means a reviewer's
 * verdict is about the same geometry the explorer shows, which is the whole
 * value of collecting verdicts at all.
 *
 * Everything here takes the camera model as data. There is no default: the
 * project's signature failure was a projection that silently inherited the
 * wrong convention from a default argument.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import jpeg from 'jpeg-js';
import { GEOID_SEPARATION_M } from '../../src/canalRecall/facade/sources/amsterdamPanorama.ts';
import { RD_NEW } from '../../src/canalRecall/facade/sources/netherlands.ts';
import type { CameraModel, CameraPose } from '../../src/canalRecall/facade/rectify.ts';
import type { PanoramaView, ProjectedPoint } from '../../src/canalRecall/facade/sources.ts';

export interface DecodedPanorama { width: number; height: number; data: Uint8Array | Uint8ClampedArray }

export const poseOf = (view: PanoramaView, heightOffsetM = 0): CameraPose => {
  const camera = RD_NEW.fromLngLat(view.lngLat);
  return {
    x: camera.x, y: camera.y, z: view.cameraHeight - heightOffsetM - GEOID_SEPARATION_M,
    headingDeg: view.headingDeg, pitchDeg: view.pitchDeg, rollDeg: view.rollDeg,
  };
};

/**
 * The solved vertical datum offset for a frame, or zero when none is known.
 *
 * Published camera height drifts within a survey run and jumps between runs;
 * `solve-track-datum.ts` recovers it from co-located frames and writes one
 * offset per ~125 m segment. Subtracting it removes 78% of the disagreement
 * between two cameras standing at the same spot in different years, measured at
 * places the solve never saw.
 *
 * A frame with no solved offset is left alone rather than guessed at. The
 * function reports whether it had one, because a corrected height and an
 * uncorrected one are different evidence and the difference belongs on the card.
 */
export async function loadTrackOffsets(cacheDir: string):
  Promise<(view: PanoramaView) => { offsetM: number; source: 'segment' | 'run' | 'none' }> {
  let offsets: Record<string, { offsetM: number; equations: number }> = {};
  let runOffsets: Record<string, number> = {};
  let segment = 0, minEquations = 8;
  try {
    const file = JSON.parse(await readFile(path.join(cacheDir, 'track-datum.json'), 'utf8'));
    offsets = file.offsets ?? {};
    runOffsets = file.runOffsets ?? {};
    segment = file.metadata?.segmentFrames ?? 0;
    minEquations = file.minEquations ?? 8;
  } catch { /* solve it and this lights up; until then every frame is uncorrected */ }
  return (view: PanoramaView) => {
    const m = view.panoramaId.match(/^(.*)_(\d{6})$/);
    if (!m) return { offsetM: 0, source: 'none' as const };
    const run = m[1];
    const key = segment > 0 ? `${run}#${Math.floor(Number(m[2]) / segment)}` : run;
    const solved = offsets[key];
    // A well-pinned segment, else the run it belongs to, else leave it alone.
    // Falling back is not the same as having no answer, so the card says which.
    if (solved && solved.equations >= minEquations && Number.isFinite(solved.offsetM)) {
      return { offsetM: solved.offsetM, source: 'segment' as const };
    }
    if (Number.isFinite(runOffsets[run])) return { offsetM: runOffsets[run], source: 'run' as const };
    return { offsetM: 0, source: 'none' as const };
  };
}

export function downscale(source: Uint8ClampedArray, width: number, height: number, maxWidth: number) {
  if (width <= maxWidth) return { width, height, data: source };
  const k = maxWidth / width, w = maxWidth, h = Math.max(1, Math.round(height * k));
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx = Math.min(width - 1, Math.floor(x / k)), sy = Math.min(height - 1, Math.floor(y / k));
    const s = (sy * width + sx) * 4, d = (y * w + x) * 4;
    out[d] = source[s]; out[d + 1] = source[s + 1]; out[d + 2] = source[s + 2]; out[d + 3] = 255;
  }
  return { width: w, height: h, data: out };
}

export const encodeJpeg = (width: number, height: number, data: Uint8ClampedArray, quality = 78) =>
  jpeg.encode({ width, height, data: Buffer.from(data) }, quality).data;

/**
 * The footprint drawn into the raw panorama — the correspondence itself.
 *
 * No rectification, deliberately. A rectified strip is a consequence of the
 * correspondence and cannot testify about it: in Amsterdam whatever you point at
 * rectifies into a convincing façade. This tests the coordinate transform, the
 * camera model, the pose and the choice of wall at once, which is right, because
 * those are exactly the things a strip cannot separate.
 */
export function projectFootprint(
  image: DecodedPanorama, view: PanoramaView, camera: CameraModel,
  ring: ProjectedPoint[], wall: readonly number[], groundZ: number, topZ: number,
  { maxWidth = 420, quality = 78, contextFraction = 0.6, eavesZ = null as number | null, heightOffsetM = 0 } = {},
): { jpeg: Buffer; width: number; height: number } | null {
  const pose = poseOf(view, heightOffsetM);
  const project = (p: ProjectedPoint, z: number) =>
    camera.project([p.x - pose.x, p.y - pose.y, z - pose.z], pose, image);

  const [wx0, wy0, wx1, wy1] = wall;
  const a = { x: wx0, y: wy0 }, b = { x: wx1, y: wy1 };
  const corners = [project(a, groundZ), project(b, groundZ), project(a, topZ), project(b, topZ)];
  const anchor = corners[0][0];
  const unwrap = (u: number) => {
    let d = u - anchor;
    while (d > image.width / 2) d -= image.width;
    while (d < -image.width / 2) d += image.width;
    return anchor + d;
  };
  const us = corners.map(c => unwrap(c[0])), vs = corners.map(c => c[1]);
  const padU = Math.max(90, (Math.max(...us) - Math.min(...us)) * contextFraction);
  const padV = Math.max(70, (Math.max(...vs) - Math.min(...vs)) * 0.28);
  const x0 = Math.round(Math.min(...us) - padU), x1 = Math.round(Math.max(...us) + padU);
  const y0 = Math.max(0, Math.round(Math.min(...vs) - padV));
  const y1 = Math.min(image.height, Math.round(Math.max(...vs) + padV));
  const cw = x1 - x0, ch = y1 - y0;
  if (cw < 16 || ch < 16 || cw > 7000 || ch > 4000) return null;

  const out = new Uint8ClampedArray(cw * ch * 4);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const sx = ((x + x0) % image.width + image.width) % image.width;
    const sy = Math.max(0, Math.min(image.height - 1, y + y0));
    const s = (sy * image.width + sx) * 4, d = (y * cw + x) * 4;
    out[d] = image.data[s]; out[d + 1] = image.data[s + 1]; out[d + 2] = image.data[s + 2]; out[d + 3] = 255;
  }
  const line = (p: number[], q: number[], colour: number[], thick: number) => {
    const ax = unwrap(p[0]) - x0, ay = p[1] - y0, bx = unwrap(q[0]) - x0, by = q[1] - y0;
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay)));
    for (let i = 0; i <= n; i++) {
      const px = Math.round(ax + ((bx - ax) * i) / n), py = Math.round(ay + ((by - ay) * i) / n);
      for (let ox = -thick; ox <= thick; ox++) for (let oy = -thick; oy <= thick; oy++) {
        const qx = px + ox, qy = py + oy;
        if (qx < 0 || qy < 0 || qx >= cw || qy >= ch) continue;
        const d = (qy * cw + qx) * 4;
        out[d] = colour[0]; out[d + 1] = colour[1]; out[d + 2] = colour[2];
      }
    }
  };
  /**
   * An edge drawn as the arc it is. In an equirectangular frame the image of a
   * straight 3-D line is a great-circle arc, and over the 20–30° a canal house
   * subtends the bow is tens of pixels — enough to lay a visibly crooked box
   * over a projection that is exact. Two days were spent on that illusion.
   */
  const edge = (pa: ProjectedPoint, za: number, pb: ProjectedPoint, zb: number, colour: number[], thick: number) => {
    let previous: number[] | null = null;
    for (let i = 0; i <= 36; i++) {
      const t = i / 36;
      const here = project({ x: pa.x + (pb.x - pa.x) * t, y: pa.y + (pb.y - pa.y) * t }, za + (zb - za) * t);
      if (previous) line(previous, here, colour, thick);
      previous = here;
    }
  };
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    edge(ring[i], groundZ, ring[j], groundZ, [70, 150, 255], 1);
    edge(ring[i], topZ, ring[j], topZ, [70, 150, 255], 1);
  }
  edge(a, groundZ, b, groundZ, [40, 235, 120], 2);
  edge(a, topZ, b, topZ, [40, 235, 120], 2);
  edge(a, groundZ, a, topZ, [40, 235, 120], 2);
  edge(b, groundZ, b, topZ, [40, 235, 120], 2);
  /**
   * The eaves, drawn inside the box rather than as its lid.
   *
   * Drawing the quad to the eaves made every gabled front look short by two
   * metres, and a reviewer cannot tell that from a genuine registration error —
   * they see a box that misses the top of the building either way. On an
   * Amsterdam canal house the visible façade continues above the eaves to the
   * gable top, so the box runs to the ridge and the eaves become a line across
   * it: still legible as a measurement, no longer mistakable for a bad fit.
   */
  if (eavesZ !== null && eavesZ > groundZ && eavesZ < topZ) {
    edge(a, eavesZ, b, eavesZ, [235, 190, 60], 1);
  }

  const small = downscale(out, cw, ch, maxWidth);
  return { jpeg: encodeJpeg(small.width, small.height, small.data, quality), width: small.width, height: small.height };
}

/** The wall resampled into its own plane, so a measurement scales by one constant. */
export function rectifyWall(
  image: DecodedPanorama, view: PanoramaView, camera: CameraModel,
  wall: readonly number[], baseZ: number, topZ: number,
  { pixelsPerMetre = 26, margin = 1.25, maxWidth = 380, quality = 78, heightOffsetM = 0 } = {},
): { jpeg: Buffer; width: number; height: number } | null {
  const pose = poseOf(view, heightOffsetM);
  const [x0, y0, x1, y1] = wall;
  const wallWidthM = Math.hypot(x1 - x0, y1 - y0);
  const mid = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
  const ux = (x1 - x0) / wallWidthM, uy = (y1 - y0) / wallWidthM;
  const half = (wallWidthM * margin) / 2;
  const start = { x: mid.x - ux * half, y: mid.y - uy * half };
  const w = Math.max(8, Math.round(wallWidthM * margin * pixelsPerMetre));
  const h = Math.max(8, Math.round((topZ - baseZ) * pixelsPerMetre));
  if (w * h > 8e6) return null;

  const data = new Uint8ClampedArray(w * h * 4);
  for (let py = 0; py < h; py++) {
    const z = topZ - ((py + 0.5) / h) * (topZ - baseZ);
    for (let px = 0; px < w; px++) {
      const along = ((px + 0.5) / w) * wallWidthM * margin;
      const [u, v] = camera.project(
        [start.x + ux * along - pose.x, start.y + uy * along - pose.y, z - pose.z], pose, image);
      const sx = Math.round(((u % image.width) + image.width) % image.width), sy = Math.round(v);
      const d = (py * w + px) * 4;
      data[d + 3] = 255;
      if (sy < 0 || sy >= image.height) continue;
      const s = (sy * image.width + sx) * 4;
      data[d] = image.data[s]; data[d + 1] = image.data[s + 1]; data[d + 2] = image.data[s + 2];
    }
  }
  const small = downscale(data, w, h, maxWidth);
  return { jpeg: encodeJpeg(small.width, small.height, small.data, quality), width: small.width, height: small.height };
}

/**
 * A plan of the parcel, its wall, the cameras that saw it and BAG's addresses.
 *
 * Neighbours are drawn because a wall on the wrong side of a party wall is only
 * visible against the terrace it sits in. North is up and there is a scale bar,
 * so "one house along" is a distance a reader can measure rather than a feeling.
 */
export function planSvg(
  ring: ProjectedPoint[], wall: readonly number[],
  cameras: Array<{ point: ProjectedPoint; label: string; primary: boolean }>,
  addressPoints: ProjectedPoint[], neighbours: ProjectedPoint[][],
  { width = 380, minHeight = 200, maxHeight = 340 } = {},
): string {
  const [wx0, wy0, wx1, wy1] = wall;
  const points: ProjectedPoint[] = [...ring, { x: wx0, y: wy0 }, { x: wx1, y: wy1 },
    ...cameras.map(c => c.point), ...addressPoints, ...neighbours.flat()];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  const pad = 4;
  minX -= pad; minY -= pad; maxX += pad; maxY += pad;
  const H = Math.max(minHeight, Math.min(maxHeight, Math.round(width * (maxY - minY) / Math.max(1, maxX - minX))));
  const scale = Math.min(width / (maxX - minX), H / (maxY - minY));
  // North up: SVG y grows downward, RD y grows north.
  const px = (p: ProjectedPoint) => [((p.x - minX) * scale).toFixed(1), (H - (p.y - minY) * scale).toFixed(1)];
  const poly = (r: ProjectedPoint[]) => r.map(p => px(p).join(',')).join(' ');

  const parts: string[] = [];
  for (const other of neighbours) parts.push(`<polygon points="${poly(other)}" class="nb"/>`);
  parts.push(`<polygon points="${poly(ring)}" class="me"/>`);
  const [ax, ay] = px({ x: wx0, y: wy0 }), [bx, by] = px({ x: wx1, y: wy1 });
  const mx = (Number(ax) + Number(bx)) / 2, my = (Number(ay) + Number(by)) / 2;
  for (const camera of cameras) {
    const [ex, ey] = px(camera.point);
    parts.push(`<line x1="${ex}" y1="${ey}" x2="${mx}" y2="${my}" class="ray${camera.primary ? ' primary' : ''}"/>`);
    parts.push(`<circle cx="${ex}" cy="${ey}" r="3.5" class="cam${camera.primary ? ' primary' : ''}"><title>${camera.label}</title></circle>`);
  }
  parts.push(`<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" class="wall"/>`);
  for (const a of addressPoints) {
    const [x, y] = px(a);
    parts.push(`<circle cx="${x}" cy="${y}" r="2.4" class="addr"/>`);
  }
  const bar = (10 * scale).toFixed(1);
  parts.push(`<line x1="10" y1="${H - 12}" x2="${10 + Number(bar)}" y2="${H - 12}" class="scale"/>`
    + `<text x="${12 + Number(bar)}" y="${H - 8}" class="scaletext">10 m</text>`
    + `<text x="${width - 12}" y="16" class="scaletext" text-anchor="end">N ↑</text>`);
  return `<svg viewBox="0 0 ${width} ${H}" class="plan" role="img" aria-label="parcel plan">${parts.join('')}</svg>`;
}
