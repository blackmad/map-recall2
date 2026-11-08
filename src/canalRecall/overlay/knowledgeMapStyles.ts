// Styles for the knowledge map and the stamp album, shipped with the
// components (the Knowledge screen's base CSS lives in index.html, which this
// lane does not own). Uses the screen's custom properties with fallbacks so
// Storybook renders the same paper and ink.
export const KNOWLEDGE_MAP_CSS = `
.kmap-panel { display: grid; align-content: start; gap: 10px; min-width: 0; }
.kmap-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.kmap-head h2, .stamp-album h2 {
  margin: 0; color: var(--ink, #1f1c17);
  font: 750 15px/1.1 var(--font-plaque, "Barlow Condensed", system-ui, sans-serif);
  letter-spacing: .08em; text-transform: uppercase;
}
.kmap-head p, .stamp-album-head p { margin: 0; color: var(--day-ink-muted, #6d655a); font: 500 13px/1.3 system-ui, sans-serif; }
.kmap-frame {
  position: relative; width: 100%; aspect-ratio: 4 / 3;
  border-radius: 6px; overflow: hidden; background: #f4efe5;
  box-shadow: inset 0 0 0 1px var(--day-line, rgba(31,28,23,.14));
}
.kmap-frame canvas { display: block; width: 100%; height: 100%; cursor: pointer; touch-action: manipulation; }
.kmap-frame[data-state="loading"] canvas { opacity: 0; }
.kmap-loading { position: absolute; inset: 0; display: grid; place-items: center; color: var(--day-ink-muted, #6d655a); font: 600 12px/1 var(--font-mono, "JetBrains Mono", monospace); letter-spacing: .08em; text-transform: uppercase; }
.kmap-legend { display: flex; flex-wrap: wrap; gap: 6px 14px; margin: 0; padding: 0; list-style: none; color: var(--ink, #1f1c17); font: 600 12px/1.2 system-ui, sans-serif; }
.kmap-legend li { display: inline-flex; align-items: center; gap: 6px; }
.kmap-legend .kmap-legend-unit { color: var(--day-ink-muted, #6d655a); font: 700 12px/1.2 var(--font-plaque, "Barlow Condensed", system-ui, sans-serif); letter-spacing: .08em; text-transform: uppercase; }
.kmap-legend i { width: 14px; height: 10px; border-radius: 2px; box-shadow: inset 0 0 0 1px rgba(31,28,23,.22); }
.kmap-legend i[data-band="due"] { box-shadow: none; border: 1.5px dashed #b4682c; background: transparent; }
.kmap-legend b { font-variant-numeric: tabular-nums; color: var(--day-ink-muted, #6d655a); font-weight: 600; }
.kmap-filter { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 10px; border-radius: 6px; background: rgba(31,28,23,.05); font: 600 13px/1.2 system-ui, sans-serif; color: var(--ink, #1f1c17); }
.kmap-filter button { min-height: 32px; padding: 0 12px; border: 0; border-radius: 16px; cursor: pointer; background: var(--ink, #1f1c17); color: #f4efe5; font: 700 12px/1 var(--font-plaque, "Barlow Condensed", system-ui, sans-serif); letter-spacing: .06em; text-transform: uppercase; }

.stamp-album { display: grid; align-content: start; gap: 12px; min-width: 0; }
.stamp-album-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.stamp-album-count { white-space: nowrap; color: var(--day-accent-ink, #8a4d1f); font: 800 22px/1 var(--font-plaque, "Barlow Condensed", system-ui, sans-serif); font-variant-numeric: tabular-nums; }
.stamp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 14px 12px; margin: 0; padding: 0; list-style: none; }
.stamp { display: grid; justify-items: center; gap: 5px; margin: 0; min-width: 0; }
.stamp canvas { width: 100%; max-width: 104px; aspect-ratio: 1; height: auto; filter: drop-shadow(0 1px 1.5px rgba(31,28,23,.28)); }
.stamp[data-earned="false"] canvas { filter: grayscale(1) contrast(.7); opacity: .38; }
.stamp figcaption { display: grid; gap: 1px; width: 100%; text-align: center; }
.stamp strong { color: var(--ink, #1f1c17); font: 700 12px/1.15 system-ui, sans-serif; hyphens: manual; overflow-wrap: anywhere; text-wrap: balance; }
.stamp span { color: var(--day-ink-muted, #6d655a); font: 500 11px/1.2 var(--font-mono, "JetBrains Mono", monospace); }
.stamp[data-earned="false"] strong { color: var(--day-ink-muted, #6d655a); font-weight: 600; }
.stamp[data-fresh="true"] span { color: #8a4d1f; font-weight: 700; }
.stamp-album-more { justify-self: start; min-height: 40px; padding: 0 14px; border: 0; border-radius: 6px; cursor: pointer; background: transparent; color: var(--ink, #1f1c17); box-shadow: inset 0 0 0 1px var(--day-line-strong, rgba(31,28,23,.3)); font: 700 13px/1 var(--font-plaque, "Barlow Condensed", system-ui, sans-serif); letter-spacing: .06em; text-transform: uppercase; }
.knowledge-g5 { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: clamp(18px, 2.5vw, 36px); width: min(100%, 1500px); margin: 0 auto; padding: clamp(18px, 2.4vw, 32px) clamp(22px, 3vw, 44px) 0; box-sizing: border-box; }
/* The screen scrolls as a page once the map and album sit above the queue; the
   queue keeps its own height and inner scroll. */
.knowledge-review:has(.knowledge-g5) { overflow-y: auto; }
.knowledge-review:has(.knowledge-g5) > .knowledge-layout { flex: 0 0 auto; height: min(82vh, 920px); }
.knowledge-review:has(.knowledge-g5) > .knowledge-empty { flex: 0 0 auto; }
.knowledge-g5 .kmap-frame { max-height: 420px; }
@media (max-width: 760px), (max-height: 500px) {
  .knowledge-review:has(.knowledge-g5) > .knowledge-layout { height: auto; }
  .knowledge-g5 { grid-template-columns: minmax(0, 1fr); padding: 16px 14px 0; gap: 22px; }
  .stamp-grid { grid-template-columns: repeat(auto-fill, minmax(78px, 1fr)); gap: 12px 10px; }
  .kmap-frame { max-height: none; }
}
`;
