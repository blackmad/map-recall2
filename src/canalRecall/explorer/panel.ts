/**
 * Pure explorer page logic: what the building panel says and links to, the
 * feedback targets it opens, deep links and name search. The DOM, MapLibre and
 * three.js live in browser.ts / viewer.ts.
 */
import type { ExplorerIndex, ExplorerKind, ExplorerModel, LngLat } from './types';

export const KIND_LABEL: Readonly<Record<ExplorerKind, string>> = {
  landmark: 'Landmark',
  ordinary: 'Building',
  house: 'Canal house',
  block: 'Street frontage',
};

/** The model licence, as credits.html words the sources; the page links "credits.html" after it. */
export const LICENCE = 'CC BY 4.0 · credit Ride Amsterdam, 3DBAG, BAG and OpenStreetMap contributors';
export const LICENCE_LINE = `${LICENCE}; see credits.html`;

/** 162728 -> "159 KB"; 1450000 -> "1.4 MB". */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** `westerkerk.glb` style file name for the download attribute. */
export const downloadName = (model: Pick<ExplorerModel, 'id'>): string => `canal-recall-${model.id.replace(/[^a-z0-9._-]+/gi, '-')}.glb`;

export interface PanelView {
  title: string;
  kindLabel: string;
  buurt: string;
  /** "BAG pand 0363…" lines, at most `maxPands`, plus a "+n more" tail. */
  pandLines: string[];
  wiki?: string;
  /** Absent when the model may not be redistributed. */
  download?: { href: string; filename: string; label: string };
  licence: string;
  facts: string[];
}

/** Everything the side panel shows for one model. `base` is the page-relative prefix of model URLs (normally ''). */
export function panelView(model: ExplorerModel, base = '', maxPands = 3): PanelView {
  const pands = model.pandIds.slice(0, maxPands).map(id => `BAG pand ${id}`);
  if (model.pandIds.length > maxPands) pands.push(`+${model.pandIds.length - maxPands} more`);
  const facts = [formatBytes(model.bytes), model.triangles ? `${model.triangles.toLocaleString('en-GB')} triangles` : ''].filter(Boolean);
  return {
    title: model.name,
    kindLabel: KIND_LABEL[model.kind],
    buurt: model.buurt,
    pandLines: pands,
    ...(model.wiki ? { wiki: model.wiki } : {}),
    ...(model.restricted ? {} : { download: { href: base + model.glbUrl, filename: downloadName(model), label: `Download GLB · ${formatBytes(model.bytes)}` } }),
    licence: model.restricted
      ? `${model.restricted.licence} (${model.restricted.author}); not redistributed here.`
      : LICENCE,
    facts,
  };
}

export type FeedbackSubject = { kind: 'pand' | 'model' | 'osm' | 'point'; id?: string; lngLat?: LngLat };
export type FeedbackOptions = { category: 'building' | 'request'; subject: FeedbackSubject; label: string; id: string };

/** "Report a problem with this building". */
export const reportOptions = (model: ExplorerModel): FeedbackOptions => ({
  category: 'building',
  subject: { kind: 'model', id: model.id, lngLat: model.lngLat },
  label: `${model.name} (${model.id})`,
  id: `explore:${model.id}`,
});

/** What a map click resolved to: a BAG pand, an OSM-only footprint, or open ground. */
export type ClickTarget = { kind: 'pand' | 'osm'; id: string } | { kind: 'point' };

/** "Request this building" for a clicked spot. */
export function requestOptions(lngLat: LngLat, target: ClickTarget = { kind: 'point' }): FeedbackOptions {
  const at: LngLat = [Math.round(lngLat[0] * 1e6) / 1e6, Math.round(lngLat[1] * 1e6) / 1e6];
  return {
    category: 'request',
    subject: target.kind === 'point' ? { kind: 'point', lngLat: at } : { kind: target.kind, id: target.id, lngLat: at },
    label: 'Building request',
    id: target.kind === 'point' ? `explore:request:${at.join(',')}` : `explore:request:${target.id}`,
  };
}

/** `?buurt=Jordaan&model=westerkerk` -> state. Unknown names are dropped. */
export function parseDeepLink(search: string, index: Pick<ExplorerIndex, 'buurten' | 'models'>): { buurt?: string; model?: string } {
  const q = new URLSearchParams(search);
  const buurt = q.get('buurt') ?? undefined, model = q.get('model') ?? undefined;
  const lower = buurt?.toLowerCase();
  return {
    ...(lower ? { buurt: index.buurten.find(b => b.name.toLowerCase() === lower)?.name } : {}),
    ...(model && index.models.some(m => m.id === model) ? { model } : {}),
  };
}

/** State -> search string, keeping any unrelated parameters. */
export function deepLinkSearch(current: string, state: { buurt?: string; model?: string }): string {
  const q = new URLSearchParams(current);
  for (const key of ['buurt', 'model'] as const) {
    const value = state[key];
    if (value) q.set(key, value); else q.delete(key);
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

/** Lowercase, accent-free, punctuation-as-space: "Hôtel de l’Europe" -> "hotel de l europe". */
export const normalise = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Name search: every query word must start a word of the name (or the id);
 * a whole-name prefix ranks first, landmarks before other kinds.
 */
export function searchModels(models: readonly ExplorerModel[], query: string, limit = 12): ExplorerModel[] {
  const words = normalise(query).split(' ').filter(Boolean);
  if (!words.length) return [];
  const scored: { m: ExplorerModel; score: number }[] = [];
  for (const m of models) {
    const name = normalise(m.name);
    const tokens = `${name} ${normalise(m.id)} ${m.pandIds.join(' ')}`.split(' ');
    if (!words.every(w => tokens.some(t => t.startsWith(w)))) continue;
    const score = (name.startsWith(words.join(' ')) ? 0 : 2) + (m.kind === 'landmark' ? 0 : 1);
    scored.push({ m, score });
  }
  return scored.sort((a, b) => a.score - b.score || a.m.name.localeCompare(b.m.name)).slice(0, limit).map(s => s.m);
}

/** Models listed for a buurt (all when none): landmarks first, then by name. */
export function modelsIn(models: readonly ExplorerModel[], buurt?: string): ExplorerModel[] {
  const order: Record<ExplorerKind, number> = { landmark: 0, ordinary: 1, block: 2, house: 3 };
  return models.filter(m => !buurt || m.buurt === buurt).sort((a, b) => order[a.kind] - order[b.kind] || a.name.localeCompare(b.name));
}

/** Pand number -> model, for a click on a modelled building's footprint rather than its pin. */
export function pandIndex(models: readonly ExplorerModel[]): Map<string, ExplorerModel> {
  const out = new Map<string, ExplorerModel>();
  for (const m of models) for (const p of m.pandIds) if (!out.has(p)) out.set(p, m);
  return out;
}
