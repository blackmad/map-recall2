// The knowledge map panel: paper map of buurt mastery, a legend, tap-to-filter.
import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import type { KnowledgeItem } from '../knowledgeReview.ts';
import {
  bandCounts,
  buildKnowledgeMapModel,
  buurtAtPixel,
  drawKnowledgeMap,
  KNOWLEDGE_MAP_COLORS,
  type KnowledgeMapGeometry,
  type KnowledgeMapModel,
  type MapProjection,
} from '../knowledgeMap.ts';
import { knowledgeMapGeometryNow, loadKnowledgeMapGeometry } from '../knowledgeMapGeometry.ts';
import { noteSession } from '../stampAlbumSession.ts';

export interface KnowledgeMapSelection {
  name: string;
  itemKeys: string[];
}

export function useKnowledgeMapGeometry(): KnowledgeMapGeometry | null {
  const [geometry, setGeometry] = useState<KnowledgeMapGeometry | null>(() => knowledgeMapGeometryNow());
  useEffect(() => {
    if (geometry) return;
    let live = true;
    loadKnowledgeMapGeometry().then(loaded => { if (live) setGeometry(loaded); }, () => {});
    return () => { live = false; };
  }, [geometry]);
  return geometry;
}

export function KnowledgeMap({
  items,
  geometry,
  selected,
  onSelect,
  title = 'Knowledge map',
}: {
  items: readonly KnowledgeItem[];
  geometry: KnowledgeMapGeometry | null;
  selected: KnowledgeMapSelection | null;
  onSelect: (selection: KnowledgeMapSelection | null) => void;
  title?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const projectionRef = useRef<MapProjection | null>(null);
  const [renderMs, setRenderMs] = useState<number | null>(null);
  const [width, setWidth] = useState(0);
  const model: KnowledgeMapModel | null = useMemo(() => (geometry ? buildKnowledgeMapModel(geometry, items) : null), [geometry, items]);
  const counts = model ? bandCounts(model.mastery) : { learning: 0, known: 0, mastered: 0 };
  const dueBuurts = model ? [...model.mastery.values()].filter(entry => entry.due > 0).length : 0;

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    setWidth(frame.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setWidth(frame.clientWidth));
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const frame = frameRef.current;
    if (!canvas || !frame || !geometry || !width) return;
    const started = performance.now();
    // The model is rebuilt inside the timed window so the figure covers the
    // whole path from the knowledge items to pixels.
    const timedModel = buildKnowledgeMapModel(geometry, items);
    const cssW = frame.clientWidth;
    const cssH = frame.clientHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    projectionRef.current = drawKnowledgeMap(ctx, timedModel, { width: cssW, height: cssH, selected: selected?.name ?? null });
    const elapsed = performance.now() - started;
    setRenderMs(elapsed);
    noteSession('knowledgeMapRenderMs', Math.round(elapsed * 10) / 10);
  }, [geometry, items, selected, width]);

  const onTap = (event: MouseEvent<HTMLCanvasElement>) => {
    if (!model || !projectionRef.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const name = buurtAtPixel(model, projectionRef.current, event.clientX - rect.left, event.clientY - rect.top);
    if (!name || name === selected?.name) { onSelect(null); return; }
    onSelect({ name, itemKeys: model.mastery.get(name)?.itemKeys ?? [] });
  };

  const selectedEntry = selected && model ? model.mastery.get(selected.name) : null;
  const c = KNOWLEDGE_MAP_COLORS;
  return (
    <section className="kmap-panel" aria-labelledby="kmap-title">
      <div className="kmap-head">
        <h2 id="kmap-title">{title}</h2>
        <p>Tap a buurt to filter</p>
      </div>
      <div
        className="kmap-frame"
        ref={frameRef}
        data-state={geometry ? 'ready' : 'loading'}
        data-render-ms={renderMs === null ? undefined : renderMs.toFixed(1)}
        data-testid="knowledge-map"
      >
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`Map of Amsterdam by buurt: ${counts.mastered} mastered, ${counts.known} known, ${counts.learning} learning`}
          onClick={onTap}
        />
        {!geometry && <div className="kmap-loading">Map loading</div>}
      </div>
      <ul className="kmap-legend" aria-label="Map key">
        <li><i style={{ background: c.mastered }} data-band="mastered" />Mastered <b>{counts.mastered}</b></li>
        <li><i style={{ background: c.known }} data-band="known" />Known <b>{counts.known}</b></li>
        <li><i style={{ background: c.learning }} data-band="learning" />Learning <b>{counts.learning}</b></li>
        <li><i style={{ background: c.fog }} data-band="fog" />Not yet ridden</li>
        <li><i data-band="due" />Names due <b>{dueBuurts}</b></li>
      </ul>
      {selected && (
        <div className="kmap-filter" role="status">
          <span>{selected.name} · {selectedEntry?.tracked ?? 0} {(selectedEntry?.tracked ?? 0) === 1 ? 'name' : 'names'}</span>
          <button type="button" onClick={() => onSelect(null)}>Whole city</button>
        </div>
      )}
    </section>
  );
}
