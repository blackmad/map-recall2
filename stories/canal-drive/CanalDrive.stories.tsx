import { useCallback } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

type Scenario = 'default' | 'bike-home' | 'advanced';

function CanalDriveFrame({ scenario = 'default' }: { scenario?: Scenario }) {
  const configure = useCallback((frame: HTMLIFrameElement | null) => {
    if (!frame) return;
    const doc = frame.contentDocument;
    if (!doc) return;
    const select = (id: string, value: string) => {
      const element = doc.getElementById(id) as HTMLSelectElement | null;
      if (!element) return;
      element.value = value;
      element.dispatchEvent(new Event('change', { bubbles: true }));
    };
    if (scenario === 'bike-home') {
      select('travel-mode', 'car');
      select('view-mode', 'heading');
      select('route-pattern', 'home');
      const address = doc.getElementById('home-address') as HTMLInputElement | null;
      if (address) address.value = 'Da Costakade 13-3, Amsterdam';
    }
    if (scenario === 'advanced') {
      const details = doc.querySelector<HTMLDetailsElement>('.advanced-options');
      if (details) details.open = true;
    }
  }, [scenario]);

  return <iframe
    key={scenario}
    ref={configure}
    title={`Canal Recall — ${scenario}`}
    src={`/canal-drive/?storybook=${scenario}`}
    style={{ display: 'block', width: '100vw', height: '100vh', border: 0 }}
  />;
}

const meta = {
  title: 'Canal Recall/Route setup',
  component: CanalDriveFrame,
  parameters: { controls: { disable: true } },
} satisfies Meta<typeof CanalDriveFrame>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { scenario: 'default' } };
export const BikeFromHome: Story = { args: { scenario: 'bike-home' } };
export const AdvancedOptions: Story = { args: { scenario: 'advanced' } };
export const Mobile: Story = {
  args: { scenario: 'default' },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
