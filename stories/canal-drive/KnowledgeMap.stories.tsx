// G5 (issue #275): the knowledge map, the stamp album (0, 3, 24 stamps) and
// the arrival card's stamp, on a desktop and a phone frame.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useMemo, useRef, useState } from 'react';
import { KnowledgeAtlas, useKnowledgeAtlasFilter } from '../../src/canalRecall/overlay/KnowledgeAtlas.tsx';
import { buildKnowledgeReview } from '../../src/canalRecall/knowledgeReview.ts';
import { PASSPORT_STORAGE_KEY } from '../../src/canalRecall/game/neighborhoodPassport.ts';
import { FREE_RIDE_COLLECTION_KEY } from '../../src/canalRecall/stampAlbum.ts';
import { provideStampArt } from '../../src/canalRecall/stampArtLoader.ts';
import * as stampArt from '../../src/canalRecall/stampAlbumStamp.ts';
import { drawArrivalStamp, ARRIVAL_STAMP_HEIGHT } from '../../src/canalRecall/stampArrival.ts';
import type { ReviewState } from '../../src/spacedRepetition.ts';

provideStampArt({
  buurtStampCanvas: stampArt.buurtStampCanvas,
  drawBuurtStamp: stampArt.drawBuurtStamp,
  loadStampFont: stampArt.loadStampFont,
  STAMP_ART_SIZE: stampArt.STAMP_ART_SIZE,
});
void stampArt.loadStampFont();

const NOW = Date.UTC(2026, 10, 9, 10);
const DAY = 86_400_000;

/** Names riders actually meet, at their places, with a spread of mastery. */
const NAMES: Array<[string, string, [number, number], number, number]> = [
  ['Prinsengracht', 'canal', [52.3725, 4.8845], 3, 5],
  ['Keizersgracht', 'canal', [52.3705, 4.8860], 3, 3],
  ['Herengracht', 'canal', [52.3690, 4.8890], 3, -1],
  ['Westerstraat', 'street', [52.3770, 4.8815], 2, 2],
  ['Lindengracht', 'street', [52.3790, 4.8825], 3, 6],
  ['Bloemgracht', 'canal', [52.3735, 4.8805], 1, 1],
  ['Elandsgracht', 'street', [52.3680, 4.8800], 3, 4],
  ['Albert Cuypstraat', 'street', [52.3560, 4.8930], 3, 8],
  ['Ferdinand Bolstraat', 'street', [52.3545, 4.8925], 2, -2],
  ['Sarphatipark', 'street', [52.3540, 4.8970], 3, 6],
  ['Ceintuurbaan', 'street', [52.3530, 4.8950], 1, 1],
  ['Overtoom', 'street', [52.3615, 4.8723], 3, 9],
  ['Vondelstraat', 'street', [52.3620, 4.8760], 2, 3],
  ['Kinkerstraat', 'street', [52.3665, 4.8665], 1, -1],
  ['Zeedijk', 'street', [52.3745, 4.9005], 3, 7],
  ['Kloveniersburgwal', 'canal', [52.3705, 4.8985], 2, 2],
  ['Plantage Middenlaan', 'street', [52.3655, 4.9110], 1, 1],
  ['Wittenburgergracht', 'canal', [52.3720, 4.9200], 0, -1],
];

/** Names in the outer districts (#297): Noord, IJburg, Nieuw-West, Zuidoost. */
const OUTER_NAMES: typeof NAMES = [
  ['Buikslotermeerplein', 'street', [52.3935, 4.9390], 3, 4],
  ['Mosplein', 'street', [52.3870, 4.9150], 2, 2],
  ['IJburglaan', 'street', [52.3560, 5.0050], 3, 6],
  ['Pampuslaan', 'street', [52.3610, 4.9990], 1, 1],
  ['Burgemeester Röellstraat', 'street', [52.3790, 4.8000], 3, 5],
  ['Sloterplas', 'street', [52.3500, 4.8300], 2, 3],
  ['Bijlmerdreef', 'street', [52.3150, 4.9700], 3, 7],
];
const SEEDS = { centre: NAMES, outer: OUTER_NAMES, everything: [...NAMES, ...OUTER_NAMES] };

function reviewStates(seed: keyof typeof SEEDS = 'centre'): ReviewState[] {
  return SEEDS[seed].map(([name, type, center, repetitions, dueDays], index) => ({
    featureKey: `sb-${index}`, mode: 'guess_name', dueAt: NOW + dueDays * DAY, intervalDays: 4, ease: 2.3,
    repetitions, lapses: 0, lastReviewedAt: NOW - DAY, lastEventId: `e${index}`, schedulerVersion: 1,
    featureSnapshot: { name, type, cityId: 'amsterdam', center },
  }) as unknown as ReviewState);
}

const STAMPED_24 = [
  'Jordaan', 'Grachtengordel', 'Oude Pijp', 'Nieuwe Pijp', 'De Pijp', 'Vondelparkbuurt', 'Centrum', 'Nieuwmarktbuurt',
  'Plantage', 'Kattenburg', 'Wittenburg', 'Oostenburg', 'Marineterrein', 'Museumkwartier', 'Willemspark', 'Helmersbuurt',
  'Kinkerbuurt', 'De Baarsjes', 'Da Costabuurt', 'Spaarndammerbuurt', 'Staatsliedenbuurt', 'Weesperbuurt', 'Rivierenbuurt', 'Gouden Bocht',
];

function storage(stamps: number): Pick<Storage, 'getItem'> {
  const stamped = STAMPED_24.slice(0, stamps);
  const dates: Record<string, string> = {};
  stamped.forEach((name, index) => {
    if (index % 5 !== 4) dates[name] = new Date(NOW - index * 2.5 * DAY).toISOString().slice(0, 10);
  });
  const entries: Record<string, string> = {
    [PASSPORT_STORAGE_KEY]: JSON.stringify({ stamped: stamped.filter(name => name !== 'Marineterrein'), dates }),
    // Free Ride's collection (lane G4) stamps a buurt by opening its places.
    [FREE_RIDE_COLLECTION_KEY]: JSON.stringify({ opened: [], stamps: stamped.includes('Marineterrein') ? [{ hood: 'Marineterrein', at: '2026-11-08' }] : [] }),
  };
  return { getItem: key => entries[key] ?? null };
}

function AtlasStory({ stamps, names, seed = 'centre' }: { stamps: number; names: boolean; seed?: keyof typeof SEEDS }) {
  const review = useMemo(() => buildKnowledgeReview(names ? reviewStates(seed) : [], [], NOW), [names, seed]);
  const atlas = useKnowledgeAtlasFilter();
  const store = useMemo(() => storage(stamps), [stamps]);
  const shown = review.items.filter(item => atlas.includes(item.key));
  return (
    <div style={{ background: '#f4efe5', minHeight: '100vh', color: '#1f1c17', fontFamily: 'system-ui, sans-serif' }}>
      <KnowledgeAtlas items={review.items} selection={atlas.selection} onSelect={atlas.select} storage={store} />
      <p style={{ padding: '12px clamp(14px, 3vw, 44px)', margin: 0, font: '600 13px/1.4 system-ui', color: '#6d655a' }}>
        Queue below the map: {shown.length} of {review.items.length} names{atlas.selection ? ` in ${atlas.selection.name}` : ''}
      </p>
    </div>
  );
}

function ArrivalStampStory({ name }: { name: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => { void stampArt.loadStampFont().then(() => setTick(value => value + 1)); }, []);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const width = canvas.clientWidth;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = (ARRIVAL_STAMP_HEIGHT + 40) * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = 'rgba(250,246,238,0.97)';
    ctx.fillRect(0, 0, width, ARRIVAL_STAMP_HEIGHT + 40);
    drawArrivalStamp(ctx, { name, isNew: true, x: 18, y: 20, width: width - 36, fontMono: '"JetBrains Mono", monospace' });
  }, [name, tick]);
  return (
    <div style={{ background: '#3b4a52', minHeight: '100vh', padding: 24, boxSizing: 'border-box' }}>
      <canvas ref={ref} style={{ width: 'min(600px, 100%)', height: ARRIVAL_STAMP_HEIGHT + 40, display: 'block', margin: '0 auto', borderRadius: 10 }} />
    </div>
  );
}

const meta: Meta = {
  title: 'Canal Drive/Knowledge map and passport (G5)',
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj;
const phone = { viewport: { defaultViewport: 'mobile1' }, chromatic: { viewports: [390] } };
const phoneFrame = (story: () => JSX.Element) => <div style={{ width: 390, margin: '0 auto' }}>{story()}</div>;

export const KnowledgeMapDesktop: Story = { render: () => <AtlasStory stamps={3} names /> };
export const KnowledgeMapPhone: Story = { render: () => <AtlasStory stamps={3} names />, parameters: phone, decorators: [phoneFrame] };
// #297: the frame fits every buurt with a known name (centre only keeps the 3.2 km map).
export const KnowledgeMapCentreDesktop: Story = { render: () => <AtlasStory stamps={3} names seed="centre" /> };
export const KnowledgeMapCentrePhone: Story = { render: () => <AtlasStory stamps={3} names seed="centre" />, parameters: phone, decorators: [phoneFrame] };
export const KnowledgeMapOuterDesktop: Story = { render: () => <AtlasStory stamps={3} names seed="outer" /> };
export const KnowledgeMapOuterPhone: Story = { render: () => <AtlasStory stamps={3} names seed="outer" />, parameters: phone, decorators: [phoneFrame] };
export const KnowledgeMapEverythingDesktop: Story = { render: () => <AtlasStory stamps={3} names seed="everything" /> };
export const KnowledgeMapEverythingPhone: Story = { render: () => <AtlasStory stamps={3} names seed="everything" />, parameters: phone, decorators: [phoneFrame] };
export const StampAlbumZeroDesktop: Story = { render: () => <AtlasStory stamps={0} names={false} /> };
export const StampAlbumZeroPhone: Story = { render: () => <AtlasStory stamps={0} names={false} />, parameters: phone, decorators: [phoneFrame] };
export const StampAlbumThreeDesktop: Story = { render: () => <AtlasStory stamps={3} names /> };
export const StampAlbumThreePhone: Story = { render: () => <AtlasStory stamps={3} names />, parameters: phone, decorators: [phoneFrame] };
export const StampAlbumTwentyFourDesktop: Story = { render: () => <AtlasStory stamps={24} names /> };
export const StampAlbumTwentyFourPhone: Story = { render: () => <AtlasStory stamps={24} names />, parameters: phone, decorators: [phoneFrame] };
export const ArrivalStampDesktop: Story = { render: () => <ArrivalStampStory name="Grachtengordel" /> };
export const ArrivalStampPhone: Story = { render: () => <ArrivalStampStory name="Prinses Irenebuurt e.o." />, parameters: phone, decorators: [phoneFrame] };
