import { useCallback } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

type Scenario = 'default' | 'bike-home' | 'advanced' | 'hud' | 'neighborhood' | 'neighborhood-fallback'
  | 'stacked-notices' | 'finish' | 'finish-calm' | 'finish-bike'
  | 'landmark-card' | 'landmark-card-bare' | 'landmark-panel' | 'landmark-panel-dutch'
  // Phone states. `touch-*` force the compact layout on a pointer device,
  // which is the only way to see the d-pad and the portrait card stack in the
  // workbench; the viewport addon alone just makes a small desktop window.
  | 'touch-hud' | 'touch-hud-steering' | 'touch-hud-question' | 'touch-setup'
  // Overlay states on a phone: the question, the arrival card, the panels and
  // the expanded article. These are DOM over canvas, so the HUD layout suite
  // cannot reach them and Storybook is where they get reviewed.
  | 'touch-prompt' | 'touch-settings' | 'finish-touch' | 'landmark-panel-touch'
  | 'stacked-notices-touch' | 'neighborhood-fallback-touch';

function CanalDriveFrame({ scenario = 'default' }: { scenario?: Scenario }) {
  const configure = useCallback((frame: HTMLIFrameElement) => {
    const doc = frame.contentDocument;
    if (!doc) return;
    const win = frame.contentWindow as (Window & {
      canalRecallForceTouch?: boolean;
      canalRecallGame?: any;
    }) | null;
    // Must be set before the game's first _resize, and re-applied because the
    // Storybook viewport addon resizes the iframe after load.
    if (win && scenario.includes('touch')) win.canalRecallForceTouch = true;
    const setupStories = new Set(['default', 'bike-home', 'advanced', 'touch-setup']);
    if (setupStories.has(scenario)) doc.body.classList.add('storybook-setup');
    else doc.body.classList.remove('storybook-setup');
    const overlay = (win as any)?.CanalRecallOverlay?.getOverlay?.();
    const patchPrefs = (patch: Record<string, unknown>) => {
      if (!overlay) return;
      overlay.store.patchPrefs(patch, overlay.callbacks.zoom);
    };
    if (scenario === 'bike-home') {
      patchPrefs({
        travelMode: 'car', viewMode: 'heading', routePattern: 'home',
        homeAddress: 'Da Costakade 13-3, Amsterdam',
      });
    }
    if (scenario === 'advanced' && overlay) overlay.store.setAdvancedOpen(true);
    if (scenario === 'hud' || scenario === 'neighborhood' || scenario === 'neighborhood-fallback'
      || scenario === 'stacked-notices' || scenario === 'stacked-notices-touch'
      || scenario === 'neighborhood-fallback-touch'
      || scenario.startsWith('finish')
      || scenario.startsWith('landmark') || scenario.startsWith('touch-hud')
      || scenario === 'touch-prompt' || scenario === 'touch-settings') {
      overlay?.store.setSetupOpen(false);
      const drawWhenReady = () => {
        const game = (frame.contentWindow as typeof frame.contentWindow & { canalRecallGame?: any })?.canalRecallGame;
        if (!game?.ctx || !game?.hud) { window.setTimeout(drawWhenReady, 50); return; }
        game._render = () => undefined;
        const ctx = game.ctx as CanvasRenderingContext2D;
        // Re-measure before drawing: the force-touch flag is set on load, so
        // the game's first _resize may have run in desktop mode.
        game._resize();
        // The stand-in map fills the live canvas, which on a phone is the
        // screen rather than a fixed 1280x720 box. Read it from the viewport:
        // `CANVAS_W`/`CANVAS_H` are top-level `let` bindings in a classic
        // script, so they are global lexical bindings and never properties of
        // `window` — reading them off contentWindow silently gave 1280x720.
        const canvasW = game.viewport?.width ?? 1280;
        const canvasH = game.viewport?.height ?? 720;
        ctx.fillStyle = '#dfe7dd'; ctx.fillRect(0, 0, canvasW, canvasH);
        ctx.strokeStyle = 'rgba(72,91,85,.25)'; ctx.lineWidth = 18;
        for (let x = -canvasH; x < canvasW + canvasH; x += 190) {
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + canvasH * 0.58, canvasH); ctx.stroke();
        }
        if (scenario.startsWith('finish')) {
          game.gameyFeatures = scenario !== 'finish-calm';
          // The arrival card's footer reads these; a game that never went
          // through route setup has none, and `routeDifficulty.charAt` threw.
          // Every finish story was failing on it, unnoticed while the frame
          // itself was 404ing.
          game.routeDifficulty = 'medium';
          game.travelMode = scenario === 'finish-bike' ? 'bike' : 'car';
          game.viewMode = 'north';
          game.quizCorrect = 2; game.quizAttempts = 4; game.quizPoints = 158; game.quizBestStreak = 2;
          game.raceTime = 98.299;
          // PIXELS_PER_METER is a top-level `const` in a classic script, so it
          // is a global lexical binding and not a property of contentWindow;
          // reading it there gave undefined and the card showed "NaN km".
          game.player = { distancePx: 2.36 * 1000 * 3 };
          game.routeFrom = { id: 'home', name: 'Home' };
          game.routeTo = { id: 'theater', name: 'Vondelpark Open Air Theater' };
          game.learnedNames = new Set(['a', 'b', 'c', 'd', 'e', 'f']);
          game._visitedNeighborhoods = new Set(['a', 'b', 'c']);
          game._seenLandmarkNames = new Set(['a', 'b']);
          game._explorationSnapshot = {
            totalRoutes: 3, learnedWaterways: new Array(14).fill('w'), learnedStreets: [],
            visitedNeighborhoods: new Array(8).fill('n'), seenLandmarks: new Array(8).fill('l'),
          };
          game._ribbon = {
            id: 'bronze', label: 'BRONZE RIBBON', color: '#D9A05B', dim: 'rgba(217,160,91,.13)', score: 0.5,
            axes: [{ label: 'Recall', score: 0.5 }, { label: 'Unaided', score: 0 }, { label: 'Efficiency', score: 1 }],
          };
          game._shareUrl = 'x'; game._copiedTimer = 0; game._raceKey = null;
          game.landmarks = [{
            id: 'theater', name: 'Vondelpark Open Air Theater', type: 'landmark',
            longDetail: 'The Vondelpark Open Air Theatre in Amsterdam has staged free performances every summer since 1865, when the park itself was still new, and it remains one of the oldest open-air stages in the Netherlands.',
            wikipediaUrl: 'https://en.wikipedia.org/wiki/Vondelpark_Open_Air_Theatre',
          }];
          const photo = new Image();
          photo.onload = () => { game._landmarkImages.set('theater', photo); game._renderFinish(); };
          photo.src = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#41603f"/><rect y="200" width="400" height="100" fill="#6d8a70"/><circle cx="200" cy="120" r="70" fill="#8fb08a"/></svg>')}`;
          game._renderFinish();
          return;
        }
        if (scenario.startsWith('landmark')) {
          const dutch = scenario === 'landmark-panel-dutch';
          const bare = scenario === 'landmark-card-bare';
          game._landmarkNotice = {
            id: 'oude-kerk',
            name: 'Oude Kerk',
            type: 'church',
            extractLang: dutch ? 'nl' : 'en',
            imageUrl: bare ? undefined : `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#9fc1c7"/><rect y="220" width="400" height="80" fill="#759bb5"/><path d="M150 220V90l50-60 50 60v130z" fill="#b95c45"/><rect x="185" y="140" width="30" height="80" fill="#3f2f28"/></svg>')}`,
            wikipediaUrl: 'https://en.wikipedia.org/wiki/Oude_Kerk,_Amsterdam',
            longDetail: dutch
              ? 'De Oude Kerk is het oudste gebouw en de oudste parochiekerk van '
                + 'Amsterdam, gesticht in 1213 en ingewijd in 1306 door de bisschop van '
                + 'Utrecht. De kerk staat aan het Oudekerksplein midden op De Wallen, en '
                + 'is sinds 2015 in gebruik als locatie voor hedendaagse kunst.'
              : 'The Oude Kerk is Amsterdam\'s oldest building and oldest parish church, '
                + 'founded in 1213 and consecrated in 1306 by the bishop of Utrecht. It '
                + 'stands on the Oudekerksplein in the middle of De Wallen, and since 2015 '
                + 'has doubled as a venue for contemporary art. Its wooden vaulted ceiling '
                + 'is the largest medieval wooden vault in Europe, and Rembrandt\'s wife '
                + 'Saskia van Uylenburgh is buried under one of its floor slabs.',
          };
          game._landmarkNoticeAlpha = 1;
          game.currentNeighborhood = 'De Wallen';
          if (bare) {
            game._renderLandmarkNotice();
            return;
          }
          const paint = new Image();
          paint.onload = () => {
            game._landmarkImages.set('oude-kerk', paint);
            game._renderLandmarkNotice();
            if (scenario !== 'landmark-card' && scenario !== 'landmark-card-bare') game._expandLandmarkNotice();
          };
          paint.src = game._landmarkNotice.imageUrl;
          return;
        }
        if (scenario === 'neighborhood-fallback' || scenario === 'neighborhood-fallback-touch') {
          game.currentNeighborhood = 'De Pijp';
          game._neighborhoodImages = new Map();
          game._neighborhoodNotice = { name: 'De Pijp', kind: 'neighborhood' };
          game._neighborhoodNoticeTimer = 4;
          game._syncHudLayout?.();
          game._renderNeighborhoodNotice();
          return;
        }
        if (scenario === 'stacked-notices' || scenario === 'stacked-notices-touch') {
          game.currentNeighborhood = 'Jordaan';
          game._landmarkNotice = {
            id: 'westerkerk',
            name: 'Westerkerk',
            type: 'church',
            extractLang: 'en',
            imageUrl: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#8aa4b8"/><rect y="200" width="400" height="100" fill="#5f7a8c"/><rect x="160" y="40" width="80" height="160" fill="#c9b29a"/><rect x="185" y="10" width="30" height="40" fill="#3f2f28"/></svg>')}`,
            wikipediaUrl: 'https://en.wikipedia.org/wiki/Westerkerk',
            longDetail: 'The Westerkerk is a Reformed church within Dutch Protestant '
              + 'church in central Amsterdam, built between 1620 and 1631 after a design '
              + 'by Hendrick de Keyser.',
          };
          game._landmarkNoticeAlpha = 1;
          const paint = new Image();
          paint.onload = () => {
            game._landmarkImages.set('westerkerk', paint);
            const hood = new Image();
            hood.onload = () => {
              game._neighborhoodImages = new Map([['Jordaan', hood]]);
              game._neighborhoodNotice = { name: 'Jordaan', kind: 'neighborhood' };
              game._neighborhoodNoticeTimer = 4;
              game._syncHudLayout?.();
              game._renderLandmarkNotice();
              game._renderNeighborhoodNotice();
            };
            hood.src = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#9fc1c7"/><rect y="210" width="600" height="190" fill="#6d8a70"/><path d="M30 250V110h120v140M190 250V70h150v180M380 250V125h180v125" fill="#b95c45"/><path d="M0 290h600v80H0z" fill="#759bb5"/></svg>')}`;
          };
          paint.src = game._landmarkNotice.imageUrl;
          return;
        }
        if (scenario === 'touch-prompt' || scenario === 'touch-settings') {
          game._syncHudLayout();
          if (scenario === 'touch-settings') {
            doc.getElementById('open-settings')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            return;
          }
          game.routeOptions.answerMode = 'multiple';
          game._openQuizPrompt({
            kind: 'route', name: 'Prinsengracht', subject: 'water',
            question: 'Which canal are you on?',
            context: 'You have been following it since the Westerkerk.',
            choices: ['Prinsengracht', 'Keizersgracht', 'Herengracht', 'Brouwersgracht'],
          });
          return;
        }
        if (scenario === 'hud' || scenario.startsWith('touch-hud')) {
          const asking = scenario === 'touch-hud-question';
          game.currentNeighborhood = 'Jordaan';
          game.quizFeedback = asking ? '' : 'Correct — Singel';
          game.showMiniMap = true;
          game.routeTo = { id: 'westerkerk', name: 'Westerkerk' };
          // Place the whole HUD from the live viewport, exactly as a frame
          // would, so the story shows the real arrangement and not a guess.
          game._syncHudLayout();
          // The street under question is withheld: the HUD must never answer it.
          game.hud.drawPlaque(ctx, {
            routeName: 'Prinsengracht', neighborhood: 'Jordaan', answerHidden: asking,
            correct: 7, attempts: 9, points: 640, streak: 4, gamey: true,
            trip: game.hud.tripText(42, 6240), feedback: game.quizFeedback,
          });
          game.hud.drawDestination(ctx, 'Westerkerk', 1860, 0.42, -Math.PI / 3);
          game.hud.drawCompass(ctx, game.camera);
          game.hud.drawCityOverview(ctx, game);
          const steering = scenario === 'touch-hud-steering';
          game.hud.drawDpad(ctx, {
            ArrowUp: false, ArrowDown: false, ArrowLeft: steering, ArrowRight: false,
          });
          if (scenario === 'touch-hud') game.hud.drawTouchHint(ctx);
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
      if (scenario.startsWith('touch-hud')) {
        // The addon resizes the iframe after onLoad; redraw at the new size.
        win?.addEventListener('resize', () => drawWhenReady());
      }
    }
  }, [scenario]);

  return <iframe
    key={scenario}
    onLoad={(event) => configure(event.currentTarget)}
    title={`Canal Recall — ${scenario}`}
    // `/canal-drive/` (no filename) 404s under `storybook dev`, which made
    // every game-frame story render the dev server's "Not Found" page. Naming
    // index.html explicitly works in both the dev server and the static build.
    src={`/canal-drive/index.html?storybook=${scenario}`}
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
export const FinishCard: Story = { args: { scenario: 'finish' } };
export const FinishCardCalmMode: Story = { args: { scenario: 'finish-calm' } };
export const FinishCardBike: Story = { args: { scenario: 'finish-bike' } };
export const NeighborhoodPhotoCard: Story = { args: { scenario: 'neighborhood' } };
/** Neighborhood entry with no photo — typography-only postcard. */
export const NeighborhoodFallbackCard: Story = { args: { scenario: 'neighborhood-fallback' } };
/** Landmark trivia and neighborhood postcard sharing the bottom band. */
export const StackedNotices: Story = { args: { scenario: 'stacked-notices' } };
export const LandmarkCard: Story = { args: { scenario: 'landmark-card' } };
/** Landmark card when the extract has no image. */
export const LandmarkCardBare: Story = { args: { scenario: 'landmark-card-bare' } };
export const LandmarkPanel: Story = { args: { scenario: 'landmark-panel' } };
export const LandmarkPanelUntranslated: Story = { args: { scenario: 'landmark-panel-dutch' } };
export const LandmarkPanelMobile: Story = {
  args: { scenario: 'landmark-panel' },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
export const LandmarkCardMobile: Story = {
  args: { scenario: 'landmark-card' },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};

// ---- Phone -----------------------------------------------------------------
// The states that were impossible to reach by driving and are the whole point
// of the portrait work: a full-width card stack over a map that actually lines
// up with it, and a d-pad that is the only way to steer.

export const PortraitHud: Story = {
  args: { scenario: 'touch-hud' },
  parameters: { viewport: { defaultViewport: 'mobile2' } },
};

/** The pad lit while steering left, so the pressed state is reviewable. */
export const PortraitHudSteering: Story = {
  args: { scenario: 'touch-hud-steering' },
  parameters: { viewport: { defaultViewport: 'mobile2' } },
};

/** Mid-question: the street name is withheld and the feedback line is gone,
 *  which is the taller/shorter pair the card stack has to absorb. */
export const PortraitHudAsking: Story = {
  args: { scenario: 'touch-hud-question' },
  parameters: { viewport: { defaultViewport: 'mobile2' } },
};

/** A small phone: the tightest the portrait stack ever gets. */
export const PortraitHudSmallPhone: Story = {
  args: { scenario: 'touch-hud' },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};

/** Landscape: the rows go back to the corners and the pad moves to the left,
 *  where a hand holding the phone already is. */
export const LandscapeHud: Story = {
  args: { scenario: 'touch-hud' },
  parameters: { viewport: { defaultViewport: 'mobile2', defaultOrientation: 'landscape' } },
};

/** The question, with the four answers stacked over a hidden d-pad. The card
 *  is capped so the vehicle it is asking about stays visible above it. */
export const PortraitRecallPrompt: Story = {
  args: { scenario: 'touch-prompt' },
  parameters: { viewport: { defaultViewport: 'mobile2' } },
};

/** The arrival card: paper, wrapped stats, and buttons instead of the ENTER /
 *  ESC / C keycaps a phone has no way to press. */
export const PortraitFinishCard: Story = {
  args: { scenario: 'finish-touch' },
  parameters: { viewport: { defaultViewport: 'mobile2' } },
};

export const PortraitStackedNotices: Story = {
  args: { scenario: 'stacked-notices-touch' },
  parameters: { viewport: { defaultViewport: 'mobile2' } },
};

export const PortraitNeighborhoodFallback: Story = {
  args: { scenario: 'neighborhood-fallback-touch' },
  parameters: { viewport: { defaultViewport: 'mobile2' } },
};

/** Settings on a phone: 44px targets and a Done button that stays on screen. */
export const PortraitSettingsPanel: Story = {
  args: { scenario: 'touch-settings' },
  parameters: { viewport: { defaultViewport: 'mobile2' } },
};

/** The expanded article, which has to scroll inside the viewport. */
export const PortraitArticlePanel: Story = {
  args: { scenario: 'landmark-panel-touch' },
  parameters: { viewport: { defaultViewport: 'mobile2' } },
};

/** The briefing as a full-bleed sheet. This is the screen whose `min(94vw,…)`
 *  width overflowed the viewport and latched the desktop layout onto phones. */
export const PortraitRouteSetup: Story = {
  args: { scenario: 'touch-setup' },
  parameters: { viewport: { defaultViewport: 'mobile2' } },
};
