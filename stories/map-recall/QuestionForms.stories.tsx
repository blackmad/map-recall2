import type { Meta, StoryObj } from '@storybook/react-vite';
import '../../src/index.css';
import { RelationQuestionOverlay } from '../../src/components/RelationQuestionOverlay';
import { PinpointModeOverlay } from '../../src/components/PinpointModeOverlay';
import { buildRelationQuestion } from '../../src/mapRecall/relationQuestions';
import type { StreetFeature } from '../../src/types';

/**
 * Question forms (wave-2 review, 2026-10-13): the two-choice relation question for obscure
 * places, the seen-before chip and "Next · nearby". Desktop and phone.
 */
const street = (name: string, center: [number, number], over: Partial<StreetFeature> = {}): StreetFeature => ({
  id: `story-${name}`, name, type: 'street', cityId: 'amsterdam', center, difficulty: 'medium', clues: [], distractors: [], funFact: '',
  path: [[center[0], center[1] - 0.001], [center[0], center[1] + 0.001]], prominenceScore: 4, ...over,
} as StreetFeature);

const janVeth = street('Jan Vethstraat', [52.3565, 4.8785], {
  distractors: ['Chris Lebeaustraat'], neighborhood: 'Overtoomse Veld',
  nameOrigin: { text: 'Jan Veth: Painter and draughtsman (1864-1925), known for his portraits.', sourceUrl: 'https://www.amsterdam.nl/', sourceLabel: 'Gemeente Amsterdam street-name register' },
});
const lebeau = street('Chris Lebeaustraat', [52.3570, 4.8690], { neighborhood: 'Overtoomse Veld' });
const longNames = street('Willem van Konijnenburgstraat', [52.3640, 4.8360], { distractors: ['Hendrik Werkmanstraat-Noordzijde'], neighborhood: 'Slotermeer-Zuidoost' });
const longOther = street('Hendrik Werkmanstraat-Noordzijde', [52.3612, 4.8350], { neighborhood: 'Geuzenveld' });

const Frame: React.FC<{ width: number; children: React.ReactNode }> = ({ width, children }) => (
  <div id="root" style={{ width, maxWidth: '100%', height: 760, position: 'relative', background: '#d9d6cc', overflow: 'hidden' }}>{children}</div>
);

const Relation: React.FC<{ width: number; complete: boolean; pick: 0 | 1; long?: boolean; seen?: string }> = ({ width, complete, pick, long, seen }) => {
  const target = long ? longNames : janVeth;
  const question = buildRelationQuestion(target, [target, lebeau, longOther], long ? 2 : 0)!;
  return <Frame width={width}>
    <RelationQuestionOverlay
      question={question}
      selectedName={complete ? question.choices[pick] : null}
      wasSkipped={false}
      isRoundComplete={complete}
      onSelect={() => undefined}
      onNoIdea={() => undefined}
      onNextRound={() => undefined}
      isLastRound={false}
      roundNumber={3}
      totalRounds={10}
      factSeed={1}
      unit="metric"
      seenBefore={seen}
      nextNearby={complete}
    />
  </Frame>;
};

const SeenQuestion: React.FC<{ width: number; seen: string }> = ({ width, seen }) => <Frame width={width}>
  <PinpointModeOverlay
    currentFeature={street('Prinsengracht', [52.375, 4.8835], { type: 'canal', prominenceScore: 400 })}
    userPinnedLocation={null}
    onConfirmGuess={() => undefined}
    onNoIdea={() => undefined}
    wasSkipped={false}
    isRoundComplete={false}
    onNextRound={() => undefined}
    isLastRound={false}
    unit="metric"
    roundNumber={2}
    totalRounds={5}
    factSeed={1}
    searchCenter={[52.37, 4.89]}
    seenBefore={seen}
  />
</Frame>;

const meta = { title: 'Map Recall/Question forms' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
const phone = { viewport: { value: 'mobile2', isRotated: false } };

export const RelationQuestionDesktop: Story = { render: () => <Relation width={1200} complete={false} pick={0} seen="Seen 3 days ago · missed before" /> };
export const RelationQuestionPhone: Story = { render: () => <Relation width={390} complete={false} pick={0} />, globals: phone };
export const RelationLongNamesPhone: Story = { render: () => <Relation width={390} complete={false} pick={0} long />, globals: phone };
export const RelationRevealDesktop: Story = { render: () => <Relation width={1200} complete pick={0} /> };
export const RelationRevealWrongPhone: Story = { render: () => <Relation width={390} complete pick={1} />, globals: phone };
export const SeenMissedDesktop: Story = { render: () => <SeenQuestion width={1200} seen="Seen 3 days ago · missed before" /> };
export const SeenKnownPhone: Story = { render: () => <SeenQuestion width={390} seen="Seen 2 weeks ago · known · 4 reviews" />, globals: phone };
