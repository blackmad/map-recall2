/**
 * The share card (G6, #276): a 1200×630 picture of a finished ride.
 *
 * The ridden route as a blank silhouette on postcard paper (the parked
 * "blank silhouette routes" idea: the shape without the map), the
 * destination, distance, time, the result ribbon and "rideamsterdam.nl".
 * The paper reuses the large-letter postcard's linen palette
 * (largeLetterPostcardStyles.ts) without its opentype-heavy compositor.
 *
 * Hidden-name rule: the card never shows the name of a question still open.
 * Every line goes through {@link redactHidden}; a destination that contains a
 * hidden name becomes a neutral "Amsterdam". The card draws no street names
 * of its own.
 *
 * Pure apart from {@link renderShareCard}, which takes its canvas factory as
 * an argument, so the layout and the drawn text list are unit-tested in Node.
 */
import { LINEN_ARCH } from './largeLetterPostcardStyles.ts';

export const SHARE_CARD_W = 1200;
export const SHARE_CARD_H = 630;
/** Smallest type on the card: 8 px when the card is shown at 25 % (300×158). */
export const SHARE_CARD_MIN_FONT_PX = 32;
/** Destination, numbers and ribbon: 12 px or more at 25 %. */
export const SHARE_CARD_PRIMARY_FONT_PX = 48;
export const SHARE_CARD_SITE = 'rideamsterdam.nl';

export interface ShareCardPoint { x: number; y: number }
export interface ShareCardRibbon { label: string; color: string; dim: string }

export interface ShareCardInput {
  /** The ridden route in any planar units, y down (game world px). */
  route: readonly ShareCardPoint[];
  destination: string;
  distanceM: number;
  timeS: number;
  ribbon?: ShareCardRibbon | null;
  /** "By bike", "By boat"…; optional. */
  modeLabel?: string;
  /** Names of questions not yet answered: never drawn, not even inside a longer line. */
  hiddenNames?: readonly (string | null | undefined)[];
  /** Captions; English defaults (plaque voice, nouns). */
  labels?: Partial<ShareCardLabels>;
}

export interface ShareCardLabels {
  arrived: string;
  distance: string;
  time: string;
  fallbackPlace: string;
  site: string;
}

export const SHARE_CARD_LABELS_EN: ShareCardLabels = {
  arrived: 'DESTINATION',
  distance: 'DISTANCE',
  time: 'TIME',
  fallbackPlace: 'Amsterdam',
  site: SHARE_CARD_SITE,
};

export type ShareCardRole = 'kicker' | 'destination' | 'label' | 'value' | 'ribbon' | 'mode' | 'site';

export interface ShareCardText {
  role: ShareCardRole;
  text: string;
  x: number;
  y: number;
  sizePx: number;
  font: string;
  color: string;
  align: 'left' | 'right' | 'center';
}

export interface ShareCardLayout {
  width: number;
  height: number;
  /** The silhouette, already fitted into its panel, in card px. */
  route: Array<[number, number]>;
  panel: { x: number; y: number; w: number; h: number };
  texts: ShareCardText[];
  ribbon: (ShareCardRibbon & { x: number; y: number; w: number; h: number }) | null;
}

export type Measure = (text: string, font: string, sizePx: number) => number;

/** Rough width when no canvas is at hand (Node tests): condensed plaque type. */
export const approximateMeasure: Measure = (text, font, sizePx) =>
  text.length * sizePx * (/Condensed|Narrow/.test(font) ? 0.46 : 0.6);

export const FONT_PLAQUE = '"Barlow Condensed", "Arial Narrow", "Helvetica Neue Condensed", sans-serif';
export const FONT_MONO = '"JetBrains Mono", Menlo, Consolas, monospace';
const INK = '#1f1c17';
const MUTED = '#6b5f4f';
const ROUTE_INK = '#24405f';
const FINISH = '#b4532a';

function normalise(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Does `text` contain any of the hidden names (case, accents and punctuation ignored)? */
export function containsHidden(text: string, hiddenNames: readonly (string | null | undefined)[] = []): boolean {
  const haystack = ` ${normalise(text)} `;
  return hiddenNames.some(name => {
    const needle = name ? normalise(name) : '';
    return needle.length > 0 && haystack.includes(` ${needle} `);
  });
}

/** The line, or null when it would show a hidden name. */
export function redactHidden(text: string, hiddenNames: readonly (string | null | undefined)[] = []): string | null {
  return containsHidden(text, hiddenNames) ? null : text;
}

export function formatShareDistance(metres: number): string {
  const m = Math.max(0, metres);
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(m < 10_000 ? 2 : 1)} km`;
}

export function formatShareTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** Drops consecutive duplicates and thins to at most `max` points, keeping both ends. */
export function thinRoute(route: readonly ShareCardPoint[], max = 600): ShareCardPoint[] {
  const clean = route.filter(p => p && Number.isFinite(p.x) && Number.isFinite(p.y))
    .filter((p, i, all) => i === 0 || p.x !== all[i - 1].x || p.y !== all[i - 1].y);
  if (clean.length <= max) return clean;
  const step = (clean.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => clean[Math.round(i * step)]);
}

/** Fits the route into the panel, preserving its aspect and north-up orientation. */
export function fitRoute(route: readonly ShareCardPoint[], panel: { x: number; y: number; w: number; h: number }, inset = 36): Array<[number, number]> {
  const pts = thinRoute(route);
  if (pts.length < 2) return [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
  const spanX = Math.max(maxX - minX, 1e-6), spanY = Math.max(maxY - minY, 1e-6);
  const boxW = panel.w - inset * 2, boxH = panel.h - inset * 2;
  const scale = Math.min(boxW / spanX, boxH / spanY);
  const ox = panel.x + inset + (boxW - spanX * scale) / 2;
  const oy = panel.y + inset + (boxH - spanY * scale) / 2;
  return pts.map(p => [Math.round((ox + (p.x - minX) * scale) * 10) / 10, Math.round((oy + (p.y - minY) * scale) * 10) / 10]);
}

/** Splits `text` into at most `maxLines` lines no wider than `width`; the last line is ellipsised. */
function wrap(text: string, width: number, maxLines: number, measure: (t: string) => number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (measure(next) <= width || !line) line = next;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  const kept = lines.length > maxLines
    ? [...lines.slice(0, maxLines - 1), lines.slice(maxLines - 1).join(' ')]
    : lines;
  return kept.map(l => {
    if (measure(l) <= width) return l;
    let cut = l;
    while (cut.length > 1 && measure(`${cut}…`) > width) cut = cut.slice(0, -1).trimEnd();
    return `${cut}…`;
  });
}

export function layoutShareCard(input: ShareCardInput, measure: Measure = approximateMeasure): ShareCardLayout {
  const labels = { ...SHARE_CARD_LABELS_EN, ...input.labels };
  const hidden = input.hiddenNames ?? [];
  const W = SHARE_CARD_W, H = SHARE_CARD_H;
  const panel = { x: 44, y: 44, w: 560, h: H - 88 };
  const texts: ShareCardText[] = [];
  const push = (t: Omit<ShareCardText, 'text'> & { text: string }) => {
    const safe = redactHidden(t.text, hidden);
    if (safe) texts.push({ ...t, text: safe });
  };

  const colX = 652;
  const colW = W - colX - 52;
  push({ role: 'kicker', text: labels.arrived, x: colX, y: 98, sizePx: 32, font: FONT_MONO, color: MUTED, align: 'left' });

  const destination = redactHidden(input.destination.trim(), hidden) || labels.fallbackPlace;
  let size = 84;
  let lines: string[] = [];
  for (; size >= SHARE_CARD_PRIMARY_FONT_PX + 8; size -= 4) {
    const font = `800 ${size}px ${FONT_PLAQUE}`;
    lines = wrap(destination, colW, 2, t => measure(t, font, size));
    if (lines.every(l => !l.endsWith('…'))) break;
  }
  size = Math.max(size, SHARE_CARD_PRIMARY_FONT_PX + 8);
  const lead = Math.round(size * 0.98);
  let y = 98 + 18 + lead;
  for (const line of lines) {
    push({ role: 'destination', text: line, x: colX, y, sizePx: size, font: `800 ${size}px ${FONT_PLAQUE}`, color: INK, align: 'left' });
    y += lead;
  }
  if (input.modeLabel) {
    push({ role: 'mode', text: input.modeLabel, x: colX, y: y - lead + 50, sizePx: 34, font: `600 34px ${FONT_PLAQUE}`, color: MUTED, align: 'left' });
  }

  // Two numbers, side by side, labels over values.
  const statsY = 400;
  const half = colW / 2;
  const stats = [
    { label: labels.distance, value: formatShareDistance(input.distanceM) },
    { label: labels.time, value: formatShareTime(input.timeS) },
  ];
  stats.forEach((stat, index) => {
    const x = colX + index * half;
    push({ role: 'label', text: stat.label, x, y: statsY, sizePx: 32, font: `700 32px ${FONT_MONO}`, color: MUTED, align: 'left' });
    push({ role: 'value', text: stat.value, x, y: statsY + 70, sizePx: 72, font: `800 72px ${FONT_PLAQUE}`, color: INK, align: 'left' });
  });

  let ribbon: ShareCardLayout['ribbon'] = null;
  if (input.ribbon) {
    const font = `800 48px ${FONT_PLAQUE}`;
    const w = Math.min(colW * 0.64, 96 + measure(input.ribbon.label, font, 48));
    ribbon = { ...input.ribbon, x: colX, y: 510, w, h: 70 };
    push({ role: 'ribbon', text: input.ribbon.label, x: colX + 70, y: 562, sizePx: 48, font, color: input.ribbon.color, align: 'left' });
  }
  push({ role: 'site', text: labels.site, x: W - 52, y: ribbon ? 560 : 572, sizePx: 36, font: `700 36px ${FONT_MONO}`, color: INK, align: 'right' });

  return { width: W, height: H, route: fitRoute(input.route, panel), panel, texts, ribbon };
}

/** The 2D context calls the card uses; a real CanvasRenderingContext2D satisfies it. */
export interface ShareCardContext {
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  lineCap: CanvasLineCap;
  lineJoin: CanvasLineJoin;
  globalAlpha: number;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  save(): void;
  restore(): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  strokeRect(x: number, y: number, w: number, h: number): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arc(x: number, y: number, r: number, a0: number, a1: number): void;
  fill(): void;
  stroke(): void;
  fillText(text: string, x: number, y: number): void;
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): CanvasGradient;
  measureText?(text: string): { width: number };
}

function paper(ctx: ShareCardContext, W: number, H: number): void {
  const style = LINEN_ARCH;
  const wash = ctx.createLinearGradient(0, 0, 0, H);
  wash.addColorStop(0, style.paperTop);
  wash.addColorStop(0.5, style.paperMid);
  wash.addColorStop(1, style.paperBottom);
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, W, H);
  // The postcard's linen hatch, lighter: a share preview is small and busy.
  ctx.save();
  ctx.globalAlpha = style.linenHatch * 0.6;
  ctx.strokeStyle = '#5a4030';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let y = 0; y < H; y += 4) { ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); }
  for (let x = 0; x < W; x += 4) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); }
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = 'rgba(55,40,25,0.4)';
  ctx.lineWidth = 2;
  ctx.strokeRect(18, 18, W - 36, H - 36);
}

function polyline(ctx: ShareCardContext, pts: Array<[number, number]>): void {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.stroke();
}

export function drawShareCard(ctx: ShareCardContext, layout: ShareCardLayout): void {
  const { width: W, height: H, panel, route } = layout;
  paper(ctx, W, H);

  // The silhouette panel: a faint plate, then the route as a thick ink line.
  ctx.fillStyle = 'rgba(255,252,244,0.55)';
  ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
  ctx.strokeStyle = 'rgba(55,40,25,0.22)';
  ctx.lineWidth = 2;
  ctx.strokeRect(panel.x, panel.y, panel.w, panel.h);
  if (route.length >= 2) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(255,252,244,0.95)';
    ctx.lineWidth = 26;
    polyline(ctx, route);
    ctx.strokeStyle = ROUTE_INK;
    ctx.lineWidth = 14;
    polyline(ctx, route);
    const [sx, sy] = route[0];
    const [fx, fy] = route[route.length - 1];
    ctx.fillStyle = '#fbf6ea';
    ctx.beginPath(); ctx.arc(sx, sy, 15, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = ROUTE_INK; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(sx, sy, 15, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = FINISH;
    ctx.beginPath(); ctx.arc(fx, fy, 21, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fbf6ea'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(fx, fy, 21, 0, Math.PI * 2); ctx.stroke();
  }

  if (layout.ribbon) {
    const r = layout.ribbon;
    ctx.fillStyle = r.dim;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = r.color;
    ctx.beginPath(); ctx.arc(r.x + 35, r.y + r.h / 2, 22, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(r.x, r.y, 6, r.h);
  }

  ctx.textBaseline = 'alphabetic';
  for (const t of layout.texts) {
    ctx.font = t.font;
    ctx.fillStyle = t.color;
    ctx.textAlign = t.align;
    ctx.fillText(t.text, t.x, t.y);
  }
  // A thin rule between the destination block and the numbers.
  ctx.strokeStyle = 'rgba(55,40,25,0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(652, 340); ctx.lineTo(W - 52, 340); ctx.stroke();
  void H;
}

export interface ShareCanvas {
  width: number;
  height: number;
  getContext(kind: '2d'): unknown;
}

/** Lays out with the canvas's own text metrics and draws. Returns the canvas and the drawn lines. */
export function renderShareCard<C extends ShareCanvas>(input: ShareCardInput, createCanvas: (w: number, h: number) => C): { canvas: C; layout: ShareCardLayout; ms: number } {
  const started = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const canvas = createCanvas(SHARE_CARD_W, SHARE_CARD_H);
  canvas.width = SHARE_CARD_W;
  canvas.height = SHARE_CARD_H;
  const ctx = canvas.getContext('2d') as ShareCardContext | null;
  if (!ctx) throw new Error('share card: no 2d context');
  const measure: Measure = ctx.measureText
    ? (text, font) => { ctx.font = font; return ctx.measureText!(text).width; }
    : approximateMeasure;
  const layout = layoutShareCard(input, measure);
  drawShareCard(ctx, layout);
  const ms = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - started;
  return { canvas, layout, ms };
}

/** A safe file name: "ride-amsterdam-westerkerk.png". */
export function shareCardFileName(destination: string): string {
  const slug = normalise(destination).replace(/\s+/g, '-').slice(0, 40) || 'route';
  return `ride-amsterdam-${slug}.png`;
}

/** The ridden path, sampled while riding (presentationRuntime.ts `_render`). */
export interface ShareTrail {
  /** The vehicle the trail belongs to: a new ride has a new one. */
  owner: unknown;
  lastDistancePx: number;
  points: ShareCardPoint[];
}

/** One sample every ~15 m at the game's 3 px per metre. */
export const SHARE_TRAIL_STEP_PX = 45;
export const SHARE_TRAIL_MAX_POINTS = 4000;

/**
 * Adds the rider's position to the trail when it has moved a step, starting a
 * fresh trail for a new vehicle or a reset odometer. Returns the trail to keep.
 */
export function extendShareTrail(
  trail: ShareTrail | null | undefined,
  owner: unknown,
  point: ShareCardPoint,
  distancePx: number,
): ShareTrail {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return trail ?? { owner, lastDistancePx: distancePx, points: [] };
  if (!trail || trail.owner !== owner || distancePx < trail.lastDistancePx - 1) {
    return { owner, lastDistancePx: distancePx, points: [{ x: point.x, y: point.y }] };
  }
  const last = trail.points[trail.points.length - 1];
  if (!last || Math.hypot(point.x - last.x, point.y - last.y) >= SHARE_TRAIL_STEP_PX) {
    trail.points.push({ x: point.x, y: point.y });
    if (trail.points.length > SHARE_TRAIL_MAX_POINTS) trail.points = trail.points.filter((_, i) => i % 2 === 0);
  }
  trail.lastDistancePx = distancePx;
  return trail;
}
