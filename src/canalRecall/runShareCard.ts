/**
 * The run's share picture (#295, G6 follow-up): one 1200×630 card for a whole
 * chained run, in the arrival share's visual language (shareCard.ts): the
 * same linen paper, silhouette panel, plaque type and footer.
 *
 * Left: every leg drawn as one silhouette, the run's start as a ring and each
 * stop as a numbered copper dot. Right: RUN over the run's buurt (one buurt
 * for every stop) or the city, the run line (N stops · N names · points) and
 * the numbered stops.
 *
 * Hidden-name rule, as the arrival share: every line passes `redactHidden`;
 * a stop whose name is withheld reads "Stop N", a withheld buurt the city.
 * The answered names themselves are never drawn, only counted.
 *
 * Pure apart from {@link renderRunShareCard}, which takes its canvas factory.
 */
import {
  applyFit, approximateMeasure, drawSharePaper, fitTransform, FONT_MONO, FONT_PLAQUE, polyline, redactHidden,
  normalise, wrapLines, SHARE_CARD_H, SHARE_CARD_LABELS_EN, SHARE_CARD_W,
  SHARE_FINISH, SHARE_INK, SHARE_MUTED, SHARE_ROUTE_INK,
  type Measure, type ShareCanvas, type ShareCardContext, type ShareCardPoint, type ShareCardText,
} from './shareCard';
import { METRES_PER_DEGREE_LAT, metresPerDegreeLng, PIXELS_PER_METER } from './osm/roadProjection';

export type LatLngPair = readonly [number, number];

export interface RunShareStop {
  /** The stop's number in the run (1-based). */
  number: number;
  name: string;
  lat?: number;
  lng?: number;
  area?: string | null;
  /** The leg ridden to this stop, [lat, lng]. */
  path?: readonly LatLngPair[] | null;
}

export interface RunShareLabels {
  /** The eyebrow: "RUN". */
  run: string;
  /** "Stop {n}": a stop whose name is withheld. */
  stop: string;
  /** "+{count} earlier stops" when the list has no room for every stop. */
  earlier: string;
  fallbackPlace: string;
  site: string;
}

export const RUN_SHARE_LABELS_EN: RunShareLabels = {
  run: 'RUN',
  stop: 'Stop {n}',
  earlier: '+{count} earlier',
  fallbackPlace: SHARE_CARD_LABELS_EN.fallbackPlace,
  site: SHARE_CARD_LABELS_EN.site,
};

export interface RunShareInput {
  /** The run's stops in order (the run keeps the last twelve). */
  stops: readonly RunShareStop[];
  /** Where the run began, when known: the first leg's start if it has no path. */
  start?: { lat: number; lng: number } | null;
  /** The run line, already localised: "3 stops  ·  4 names  ·  481 points". */
  summary: string;
  /** The city shown when the stops do not share one buurt. */
  city?: string | null;
  hiddenNames?: readonly (string | null | undefined)[];
  labels?: Partial<RunShareLabels>;
}

export type RunShareRole = 'kicker' | 'title' | 'summary' | 'stopNumber' | 'stop' | 'earlier' | 'dot' | 'site';

export interface RunShareText extends Omit<ShareCardText, 'role'> { role: RunShareRole }

export interface RunShareDot { x: number; y: number; r: number; number: number; last: boolean }

export interface RunShareLayout {
  width: number;
  height: number;
  panel: { x: number; y: number; w: number; h: number };
  /** Each leg in card px; drawn together as one silhouette. */
  legs: Array<Array<[number, number]>>;
  start: [number, number] | null;
  dots: RunShareDot[];
  /** The numbered discs in the list. */
  discs: Array<{ x: number; y: number; r: number }>;
  texts: RunShareText[];
  rule: { x0: number; x1: number; y: number };
}

/** Lat/lng to planar px (y down) about a fixed centre: one frame for every leg of the run. */
export function projectRun(points: readonly LatLngPair[], centre: { lat: number; lng: number }): ShareCardPoint[] {
  const kx = metresPerDegreeLng(centre.lat) * PIXELS_PER_METER;
  const ky = METRES_PER_DEGREE_LAT * PIXELS_PER_METER;
  return points.map(([lat, lng]) => ({ x: (lng - centre.lng) * kx, y: -(lat - centre.lat) * ky }));
}

/** The inverse of osm/roadProjection `projectToWorld` plus the road build's offset: a game point as [lat, lng]. */
export function worldToLatLng(
  point: ShareCardPoint,
  projection: { centerLat: number; centerLng: number; offsetX?: number; offsetY?: number },
): [number, number] | null {
  const { centerLat, centerLng } = projection;
  if (![point.x, point.y, centerLat, centerLng].every(Number.isFinite)) return null;
  const x = point.x - (projection.offsetX ?? 0);
  const y = point.y - (projection.offsetY ?? 0);
  return [
    centerLat - y / (METRES_PER_DEGREE_LAT * PIXELS_PER_METER),
    centerLng + x / (metresPerDegreeLng(centerLat) * PIXELS_PER_METER),
  ];
}

const finite = (lat?: number, lng?: number): lat is number => Number.isFinite(lat) && Number.isFinite(lng);

/**
 * The run's legs as [lat, lng] lists: each stop's ridden path, else a straight
 * line from the previous stop (or the run's start) to it. A stop with neither
 * draws no leg but keeps its dot when it has a position.
 */
export function runLegs(input: Pick<RunShareInput, 'stops' | 'start'>): Array<LatLngPair[]> {
  const legs: Array<LatLngPair[]> = [];
  let previous: LatLngPair | null = input.start && finite(input.start.lat, input.start.lng) ? [input.start.lat, input.start.lng] : null;
  for (const stop of input.stops) {
    const path = (stop.path ?? []).filter(p => p && finite(p[0], p[1]));
    const end: LatLngPair | null = finite(stop.lat, stop.lng) ? [stop.lat, stop.lng!] : path[path.length - 1] ?? null;
    if (path.length >= 2) legs.push(path);
    else if (previous && end) legs.push([previous, end]);
    else legs.push([]);
    previous = end ?? previous;
  }
  return legs;
}

/** RUN's place: the buurt every stop shares (and that is not withheld), else the city. */
export function runPlace(input: RunShareInput, labels: RunShareLabels): string {
  const hidden = input.hiddenNames ?? [];
  const areas = input.stops.map(s => (s.area ?? '').trim());
  const one = areas.length > 0 && areas.every(a => a && a === areas[0]) ? areas[0] : '';
  return (one && redactHidden(one, hidden)) || redactHidden((input.city ?? '').trim(), hidden) || labels.fallbackPlace;
}

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, k: string) => (k in values ? String(values[k]) : `{${k}}`));

const ROW = 44;
/** The last row's centre: its name clears the footer's cap height. */
const LIST_BOTTOM = 530;
const DOT_R = 24;
const DISC_R = 21;

export function layoutRunShareCard(input: RunShareInput, measure: Measure = approximateMeasure): RunShareLayout {
  const labels = { ...RUN_SHARE_LABELS_EN, ...input.labels };
  const hidden = input.hiddenNames ?? [];
  const W = SHARE_CARD_W, H = SHARE_CARD_H;
  const panel = { x: 44, y: 44, w: 560, h: H - 88 };
  const texts: RunShareText[] = [];
  const push = (t: RunShareText) => {
    const safe = redactHidden(t.text, hidden);
    if (safe) texts.push({ ...t, text: safe });
  };

  // The silhouette: one frame for every leg, fitted into the panel with room for the dots.
  const legsLL = runLegs(input);
  const all = legsLL.flat();
  const centre = all.length ? { lat: all[0][0], lng: all[0][1] } : { lat: 52.37, lng: 4.9 };
  const legsXY = legsLL.map(leg => projectRun(leg, centre));
  const stopXY = input.stops.map((stop, i) => {
    if (finite(stop.lat, stop.lng)) return projectRun([[stop.lat, stop.lng!]], centre)[0];
    const leg = legsXY[i];
    return leg.length ? leg[leg.length - 1] : null;
  });
  const fitPts = [...legsXY.flat(), ...stopXY.filter((p): p is ShareCardPoint => !!p)];
  const fit = fitTransform(fitPts, panel, 36 + DOT_R);
  const legs = fit ? legsXY.filter(l => l.length >= 2).map(l => l.map(p => applyFit(fit, p))) : [];
  const firstLeg = legsXY.find(l => l.length >= 2);
  const start = fit && firstLeg ? applyFit(fit, firstLeg[0]) : null;
  const dots: RunShareDot[] = [];
  if (fit) {
    input.stops.forEach((stop, i) => {
      const p = stopXY[i];
      if (!p) return;
      const [x, y] = applyFit(fit, p);
      dots.push({ x, y, r: DOT_R, number: stop.number, last: i === input.stops.length - 1 });
    });
  } else if (input.stops.length === 1) {
    // One stop with no geometry: its dot in the middle of the plate.
    dots.push({ x: panel.x + panel.w / 2, y: panel.y + panel.h / 2, r: DOT_R, number: input.stops[0].number, last: true });
  }
  for (const dot of dots) {
    push({ role: 'dot', text: String(dot.number), x: dot.x, y: dot.y + 11, sizePx: 32, font: `800 32px ${FONT_PLAQUE}`, color: '#fbf6ea', align: 'center' });
  }

  const colX = 652;
  const colW = W - colX - 52;
  push({ role: 'kicker', text: labels.run, x: colX, y: 86, sizePx: 32, font: `700 32px ${FONT_MONO}`, color: SHARE_MUTED, align: 'left' });

  // The place: one line from 76 down to 64 px, else two lines 64 → 52 px, then cut.
  const place = runPlace(input, labels);
  const fitTitle = (px: number, maxLines: number) => wrapLines(place, colW, maxLines, t => measure(t, `800 ${px}px ${FONT_PLAQUE}`, px));
  const attempts: Array<[number, number]> = [
    ...[76, 72, 68, 64].map(px => [px, 1] as [number, number]),
    ...[64, 60, 56, 52].map(px => [px, 2] as [number, number]),
  ];
  let size = 52;
  let lines: string[] = [];
  for (const [px, max] of attempts) {
    const ls = fitTitle(px, max);
    if (ls.every(l => !l.endsWith('…'))) { size = px; lines = ls; break; }
  }
  if (!lines.length) lines = fitTitle(size, 2);
  let y = 86 + 14 + Math.round(size * 0.92);
  for (const line of lines) {
    push({ role: 'title', text: line, x: colX, y, sizePx: size, font: `800 ${size}px ${FONT_PLAQUE}`, color: SHARE_INK, align: 'left' });
    y += size;
  }

  // The run line: 38 px, down to 32 px, else two lines at 32 px.
  y = y - size + 50;
  const sumFont = (px: number) => `600 ${px}px ${FONT_PLAQUE}`;
  let sumSize = 32;
  let sumLines: string[] | null = null;
  // The game's wide "  ·  " separators first, then single spaces, before a second line.
  const compact = input.summary.replace(/\s+·\s+/g, ' · ');
  for (const px of [38, 36, 34, 32]) {
    const one = [input.summary, compact].find(text => measure(text, sumFont(px), px) <= colW);
    if (one) { sumSize = px; sumLines = [one]; break; }
  }
  sumLines ??= wrapLines(compact, colW, 2, t => measure(t, sumFont(32), 32));
  for (const line of sumLines) {
    push({ role: 'summary', text: line, x: colX, y, sizePx: sumSize, font: sumFont(sumSize), color: SHARE_MUTED, align: 'left' });
    y += sumSize + 6;
  }
  const rule = { x0: colX, x1: W - 52, y: y + 2 };

  // The stops, numbered as on the map: as many rows as fit; the earliest give way to "+N earlier".
  const firstRow = rule.y + 20 + DISC_R;
  const rows = Math.max(1, Math.floor((LIST_BOTTOM - firstRow) / ROW) + 1);
  const stops = input.stops;
  const earlier = stops.length > rows ? stops.length - (rows - 1) : 0;
  const shown = earlier ? stops.slice(earlier) : stops;
  const discs: RunShareLayout['discs'] = [];
  let row = 0;
  if (earlier) {
    push({ role: 'earlier', text: fill(labels.earlier, { count: earlier }), x: colX, y: firstRow + 11, sizePx: 32, font: `600 32px ${FONT_PLAQUE}`, color: SHARE_MUTED, align: 'left' });
    row = 1;
  }
  const nameX = colX + DISC_R * 2 + 14;
  const nameW = W - 52 - nameX;
  for (const stop of shown) {
    const cy = firstRow + row * ROW;
    discs.push({ x: colX + DISC_R, y: cy, r: DISC_R });
    push({ role: 'stopNumber', text: String(stop.number), x: colX + DISC_R, y: cy + 11, sizePx: 32, font: `800 32px ${FONT_PLAQUE}`, color: '#fbf6ea', align: 'center' });
    const font = `700 36px ${FONT_PLAQUE}`;
    const named = redactHidden(stop.name.trim(), hidden) || fill(labels.stop, { n: stop.number });
    const line = wrapLines(named, nameW, 1, t => measure(t, font, 36))[0] ?? '';
    push({ role: 'stop', text: line, x: nameX, y: cy + 12, sizePx: 36, font, color: SHARE_INK, align: 'left' });
    row += 1;
  }

  push({ role: 'site', text: labels.site, x: W - 52, y: 588, sizePx: 32, font: `700 32px ${FONT_MONO}`, color: SHARE_INK, align: 'right' });
  return { width: W, height: H, panel, legs, start, dots, discs, texts, rule };
}

export function drawRunShareCard(ctx: ShareCardContext, layout: RunShareLayout): void {
  const { width: W, height: H, panel } = layout;
  drawSharePaper(ctx, W, H);
  ctx.fillStyle = 'rgba(255,252,244,0.55)';
  ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
  ctx.strokeStyle = 'rgba(55,40,25,0.22)';
  ctx.lineWidth = 2;
  ctx.strokeRect(panel.x, panel.y, panel.w, panel.h);

  // Every leg's halo first, then every leg's ink: one silhouette where legs meet.
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(255,252,244,0.95)';
  ctx.lineWidth = 26;
  for (const leg of layout.legs) polyline(ctx, leg);
  ctx.strokeStyle = SHARE_ROUTE_INK;
  ctx.lineWidth = 14;
  for (const leg of layout.legs) polyline(ctx, leg);
  if (layout.start) {
    const [sx, sy] = layout.start;
    ctx.fillStyle = '#fbf6ea';
    ctx.beginPath(); ctx.arc(sx, sy, 15, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = SHARE_ROUTE_INK; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(sx, sy, 15, 0, Math.PI * 2); ctx.stroke();
  }
  // Stops: copper dots ringed in paper, the last one darker, the number on top (drawn with the texts).
  for (const dot of layout.dots) {
    ctx.fillStyle = dot.last ? SHARE_FINISH : '#c9844a';
    ctx.beginPath(); ctx.arc(dot.x, dot.y, dot.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fbf6ea'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(dot.x, dot.y, dot.r, 0, Math.PI * 2); ctx.stroke();
  }
  for (const disc of layout.discs) {
    ctx.fillStyle = SHARE_FINISH;
    ctx.beginPath(); ctx.arc(disc.x, disc.y, disc.r, 0, Math.PI * 2); ctx.fill();
  }

  ctx.textBaseline = 'alphabetic';
  for (const t of layout.texts) {
    ctx.font = t.font;
    ctx.fillStyle = t.color;
    ctx.textAlign = t.align;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.strokeStyle = 'rgba(55,40,25,0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(layout.rule.x0, layout.rule.y); ctx.lineTo(layout.rule.x1, layout.rule.y); ctx.stroke();
}

/** Lays out with the canvas's own text metrics and draws. */
export function renderRunShareCard<C extends ShareCanvas>(input: RunShareInput, createCanvas: (w: number, h: number) => C): { canvas: C; layout: RunShareLayout; ms: number } {
  const started = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const canvas = createCanvas(SHARE_CARD_W, SHARE_CARD_H);
  canvas.width = SHARE_CARD_W;
  canvas.height = SHARE_CARD_H;
  const ctx = canvas.getContext('2d') as ShareCardContext | null;
  if (!ctx) throw new Error('run share card: no 2d context');
  const measure: Measure = ctx.measureText
    ? (text, font) => { ctx.font = font; return ctx.measureText!(text).width; }
    : approximateMeasure;
  const layout = layoutRunShareCard(input, measure);
  drawRunShareCard(ctx, layout);
  const ms = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - started;
  return { canvas, layout, ms };
}

/** "ride-amsterdam-run-3-stops-jordaan.png". */
export function runShareFileName(stopCount: number, place: string): string {
  const slug = normalise(place).replace(/\s+/g, '-').slice(0, 30);
  return `ride-amsterdam-run-${Math.max(0, stopCount)}-stops${slug ? `-${slug}` : ''}.png`;
}

