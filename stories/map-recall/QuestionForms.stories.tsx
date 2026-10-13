import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import '../../src/index.css';
import { RelationQuestionOverlay } from '../../src/components/RelationQuestionOverlay';
import { PinpointModeOverlay } from '../../src/components/PinpointModeOverlay';
import { BonusPinPanel, type BonusPinState } from '../../src/components/BonusPinPanel';
import { DailyFiveTile } from '../../src/components/DailyFiveTile';
import { buildRelationQuestion } from '../../src/mapRecall/relationQuestions';
import type { StreetFeature } from '../../src/types';

/**
 * Question forms (wave-2 review, 2026-10-13): the two-choice relation question for obscure
 * places, the bonus pin line on the answer card (offer, waiting for the tap, result), the
 * seen-before chip, "Next · nearby" and the start rail's Daily five tile. Desktop and phone.
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
  const [bonus, setBonus] = useState<BonusPinState | null>({ roundNumber: 3, name: 'Rembrandt Theatre', label: 'the Rembrandt Theatre', center: [52.36, 4.87], phase: 'offer' });
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
      bonusSlot={<BonusPinPanel bonus={bonus} unit="metric" onStart={() => setBonus((b) => b && { ...b, phase: 'active' })} onSkip={() => setBonus((b) => b && { ...b, phase: 'skipped' })} />}
    />
  </Frame>;
};

const Bonus: React.FC<{ width: number; phase: BonusPinState['phase'] }> = ({ width, phase }) => {
  const bonus: BonusPinState = { roundNumber: 1, name: 'Concertgebouw', label: 'the Concertgebouw', center: [52.3563, 4.879], phase, guess: [52.358, 4.88], distanceMeters: 212, points: 391 };
  return <Frame width={width}>
    <PinpointModeOverlay
      currentFeature={street('Van Baerlestraat', [52.357, 4.879], { prominenceScore: 120 })}
      userPinnedLocation={[52.3575, 4.8795]}
      onConfirmGuess={() => undefined}
      onNoIdea={() => undefined}
      wasSkipped={false}
      isRoundComplete
      distanceErrorMeters={60}
      onNextRound={() => undefined}
      isLastRound={false}
      unit="metric"
      roundNumber={1}
      totalRounds={5}
      factSeed={1}
      searchCenter={[52.37, 4.89]}
      nextNearby
      bonusSlot={<BonusPinPanel bonus={bonus} unit="metric" onStart={() => undefined} onSkip={() => undefined} />}
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

const Daily: React.FC<{ width: number; streak: number; done: boolean; nearHome: boolean }> = ({ width, ...props }) => (
  <div id="root" style={{ width, maxWidth: '100%', background: '#f7f3eb', padding: 16 }}>
    <DailyFiveTile today="2026-10-13" onStart={() => undefined} {...props} />
  </div>
);

const meta = { title: 'Map Recall/Question forms' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
const phone = { viewport: { value: 'mobile2', isRotated: false } };

export const RelationQuestionDesktop: Story = { render: () => <Relation width={1200} complete={false} pick={0} seen="Seen 3 days ago · missed before" /> };
export const RelationQuestionPhone: Story = { render: () => <Relation width={390} complete={false} pick={0} />, globals: phone };
export const RelationLongNamesPhone: Story = { render: () => <Relation width={390} complete={false} pick={0} long />, globals: phone };
export const RelationRevealDesktop: Story = { render: () => <Relation width={1200} complete pick={0} /> };
export const RelationRevealWrongPhone: Story = { render: () => <Relation width={390} complete pick={1} />, globals: phone };
export const BonusOfferDesktop: Story = { render: () => <Bonus width={1200} phase="offer" /> };
export const BonusActivePhone: Story = { render: () => <Bonus width={390} phase="active" />, globals: phone };
export const BonusResultDesktop: Story = { render: () => <Bonus width={1200} phase="done" /> };
export const BonusResultPhone: Story = { render: () => <Bonus width={390} phase="done" />, globals: phone };
export const SeenMissedDesktop: Story = { render: () => <SeenQuestion width={1200} seen="Seen 3 days ago · missed before" /> };
export const SeenKnownPhone: Story = { render: () => <SeenQuestion width={390} seen="Seen 2 weeks ago · known · 4 reviews" />, globals: phone };
export const DailyStreakDesktop: Story = { render: () => <Daily width={380} streak={4} done={false} nearHome /> };
export const DailyFirstPhone: Story = { render: () => <Daily width={390} streak={0} done={false} nearHome={false} />, globals: phone };
export const DailyDonePhone: Story = { render: () => <Daily width={390} streak={4} done nearHome />, globals: phone };
