// The arrival/run card's stamp (G5, issue #275): the buurt stamp you just
// earned, drawn as a stamp beside its label, instead of "Passport: Jordaan".
// Draws the postcard art when the stamp-art bundle has loaded, the plain
// stand-in until then; the card is redrawn every frame, so it upgrades itself.
// `?stampCard=0` keeps the old sentence.

import { drawPlainStamp } from './stampAlbumPlain.ts';
import { stampArtNow } from './stampArtLoader.ts';

export const ARRIVAL_STAMP_HEIGHT = 64;

export function stampCardEnabled(search: string | null | undefined): boolean {
  if (!search) return true;
  try {
    return new URLSearchParams(search).get('stampCard') !== '0';
  } catch {
    return true;
  }
}

const plainCache = new Map<string, HTMLCanvasElement>();

function plainStamp(name: string, size: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const key = `${size}|${name}`;
  let canvas = plainCache.get(key);
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) drawPlainStamp(ctx, name, size);
    plainCache.set(key, canvas);
  }
  return canvas;
}

export interface ArrivalStampInput {
  name: string;
  isNew: boolean;
  x: number;
  y: number;
  width: number;
  fontMono: string;
  /** "+2 more" when one arrival stamped several buurts. */
  more?: number;
  /** "4 of 89 stamps", when the album size is known. */
  tally?: string;
}

/** Draw the stamp row; returns its height. */
export function drawArrivalStamp(ctx: CanvasRenderingContext2D, input: ArrivalStampInput): number {
  const size = ARRIVAL_STAMP_HEIGHT;
  const { x, y } = input;
  const art = stampArtNow();
  const image = art ? art.buurtStampCanvas(input.name) : plainStamp(input.name, size * 3);
  ctx.save();
  // A stamp sits slightly askew, like one pressed in by hand.
  ctx.translate(x + size / 2, y + size / 2);
  ctx.rotate(-0.05);
  ctx.shadowColor = 'rgba(31,28,23,0.28)';
  ctx.shadowBlur = 3;
  ctx.shadowOffsetY = 1;
  if (image) ctx.drawImage(image, -size / 2, -size / 2, size, size);
  ctx.restore();

  const textX = x + size + 14;
  const room = Math.max(40, input.x + input.width - textX);
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#b4682c';
  ctx.font = `700 11px ${input.fontMono}`;
  ctx.fillText(input.isNew ? 'NEW PASSPORT STAMP' : 'PASSPORT STAMP', textX, y + 18, room);
  ctx.fillStyle = '#1f1c17';
  ctx.font = '700 19px "Barlow Condensed", system-ui, sans-serif';
  ctx.fillText(input.name, textX, y + 40, room);
  const foot = [input.tally, input.more ? `+${input.more} more` : ''].filter(Boolean).join('  ·  ');
  if (foot) {
    ctx.fillStyle = '#6d655a';
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.fillText(foot, textX, y + 58, room);
  }
  ctx.restore();
  return size;
}
