/**
 * The pause card (#319). The user, 2026-11-09: "ugly and uncentered". The old
 * card was a fixed 400 px plate whose keycap row started at the left padding
 * and whose stats line sat under it on the card's centre, so nothing lined up;
 * in Free Ride it reported "0 of 0 named", a quiz tally that does not exist.
 *
 * Now the card hugs its content and every line is centred on the card:
 * heading, a one-line ride-context subtitle, the actions (desktop: centred
 * keycap rows that wrap within the inner width; phone: full-width 44 px
 * buttons, no keycaps), and time · distance with the tally only when a quiz
 * ride has attempts. `pauseCardLayout` is pure (measure in, rects out) so the
 * centring invariant is unit-tested and Storybook draws the same card.
 */
import { drawKeycapAction, KEYCAP_ROW_H, keycapActionWidth, wrapKeycapRows, type KeycapActionBounds } from './keycapAction';
import { formatRideDistance } from './rideDistance';

export type PauseActionId = 'resume' | 'route' | 'copy';
export interface PauseAction { id: PauseActionId; key: string; caption: string }

export interface PauseCardStrings {
  title: string;
  /** Ride context: "to Westerkerk", "Free ride · Jordaan". Empty for none. */
  subtitle: string;
  stats: string;
  actions: readonly PauseAction[];
}

export interface PauseCardViewport { width: number; height: number; compact: boolean }
export interface PauseCardFonts { plaque: string; ui: string; mono: string }
export type PauseMeasure = (text: string, font: string) => number;

export interface PauseRect { x: number; y: number; w: number; h: number }
export interface PauseTextLine { text: string; font: string; x: number; baseline: number; width: number }
export interface PauseRowItem { index: number; x: number; w: number }
export interface PauseRow { x: number; top: number; w: number; h: number; items: PauseRowItem[] }

export interface PauseCardLayout {
  compact: boolean;
  card: PauseRect;
  /** The card's inner box: card less its side padding. Every line sits within it. */
  inner: { left: number; right: number };
  cx: number;
  title: PauseTextLine;
  subtitle: PauseTextLine | null;
  rows: PauseRow[];
  stats: PauseTextLine | null;
}

export const PAUSE_DESKTOP = {
  padX: 32, padTop: 22, padBottom: 20, maxCardW: 520, minInnerW: 240,
  titleSize: 30, subtitleSize: 13, statsSize: 12,
  keyGap: 22, rowGap: 6,
} as const;
export const PAUSE_PHONE = {
  padX: 18, padTop: 18, padBottom: 16, maxCardW: 360, minInnerW: 260,
  titleSize: 26, subtitleSize: 13, statsSize: 12,
  buttonH: 44, rowGap: 8, buttonPadX: 24,
} as const;
const EDGE = 12;
const ELLIPSIS = '…';

export function pauseFonts(fonts: PauseCardFonts, compact: boolean) {
  const spec = compact ? PAUSE_PHONE : PAUSE_DESKTOP;
  return {
    title: `800 ${spec.titleSize}px ${fonts.plaque}`,
    subtitle: `500 ${spec.subtitleSize}px ${fonts.ui}`,
    stats: `500 ${spec.statsSize}px ${fonts.ui}`,
    button: '700 14px system-ui, sans-serif',
  };
}

/** Cut `text` at a word (else a character) so it fits `maxW`, with an ellipsis. */
export function fitLine(measure: PauseMeasure, text: string, font: string, maxW: number): string {
  if (!text || measure(text, font) <= maxW) return text;
  let cut = text;
  while (cut.length > 1) {
    const space = cut.lastIndexOf(' ', cut.length - 2);
    cut = space > 0 && measure(cut.slice(0, space) + ELLIPSIS, font) <= maxW
      ? cut.slice(0, space)
      : cut.slice(0, -1);
    if (measure(cut.trimEnd() + ELLIPSIS, font) <= maxW) return cut.trimEnd() + ELLIPSIS;
  }
  return ELLIPSIS;
}

export function pauseCardLayout(
  measure: PauseMeasure,
  strings: PauseCardStrings,
  viewport: PauseCardViewport,
  fonts: PauseCardFonts,
): PauseCardLayout {
  const compact = viewport.compact;
  const spec = compact ? PAUSE_PHONE : PAUSE_DESKTOP;
  const font = pauseFonts(fonts, compact);
  const maxCardW = Math.max(160, Math.min(spec.maxCardW, viewport.width - EDGE * 2));
  const maxInner = maxCardW - spec.padX * 2;

  // Actions: desktop keycap rows wrapped to the widest inner width; phone buttons one per row.
  let actionRows: { indices: number[]; w: number }[];
  let rowH: number;
  if (compact) {
    rowH = PAUSE_PHONE.buttonH;
    actionRows = strings.actions.map((action, index) => ({
      indices: [index], w: Math.min(maxInner, measure(action.caption, font.button) + PAUSE_PHONE.buttonPadX * 2),
    }));
  } else {
    rowH = KEYCAP_ROW_H;
    const widths = strings.actions.map(action => keycapActionWidth(measure, action, fonts.mono));
    actionRows = wrapKeycapRows(widths, maxInner, PAUSE_DESKTOP.keyGap).map(indices => ({
      indices,
      w: indices.reduce((sum, i) => sum + widths[i], 0) + (indices.length - 1) * PAUSE_DESKTOP.keyGap,
    }));
  }

  const titleText = fitLine(measure, strings.title, font.title, maxInner);
  const statsText = fitLine(measure, strings.stats, font.stats, maxInner);
  const subtitleText = fitLine(measure, strings.subtitle, font.subtitle, maxInner);
  const titleW = measure(titleText, font.title);
  const statsW = statsText ? measure(statsText, font.stats) : 0;
  const subtitleW = subtitleText ? measure(subtitleText, font.subtitle) : 0;

  const innerW = Math.min(maxInner, Math.max(spec.minInnerW, titleW, statsW, subtitleW, ...actionRows.map(row => row.w)));
  const cardW = Math.ceil(innerW + spec.padX * 2);

  // Vertical stack, top to bottom; every gap is named so the card has no empty band.
  let y = spec.padTop;
  const titleBaseline = y + Math.round(spec.titleSize * 0.8);
  y += spec.titleSize;
  let subtitleBaseline = 0;
  if (subtitleText) {
    y += 6;
    subtitleBaseline = y + Math.round(spec.subtitleSize * 0.85);
    y += spec.subtitleSize + 3;
  }
  y += compact ? 14 : 16;
  const actionsTop = y;
  y += actionRows.length * rowH + Math.max(0, actionRows.length - 1) * spec.rowGap;
  let statsBaseline = 0;
  if (statsText) {
    y += compact ? 12 : 14;
    statsBaseline = y + Math.round(spec.statsSize * 0.85);
    y += spec.statsSize + 3;
  }
  y += spec.padBottom;
  const cardH = Math.round(y);

  const cardX = Math.round((viewport.width - cardW) / 2);
  const cardY = Math.round((viewport.height - cardH) / 2);
  const cx = cardX + cardW / 2;
  const line = (text: string, f: string, width: number, baseline: number): PauseTextLine =>
    ({ text, font: f, x: cx, baseline: cardY + baseline, width });

  const rows: PauseRow[] = actionRows.map((row, r) => {
    const w = compact ? innerW : row.w;
    const x = cx - w / 2;
    const top = cardY + actionsTop + r * (rowH + spec.rowGap);
    let ax = x;
    const items = row.indices.map(index => {
      const iw = compact ? w : keycapActionWidth(measure, strings.actions[index], fonts.mono);
      const item = { index, x: ax, w: iw };
      ax += iw + (compact ? 0 : PAUSE_DESKTOP.keyGap);
      return item;
    });
    return { x, top, w, h: rowH, items };
  });

  return {
    compact,
    card: { x: cardX, y: cardY, w: cardW, h: cardH },
    inner: { left: cardX + spec.padX, right: cardX + cardW - spec.padX },
    cx,
    title: line(titleText, font.title, titleW, titleBaseline),
    subtitle: subtitleText ? line(subtitleText, font.subtitle, subtitleW, subtitleBaseline) : null,
    rows,
    stats: statsText ? line(statsText, font.stats, statsW, statsBaseline) : null,
  };
}

/** "11:33" or "1:02:05": a pause card is no stopwatch, so no milliseconds. */
export function formatPauseTime(seconds: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const two = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${two(m)}:${two(sec)}` : `${two(m)}:${two(sec)}`;
}

export type PauseTranslate = (key: 'ride.pauseSummary' | 'ride.pauseStats', vars: Record<string, string | number>) => string;

/** Time · distance always; the quiz tally only on a quiz ride that has asked something. */
export function pauseStatsText(
  t: PauseTranslate,
  ride: { timeS: number; km: number; correct: number; attempts: number; freeRide: boolean },
): string {
  const vars = { time: formatPauseTime(ride.timeS), km: formatRideDistance(ride.km, { routed: true }).replace(/ km$/, '') };
  return !ride.freeRide && ride.attempts > 0
    ? t('ride.pauseSummary', { ...vars, correct: ride.correct, attempts: ride.attempts })
    : t('ride.pauseStats', vars);
}

export interface PauseCardPaint {
  ink: string; muted: string; copper: string; rule: string; good: string;
  fontMono: string;
  /** The card plate (the HUD's paper card in the game). */
  paper(rect: PauseRect): void;
  roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void;
  /** Action whose caption shows done (green), e.g. "Link copied". */
  doneId?: PauseActionId | null;
  mouse?: { x: number; y: number } | null;
}

/** Draw the laid-out card; return each action's click box (#278) in drawing order. */
export function drawPauseCard(
  ctx: CanvasRenderingContext2D,
  layout: PauseCardLayout,
  actions: readonly PauseAction[],
  paint: PauseCardPaint,
): Array<KeycapActionBounds & { id: PauseActionId }> {
  paint.paper(layout.card);
  ctx.textAlign = 'center';
  ctx.fillStyle = paint.ink;
  ctx.font = layout.title.font;
  ctx.fillText(layout.title.text, layout.cx, layout.title.baseline);
  if (layout.subtitle) {
    ctx.fillStyle = paint.muted;
    ctx.font = layout.subtitle.font;
    ctx.fillText(layout.subtitle.text, layout.cx, layout.subtitle.baseline);
  }

  const bounds: Array<KeycapActionBounds & { id: PauseActionId }> = [];
  for (const row of layout.rows) {
    for (const item of row.items) {
      const action = actions[item.index];
      const done = paint.doneId === action.id;
      if (layout.compact) {
        const primary = action.id === 'resume';
        const box = { x: item.x, y: row.top, w: item.w, h: row.h };
        ctx.fillStyle = primary ? paint.copper : 'rgba(31,28,23,.05)';
        paint.roundRect(ctx, box.x, box.y, box.w, box.h, 12);
        ctx.fill();
        if (!primary) {
          ctx.strokeStyle = paint.rule;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        ctx.textAlign = 'center';
        ctx.fillStyle = primary ? '#1f1c17' : (done ? paint.good : paint.ink);
        ctx.font = '700 14px system-ui, sans-serif';
        ctx.fillText(action.caption, box.x + box.w / 2, box.y + 28);
        bounds.push({ ...box, id: action.id });
      } else {
        ctx.textAlign = 'left';
        const drawn = drawKeycapAction(ctx, paint.roundRect, { x: item.x, top: row.top }, action, {
          ink: paint.ink, muted: paint.muted, fontMono: paint.fontMono, captionColour: done ? paint.good : undefined,
        }, paint.mouse);
        bounds.push({ ...drawn.bounds, id: action.id });
      }
    }
  }

  if (layout.stats) {
    ctx.textAlign = 'center';
    ctx.fillStyle = paint.muted;
    ctx.font = layout.stats.font;
    ctx.fillText(layout.stats.text, layout.cx, layout.stats.baseline);
  }
  return bounds;
}
