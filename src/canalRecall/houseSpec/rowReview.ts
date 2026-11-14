/**
 * Parser for the blind row review (scripts/house-specs/rows/blind-review.md). A fresh reviewer sees two strips (photo,
 * drawn) and answers in visible order, one line per house per block:
 *
 *   <block> | <house> | PASS or FAIL | <reason>
 *
 * blocks: same-houses, roof-line, colour-family, white-amount (these four block the row), roof-storey-dormers, window-rhythm-dressings,
 * invented (informational, reported). `<house>` is a label from the strip header or ALL. The row passes when no blocking
 * block has a FAIL and every block has at least one line; an `overall | ALL | FAIL` line also blocks; a malformed or incomplete answer is `invalid`, never a pass.
 */
export const REVIEW_BLOCKS = ['same-houses', 'roof-line', 'colour-family', 'white-amount', 'roof-storey-dormers', 'window-rhythm-dressings', 'invented'] as const;
export type ReviewBlock = typeof REVIEW_BLOCKS[number];
export const BLOCKING: readonly ReviewBlock[] = ['same-houses', 'roof-line', 'colour-family', 'white-amount'];

/** `full`: six blocks, the first four block. `blocking-only`: five blocks, every FAIL blocks; ornament is not judged. */
export type ReviewMode = 'full' | 'blocking-only';
export const BLOCKING_ONLY_BLOCKS: readonly ReviewBlock[] = ['same-houses', 'roof-line', 'colour-family', 'white-amount', 'invented'];
/** A blocking-only answer names none of the two ornament blocks; any line for them makes it a full answer. */
export const detectMode = (text: string): ReviewMode => /^[\s>*`-]*(roof-storey-dormers|window-rhythm-dressings)\s*\|/m.test(text) ? 'full' : 'blocking-only';

export interface ReviewLine { block: ReviewBlock; house: string; pass: boolean; reason: string }
export interface ReviewResult {
  lines: ReviewLine[];
  mode: ReviewMode;
  verdict: 'pass' | 'blocked' | 'pass-with-fails' | 'invalid';
  blocks: Record<ReviewBlock, 'pass' | 'fail' | 'missing'>;
  fails: ReviewLine[];
  problems: string[];
}

export function parseReview(text: string, houses?: string[], mode: ReviewMode | 'auto' = 'auto'): ReviewResult {
  const m: ReviewMode = mode === 'auto' ? detectMode(text) : mode;
  const required = m === 'full' ? REVIEW_BLOCKS : BLOCKING_ONLY_BLOCKS;
  const blocking = m === 'full' ? BLOCKING : BLOCKING_ONLY_BLOCKS;
  const lines: ReviewLine[] = [], problems: string[] = [];
  let overallFail = false;
  for (const raw of text.split('\n')) {
    const l = raw.replace(/^[\s>*`-]+/, '').trim();
    if (!/^[a-z-]+\s*\|/.test(l)) continue;
    const [b, h, v, ...rest] = l.split('|').map(s => s.trim());
    const block = b.toLowerCase() as ReviewBlock;
    if (b.toLowerCase() === 'overall') { if ((v ?? '').toUpperCase() === 'FAIL') overallFail = true; continue; }
    if (!REVIEW_BLOCKS.includes(block)) { problems.push(`unknown block "${b}"`); continue; }
    const verdict = (v ?? '').toUpperCase();
    if (verdict !== 'PASS' && verdict !== 'FAIL') { problems.push(`${b} | ${h}: verdict "${v}" is not PASS or FAIL`); continue; }
    if (!h) { problems.push(`${b}: no house`); continue; }
    lines.push({ block, house: h, pass: verdict === 'PASS', reason: rest.join('|').trim() });
  }
  const blocks = {} as ReviewResult['blocks'];
  for (const b of REVIEW_BLOCKS) { const ls = lines.filter(l => l.block === b); blocks[b] = !ls.length ? 'missing' : ls.some(l => !l.pass) ? 'fail' : 'pass'; }
  for (const b of required) if (blocks[b] === 'missing') problems.push(`block ${b} has no answer`);
  if (houses) for (const b of required) {
    const seen = new Set(lines.filter(l => l.block === b).map(l => l.house.toUpperCase()));
    if (!seen.has('ALL')) for (const h of houses) if (!seen.has(h.toUpperCase())) problems.push(`block ${b}: house ${h} not answered`);
  }
  const fails = lines.filter(l => !l.pass);
  const verdict = problems.length ? 'invalid' : overallFail || blocking.some(b => blocks[b] === 'fail') ? 'blocked' : fails.length ? 'pass-with-fails' : 'pass';
  return { lines, mode: m, verdict, blocks, fails, problems };
}

export function formatReview(r: ReviewResult): string {
  const shown = r.mode === 'full' ? REVIEW_BLOCKS : BLOCKING_ONLY_BLOCKS, blocking = r.mode === 'full' ? BLOCKING : BLOCKING_ONLY_BLOCKS;
  const out = [`verdict: ${r.verdict} (${r.mode})`, ...shown.map(b => `  ${blocking.includes(b) ? '[blocks] ' : '         '}${b}: ${r.blocks[b]}`)];
  for (const f of r.fails) out.push(`  FAIL ${f.block} ${f.house}: ${f.reason}`);
  for (const p of r.problems) out.push(`  problem: ${p}`);
  return out.join('\n');
}
