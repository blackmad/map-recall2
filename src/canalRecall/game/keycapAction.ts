/**
 * The desktop card action: a mono keycap and its caption (#278, #301). The
 * arrival, pause and run cards all draw it here so hover looks the same: the
 * keycap darkens, the caption turns ink and underlines. Hover is only passed
 * for unscaled cards, where the drawn box is the hit box.
 */
export interface KeycapActionStyle {
  ink: string;
  muted: string;
  /** Caption colour overriding muted/ink (e.g. "Link copied" green). */
  captionColour?: string;
  fontMono: string;
}

export interface KeycapActionBounds { x: number; y: number; w: number; h: number }

export const KEYCAP_ROW_H = 28;
const GAP = 8;

type RoundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => void;

/** Pure hit test for the hover state: true when `mouse` is inside the action's row box. */
export function keycapHover(mouse: { x: number; y: number } | null | undefined, box: KeycapActionBounds): boolean {
  return !!mouse && mouse.x >= box.x && mouse.x <= box.x + box.w && mouse.y >= box.y && mouse.y <= box.y + box.h;
}

/**
 * Draw one keycap action with its row top at `top`; return its click box and
 * the x where the next action may start (before the caller's own spacing).
 */
export function drawKeycapAction(
  ctx: CanvasRenderingContext2D,
  roundRect: RoundRect,
  at: { x: number; top: number },
  action: { key: string; caption: string },
  style: KeycapActionStyle,
  mouse?: { x: number; y: number } | null,
): { bounds: KeycapActionBounds; endX: number } {
  ctx.font = '12px system-ui, sans-serif';
  const captionW = ctx.measureText(action.caption).width;
  ctx.font = `700 11px ${style.fontMono}`;
  const keyW = ctx.measureText(action.key).width + 14;
  const bounds = { x: at.x, y: at.top, w: keyW + GAP + captionW, h: KEYCAP_ROW_H };
  const hover = keycapHover(mouse, bounds);
  ctx.fillStyle = hover ? 'rgba(31,28,23,.18)' : 'rgba(31,28,23,.08)';
  roundRect(ctx, at.x, at.top + 4, keyW, 20, 5);
  ctx.fill();
  ctx.fillStyle = style.ink;
  ctx.fillText(action.key, at.x + 7, at.top + 18);
  const captionX = at.x + keyW + GAP;
  ctx.fillStyle = style.captionColour ?? (hover ? style.ink : style.muted);
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(action.caption, captionX, at.top + 18);
  if (hover) ctx.fillRect(captionX, at.top + 21, captionW, 1);
  return { bounds, endX: captionX + captionW };
}

/** The width `drawKeycapAction` will give an action (keycap + gap + caption), without drawing. */
export function measureKeycapAction(
  ctx: CanvasRenderingContext2D,
  action: { key: string; caption: string },
  fontMono: string,
): number {
  ctx.font = '12px system-ui, sans-serif';
  const captionW = ctx.measureText(action.caption).width;
  ctx.font = `700 11px ${fontMono}`;
  return ctx.measureText(action.key).width + 14 + GAP + captionW;
}

/**
 * Greedy rows of action indices whose widths plus `gap` between them stay within `maxW` (R2-6, #304: the
 * pause card's three keycaps were wider than the card). An action wider than `maxW` still gets a row of its own.
 */
export function wrapKeycapRows(widths: readonly number[], maxW: number, gap: number): number[][] {
  const rows: number[][] = [];
  let used = 0;
  widths.forEach((width, index) => {
    const row = rows[rows.length - 1];
    if (row && used + gap + width <= maxW) { row.push(index); used += gap + width; }
    else { rows.push([index]); used = width; }
  });
  return rows;
}
