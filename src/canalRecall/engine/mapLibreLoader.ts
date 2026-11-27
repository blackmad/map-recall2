/**
 * MapLibre loads only for the MapLibre world view (#129 P5 step B1).
 *
 * index.html used to carry static maplibre-gl `<script>` / `<link>` tags, so `?engine=own` downloaded and parsed the
 * library and never used it. This classic script runs in their place, at the same point in `<head>`. For the MapLibre
 * engine it `document.write`s the same tags. That keeps them parser-blocking and in document order, so vector-map.js,
 * the map guard and game.js see `window.maplibregl` exactly as before. For `own` (the default since the Amsterdam
 * flip) it writes nothing.
 *
 * The engine is chosen the way `engineFlag()` (worldViewApi.ts) chooses it: `window.__canalRecallEngine` (the specs'
 * init script) first, then `?engine=`; only `maplibre` loads the library. That logic is repeated here rather than imported, so this bundle stays a few
 * hundred bytes.
 *
 * Caveat: Chrome refuses a cross-site parser-blocking script written by `document.write` on 2G-class connections
 * (the "document.write intervention"). Serving maplibre-gl from this origin removes it; until then that is the one
 * case where the default path can differ from a static tag.
 */
export const MAPLIBRE_VERSION = '5.24.0';
export const MAPLIBRE_BASE = `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist`;

/**
 * True only when the page asks for MapLibre (`?engine=maplibre` or the global): engineFlag() === 'maplibre' for the
 * city game.js loads first (Amsterdam, `DEFAULT_CITY_ID`; game.js picks the engine before any saved city applies).
 * The own engine is the default since the Amsterdam flip (#129).
 */
export function wantsMapLibre(search: string, engineGlobal: unknown): boolean {
  const asked = engineGlobal ?? new URLSearchParams(search).get('engine');
  return asked === 'maplibre';
}

/** The head markup the static tags had, in their order (the basemap preconnect, the CSS, the JS). */
export function mapLibreTags(base = MAPLIBRE_BASE): string {
  return '<link rel="preconnect" href="https://tiles.openfreemap.org" crossorigin>'
    + `<link href="${base}/maplibre-gl.css" rel="stylesheet">`
    + `<script src="${base}/maplibre-gl.js"></script>`;
}

/** Write the tags while the parser is in `<head>`; returns whether it did. */
export function loadMapLibreIfNeeded(win: { location: { search: string }; __canalRecallEngine?: unknown; __canalRecallMapLibreLoad?: string }, doc: { write(markup: string): void }): boolean {
  const load = wantsMapLibre(win.location.search, win.__canalRecallEngine);
  win.__canalRecallMapLibreLoad = load ? 'written' : 'skipped (engine=own)';
  if (load) doc.write(mapLibreTags());
  return load;
}

const w = globalThis as any;
if (typeof w.document !== 'undefined' && w.document.readyState === 'loading') loadMapLibreIfNeeded(w, w.document);
