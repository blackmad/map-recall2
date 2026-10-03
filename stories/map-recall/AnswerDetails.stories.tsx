import { useEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import '../../src/index.css';
import { AnswerDetails } from '../../src/components/AnswerDetails';
import type { StreetFeature } from '../../src/types';
import canalUrl from '../canal-drive/fixtures/amsterdam-canal.jpg';
import housesUrl from '../canal-drive/fixtures/amsterdam-houses.jpg';

/**
 * The Map Recall answer card after a guess (user report 2026-10-02): folded to one line so the
 * revealed neighbourhood stays in view, with the postcard as its thumbnail; "More" opens the
 * full card. Long text, a missing postcard and a phone width are the states worth checking.
 */
const nieuwmarkt: StreetFeature = {
  id: 'story-nieuwmarktbuurt',
  name: 'Nieuwmarktbuurt',
  type: 'neighborhood',
  cityId: 'amsterdam',
  center: [52.3712, 4.9012],
  difficulty: 'medium',
  clues: [],
  distractors: [],
  areaPhotos: [canalUrl, housesUrl].map((imageUrl, index) => ({
    name: `Photo ${index + 1}`,
    photo: { imageUrl, imageAttribution: 'Story fixture', sourceUrl: 'https://commons.wikimedia.org/' },
  })),
  nameOrigin: {
    text: "The Nieuwmarktbuurt was long known as the Lastage, a name from 'lastaedse', ballast: in the 15th century it was where ships took on ballast. In the 16th century it grew into the city's industrial and harbour district.",
    sourceUrl: 'https://nl.wikipedia.org/wiki/Nieuwmarktbuurt',
    sourceLabel: 'Wikipedia (translated from Dutch)',
  },
  history: {
    text: "By a charter of Count Albrecht (1386), confirmed in 1404, the area, then called the Lastage, belonged to Amsterdam's 'city liberty'.",
    sourceUrl: 'https://nl.wikipedia.org/wiki/Nieuwmarktbuurt',
    sourceLabel: 'Wikipedia (translated from Dutch)',
  },
  notablePlaces: [
    { name: 'Waag', center: [52.3727, 4.9003], kind: 'landmark' },
    { name: 'Huis De Pinto', center: [52.3706, 4.9013], kind: 'landmark' },
  ],
} as StreetFeature;

const AnswerCard: React.FC<{ feature: StreetFeature; width: number; open?: boolean }> = ({ feature, width, open }) => {
  useEffect(() => {
    if (open) document.querySelector<HTMLButtonElement>('[data-testid="answer-details"]')?.click();
  }, [open]);
  // The app's day theme is scoped to #root (src/index.css).
  return <div id="root" style={{ minHeight: '100vh', background: '#e9e4d8', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 16 }}>
    <div style={{ width, maxWidth: '100%' }} className="quiz-result-card space-y-2.5 p-3 sm:p-4" data-result-card>
      <div className="flex items-center justify-between border-b border-white/15 pb-2 text-xs font-bold">Right neighborhood · +876 PTS</div>
      <div className="text-xs text-white/75">Target: <strong className="text-white">{feature.name}</strong></div>
      <AnswerDetails feature={feature} factSeed={0} roundIndex={0} />
    </div>
  </div>;
};

const meta = { title: 'Map Recall/Answer card', component: AnswerCard } satisfies Meta<typeof AnswerCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const FoldedDesktop: Story = { args: { feature: nieuwmarkt, width: 576 } };
export const OpenDesktop: Story = { args: { feature: nieuwmarkt, width: 576, open: true } };
export const FoldedPhone: Story = { args: { feature: nieuwmarkt, width: 358 } };
export const OpenPhone: Story = { args: { feature: nieuwmarkt, width: 358, open: true } };
export const FoldedNoPostcard: Story = {
  args: { feature: { ...nieuwmarkt, id: 'story-no-postcard', areaPhotos: [], wikipediaImageUrl: canalUrl, name: 'Gelderlandpleinbuurt-Noord en omgeving' }, width: 358 },
};
