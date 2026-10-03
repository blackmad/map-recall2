import React, { useEffect, useMemo, useState } from 'react';
import { EXTRACT_CITIES } from './mapRecall/cityExtracts';
import { fetchQuizFeatures } from './dataSources/featureProvider';
import { WikipediaCard } from './components/WikipediaCard';
import type { StreetFeature } from './types';

const CARD_CITIES = EXTRACT_CITIES.map(({ id }) => id as string);

/** What a card still lacks, so the gallery doubles as a coverage review. */
function gaps(feature: StreetFeature): string[] {
  const out: string[] = [];
  if (!feature.localFact) out.push('local fact');
  if (!feature.wikipediaExtract) out.push('description');
  if (!feature.history) out.push('history');
  if (!feature.nameOrigin) out.push('name');
  if (!feature.wikipediaImageUrl) out.push('photo');
  if ((feature.areaPhotos?.length ?? 0) < 2) out.push('postcard');
  return out;
}

/**
 * Every neighbourhood's answer card, as the quiz would show it after the answer.
 * Open with ?gallery=cards[&city=utrecht]. Not linked from the game; it is a review page.
 */
export const CardGallery: React.FC = () => {
  const params = new URLSearchParams(window.location.search);
  const cityId = CARD_CITIES.includes(params.get('city') ?? '') ? params.get('city')! : 'amsterdam';
  // Only Amsterdam is a game city (CITIES); every extract city has a name and box, which is all this needs.
  const extract = EXTRACT_CITIES.find(({ id }) => id === cityId)!;
  const city = { name: extract.name, center: [(extract.bbox.minLat + extract.bbox.maxLat) / 2, (extract.bbox.minLng + extract.bbox.maxLng) / 2] as [number, number] };
  const [features, setFeatures] = useState<StreetFeature[] | null>(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [onlyGaps, setOnlyGaps] = useState(false);

  useEffect(() => {
    document.title = `Neighbourhood cards · ${city.name}`;
    fetchQuizFeatures({ cityId, center: city.center, placeName: city.name, category: 'neighborhoods', scope: 'city', radiusMeters: 60000 })
      .then((all) => setFeatures(all.filter((feature) => feature.type === 'neighborhood').sort((a, b) => a.name.localeCompare(b.name))))
      .catch((reason) => setError(String(reason?.message ?? reason)));
  }, [cityId]);

  const shown = useMemo(() => (features ?? []).filter((feature) =>
    feature.name.toLowerCase().includes(filter.toLowerCase()) && (!onlyGaps || gaps(feature).length)), [features, filter, onlyGaps]);
  const complete = (features ?? []).filter((feature) => !gaps(feature).length).length;

  return <div className="fixed inset-0 overflow-y-auto bg-[#f4efe5] p-4 text-[#2b2118]" data-testid="card-gallery">
    <header className="mx-auto mb-4 flex max-w-6xl flex-wrap items-center gap-3">
      <h1 className="mr-auto text-xl font-black uppercase tracking-wide">Neighbourhood cards · {city.name}</h1>
      {CARD_CITIES.map((id) => <a key={id} href={`?gallery=cards&city=${id}`} className={`rounded-lg px-2.5 py-1 text-xs font-bold ${id === cityId ? 'bg-[#8a4a18] text-white' : 'bg-white/70'}`}>{EXTRACT_CITIES.find((c) => c.id === id)?.name ?? id}</a>)}
      <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter by name" style={{ background: "#fff", color: "#2b2118" }} className="rounded-lg border border-black/20 px-2 py-1 text-sm" />
      <label className="flex items-center gap-1.5 text-xs font-bold"><input type="checkbox" checked={onlyGaps} onChange={(event) => setOnlyGaps(event.target.checked)} />Only cards with gaps</label>
      {features && <span className="text-xs font-bold text-[#8a4a18]">{complete}/{features.length} complete · showing {shown.length}</span>}
    </header>
    {error && <p className="mx-auto max-w-6xl text-sm font-bold text-red-700">{error}</p>}
    {!features && !error && <p className="mx-auto max-w-6xl text-sm">Loading…</p>}
    <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[repeat(2,minmax(0,1fr))]">
      {shown.map((feature) => <section key={feature.id} className="min-w-0 overflow-hidden" data-testid="gallery-card">
        <div className="mb-1 flex flex-wrap items-baseline gap-2">
          <h2 className="text-sm font-black uppercase tracking-wide">{feature.name}</h2>
          {gaps(feature).map((gap) => <span key={gap} className="rounded bg-red-100 px-1.5 text-[10px] font-bold uppercase text-red-800">no {gap}</span>)}
        </div>
        <WikipediaCard feature={feature} />
        {!gaps(feature).length ? null : !feature.wikipediaExtract && !feature.history && !feature.nameOrigin && !feature.wikipediaImageUrl && <div className="answer-detail-card p-3 text-xs">No card at all: the quiz shows only the answer.</div>}
      </section>)}
    </div>
  </div>;
};
