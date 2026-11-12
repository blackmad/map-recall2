/**
 * Parse and score a blind-critic round (lane F4, #379).
 *
 * The critic writes one line per pair: `P017 | game: B | gap: window kind | severity: 2 | confidence: med | note: ...`.
 * parseAnswers keeps lines whose gap is a closed-vocabulary term and rejects the rest (with the reason), never guessing.
 * scoreRound sets the answers against the round key (which half is the game): the fooled-rate is the share of answered
 * pairs where the critic named the photo as the game (0.5 = cannot tell them apart), and the histogram counts each gap
 * term with its severity sum, per benchmark group too. The histogram, ranked by severity sum, is the kit-gap queue.
 */
import { GAP_TERMS, gapIdOf, type CriticAnswer, type GapId, type Severity, type Side } from './vocabulary.ts';

export interface Rejected { line: string; why: string }

export function parseAnswers(text: string): { answers: CriticAnswer[]; rejected: Rejected[] } {
  const answers: CriticAnswer[] = [], rejected: Rejected[] = [], seen = new Set<string>();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/^[\s>*`-]+/, '').replace(/`+$/, '').trim();
    const m = /^(P\d{3,4})\s*\|(.*)$/i.exec(line);
    if (!m) continue;
    const pair = m[1].toUpperCase(), fields: Record<string, string> = {};
    for (const part of m[2].split('|')) { const kv = /^\s*([a-z ]+?)\s*:\s*(.*?)\s*$/i.exec(part); if (kv) fields[kv[1].toLowerCase()] = kv[2]; }
    const game = (fields.game ?? '').trim().toUpperCase();
    if (game !== 'A' && game !== 'B') { rejected.push({ line, why: `game must be A or B, got "${fields.game ?? ''}"` }); continue; }
    const gap = gapIdOf(fields.gap ?? '');
    if (!gap) { rejected.push({ line, why: `gap "${fields.gap ?? ''}" is not a vocabulary term` }); continue; }
    const sevN = Number((fields.severity ?? '').trim());
    const severity = gap === 'none' ? null : sevN === 1 || sevN === 2 || sevN === 3 ? sevN as Severity : null;
    if (gap !== 'none' && severity == null) { rejected.push({ line, why: `severity must be 1-3, got "${fields.severity ?? ''}"` }); continue; }
    if (seen.has(pair)) { rejected.push({ line, why: `second answer for ${pair}` }); continue; }
    seen.add(pair);
    const conf = (fields.confidence ?? '').trim().toLowerCase();
    answers.push({ pair, game: game as Side, gap, severity, confidence: conf === 'low' || conf === 'med' || conf === 'high' ? conf : conf === 'medium' ? 'med' : null, note: fields.note ?? '' });
  }
  return { answers, rejected };
}

export interface KeyEntry { pair: string; key: string; pandId: string; group: string; route: string; game: Side }
export interface HistogramRow { gap: GapId; text: string; owner: string | null; count: number; severitySum: number; bySeverity: Record<1 | 2 | 3, number>; byGroup: Record<string, number>; pairs: string[] }
export interface RoundScore {
  round: number; pairs: number; answered: number; missing: string[]; correct: number; fooled: number; fooledRate: number;
  fooledRateByGroup: Record<string, { n: number; fooled: number; rate: number }>;
  histogram: HistogramRow[];
}

export function scoreRound(round: number, key: KeyEntry[], answers: CriticAnswer[]): RoundScore {
  const byPair = new Map(answers.map(a => [a.pair, a]));
  const answered = key.filter(k => byPair.has(k.pair));
  const fooledList = answered.filter(k => byPair.get(k.pair)!.game !== k.game);
  const groups: RoundScore['fooledRateByGroup'] = {};
  for (const k of answered) {
    const g = groups[k.group] ??= { n: 0, fooled: 0, rate: 0 };
    g.n++; if (byPair.get(k.pair)!.game !== k.game) g.fooled++;
  }
  for (const g of Object.values(groups)) g.rate = +(g.fooled / g.n).toFixed(3);
  const rows = new Map<GapId, HistogramRow>();
  for (const t of GAP_TERMS) rows.set(t.id, { gap: t.id, text: t.text, owner: t.owner, count: 0, severitySum: 0, bySeverity: { 1: 0, 2: 0, 3: 0 }, byGroup: {}, pairs: [] });
  for (const k of answered) {
    const a = byPair.get(k.pair)!, row = rows.get(a.gap)!;
    row.count++; row.severitySum += a.severity ?? 0; if (a.severity) row.bySeverity[a.severity]++;
    row.byGroup[k.group] = (row.byGroup[k.group] ?? 0) + 1; row.pairs.push(k.pair);
  }
  const histogram = [...rows.values()].filter(r => r.count).sort((x, y) => y.severitySum - x.severitySum || y.count - x.count || x.gap.localeCompare(y.gap));
  return {
    round, pairs: key.length, answered: answered.length, missing: key.filter(k => !byPair.has(k.pair)).map(k => k.pair),
    correct: answered.length - fooledList.length, fooled: fooledList.length, fooledRate: answered.length ? +(fooledList.length / answered.length).toFixed(3) : NaN,
    fooledRateByGroup: groups, histogram,
  };
}

/** Stop rule: the fooled-rate curve is flat (|change| < tol) for the last two rounds, so the loop restarts with a fresh critic. */
export function flatForTwoRounds(rates: number[], tol = 0.03): boolean {
  if (rates.length < 3) return false;
  const [a, b, c] = rates.slice(-3);
  return Math.abs(b - a) < tol && Math.abs(c - b) < tol;
}
