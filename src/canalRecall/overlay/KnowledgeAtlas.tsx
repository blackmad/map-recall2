// The Knowledge screen's G5 band: the knowledge map beside the stamp album.
// Kept out of OverlayApp.tsx so the screen only gains two lines.
import { useCallback, useMemo, useState } from 'react';
import type { KnowledgeItem } from '../knowledgeReview.ts';
import { readStampSources } from '../stampAlbum.ts';
import { AMSTERDAM_STAMP_BUURTS } from '../stampCatalogue.ts';
import { KnowledgeMap, useKnowledgeMapGeometry, type KnowledgeMapSelection } from './KnowledgeMap.tsx';
import { StampAlbum } from './StampAlbum.tsx';
import { KNOWLEDGE_MAP_CSS } from './knowledgeMapStyles.ts';

export function useKnowledgeAtlasFilter(onSelectBuurt?: () => void) {
  const [selection, setSelection] = useState<KnowledgeMapSelection | null>(null);
  const keys = useMemo(() => (selection ? new Set(selection.itemKeys) : null), [selection]);
  const select = useCallback((next: KnowledgeMapSelection | null) => {
    setSelection(next);
    if (next) onSelectBuurt?.();
  }, [onSelectBuurt]);
  const includes = useCallback((key: string) => !keys || keys.has(key), [keys]);
  return useMemo(() => ({ selection, select, includes }), [selection, select, includes]);
}

export function KnowledgeAtlas({
  items,
  selection,
  onSelect,
  storage = typeof localStorage === 'undefined' ? null : localStorage,
}: {
  items: readonly KnowledgeItem[];
  selection: KnowledgeMapSelection | null;
  onSelect: (selection: KnowledgeMapSelection | null) => void;
  storage?: Pick<Storage, 'getItem'> | null;
}) {
  const geometry = useKnowledgeMapGeometry();
  const sources = useMemo(() => readStampSources(storage), [storage]);
  return (
    <div className="knowledge-g5">
      <style>{KNOWLEDGE_MAP_CSS}</style>
      <KnowledgeMap items={items} geometry={geometry} selected={selection} onSelect={onSelect} />
      {/* The catalogue, not the loaded geometry: the album's total is the same
          number the landing and the arrival card count against (#283). */}
      <StampAlbum sources={sources} buurtNames={AMSTERDAM_STAMP_BUURTS} />
    </div>
  );
}
