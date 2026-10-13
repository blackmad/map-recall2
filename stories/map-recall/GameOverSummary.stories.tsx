import type { Meta, StoryObj } from '@storybook/react-vite';
import '../../src/index.css';
import { GameOverSummary } from '../../src/components/GameOverSummary';
import { CITIES } from '../../src/data/cities';
import type { City } from '../../src/types';
import { STORY_NOW, storySession } from './progressFixtures';

/**
 * The end of a Map Recall session (review P0, 2026-10-13): "Session complete", the session's
 * best new postcard as the hero, and Known / Still shaky / New with each place's next review.
 * The frame's transform makes the dialog's `position: fixed` resolve to the frame, so the
 * phone size is exact whatever the Storybook viewport.
 */
const amsterdam = { ...(CITIES.find((city) => city.id === 'amsterdam') ?? CITIES[0]), id: 'amsterdam', name: 'Amsterdam' } as City;

const EndScreen: React.FC<{ withPostcard: boolean; width: number; height: number }> = ({ withPostcard, width, height }) => {
  const session = storySession(withPostcard);
  return <div id="root" style={{ width, height, position: 'relative', transform: 'translateZ(0)', overflow: 'hidden', background: '#e9e4d8' }}>
    <GameOverSummary
      currentCity={amsterdam}
      gameMode="pinpoint"
      selectedCategory="neighborhoods"
      roundResults={session.results}
      totalScore={session.total}
      maxPossibleScore={25_000}
      unit="metric"
      onPlayAgain={() => undefined}
      onSwitchMode={() => undefined}
      onChangeCity={() => undefined}
      allCities={CITIES}
      reviewStatesBefore={session.before}
      reviewStatesAfter={session.after}
      now={STORY_NOW}
    />
  </div>;
};

const meta = { title: 'Map Recall/End screen', component: EndScreen } satisfies Meta<typeof EndScreen>;
export default meta;
type Story = StoryObj<typeof meta>;
/** Media queries follow the window, so phone stories also set the Storybook viewport. */
const phone = { viewport: { value: 'mobile2', isRotated: false } };

export const PostcardDesktop: Story = { args: { withPostcard: true, width: 1352, height: 761 } };
export const NoPostcardDesktop: Story = { args: { withPostcard: false, width: 1352, height: 761 } };
export const PostcardPhone: Story = { args: { withPostcard: true, width: 390, height: 844 }, globals: phone };
export const NoPostcardPhone: Story = { args: { withPostcard: false, width: 390, height: 844 }, globals: phone };
