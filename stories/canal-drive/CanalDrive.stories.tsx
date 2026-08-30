import { useCallback } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

type Scenario = 'default' | 'bike-home' | 'advanced' | 'hud' | 'neighborhood';

function CanalDriveFrame({ scenario = 'default' }: { scenario?: Scenario }) {
  const configure = useCallback((frame: HTMLIFrameElement) => {
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
    if (scenario === 'hud' || scenario === 'neighborhood') {
      const setup = doc.getElementById('route-setup');
      if (setup) setup.style.display = 'none';
      const drawWhenReady = () => {
        const game = (frame.contentWindow as typeof frame.contentWindow & { canalRecallGame?: any })?.canalRecallGame;
        if (!game?.ctx || !game?.hud) { window.setTimeout(drawWhenReady, 50); return; }
        game._render = () => undefined;
        const ctx = game.ctx as CanvasRenderingContext2D;
        ctx.fillStyle = '#dfe7dd'; ctx.fillRect(0, 0, 1280, 720);
        ctx.strokeStyle = 'rgba(72,91,85,.25)'; ctx.lineWidth = 18;
        for (let x = -200; x < 1400; x += 190) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 420, 720); ctx.stroke(); }
        if (scenario === 'hud') {
          game.hud.drawCanalScore(ctx, 7, 9, 640, 'Correct — Singel', 4, true);
          game.hud.drawCurrentLocation(ctx, 'Prinsengracht', 'Jordaan', 'car', false);
          game.hud.drawDestination(ctx, 'Westerkerk', 1860);
          game.hud.drawTripReadout(ctx, 42, 6240);
          return;
        }
        const image = new Image();
        image.src = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#9fc1c7"/><rect y="210" width="600" height="190" fill="#6d8a70"/><path d="M30 250V110h120v140M190 250V70h150v180M380 250V125h180v125" fill="#b95c45"/><path d="M0 290h600v80H0z" fill="#759bb5"/></svg>')}`;
        image.onload = () => {
          game._neighborhoodImages = new Map([['Jordaan', image]]);
          game._neighborhoodNotice = { name: 'Jordaan', kind: 'neighborhood' };
          game._neighborhoodNoticeTimer = 4;
          game._renderNeighborhoodNotice();
        };
      };
      drawWhenReady();
    }
  }, [scenario]);

  return <iframe
    key={scenario}
    onLoad={(event) => configure(event.currentTarget)}
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
export const LiveHud: Story = { args: { scenario: 'hud' } };
export const NeighborhoodPhotoCard: Story = { args: { scenario: 'neighborhood' } };
