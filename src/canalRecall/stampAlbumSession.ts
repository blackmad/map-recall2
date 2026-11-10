// The lane's local counters on `window.__canalRecallSession` (gameplay plan,
// "Measurement"): nothing is sent anywhere; the dev and the run card read it.
type Session = Record<string, unknown>;

export function noteSession(key: string, value: number): void {
  if (typeof window === 'undefined') return;
  const host = window as unknown as { __canalRecallSession?: Session };
  const session = host.__canalRecallSession || (host.__canalRecallSession = {});
  session[key] = value;
}

export function bumpSession(key: string): void {
  if (typeof window === 'undefined') return;
  const host = window as unknown as { __canalRecallSession?: Session };
  const session = host.__canalRecallSession || (host.__canalRecallSession = {});
  session[key] = (Number(session[key]) || 0) + 1;
}
