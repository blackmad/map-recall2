import { useCallback } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

// Free Ride's HUD (src/canalRecall/game/freeRideRuntime.ts): the plaque with
// the street named and the "places opened" line, the "Free ride · Exit" bar,
// markers over nearby places, and the card a tap opens. Drawn once over a
// stand-in map, through the game's own drawing methods, so the layout here is
// the layout in the ride.

type Scenario = 'idle' | 'card' | 'long' | 'no-image' | 'checklist' | 'stamped' | 'stamped-long' | 'token-far' | 'at-place' | 'no-checklist';

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
      const background = () => {
        ctx.fillStyle = '#dfe7dd'; ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = 'rgba(72,91,85,.25)'; ctx.lineWidth = 18;
        for (let x = -h; x < w + h; x += 190) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + h * 0.58, h); ctx.stroke(); }
      };
      background();

      // The world is the screen here: the markers' places are given in
      // canvas pixels, so the story places them where it wants them. The
      // far-token state scales the world up so its places are ~250 m away.
      const k = scenario === 'token-far' ? 2 : 1;
      game.camera.worldToScreen = (x: number, y: number) => ({ x: x / k, y: y / k });
      const at = (x: number, y: number) => ({ x: x * k, y: y * k });
      game.player = { ...at(w / 2, h * 0.62), angle: -Math.PI / 2, speed: 0, vx: 0, vy: 0 };
      game.freeRide = true;
      game.showMiniMap = false;
      game.quizFeedback = '';
      const long = scenario === 'long';
      const atPlace = scenario === 'at-place';
      const collecting = scenario === 'checklist' || scenario === 'stamped' || scenario === 'stamped-long' || scenario === 'token-far' || atPlace;
      // F1 (#311): the default Free Ride in a buurt that has a list: no checklist line, no coin.
      const noChecklist = scenario === 'no-checklist';
      game.currentNeighborhood = long ? 'Van Lennepbuurt en Kinkerbuurt-Noord' : collecting || noChecklist ? 'Marineterrein' : 'Jordaan';
      const landmark = {
        id: long ? 'rijksmuseum' : 'westerkerk', name: long ? LONG_NAME : 'Westerkerk', type: long ? 'museum' : 'church',
        ...at(w * 0.36, h * 0.42), extractLang: 'en',
        imageUrl: scenario === 'no-image' ? '' : PHOTO,
        wikipediaUrl: 'https://en.wikipedia.org/wiki/Westerkerk',
        detail: long ? LONG_DETAIL : WESTERKERK, longDetail: long ? LONG_DETAIL : WESTERKERK,
      };
      game.landmarks = [landmark];
      const nearby = atPlace ? [
        // At the museum (#284): the plaque names its buurt and its list, whichever side of the line the kerb is.
        { key: 'maritime', kind: 'landmark', name: 'National Maritime Museum', ...at(w * 0.42, h * 0.5) },
        { key: 'voc-ship', kind: 'landmark', name: 'VOC ship Amsterdam', ...at(w * 0.24, h * 0.36) },
      ] : [
        { key: landmark.id, kind: 'landmark', name: landmark.name, ...at(w * 0.36, h * 0.42) },
        { key: 'bridge:bloemgrachtbrug', kind: 'bridge', name: 'Bloemgrachtbrug', ...at(w * 0.62, h * 0.48) },
        { key: 'anne-frank', kind: 'landmark', name: 'Anne Frank House', ...at(w * 0.7, h * 0.3) },
        { key: 'homomonument', kind: 'landmark', name: 'Homomonument', ...at(w * 0.22, h * 0.27) },
      ];
      const player = game.player;
      game._freeRideNearby = nearby.map(place => ({ ...place, distance: Math.hypot(place.x - player.x, place.y - player.y) }));
      game._freeRideOpened = new Set(scenario === 'idle' || collecting ? [] : ['westerkerk', 'anne-frank', 'bloemgrachtbrug']);
      const open = scenario === 'card' || scenario === 'long' || scenario === 'no-image';
      game._freeRideCollection = null;
      if (collecting) {
        // Marineterrein's list: nine places, three opened (all nine once stamped).
        const places = atPlace
          // Marineterrein's real list after #284: one spelling per place, the ship by its full name.
          ? [['voc-ship', 'VOC ship Amsterdam'], ['maritime', 'National Maritime Museum'], ['mediamatic', 'Mediamatic Biotoop Dijkspark'],
            ['hannekes', 'Hannekes Boom'], ['klimmuur', 'Klimmuur Centraal']].map(([key, name], i) => ({ key, name, ...at(w * (0.24 + i * 0.12), h * (0.36 + (i % 2) * 0.14)) }))
          : Array.from({ length: 9 }, (_, i) => ({ key: `m${i}`, name: `Place ${i}`, ...at(w * (0.15 + i * 0.08), h * (0.2 + (i % 3) * 0.08)) }));
        if (!atPlace) places[0] = { key: 'anne-frank', name: 'Anne Frank House', ...at(w * 0.7, h * 0.3) };
        const opened = new Set((scenario === 'stamped' || scenario === 'stamped-long') ? places.map(p => p.key) : atPlace ? ['voc-ship'] : ['m1', 'm2', 'm3']);
        game._freeRideLists = {
          lists: new Map([['Marineterrein', { hood: 'Marineterrein', places }]]),
          listsFrom: { places: game._freeRideCatalog(), neighborhoods: game.neighborhoods }, hoodOfKey: new Map(places.map(p => [p.key, 'Marineterrein'])),
        };
        game._freeRideCollection = {
          state: { opened: [...opened], stamps: (scenario === 'stamped' || scenario === 'stamped-long') ? [{ hood: 'Marineterrein', at: '2026-11-09' }] : [] },
          opened,
          token: scenario === 'stamped' || scenario === 'stamped-long' || atPlace ? null : { ...places[0], distance: Math.hypot(places[0].x - player.x, places[0].y - player.y) },
          tokenScreen: null, tokenHidden: null, corridor: null,
          stampMoment: (scenario === 'stamped' || scenario === 'stamped-long') ? { hood: 'Marineterrein', until: performance.now() + 600_000 } : null,
        };
        game._neighborhoodNotice = scenario === 'token-far' || atPlace ? null : { name: scenario === 'stamped-long' ? 'Prinses Irenebuurt e.o.' : 'Marineterrein', kind: 'neighbourhood', stamped: scenario === 'stamped' || scenario === 'stamped-long' };
        game._neighborhoodNoticeTimer = 2.5;
      }
      game._landmarkNotice = null;
      game._landmarkCardBounds = null;

      const paint = () => {
        if (collecting) background();
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
        // The postcard comes up on entry on a wide screen; a phone has the plaque line only (landmarkRuntime),
        // except for the stamped postcard: the once-per-buurt reward shows on the phone too (#286).
        if (game._neighborhoodNotice && (!touch || game._neighborhoodNotice.stamped)) game._renderNeighborhoodNotice();
        game.hud.drawStick(ctx, null);
        game.state = 4;
        game._showFreeRideBar(true);
        game._placeFreeRideBar();
        const bar = doc.getElementById('free-ride-bar');
        if (bar) bar.hidden = false;
      };
      if (collecting) {
        // Markers fade in over a few frames (labels/labelFade.ts): paint until they have settled.
        const started = performance.now();
        const settle = () => { paint(); if (performance.now() - started < 700) win.requestAnimationFrame(settle); };
        settle();
      } else if (open && landmark.imageUrl) {
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

/** Collection: entering Marineterrein, the postcard and plaque say 3 of 9 places; the token sits on the nearest unopened landmark. */
export const ChecklistPostcard: Story = { args: { scenario: 'checklist' } };
/** Collection: the last place opened, the postcard comes back with the passport stamp; the plaque says so. */
export const CollectionStamped: Story = { args: { scenario: 'stamped' } };
/** Collection: the token ~250 m away, smaller (≤ 24 px) and fainter; the markers fade with distance too. */
export const TokenFar: Story = { args: { scenario: 'token-far' } };
/** #284: standing at the National Maritime Museum the plaque keeps Marineterrein's list (1 of 5 places); the ship is "VOC ship Amsterdam". */
export const ChecklistAtPlace: Story = { args: { scenario: 'at-place' } };
export const ChecklistAtPlacePhone: Story = { args: { scenario: 'at-place', touch: true }, parameters: phone };
/** F1 (#311, user 2026-11-09 "no gameplay element in free ride"): the default. In Marineterrein, a buurt with a list,
 *  the plaque says how many places were opened (or "Tap a marker or a building"); no checklist, no coin, no radar. */
export const PlaqueWithoutChecklist: Story = { args: { scenario: 'no-checklist' } };
export const PlaqueWithoutChecklistPhone: Story = { args: { scenario: 'no-checklist', touch: true }, parameters: phone };

export const ChecklistPostcardPhone: Story = { args: { scenario: 'checklist', touch: true }, parameters: phone };
export const CollectionStampedPhone: Story = { args: { scenario: 'stamped', touch: true }, parameters: phone };
/** #292: the longest buurt name in the pool on the narrow stamp postcard: the seal sits in the corner, the name below it. */
export const CollectionStampedLongNamePhone: Story = { args: { scenario: 'stamped-long', touch: true }, parameters: phone };
export const TokenFarPhone: Story = { args: { scenario: 'token-far', touch: true }, parameters: phone };

export const IdlePhone: Story = { args: { scenario: 'idle', touch: true }, parameters: phone };
export const CardOpenPhone: Story = { args: { scenario: 'card', touch: true }, parameters: phone };
export const LongNamesPhone: Story = { args: { scenario: 'long', touch: true }, parameters: phone };
export const MissingImagePhone: Story = { args: { scenario: 'no-image', touch: true }, parameters: phone };
