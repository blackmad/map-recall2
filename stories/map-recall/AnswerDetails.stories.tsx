import { useEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import '../../src/index.css';
import { AnswerDetails } from '../../src/components/AnswerDetails';
import type { StreetFeature } from '../../src/types';
import canalUrl from '../canal-drive/fixtures/amsterdam-canal.jpg';
import housesUrl from '../canal-drive/fixtures/amsterdam-houses.jpg';

/**
 * The Map Recall answer card after a guess (user report 2026-10-02, review 2026-10-13): folded to
 * two lines so the revealed answer stays in view, a neighbourhood's postcard at card width on
 * desktop and a one-line strip on phones; "More" opens the full card. Long text, a missing
 * postcard, a canal with four facts, a street whose origin needs its subject and a borrowed
 * history are the states worth checking, each on desktop and phone.
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

const fact = (kind: 'people' | 'history' | 'design' | 'surprise', text: string) => ({
  kind, text, section: '', sourceQuote: text, sourceUrl: 'https://en.wikipedia.org/wiki/Prinsengracht', license: 'CC BY-SA 4.0',
  retrievedAt: '2026-08-31', model: 'story', verification: 'grounded' as const,
});

/** Review 2026-10-13: a canal's register origin folded to its first sentence, and all four reviewed facts open. */
const prinsengracht: StreetFeature = {
  id: 'story-prinsengracht',
  name: 'Prinsengracht',
  type: 'canal',
  cityId: 'amsterdam',
  center: [52.37517, 4.883529],
  difficulty: 'hard',
  clues: [],
  distractors: [],
  wikipediaImageUrl: canalUrl,
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Prinsengracht',
  wikipediaExtract: 'The Prinsengracht is a 3.2-kilometer (2.0 mi)-long canal that runs parallel to the Keizersgracht in the center of Amsterdam. The canal, named after the Prince of Orange, is the fourth of the four main canals belonging to the canal belt. Its houses include the Anne Frank House and the Westerkerk stands beside it.',
  nameOrigin: {
    text: "After 'the princely title', meaning that of the Princes of Orange. The canal is one of the three main canals, and the plainest in the character of its buildings. It was dug in the expansion of 1612 and built up from the Brouwersgracht to the Leidsegracht.",
    sourceUrl: 'https://api.data.amsterdam.nl/v1/bag/openbareruimtes/',
    sourceLabel: 'Gemeente Amsterdam street-name register',
  },
  localFacts: [
    fact('people', 'Mayor Frans Hendricksz Oetgens initiated construction in 1612.'),
    fact('history', 'The eastern section was built later and named Nieuwe Prinsengracht.'),
    fact('people', 'St. Van Brienens founded the Star at Prinsengracht 89–133.'),
    fact('design', 'Prinsengracht 849 holds the best-preserved copy of five identical neck gables from 1701.'),
  ],
} as StreetFeature;

/** Register prose without a subject: the card names Jan Veth first. */
const janVethstraat: StreetFeature = {
  id: 'story-jan-vethstraat',
  name: 'Jan Vethstraat',
  type: 'street',
  cityId: 'amsterdam',
  center: [52.36, 4.80],
  difficulty: 'hard',
  clues: [],
  distractors: [],
  wikipediaExtract: 'Street in Amsterdam, the Netherlands.',
  nameOrigin: {
    text: 'Painter and draughtsman (1864-1925), and also an art historian, who campaigned to preserve the beauty of Amsterdam.',
    sourceUrl: 'https://api.data.amsterdam.nl/v1/bag/openbareruimtes/',
    sourceLabel: 'Gemeente Amsterdam street-name register',
  },
} as StreetFeature;

/** A canal's history shown for the area it runs through, headed as the canal's. */
const hoofddorpplein: StreetFeature = {
  ...nieuwmarkt,
  id: 'story-hoofddorppleinbuurt',
  name: 'Hoofddorppleinbuurt',
  center: [52.351, 4.848],
  nameOrigin: { text: 'Its streets are named after 19th-century painters and places south-west of Amsterdam.', sourceUrl: 'https://nl.wikipedia.org/wiki/Hoofddorppleinbuurt', sourceLabel: 'Wikipedia (translated from Dutch)' },
  wikipediaExtract: 'A concert hall for organ music in a former church on the Sloterkade.',
  wikipediaExtractSource: { sourceUrl: 'https://nl.wikipedia.org/wiki/Orgelpark', sourceLabel: 'Wikipedia (translated from Dutch)', borrowedFrom: 'Orgelpark (landmark)' },
  history: {
    text: 'A dam blocked the river in 1434 to stop shipping, forcing vessels to take a long detour via Spaarndam.',
    sourceUrl: 'https://nl.wikipedia.org/wiki/Schinkel_(rivier)',
    sourceLabel: 'Wikipedia (translated from Dutch)',
    borrowedFrom: 'Schinkel (waterway)',
  },
  notablePlaces: [
    { name: 'Retort', center: [52.3478, 4.8479], kind: 'culture' },
    { name: 'Legmeerplein', center: [52.3531, 4.8516], kind: 'leisure' },
    { name: 'Bockesprong', center: [52.355, 4.8459], kind: 'education' },
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
export const CanalFourFactsFoldedDesktop: Story = { args: { feature: prinsengracht, width: 576 } };
export const CanalFourFactsOpenDesktop: Story = { args: { feature: prinsengracht, width: 576, open: true } };
export const CanalFourFactsFoldedPhone: Story = { args: { feature: prinsengracht, width: 358 } };
export const CanalFourFactsOpenPhone: Story = { args: { feature: prinsengracht, width: 358, open: true } };
export const StreetNamedAfterFoldedDesktop: Story = { args: { feature: janVethstraat, width: 576 } };
export const StreetNamedAfterOpenPhone: Story = { args: { feature: janVethstraat, width: 358, open: true } };
export const NeighbourhoodStripPhone: Story = { args: { feature: hoofddorpplein, width: 358 } };
export const NeighbourhoodPostcardDesktop: Story = { args: { feature: hoofddorpplein, width: 576 } };
export const BorrowedHistoryOpenDesktop: Story = { args: { feature: hoofddorpplein, width: 576, open: true } };
export const BorrowedHistoryOpenPhone: Story = { args: { feature: hoofddorpplein, width: 358, open: true } };
