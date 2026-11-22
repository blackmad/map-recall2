/**
 * What's New pair guard, from the command line (src/canalRecall/whatsNewPairGuard.ts). Measures a before/after pair
 * and exits 1 when it is refused: a frame missing most buildings next to the other, or a change too small to see.
 *
 *   node --import tsx scripts/whats-new/pair-guard.ts --before b.png --after a.png [--target x,y,w,h] [--frame x,y,w,h]
 *   node --import tsx scripts/whats-new/pair-guard.ts --composite shot.jpg [--panels 3 --gutter 6] [--pair 1,2] [--vertical]
 *
 * Boxes are fractions of the frame (x,y,w,h). --target is the part of the frame the note is about (default: the whole
 * frame, which skips the context checks); --frame trims HUD or caption bands (default: the whole frame).
 * --composite splits an already-composed sheet into equal panels; --pair picks the before and after panels (0-based,
 * default the last two). --json prints the metrics as JSON.
 */
import sharp from 'sharp';
import { DEFAULT_THRESHOLDS, detectPanels, pairMetrics, pixelChecks, splitPanels, WHOLE, type Box, type RawImage } from '../../src/canalRecall/whatsNewPairGuard.ts';

const args = process.argv.slice(2);
const opt = (name: string): string | undefined => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const flag = (name: string): boolean => args.includes(`--${name}`);
const box = (s: string | undefined): Box => {
  if (!s) return WHOLE;
  const [x, y, w, h] = s.split(',').map(Number);
  if (![x, y, w, h].every(Number.isFinite)) throw new Error(`bad box ${s}: want x,y,w,h fractions`);
  return { x, y, w, h };
};

async function raw(file: string | Buffer, size?: { width: number; height: number }): Promise<RawImage> {
  let s = sharp(file).removeAlpha();
  if (size) s = s.resize(size.width, size.height, { fit: 'fill' });
  const { data, info } = await s.raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, channels: info.channels, data };
}

export async function loadPair(): Promise<[RawImage, RawImage]> {
  const composite = opt('composite');
  if (composite) {
    const sheet = await raw(composite);
    // --panels/--gutter split evenly; without them the gutters are found (detectPanels).
    const panels = opt('panels') ? splitPanels(sheet, Number(opt('panels')), Number(opt('gutter') ?? 6), flag('vertical')) : detectPanels(sheet, flag('vertical'));
    if (panels.length < 2) throw new Error(`${composite}: found ${panels.length} panel(s); pass --panels and --gutter`);
    const [i, j] = (opt('pair') ?? `${panels.length - 2},${panels.length - 1}`).split(',').map(Number);
    return [panels[i], panels[j]];
  }
  const b = opt('before'), a = opt('after');
  if (!b || !a) throw new Error('give --before and --after, or --composite');
  const before = await raw(b);
  return [before, await raw(a, { width: before.width, height: before.height })];
}

async function main(): Promise<void> {
  const [before, after] = await loadPair();
  const m = pairMetrics(before, after, box(opt('target')), box(opt('frame')));
  const refusals = pixelChecks(m, DEFAULT_THRESHOLDS);
  if (flag('json')) console.log(JSON.stringify({ metrics: m, refusals }));
  else {
    const p = (v: number | null) => v == null ? '-' : `${(v * 100).toFixed(1)}%`;
    console.log(`target mean diff ${p(m.targetMeanDiff)} | context changed ${p(m.contextChanged)} | edges before ${p(m.edgeBefore)} after ${p(m.edgeAfter)}`);
    for (const r of refusals) console.log(`REFUSED ${r.code}: ${r.message}`);
    if (!refusals.length) console.log('OK');
  }
  process.exitCode = refusals.length ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
