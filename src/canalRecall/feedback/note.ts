/** Pure builders for a canalFeedback document body (no DOM globals), shared by the one-note dialog and saveMany. */
export type Context = Record<string, unknown>;
export type Category = 'bug' | 'building' | 'data' | 'request' | 'other';
/** The real-world object a note is about (a building, a model, an OSM element, or a map point). */
export type Subject = { kind: 'pand' | 'model' | 'osm' | 'point'; id?: string; lngLat?: [number, number] };
export type LocationLike = { href: string; hostname: string; host: string; origin: string };
export type EnvironmentInput = {
  location: LocationLike; userAgent: string; viewport: { width: number; height: number; dpr: number };
  feedbackBuild: unknown; build: unknown; capturedAt: string;
};
export type NoteInput = {
  text: string; category: Category; targetId: string; label: string; imageUrl?: string;
  anchor?: { x: number; y: number } | null; screenshot?: string; context?: Context; subject?: Subject; environment: Context;
};
const LOCAL = ['localhost', '127.0.0.1', '[::1]'];
/** Do not store GPS/home query values, tokens or other arbitrary URL data. */
export function pageUrl(href: string) {
  const u = new URL(href);
  for (const key of [...u.searchParams.keys()]) if (!['only', 'kit', 'look', 'az', 'el', 'case', 'queue', 'id'].includes(key)) u.searchParams.delete(key);
  u.hash = '';
  return u.href;
}
export function buildEnvironment(i: EnvironmentInput): Context {
  const { location: l } = i;
  const local = LOCAL.includes(l.hostname);
  return {
    kind: local ? 'local-development' : /\.(web\.app|firebaseapp\.com)$/.test(l.hostname) ? 'firebase-hosting' : l.hostname.endsWith('github.io') ? 'github-pages' : 'custom-host',
    feedbackBuild: i.feedbackBuild, host: l.host, origin: l.origin, page: pageUrl(l.href), local, userAgent: i.userAgent,
    viewport: i.viewport, capturedAt: i.capturedAt, build: i.build ?? null,
  };
}
/** The fields the client supplies; cloud.save adds ownerUid, status and timestamps. */
export function buildNote(i: NoteInput): Record<string, unknown> {
  const note: Record<string, unknown> = {
    text: i.text.trim().slice(0, 12000), category: i.category,
    target: { id: i.targetId.slice(0, 2048), label: i.label.slice(0, 500), imageUrl: i.imageUrl?.startsWith('http') ? i.imageUrl.slice(0, 4096) : '', anchor: i.anchor ?? null },
    screenshot: i.screenshot ?? '', context: i.context ?? {}, environment: i.environment,
  };
  if (i.subject) note.subject = i.subject;
  return note;
}
export type BatchNote = { targetId: string; label: string; imageUrl?: string; text: string; category?: Category; subject?: Subject; context?: Context };
/** Notes with text only, each with the shared environment; ids are assigned by the caller. */
export function buildBatch(notes: BatchNote[], environment: Context): { targetId: string; note: Record<string, unknown> }[] {
  return notes.filter(n => n.text.trim()).map(n => ({
    targetId: n.targetId,
    note: buildNote({ text: n.text, category: n.category ?? 'building', targetId: n.targetId, label: n.label, imageUrl: n.imageUrl, subject: n.subject, context: n.context, environment }),
  }));
}
