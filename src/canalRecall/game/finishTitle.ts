/**
 * The arrival card's title (G7, #277). A long destination ("Vondelpark Open
 * Air Theater") was cut to "Vondelpark Open Air…" on a 414-wide phone, so the
 * card no longer named where the rider had arrived. The title steps its size
 * down first, then takes a second line; only a name too long for two lines at
 * the smallest size still ends in an ellipsis.
 */

export interface FinishTitleLayout {
  size: number;
  lineHeight: number;
  lines: string[];
}

/** Sizes tried on one line, roomiest first; the last is also the two-line size. */
export const FINISH_TITLE_SIZES = [26, 24, 22, 20] as const;

interface MeasureContext {
  font: string;
  measureText(text: string): { width: number };
}

const fontAt = (size: number) => `800 ${size}px system-ui, sans-serif`;

/** Greedy word wrap into at most `maxLines`, the last line ellipsised if words remain. */
export function wrapWords(measure: (text: string) => number, text: string, width: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  let index = 0;
  for (; index < words.length; index++) {
    const next = line ? `${line} ${words[index]}` : words[index];
    if (!line || measure(next) <= width) { line = next; continue; }
    lines.push(line);
    line = words[index];
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines) { lines.push(line); return lines.map(l => clip(measure, l, width)); }
  // Out of lines with words left: the last line carries the ellipsis.
  const last = lines.length - 1;
  lines[last] = clip(measure, `${lines[last]}…`, width, true);
  return lines;
}

function clip(measure: (text: string) => number, text: string, width: number, forceEllipsis = false): string {
  if (measure(text) <= width && (!forceEllipsis || text.endsWith('…'))) return text;
  let base = text.replace(/…$/, '');
  while (base.length > 1 && measure(`${base}…`) > width) base = base.slice(0, -1);
  return `${base.trimEnd()}…`;
}

export function fitFinishTitle(ctx: MeasureContext, name: string, width: number): FinishTitleLayout {
  const saved = ctx.font;
  const measure = (text: string) => ctx.measureText(text).width;
  try {
    for (const size of FINISH_TITLE_SIZES) {
      ctx.font = fontAt(size);
      if (measure(name) <= width) return { size, lineHeight: Math.round(size * 1.15), lines: [name] };
    }
    const size = FINISH_TITLE_SIZES[FINISH_TITLE_SIZES.length - 1];
    ctx.font = fontAt(size);
    return { size, lineHeight: Math.round(size * 1.15), lines: wrapWords(measure, name, width, 2) };
  } finally {
    ctx.font = saved;
  }
}
