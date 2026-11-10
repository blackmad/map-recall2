// The knowledge map panel: paper map of buurt mastery, a legend, tap-to-filter.
import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import type { KnowledgeItem } from '../knowledgeReview.ts';
import {
  bandCounts,
  buildKnowledgeMapModel,
  buurtAtPixel,
  drawKnowledgeMap,
  KNOWLEDGE_MAP_COLORS,
  fitMap,
  knownFrame,
  projectLatLng,
  type KnowledgeMapGeometry,
  type KnowledgeMapModel,
  type MapProjection,
} from '../knowledgeMap.ts';
import { knowledgeMapGeometryNow, loadKnowledgeMapGeometry } from '../knowledgeMapGeometry.ts';
import { noteSession } from '../stampAlbumSession.ts';
import { useT } from '../../i18n/useT.ts';

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
  title,
}: {
  items: readonly KnowledgeItem[];
  geometry: KnowledgeMapGeometry | null;
  selected: KnowledgeMapSelection | null;
  onSelect: (selection: KnowledgeMapSelection | null) => void;
  title?: string;
}) {
  const t = useT();
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
    // Test seam: specs tap a buurt by its coordinates.
    const projection = projectionRef.current;
    (canvas as HTMLCanvasElement & { knowledgeMapProject?: (lat: number, lng: number) => [number, number] })
      .knowledgeMapProject = (lat, lng) => projectLatLng(projection, [lat, lng]);
    // Seam for the frame-fit spec (#297): where every known buurt's bounding
    // box lands on the canvas, and the frame the projection was fitted to.
    (canvas as HTMLCanvasElement & { knowledgeMapReport?: () => unknown }).knowledgeMapReport = () => ({
      width: cssW,
      height: cssH,
      frame: knownFrame(timedModel.geometry, timedModel.mastery, timedModel.items),
      defaultFrame: timedModel.geometry.frame,
      outsideDefault: [...timedModel.mastery.values()].filter(entry => {
        const shape = timedModel.geometry.buurts.find(buurt => buurt.name === entry.name);
        if (!shape) return false;
        const old = fitMap(timedModel.geometry.frame, cssW, cssH);
        const { minLat, minLng, maxLat, maxLng } = shape.bbox;
        const [x0, y1] = projectLatLng(old, [minLat, minLng]);
        const [x1, y0] = projectLatLng(old, [maxLat, maxLng]);
        return x0 < 0 || y0 < 0 || x1 > cssW || y1 > cssH;
      }).map(entry => entry.name),
      known: [...timedModel.mastery.values()].map(entry => {
        const shape = timedModel.geometry.buurts.find(buurt => buurt.name === entry.name);
        if (!shape) return null;
        const { minLat, minLng, maxLat, maxLng } = shape.bbox;
        const [x0, y1] = projectLatLng(projection, [minLat, minLng]);
        const [x1, y0] = projectLatLng(projection, [maxLat, maxLng]);
        return { name: entry.name, tracked: entry.tracked, x0, y0, x1, y1 };
      }).filter(Boolean),
    });
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
        <h2 id="kmap-title">{title ?? t('kmap.title')}</h2>
        <p>{t('kmap.tapHint')}</p>
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
          aria-label={t('kmap.aria', { mastered: counts.mastered, known: counts.known, learning: counts.learning })}
          onClick={onTap}
        />
        {!geometry && <div className="kmap-loading">{t('kmap.loading')}</div>}
      </div>
      <ul className="kmap-legend" aria-label={t('knowledge.mapKey')}>
        {/* The bands count buurts, not names: the list below counts names. */}
        <li className="kmap-legend-unit">{t('kmap.legendUnit')}</li>
        <li><i style={{ background: c.mastered }} data-band="mastered" />{t('kmap.mastered')} <b>{counts.mastered}</b></li>
        <li><i style={{ background: c.known }} data-band="known" />{t('kmap.known')} <b>{counts.known}</b></li>
        <li><i style={{ background: c.learning }} data-band="learning" />{t('kmap.learning')} <b>{counts.learning}</b></li>
        <li><i style={{ background: c.fog }} data-band="fog" />{t('kmap.fog')}</li>
        <li><i data-band="due" />{t('kmap.due')} <b>{dueBuurts}</b></li>
      </ul>
      {selected && (
        <div className="kmap-filter" role="status">
          <span>{t((selectedEntry?.tracked ?? 0) === 1 ? 'kmap.filter.one' : 'kmap.filter.other', { name: selected.name, count: selectedEntry?.tracked ?? 0 })}</span>
          <button type="button" onClick={() => onSelect(null)}>{t('kmap.wholeCity')}</button>
        </div>
      )}
    </section>
  );
}
