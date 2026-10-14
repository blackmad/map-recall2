/**
 * Per-pand palette medians from a face's rectified strip (blockFace/stripPalette.ts): wall, accent, frame, band,
 * cornice and fascia colours, class shares, band-row runs. Library palettes are taken from these, not guessed.
 *
 *   node --import tsx scripts/block-face/palette-from-strip.ts --face=kinker-2-30 [--json]
 *   node --import tsx scripts/block-face/palette-from-strip.ts --street=kinkerstraat     # every face of a street survey
 *   ... --frame=<hex>   the model's frame colour (default each pand's measured frame): adds `paint`, the painted-stone
 *                       colour that reads against the drawn frames as the photo's band reads against its frames
 *                       (stripPalette.ts `paintFromFrames`; for `palette.stone` with `stoneMaterial: painted`)
 *
 * Eaves per pand come from the street survey (`scripts/street-surveys/streets/<street>.json`, survey.eavesM) when given,
 * else from the face's `pands/<id>/facts.json` (heights.eavesM), else 14 m. Writes
 * staging/street-types/<street|face>/palette.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {measureStripPalette, paintFromFrames, type StripPalette} from '../../src/canalRecall/blockFace/stripPalette.ts';
import {cityFrameTint} from '../../src/canalRecall/look/palette.ts';
import {swatch} from '../../src/canalRecall/buildingRecipe/intent.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const FACES = 'scripts/block-face/faces';

export interface PandPalette extends StripPalette { face: string; pandId: string; label: string; eavesM: number; widthM: number; buildYear?: number;
  /** Painted-stone colour (`--frame` or the measured frame, drawn through the city frame tint), and the photo's band (else accent) to frame luma ratio. */
  paint?: string | null; paintRatio?: number }

export async function faceStripPalettes(face: string, survey?: Map<string, any>): Promise<PandPalette[]> {
  const strip = JSON.parse(fs.readFileSync(path.join(FACES, face, 'strip.json'), 'utf8'));
  const img = strip.image ?? `staging/block-face/${face}/strip.jpg`;
  if (!fs.existsSync(img)) throw Error(`${face}: no strip image ${img}`);
  const {data, info} = await sharp(img).removeAlpha().raw().toBuffer({resolveWithObject: true});
  const rgb = new Uint8Array(data.buffer, data.byteOffset, data.length);
  return strip.spans.map((s: any) => {
    const sv = survey?.get(s.pandId);
    let eavesM = sv?.survey?.eavesM as number | undefined;
    if (eavesM === undefined) {
      const f = path.join(FACES, face, 'pands', s.pandId, 'facts.json');
      if (fs.existsSync(f)) eavesM = JSON.parse(fs.readFileSync(f, 'utf8')).heights?.eavesM;
    }
    eavesM ??= 14;
    const p = measureStripPalette({rgb, width: info.width, height: info.height, x0: s.px[0], x1: s.px[1], pixelsPerMetre: strip.pixelsPerMetre, eavesM});
    const modelFrame = arg('frame') ? swatch(arg('frame')!) : p.frame, painted = (p.band ?? p.accent) && p.frame && modelFrame ? paintFromFrames((p.band ?? p.accent)!, p.frame, cityFrameTint(modelFrame)) : null;
    return {face, pandId: s.pandId, label: sv?.label ?? s.pandId.slice(-6), eavesM, widthM: +(s.x1M - s.x0M).toFixed(2), buildYear: sv?.buildYear, ...p, paint: painted?.paint ?? null, ...(painted ? {paintRatio: painted.ratio} : {})};
  });
}

export const paletteLine = (p: PandPalette) => `${p.pandId.slice(-6)} ${String(p.label).padEnd(22)} wall ${p.wall ?? '-'}${p.stucco ? ' (stucco)' : ''} accent ${p.accent ?? '-'} frame ${p.frame ?? '-'} band ${p.band ?? '-'} cornice ${p.cornice ?? '-'} fascia ${p.fascia ?? '-'} paint ${p.paint ?? '-'}${p.paintRatio ? ` (x${p.paintRatio})` : ''} | wall/accent/glass ${p.shares.wall}/${p.shares.accent}/${p.shares.glass} | bands ${p.bandRunsM.map(r => r.join('-')).join(' ') || '-'}`;

if (process.argv[1]?.endsWith('palette-from-strip.ts')) {
  const street = arg('street'), face = arg('face');
  if (!street && !face) throw Error('Use --face=<id> or --street=<survey name>');
  let survey: Map<string, any> | undefined, faces: string[];
  if (street) {
    const s = JSON.parse(fs.readFileSync(`scripts/street-surveys/streets/${street}.json`, 'utf8'));
    survey = new Map(s.pands.map((p: any) => [p.pandId, p]));
    faces = [...new Set<string>(s.pands.map((p: any) => p.face).filter(Boolean))].filter(f => fs.existsSync(path.join(FACES, f, 'strip.json')));
  } else faces = [face!];
  const all: PandPalette[] = [];
  for (const f of faces) {
    try { const ps = await faceStripPalettes(f, survey); all.push(...ps); if (!process.argv.includes('--json')) { console.log(`# ${f}`); ps.forEach(p => console.log('  ' + paletteLine(p))); } }
    catch (e) { console.log(`# ${f}: ${(e as Error).message}`); }
  }
  const out = path.join('staging/street-types', street ?? face!);
  fs.mkdirSync(out, {recursive: true});
  fs.writeFileSync(path.join(out, 'palette.json'), JSON.stringify(all, null, 1) + '\n');
  if (process.argv.includes('--json')) console.log(JSON.stringify(all, null, 1));
  console.log(`${all.length} pands -> ${path.join(out, 'palette.json')}`);
}
