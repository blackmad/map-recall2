// The light half of a buurt stamp: the perforated edge and a typographic
// stand-in drawn while the postcard compositor bundle loads (or if it never
// does). No compositor import here, so the overlay and ride bundles can use it.

export const STAMP_PAPER = '#fbf6ea';
export const STAMP_INK = '#1f1c17';
export const STAMP_ACCENT = '#b4682c';

type Ctx = CanvasRenderingContext2D;

/** Cut the stamp's perforations: half-discs along every edge, made transparent. */
export function punchPerforations(ctx: Ctx, size: number): void {
  const radius = Math.max(1.5, size * 0.022);
  const count = Math.max(6, Math.round(size / (radius * 2.8)));
  const step = size / count;
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  for (let i = 0; i <= count; i += 1) {
    const at = i * step;
    for (const [x, y] of [[at, 0], [at, size], [0, at], [size, at]] as const) {
      ctx.moveTo(x + radius, y);
      ctx.arc(x, y, radius, 0, Math.PI * 2);
    }
  }
  ctx.fill();
  ctx.restore();
}

/** Typographic stand-in: paper, a copper frame, the name in condensed caps. */
export function drawPlainStamp(ctx: Ctx, name: string, size: number): void {
  const margin = Math.round(size * 0.075);
  ctx.save();
  ctx.fillStyle = STAMP_PAPER;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = STAMP_ACCENT;
  ctx.lineWidth = Math.max(1, size * 0.012);
  ctx.strokeRect(margin, margin, size - margin * 2, size - margin * 2);
  ctx.fillStyle = STAMP_INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const words = name.toUpperCase().split(/\s+/);
  const lines = words.length > 1 && name.length > 10
    ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')]
    : [name.toUpperCase()];
  const maxW = size - margin * 3;
  let px = size * 0.2;
  ctx.font = `700 ${px}px "Barlow Condensed", system-ui, sans-serif`;
  while (px > 6 && Math.max(...lines.map(line => ctx.measureText(line).width)) > maxW) {
    px -= 1;
    ctx.font = `700 ${px}px "Barlow Condensed", system-ui, sans-serif`;
  }
  lines.forEach((line, index) => ctx.fillText(line, size / 2, size / 2 + (index - (lines.length - 1) / 2) * px * 1.05));
  ctx.restore();
  punchPerforations(ctx, size);
}
