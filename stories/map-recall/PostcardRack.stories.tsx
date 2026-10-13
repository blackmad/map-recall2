import type { Meta, StoryObj } from '@storybook/react-vite';
import '../../src/index.css';
import { PostcardRack } from '../../src/components/PostcardRack';
import { ProgressLine } from '../../src/components/ProgressLine';
import { STORY_NEIGHBOURHOODS, STORY_NOW, earnedStates } from './progressFixtures';

/**
 * The start rail's progress (review P0, 2026-10-13): "Due today · Known" for the current mode,
 * and the rack of earned "Greetings from" postcards with greyed blanks for what is left.
 * Phones get a scroll-snap strip in the rail; desktop a wrapping panel over the side plane.
 */
const Rack: React.FC<{ earned: number; placement: 'rail' | 'vista'; width: number }> = ({ earned, placement, width }) => {
  const states = earnedStates(earned);
  const rack = <PostcardRack alwaysShow placement={placement} cityId="amsterdam" cityCenter={[52.3676, 4.9041]} states={states} features={STORY_NEIGHBOURHOODS} />;
  return <div id="root" style={{ minHeight: '100vh', background: '#e9e4d8', padding: 16 }}>
    {placement === 'rail'
      ? <div style={{ width, maxWidth: '100%', background: '#f7f3eb' }} className="space-y-4 px-4 py-4">
        <ProgressLine states={states} mode="pinpoint" cityId="amsterdam" now={STORY_NOW} />
        {rack}
      </div>
      : <div style={{ width, height: 700, maxWidth: '100%', position: 'relative', background: '#6d7f86' }}>{rack}</div>}
  </div>;
};

const meta = { title: 'Map Recall/Postcard rack', component: Rack } satisfies Meta<typeof Rack>;
export default meta;
type Story = StoryObj<typeof meta>;
const phone = { viewport: { value: 'mobile2', isRotated: false } };

export const NoneEarnedDesktop: Story = { args: { earned: 0, placement: 'vista', width: 968 } };
export const TwelveEarnedDesktop: Story = { args: { earned: 12, placement: 'vista', width: 968 } };
export const NoneEarnedPhone: Story = { args: { earned: 0, placement: 'rail', width: 390 }, globals: phone };
export const TwelveEarnedPhone: Story = { args: { earned: 12, placement: 'rail', width: 390 }, globals: phone };
