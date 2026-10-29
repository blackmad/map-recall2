/**
 * Lane cost bookkeeping for the landmark factory queue (`scripts/landmarks/factory-queue.ts` rows). Every row a lane
 * touches gets `model` (haiku | opus | the raw CLAUDE_MODEL), `turns` (accumulated share of the run's turns) and `ms`
 * (accumulated wall time per stage). Rows no run touched are never changed, so their JSON stays byte-identical.
 * `censusCost` turns the rows into the programme's number: turns per reviewed building.
 */

export const COST_STAGES = ['crops', 'facts', 'draft', 'measure', 'compile', 'strip', 'install'] as const;
export type CostStage = typeof COST_STAGES[number];

export interface CostRow { model?: string; turns?: number; ms?: Partial<Record<CostStage, number>>; verdict?: unknown; [k: string]: unknown }
export interface RunCost { model?: string; turns?: number; stage?: CostStage; ms?: number }

/** `--model=`, `--turns=` from argv; the model defaults to CLAUDE_MODEL (claude-haiku-5-5 -> haiku). */
export function costFlags(argv: string[], env: Record<string, string | undefined> = {}): {model?: string; turns?: number} {
  const get = (n: string) => argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
  const rawModel = get('model') ?? env.CLAUDE_MODEL;
  const turnsRaw = get('turns');
  const turns = turnsRaw === undefined ? undefined : Number(turnsRaw);
  if (turns !== undefined && (!Number.isFinite(turns) || turns < 0)) throw Error(`--turns must be a non-negative number, got ${turnsRaw}`);
  return {...(rawModel ? {model: normaliseModel(rawModel)} : {}), ...(turns !== undefined ? {turns} : {})};
}

/** Short family name for the census table: any Haiku id is `haiku`, any Opus id is `opus`; other ids pass through. */
export function normaliseModel(m: string): string {
  const s = m.toLowerCase();
  for (const family of ['haiku', 'opus', 'sonnet', 'fable']) if (s.includes(family)) return family;
  return s;
}

const round2 = (x: number) => Math.round(x * 100) / 100;

/** Adds one stage's wall time to a row (accumulated over runs). */
export function addStageMs(row: CostRow, stage: CostStage, ms: number): void {
  row.ms ??= {};
  row.ms[stage] = round2((row.ms[stage] ?? 0) + ms);
}

/**
 * Charges one run to the rows it touched: the run's turns are split evenly over `rows` (a row's `turns` is the sum of
 * its shares), its wall time is split the same way when given, and the model is set. Rows not passed are not touched.
 */
export function applyRunCost(rows: CostRow[], run: RunCost): void {
  if (!rows.length) return;
  for (const row of rows) {
    if (run.model) row.model = run.model;
    if (run.turns !== undefined) row.turns = round2((row.turns ?? 0) + run.turns / rows.length);
    if (run.stage !== undefined && run.ms !== undefined) addStageMs(row, run.stage, run.ms / rows.length);
  }
}

export interface CostCensus {
  reviewed: number;
  reviewedWithTurns: number;
  turnsReviewed: number;
  turnsAllRows: number;
  turnsPerReviewed: number | null;
  byModel: Record<string, {rows: number; turns: number}>;
  msByStage: Partial<Record<CostStage, number>>;
}

/** The headline: turns per reviewed building (rows with a verdict), with the spend split by model. */
export function censusCost(rows: CostRow[]): CostCensus {
  const out: CostCensus = {reviewed: 0, reviewedWithTurns: 0, turnsReviewed: 0, turnsAllRows: 0, turnsPerReviewed: null, byModel: {}, msByStage: {}};
  for (const r of rows) {
    const reviewed = r.verdict !== undefined && r.verdict !== null;
    if (reviewed) out.reviewed++;
    if (r.turns !== undefined) {
      out.turnsAllRows += r.turns;
      if (reviewed) { out.reviewedWithTurns++; out.turnsReviewed += r.turns; }
      const m = out.byModel[r.model ?? 'unknown'] ??= {rows: 0, turns: 0};
      m.rows++; m.turns = round2(m.turns + r.turns);
    }
    for (const [stage, ms] of Object.entries(r.ms ?? {})) out.msByStage[stage as CostStage] = round2((out.msByStage[stage as CostStage] ?? 0) + (ms ?? 0));
  }
  out.turnsAllRows = round2(out.turnsAllRows);
  out.turnsReviewed = round2(out.turnsReviewed);
  out.turnsPerReviewed = out.reviewedWithTurns ? round2(out.turnsReviewed / out.reviewedWithTurns) : null;
  return out;
}
