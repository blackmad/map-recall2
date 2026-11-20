/** Browser client for /api/belt-review: GETs, and POSTs serialised through one queue so revisions advance in order. */
export const API = '/api/belt-review';

export class ApiError extends Error { constructor(message: string, readonly status: number) { super(message); } }

export async function getJson<T>(path: string): Promise<T> {
  const r = await fetch(API + path, { cache: 'no-store' });
  const body = await r.json().catch(() => ({ error: r.statusText }));
  if (!r.ok) throw new ApiError(body.error ?? r.statusText, r.status);
  return body as T;
}

let queue: Promise<unknown> = Promise.resolve();
/** POST in submission order. Resolves with the body, rejects with ApiError (409 conflict, 403 stale token…). A function
 *  body is evaluated when the request starts, so it reads the revision the previous queued save returned. */
export function post<T>(path: string, token: string, body: unknown | (() => unknown), opts: { keepalive?: boolean } = {}): Promise<T> {
  const run = async () => {
    const payload = typeof body === 'function' ? (body as () => unknown)() : body;
    const r = await fetch(API + path, { method: 'POST', keepalive: opts.keepalive, headers: { 'content-type': 'application/json', 'x-review-token': token }, body: JSON.stringify(payload) });
    const out = await r.json().catch(() => ({ error: r.statusText }));
    if (!r.ok) throw new ApiError(out.error ?? r.statusText, r.status);
    return out as T;
  };
  const p = queue.then(run, run);
  queue = p.catch(() => undefined);
  return p;
}
