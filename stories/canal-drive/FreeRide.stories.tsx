import { useCallback } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

// Free Ride's HUD (src/canalRecall/game/freeRideRuntime.ts): the plaque with
// the street named and the "places opened" line, the "Free ride · Exit" bar,
// markers over nearby places, and the card a tap opens. Drawn once over a
// stand-in map, through the game's own drawing methods, so the layout here is
// the layout in the ride.

type Scenario = 'idle' | 'card' | 'long' | 'no-image';

interface FreeRideStoryArgs {
  scenario: Scenario;
  /** Force the phone layout (d-pad, merged plaque), as the main HUD stories do. */
  touch?: boolean;
}

const PHOTO = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#8aa4b8"/><rect y="200" width="400" height="100" fill="#5f7a8c"/><rect x="160" y="40" width="80" height="160" fill="#c9b29a"/><rect x="185" y="10" width="30" height="40" fill="#3f2f28"/></svg>')}`;

const WESTERKERK = 'The Westerkerk is a Protestant church in central Amsterdam, built between 1620 and 1631 after a design by Hendrick de Keyser. Its 85-metre tower is the tallest church tower in the city, and Rembrandt was buried here in 1669.';
const LONG_NAME = 'Rijksmuseum en Museumplein (hoofdingang aan de Museumstraat)';
const LONG_DETAIL = 'The Rijksmuseum is the national museum of the Netherlands, on the Museumplein. Pierre Cuypers designed the building, which opened in 1885; its passage under the middle is a public cycle path, the only one through a national museum.';

function FreeRideFrame({ scenario, touch = false }: FreeRideStoryArgs) {
  const configure = useCallback((frame: HTMLIFrameElement) => {
    const doc = frame.contentDocument;
    const win = frame.contentWindow as (Window & { canalRecallForceTouch?: boolean; canalRecallGame?: any; CanalRecallOverlay?: any }) | null;
    if (!doc || !win) return;
    if (touch) win.canalRecallForceTouch = true;
    const draw = () => {
      const game = win.canalRecallGame;
      if (!game?.ctx || !game?.hud || !game._renderFreeRideMarkers) { window.setTimeout(draw, 50); return; }
      win.CanalRecallOverlay?.getOverlay?.()?.store.setSetupOpen(false);
      game._render = () => undefined;
      game._update = () => undefined;
      game._resize();
      const ctx = game.ctx as CanvasRenderingContext2D;
      const w = game.viewport?.width ?? 1280;
      const h = game.viewport?.height ?? 720;
      ctx.fillStyle = '#dfe7dd'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(72,91,85,.25)'; ctx.lineWidth = 18;
      for (let x = -h; x < w + h; x += 190) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + h * 0.58, h); ctx.stroke(); }

      // The world is the screen here: the markers' places are given in
      // canvas pixels, so the story places them where it wants them.
      game.camera.worldToScreen = (x: number, y: number) => ({ x, y });
      game.player = { x: w / 2, y: h * 0.62, angle: -Math.PI / 2, speed: 0, vx: 0, vy: 0 };
      game.freeRide = true;
      game.showMiniMap = false;
      game.quizFeedback = '';
      const long = scenario === 'long';
      game.currentNeighborhood = long ? 'Van Lennepbuurt en Kinkerbuurt-Noord' : 'Jordaan';
      const landmark = {
        id: long ? 'rijksmuseum' : 'westerkerk', name: long ? LONG_NAME : 'Westerkerk', type: long ? 'museum' : 'church',
        x: w * 0.36, y: h * 0.42, extractLang: 'en',
        imageUrl: scenario === 'no-image' ? '' : PHOTO,
        wikipediaUrl: 'https://en.wikipedia.org/wiki/Westerkerk',
        detail: long ? LONG_DETAIL : WESTERKERK, longDetail: long ? LONG_DETAIL : WESTERKERK,
      };
      game.landmarks = [landmark];
      game._freeRideNearby = [
        { key: landmark.id, kind: 'landmark', name: landmark.name, x: landmark.x, y: landmark.y, distance: 120 },
        { key: 'bridge:bloemgrachtbrug', kind: 'bridge', name: 'Bloemgrachtbrug', x: w * 0.62, y: h * 0.48, distance: 140 },
        { key: 'anne-frank', kind: 'landmark', name: 'Anne Frank House', x: w * 0.7, y: h * 0.3, distance: 200 },
        { key: 'homomonument', kind: 'landmark', name: 'Homomonument', x: w * 0.22, y: h * 0.27, distance: 240 },
      ];
      game._freeRideOpened = new Set(scenario === 'idle' ? [] : ['westerkerk', 'anne-frank', 'bloemgrachtbrug']);
      const open = scenario !== 'idle';
      game._landmarkNotice = null;
      game._landmarkCardBounds = null;

      const paint = () => {
        game._syncHudLayout();
        game.hud.drawPlaque(ctx, {
          routeName: long ? 'Burgemeester de Vlugtlaan-Oost' : 'Prinsengracht',
          neighborhood: game.currentNeighborhood,
          trip: game.hud.tripText(42, 6240),
          tally: game._freeRideTally(),
        });
        game.hud.drawCompass(ctx, game.camera);
        if (open) {
          game._landmarkNotice = { ...landmark };
          game._landmarkNoticeSource = 'click';
          game._landmarkNoticeAlpha = 1;
          // Measure the card first so the markers keep off it, as a frame does.
          game._renderLandmarkNotice();
        }
        game._renderFreeRideMarkers();
        if (open) game._renderLandmarkNotice();
        game.hud.drawStick(ctx, null);
        game.state = 4;
        game._showFreeRideBar(true);
        game._placeFreeRideBar();
        const bar = doc.getElementById('free-ride-bar');
        if (bar) bar.hidden = false;
      };
      if (open && landmark.imageUrl) {
        const img = new Image();
        img.onload = () => { game._landmarkImages.set(landmark.id, img); paint(); };
        img.src = landmark.imageUrl;
      } else {
        paint();
      }
    };
    draw();
    if (touch) win.addEventListener('resize', () => draw());
  }, [scenario, touch]);

  return <iframe
    key={`${scenario}-${touch}`}
    onLoad={(event) => configure(event.currentTarget)}
    title={`Free ride — ${scenario}`}
    src={`/canal-drive/index.html?storybook=free-ride-${scenario}`}
    style={{ display: 'block', width: '100vw', height: '100vh', border: 0 }}
  />;
}

const meta = {
  title: 'Canal Recall/Free ride',
  component: FreeRideFrame,
  parameters: { controls: { disable: true } },
} satisfies Meta<typeof FreeRideFrame>;

export default meta;
type Story = StoryObj<typeof meta>;

const phone = { viewport: { defaultViewport: 'mobile2' } };

/** Riding, nothing opened yet: markers over the places nearby, the street named, Exit top right. */
export const Idle: Story = { args: { scenario: 'idle' } };
/** A tapped landmark: its marker inverted, the card at the bottom with its photo. */
export const CardOpen: Story = { args: { scenario: 'card' } };
/** A long street, neighbourhood and landmark name: the marker is cut on a word, the plaque and card ellipsise. */
export const LongNames: Story = { args: { scenario: 'long' } };
/** A landmark with no photo: the card falls back to text alone. */
export const MissingImage: Story = { args: { scenario: 'no-image' } };

export const IdlePhone: Story = { args: { scenario: 'idle', touch: true }, parameters: phone };
export const CardOpenPhone: Story = { args: { scenario: 'card', touch: true }, parameters: phone };
export const LongNamesPhone: Story = { args: { scenario: 'long', touch: true }, parameters: phone };
export const MissingImagePhone: Story = { args: { scenario: 'no-image', touch: true }, parameters: phone };
