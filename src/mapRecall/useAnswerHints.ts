/**
 * The locate hints for an answer, fetched once per feature (references are cached by
 * src/dataSources/featureProvider.ts). Used after the answer for the card's "Where it is" line
 * and the postcard's district caption; the quiz prepares them during the guess, so the card
 * does not wait. Nothing here is shown before the answer.
 */
import { useEffect, useState } from 'react';
import type { StreetFeature } from '../types';
import { fetchHintReferences } from '../dataSources/featureProvider';
import { buildLocateHints, type LocateHint } from './locateHints';

type HintFeature = Pick<StreetFeature, 'id' | 'name' | 'type' | 'cityId' | 'center' | 'path' | 'paths' | 'areaGeometry'>;

const hintsByFeature = new Map<string, Promise<LocateHint[]>>();

export function answerHints(feature: HintFeature): Promise<LocateHint[]> {
  const key = `${feature.cityId}:${feature.id}`;
  let entry = hintsByFeature.get(key);
  if (!entry) {
    entry = fetchHintReferences(feature.cityId, feature.center)
      .then((references) => buildLocateHints(feature, references, 8))
      .catch(() => []);
    hintsByFeature.set(key, entry);
    if (hintsByFeature.size > 40) hintsByFeature.delete(hintsByFeature.keys().next().value!);
  }
  return entry;
}

/** The answer's hints, or null while they load. */
export function useAnswerHints(feature: HintFeature): LocateHint[] | null {
  const key = `${feature.cityId}:${feature.id}`;
  const [state, setState] = useState<{ key: string; hints: LocateHint[] } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void answerHints(feature).then((hints) => { if (!cancelled) setState({ key, hints }); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state?.key === key ? state.hints : null;
}
