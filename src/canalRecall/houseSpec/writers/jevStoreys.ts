/**
 * Jev storeys question (lane H5h round 3, #351): the facade storey count under STOREYS_DEFINITION, asked of a street crop.
 * A measurement first: `JEV_WRITES_STOREYS` stays false until the question passes the storeys gate on the hand set by the Wilson
 * rule (docs/house-line.md §4c). The prompt is `fixtures/jev-storeys.json` (its `version` is part of every cache key). Pure apart
 * from `askJevStoreys`, which takes the fetch and the key as arguments; nothing here reads the environment or stores a key.
 */
import { createHash } from 'node:crypto';
import FIXTURE from './fixtures/jev-storeys.json' with { type: 'json' };

export const JEV_STOREYS = FIXTURE as typeof FIXTURE;
/** Off: measured on hand set v1 (docs §4c); a writer only once the Wilson interval clears the storeys gate. */
export const JEV_WRITES_STOREYS = false;
const WORDS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven'];

export const storeysHash = (image: Uint8Array | Buffer): string => createHash('sha256').update(`jev-storeys-v${JEV_STOREYS.version}\u0000${JEV_STOREYS.model}\u0000`).update(image).digest('hex').slice(0, 32);

export function storeysRequestBody(imageId: string) {
  return { model: JEV_STOREYS.model, state: { facade: imageId, note: JEV_STOREYS.note }, assets: { [imageId]: { type: 'image', part: 'facade' } }, questions: JEV_STOREYS.questions };
}

export type StoreysAnswer = { value: number; p: number; probabilities: Record<string, number> };
/** The storeys answer and token count of a response; throws on a malformed one, so it is never cached. */
export function parseStoreys(res: any): { answer: StoreysAnswer; tokens: number; model: string } {
  const a = res?.answers?.storeys;
  if (!a || a.type !== 'choice' || typeof a.choice !== 'string' || !a.probabilities) throw new Error('malformed Jev response: no storeys answer');
  const n = WORDS.indexOf(a.choice) + 1; if (n < 1) throw new Error(`malformed Jev response: storeys ${a.choice}`);
  return { answer: { value: n, p: a.probabilities[a.choice], probabilities: a.probabilities }, tokens: (res.usage?.input_tokens ?? 0) + (res.usage?.output_tokens ?? 0), model: String(res.model ?? JEV_STOREYS.model) };
}

export async function askJevStoreys(key: string, jpg: Uint8Array | Buffer, imageId: string, fetchImpl: typeof fetch = fetch): Promise<{ status: number; body: any }> {
  const form = new FormData();
  form.append('request', new Blob([JSON.stringify(storeysRequestBody(imageId))], { type: 'application/json' }));
  form.append('facade', new Blob([jpg as BlobPart], { type: 'image/jpeg' }), 'facade.jpg');
  try {
    const res = await fetchImpl(JEV_STOREYS.endpoint, { method: 'POST', headers: { Authorization: `Bearer ${key}`, [JEV_STOREYS.imageHeader]: 'true' }, body: form });
    const text = await res.text(); let body: any = null; try { body = JSON.parse(text); } catch { /* raw */ }
    return { status: res.status, body: body ?? { raw: text.slice(0, 300) } };
  } catch (e: any) { return { status: 0, body: { error: `network: ${e.message}` } }; }
}
