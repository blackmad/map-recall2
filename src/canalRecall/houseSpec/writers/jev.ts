/**
 * Jev writer (house line H5): typed judgements of a good-tier street crop (TypeSafe Jev jev-1.14.0, `/v1/systemone`) as a partial
 * HouseSpec. The prompt, the schema and the accept thresholds live in `fixtures/jev-questions.json` (testable, versioned: a change
 * bumps `version` and so every cache key). This module is pure apart from `askJev`, which takes the fetch and the key as arguments;
 * nothing here reads the environment, prints a header or stores a key (scripts/house-specs/describe.ts reads TYPESAFE_API_KEY).
 *
 * Fields written (source `vision-judge`, confidence = the judge's probability for its answer), only above the J1 spike's accept rule:
 *   fronts/0/bays        the word-form bays answer at p >= 0.55 (the spike: 96.7 % right, within +-1 on every front)
 *   fronts/0/gable       only a *confident* answer, p >= 0.75, and only the classes in `gableClasses` (step, plain): cornice contradicted
 *                        the register on AB07 canal fronts (fixture note), bell and neck are unreliable (spike)
 *   palette/wallMaterial brick / painted-brick / stucco at p >= 0.9 (95 % right); stone and mixed are not wall materials in the kit
 *   facts/pui            shop or residential from the shopfront yes/no at answer probability >= 0.875
 * Stone bands, basement and dormer questions are not asked (below baseline in the spike). The Jev writer never sees a fallback-tier crop.
 */
import { createHash } from 'node:crypto';
import type { GableIntent } from '../../buildingRecipe/intent.ts';
import { fromJev, type JevJudgement } from '../adapters.ts';
import type { HouseSpec } from '../spec.ts';
import FIXTURE from './fixtures/jev-questions.json' with { type: 'json' };

export const JEV = FIXTURE as typeof FIXTURE;
/** USD per token (J1 spike: 7,328 tokens = $0.000308). Input and output are priced alike here, which can only overstate the spend. */
export const JEV_USD_PER_TOKEN = 0.042 / 1e6;
const WORDS = ['one', 'two', 'three', 'four', 'five'];

export type JevAnswers = {
  gable?: { choice: string; probabilities: Record<string, number> };
  finish?: { choice: string; probabilities: Record<string, number> };
  shopfront?: { noul: number };
  bays?: { choice: string; probabilities: Record<string, number> };
};
export type JevParsed = { answers: JevAnswers; tokens: number; model: string };

/** The cache key of a request: the bytes of the image that is sent and the prompt version. A crop that changes is a new key. */
export const cropHash = (image: Uint8Array | Buffer): string => createHash('sha256').update(`jev-questions-v${JEV.version}\u0000${JEV.model}\u0000`).update(image).digest('hex').slice(0, 32);

/** The multipart `request` part. `imageId` names the one image asset; no key and no header is part of the body. */
export function requestBody(imageId: string) {
  return { model: JEV.model, state: { facade: imageId, note: JEV.note }, assets: { [imageId]: { type: 'image', part: 'facade' } }, questions: JEV.questions };
}

/** Pull the four answers and the token count out of a Jev response; throws on a malformed one, so a bad response is never cached as an answer. */
export function parseResponse(res: any): JevParsed {
  const a = res?.answers;
  if (!a || typeof a !== 'object') throw new Error('malformed Jev response: no answers');
  const choice = (x: any) => (x && x.type === 'choice' && typeof x.choice === 'string' && x.probabilities && typeof x.probabilities === 'object' ? { choice: x.choice as string, probabilities: x.probabilities as Record<string, number> } : undefined);
  const out: JevAnswers = { gable: choice(a.gable), finish: choice(a.finish), bays: choice(a.bays), shopfront: typeof a.shopfront?.noul === 'number' ? { noul: a.shopfront.noul } : undefined };
  if (!out.gable && !out.finish && !out.bays && !out.shopfront) throw new Error('malformed Jev response: no answer parsed');
  return { answers: out, tokens: (res.usage?.input_tokens ?? 0) + (res.usage?.output_tokens ?? 0), model: String(res.model ?? JEV.model) };
}
export const costOf = (tokens: number): number => tokens * JEV_USD_PER_TOKEN;

const FINISH: Record<string, 'brick' | 'stucco' | 'painted-brick'> = { brick: 'brick', 'painted brick': 'painted-brick', plaster: 'stucco' };
const GABLES = new Set<string>(['neck', 'bell', 'step', 'cornice', 'spout', 'plain']);
/** The jev `plain` pointed gable is the intent vocabulary's `point`. */
const GABLE_WORD: Record<string, GableIntent> = { neck: 'neck', bell: 'bell', step: 'step', cornice: 'cornice', spout: 'spout', plain: 'point' };

/** Answers over the accept thresholds as a `JevJudgement` (adapters.ts fromJev reads it). */
export function judgementOf(pandId: string, crop: string, capturedAt: string | null, answers: JevAnswers): JevJudgement {
  const t = JEV.thresholds, j: JevJudgement = { pandId, crop, capturedAt };
  if (answers.bays) {
    const n = WORDS.indexOf(answers.bays.choice) + 1, p = answers.bays.probabilities[answers.bays.choice];
    if (n > 0 && p >= t.bays) j.bays = { value: n, p };
  }
  if (answers.gable && GABLES.has(answers.gable.choice) && JEV.gableClasses.includes(answers.gable.choice)) {
    const p = answers.gable.probabilities[answers.gable.choice];
    if (p >= t.gable) j.gable = { value: GABLE_WORD[answers.gable.choice], p, confident: true };
  }
  if (answers.finish && FINISH[answers.finish.choice]) {
    const p = answers.finish.probabilities[answers.finish.choice];
    if (p >= t.finish) j.finish = { value: FINISH[answers.finish.choice], p };
  }
  if (answers.shopfront) {
    const yes = answers.shopfront.noul >= 0.5, p = yes ? answers.shopfront.noul : 1 - answers.shopfront.noul;
    if (p >= t.pui) j.pui = { value: yes ? 'shop' : 'residential', p };
  }
  return j;
}

export const jevSpec = (pandId: string, crop: string, capturedAt: string | null, answers: JevAnswers): HouseSpec => fromJev(judgementOf(pandId, crop, capturedAt, answers));

export type JevCall = { status: number; body: any };
/**
 * One request. `fetchImpl` and `key` are arguments so tests never touch the network and the key never lives in this module.
 * A 401/403 is returned as is: the caller stops the whole run (fail closed).
 */
export async function askJev(key: string, jpg: Uint8Array | Buffer, imageId: string, fetchImpl: typeof fetch = fetch): Promise<JevCall> {
  const form = new FormData();
  form.append('request', new Blob([JSON.stringify(requestBody(imageId))], { type: 'application/json' }));
  form.append('facade', new Blob([jpg as BlobPart], { type: 'image/jpeg' }), 'facade.jpg');
  try {
    const res = await fetchImpl(JEV.endpoint, { method: 'POST', headers: { Authorization: `Bearer ${key}`, [JEV.imageHeader]: 'true' }, body: form });
    const text = await res.text();
    let body: any = null; try { body = JSON.parse(text); } catch { /* keep raw */ }
    return { status: res.status, body: body ?? { raw: text.slice(0, 300) } };
  } catch (e: any) { return { status: 0, body: { error: `network: ${e.message}` } }; }
}

/** A hard USD budget: `spend` refuses (returns false) once the total would pass the cap; the caller stops. */
export class Budget {
  spent = 0;
  constructor(readonly capUsd: number, spentBefore = 0) { this.spent = spentBefore; }
  get exhausted() { return this.spent >= this.capUsd; }
  add(tokens: number) { this.spent += costOf(tokens); }
}
