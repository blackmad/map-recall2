/**
 * F1 finish hint (#380, coordinator ruling 2026-11-13): a provenance-tagged RENDER HINT for the facade record's wall
 * material, never a fact. Jev's wall-finish answer counts only as 'plaster' at confidence >= 0.7 (benchmark pilot:
 * plaster right on 10 of 11 at that bar; 'painted brick' 17 of 39 and is ignored; 'brick' is the record's default
 * anyway). It is used only where the pand has no spec reading and no register finish (the spec's palette.wallMaterial
 * outranks it in the packer, the register finish in recordWallMaterial), behind `?finishHint=1` (default off until
 * round 4 measures it). Scope: ride-priority gebieden, pre-1945 generic pands (scripts/house-specs/finish-hints.ts).
 *
 * The hints live in their own extract (`finish-hints-v1.json`), never in the facts, encyclopedia or house-spec
 * stores: Jev is never the sole source of an installed fact, only of this hint.
 */
export type FinishHint = { value: 'render'; source: 'jev'; conf: number };
export type FinishHintFile = { version: 1; source: 'jev'; question: 'finish'; minConf: number; generated?: string; hints: Record<string, { value: 'render'; conf: number }> };

export const FINISH_HINT_PARAM = 'finishHint';
export const FINISH_HINT_DEFAULT = false;
export const FINISH_HINT_MIN_CONF = 0.7;
export const FINISH_HINT_FILE = 'finish-hints-v1.json';

/** Jev's finish answer as a hint: 'plaster' at confidence >= FINISH_HINT_MIN_CONF is a render hint; anything else is none. */
export function finishHintFromJev(answer: { choice?: unknown; confidence?: unknown } | null | undefined): FinishHint | null {
  const conf = Number(answer?.confidence);
  if (answer?.choice !== 'plaster' || !Number.isFinite(conf) || conf < FINISH_HINT_MIN_CONF) return null;
  return { value: 'render', source: 'jev', conf: Math.round(conf * 100) / 100 };
}

/** `?finishHint=1|0`, else `window.__canalRecallFinishHint`, else off. */
export function finishHintEnabled(search?: string | null, global?: Record<string, unknown> | null): boolean {
  const g = global ?? (globalThis as Record<string, unknown>);
  const s = search ?? ((g.location as { search?: string } | undefined)?.search ?? '');
  const q = new RegExp(`[?&]${FINISH_HINT_PARAM}=([01])\\b`).exec(s)?.[1];
  if (q) return q === '1';
  const w = g.__canalRecallFinishHint;
  return typeof w === 'boolean' ? w : FINISH_HINT_DEFAULT;
}

const fullId = (id: string) => (id.startsWith('NL.IMBAG.Pand.') ? id : `NL.IMBAG.Pand.${id}`);

/** The hint file as a lookup (keys are full BAG pand ids); a malformed entry or one under the bar is dropped. */
export function parseFinishHints(file: unknown): Map<string, FinishHint> {
  const out = new Map<string, FinishHint>(), f = file as Partial<FinishHintFile> | null;
  if (!f || f.version !== 1 || f.source !== 'jev' || !f.hints || typeof f.hints !== 'object') return out;
  for (const [id, h] of Object.entries(f.hints)) {
    const hint = h?.value === 'render' ? finishHintFromJev({ choice: 'plaster', confidence: h.conf }) : null;
    if (hint) out.set(fullId(id), hint);
  }
  return out;
}

/** The hint file from Jev answers (`{ [pandId]: { choice, confidence } }`): only the pands `inScope` accepts. */
export function buildFinishHintFile(answers: Record<string, { choice?: unknown; confidence?: unknown }>, inScope: (id: string) => boolean, generated?: string): FinishHintFile {
  const hints: FinishHintFile['hints'] = {};
  for (const id of Object.keys(answers).sort()) {
    const h = inScope(fullId(id)) ? finishHintFromJev(answers[id]) : null;
    if (h) hints[fullId(id)] = { value: h.value, conf: h.conf };
  }
  return { version: 1, source: 'jev', question: 'finish', minConf: FINISH_HINT_MIN_CONF, ...(generated ? { generated } : {}), hints };
}

/** One worker's hint file: fetched once (a failed read is an empty table), looked up by pand id. */
export class FinishHintTable {
  private table: Promise<Map<string, FinishHint>> | null = null;
  constructor(private readonly url: string, private readonly fetcher: typeof fetch = (...a) => fetch(...a)) {}
  async hintFor(): Promise<(id: string) => FinishHint | undefined> {
    this.table ??= this.fetcher(this.url).then(async r => (r.ok ? parseFinishHints(await r.json()) : new Map<string, FinishHint>())).catch(() => new Map<string, FinishHint>());
    const t = await this.table;
    return (id: string) => t.get(fullId(id));
  }
}
