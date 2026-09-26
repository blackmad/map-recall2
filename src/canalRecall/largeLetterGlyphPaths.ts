/**
 * Outline-based large-letter drawing: load a heavy display face with opentype.js,
 * then mangle glyph Bézier paths through an arch envelope (Monterey / Atlantic
 * City souvenir style) before canvas fill/stroke.
 *
 * CSS fillText cannot warp outlines; SVG <textPath> only bends the baseline.
 * Path warping is what makes tops + bottoms both curve and letters lean.
 */

// opentype.js is dual-published: Node/CJS exposes `default`, Vite/ESM exposes
// named exports only. Namespace + coalesce works in both.
import * as opentypeNs from 'opentype.js';

type OtGlyph = { advanceWidth: number };
type OtPath = {
  commands: Array<{
    type: string;
    x?: number;
    y?: number;
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
  }>;
};

export type OtFont = {
  numGlyphs: number;
  unitsPerEm: number;
  charToGlyph: (ch: string) => OtGlyph;
  getPath: (ch: string, x: number, y: number, fontSize: number) => OtPath;
};

type OtApi = { parse: (buffer: ArrayBuffer) => OtFont };

const opentype: OtApi = (() => {
  const mod = opentypeNs as unknown as OtApi & { default?: OtApi };
  const api = mod.default ?? mod;
  if (typeof api.parse !== 'function') {
    throw new Error('opentype.js parse() not available (CJS/ESM interop)');
  }
  return api;
})();

type PathCmd = {
  type: string;
  x?: number;
  y?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
};

export type PathBend = 'flat' | 'arch' | 'rise' | 'wave';

export interface ArchEnvelope {
  /** Word left edge (canvas px). */
  x0: number;
  /** Word right edge (canvas px). */
  x1: number;
  /** Baseline y of the flat layout (canvas px). */
  baselineY: number;
  /** Peak path lift in px (positive = rises / baseline moves up). */
  archPx: number;
  /** Extra vertical scale on outlines (taller faces). */
  pullY: number;
  /** Horizontal scale already baked into advance layout. */
  pullX: number;
  /** Bend shape — arch / Indiana wave / Waterloo rise. */
  path?: PathBend;
}

/** Positive = lift (toward top of card). */
export function pathBendLift(path: PathBend, amount: number, t: number): number {
  if (amount <= 0 || path === 'flat') return 0;
  if (path === 'arch') return amount * Math.sin(Math.PI * t);
  if (path === 'rise') {
    return t * amount + Math.sin(Math.PI * t) * amount * 0.35;
  }
  // wave (Indiana) — match baselinePathOffset (smooth rise + bow)
  return (
    t * amount * 0.45
    + Math.sin(Math.PI * t) * amount * 0.55
  );
}

let cachedFont: OtFont | null = null;
let cachedFontUrl: string | null = null;

/** Default craft face — ultra-black, thick strokes for photo windows. */
export const LARGE_LETTER_FONT_URL = '/public/canal-drive/fonts/ArchivoBlack-Regular.ttf';
export const LARGE_LETTER_FONT_CSS = '"Archivo Black", "Arial Black", "Helvetica Neue", sans-serif';

/**
 * Browser/Storybook URL for the bundled TTF. Vite serves `public/` at `/`,
 * so Storybook uses `/canal-drive/fonts/...`. The craft harness serves the
 * repo root and needs `/public/canal-drive/fonts/...` — callers should pass
 * an explicit URL when not using the default.
 */
export const LARGE_LETTER_FONT_PUBLIC_URL = '/canal-drive/fonts/ArchivoBlack-Regular.ttf';

function parseFontBuffer(buffer: ArrayBuffer): OtFont {
  const font = opentype.parse(buffer);
  if (!font || !font.numGlyphs) {
    throw new Error('opentype.parse returned an empty font');
  }
  return font;
}

/** Load Archivo Black (or any TTF/OTF/WOFF) for outline path warping. */
export async function loadLargeLetterFont(
  url: string = LARGE_LETTER_FONT_URL,
): Promise<OtFont> {
  if (cachedFont && cachedFontUrl === url) return cachedFont;
  // Prefer fetch+parse — opentype.load() is flaky across CJS/ESM builds.
  const res = await fetch(url);
  if (!res.ok) throw new Error(`font fetch failed ${res.status} ${url}`);
  const buffer = await res.arrayBuffer();
  const font = parseFontBuffer(buffer);
  cachedFont = font;
  cachedFontUrl = url;
  return font;
}

export function getLoadedLargeLetterFont(): OtFont | null {
  return cachedFont;
}

export function clearLargeLetterFontCache(): void {
  cachedFont = null;
  cachedFontUrl = null;
}

/** Advance width for layout (matches draw scale). */
export function measureGlyphAdvance(
  font: OtFont,
  ch: string,
  fontSize: number,
): number {
  const g = font.charToGlyph(ch);
  return (g.advanceWidth / font.unitsPerEm) * fontSize;
}

/**
 * Arch envelope: baseline + tops follow the same sine bow with uniform height.
 * No fisheye / stem lean — faces stay coplanar on one billboard ribbon.
 * Coordinates are canvas-space (y down).
 */
export function warpPoint(
  x: number,
  y: number,
  env: ArchEnvelope,
): { x: number; y: number } {
  const span = Math.max(1, env.x1 - env.x0);
  const t = Math.min(1, Math.max(0, (x - env.x0) / span));
  const above = (env.baselineY - y) * env.pullY;
  const bend = pathBendLift(env.path ?? 'arch', env.archPx, t);
  return {
    x: env.x0 + (x - env.x0) * env.pullX,
    y: env.baselineY - above - bend,
  };
}

function warpCmd(cmd: PathCmd, env: ArchEnvelope): PathCmd {
  const out: PathCmd = { type: cmd.type };
  if (cmd.type === 'Z') return out;
  if (cmd.x1 != null && cmd.y1 != null) {
    const p = warpPoint(cmd.x1, cmd.y1, env);
    out.x1 = p.x;
    out.y1 = p.y;
  }
  if (cmd.x2 != null && cmd.y2 != null) {
    const p = warpPoint(cmd.x2, cmd.y2, env);
    out.x2 = p.x;
    out.y2 = p.y;
  }
  if (cmd.x != null && cmd.y != null) {
    const p = warpPoint(cmd.x, cmd.y, env);
    out.x = p.x;
    out.y = p.y;
  }
  return out;
}

/** Flat glyph path in canvas space (y down), left at `x`, baseline at `baselineY`. */
export function glyphPathCommands(
  font: OtFont,
  ch: string,
  x: number,
  baselineY: number,
  fontSize: number,
): PathCmd[] {
  const path = font.getPath(ch, x, baselineY, fontSize);
  return path.commands.map((c) => ({ ...c }));
}

export function warpPathCommands(cmds: PathCmd[], env: ArchEnvelope): PathCmd[] {
  return cmds.map((c) => warpCmd(c, env));
}

export function pathCommandsToPath2D(cmds: PathCmd[]): Path2D {
  const p = new Path2D();
  for (const c of cmds) {
    if (c.type === 'M' && c.x != null && c.y != null) p.moveTo(c.x, c.y);
    else if (c.type === 'L' && c.x != null && c.y != null) p.lineTo(c.x, c.y);
    else if (
      c.type === 'C'
      && c.x != null && c.y != null
      && c.x1 != null && c.y1 != null
      && c.x2 != null && c.y2 != null
    ) {
      p.bezierCurveTo(c.x1, c.y1, c.x2, c.y2, c.x, c.y);
    } else if (
      c.type === 'Q'
      && c.x != null && c.y != null
      && c.x1 != null && c.y1 != null
    ) {
      p.quadraticCurveTo(c.x1, c.y1, c.x, c.y);
    } else if (c.type === 'Z') {
      p.closePath();
    }
  }
  return p;
}

/** Build a warped Path2D for one letter (optional arch). */
export function buildWarpedGlyphPath(
  font: OtFont,
  ch: string,
  x: number,
  baselineY: number,
  fontSize: number,
  env: ArchEnvelope | null,
): Path2D {
  let cmds = glyphPathCommands(font, ch, x, baselineY, fontSize);
  if (env) cmds = warpPathCommands(cmds, env);
  return pathCommandsToPath2D(cmds);
}

/** SVG path `d` for debugging / Storybook export. */
export function pathCommandsToSvgD(cmds: PathCmd[]): string {
  const parts: string[] = [];
  for (const c of cmds) {
    if (c.type === 'M' && c.x != null && c.y != null) parts.push(`M${c.x} ${c.y}`);
    else if (c.type === 'L' && c.x != null && c.y != null) parts.push(`L${c.x} ${c.y}`);
    else if (
      c.type === 'C'
      && c.x != null && c.y != null
      && c.x1 != null && c.y1 != null
      && c.x2 != null && c.y2 != null
    ) {
      parts.push(`C${c.x1} ${c.y1} ${c.x2} ${c.y2} ${c.x} ${c.y}`);
    } else if (
      c.type === 'Q'
      && c.x != null && c.y != null
      && c.x1 != null && c.y1 != null
    ) {
      parts.push(`Q${c.x1} ${c.y1} ${c.x} ${c.y}`);
    } else if (c.type === 'Z') parts.push('Z');
  }
  return parts.join(' ');
}
