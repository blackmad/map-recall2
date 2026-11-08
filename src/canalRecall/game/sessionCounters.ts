// Local play counters (gameplay plan 2026-11-08, "Measurement"): each lane
// adds a field the dev can read from `window.__canalRecallSession` and the
// arrival/run card can show. Nothing is sent anywhere; the object lives for
// the page's lifetime only.

export interface SessionCounters {
  [counter: string]: number;
}

type Holder = { __canalRecallSession?: SessionCounters };

function holder(): Holder | null {
  return typeof globalThis === 'undefined' ? null : (globalThis as unknown as Holder);
}

/** The counters object, created on first use. */
export function sessionCounters(): SessionCounters {
  const h = holder();
  if (!h) return {};
  return (h.__canalRecallSession ||= {});
}

/** Add `by` to a counter (created at 0); returns the new value. */
export function bumpSessionCounter(name: string, by = 1): number {
  const counters = sessionCounters();
  counters[name] = (counters[name] || 0) + by;
  return counters[name];
}
