import { useCallback, useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { PERF_HUD_ID, PERF_HUD_NARROW_STYLE, PERF_HUD_STYLE, perfHudLine } from '../../src/canalRecall/engine/perfHud';
import { describeBuilding } from '../../src/canalRecall/buildingFacts';

type Scenario = 'default' | 'bike-home' | 'bike-here' | 'transit' | 'advanced' | 'advanced-cartoon' | 'advanced-questions-off' | 'advanced-haze-off' | 'advanced-perf-hud' | 'hud' | 'neighborhood' | 'neighborhood-fallback'
  | 'stacked-notices' | 'finish' | 'finish-calm' | 'finish-calm-bare' | 'finish-bike' | 'finish-transit'
  | 'landmark-card' | 'landmark-card-bare' | 'landmark-card-touch' | 'landmark-panel' | 'landmark-panel-dutch'
  | 'landmark-card-folded' | 'landmark-card-folded-touch'
  // G3 (#273): "Which building is this?", and the drive-by card's "Noticed" pill.
  | 'question-landmark' | 'touch-question-landmark' | 'landmark-card-noticed' | 'landmark-card-noticed-touch'
  // #281: approaching the candidate, before its question opens: its name and the distractors' are withheld from the map.
  | 'landmark-approach' | 'landmark-approach-touch'
  // Cards with no photo that arrive from data rather than Wikipedia: a named
  // bridge's origin (municipal register) and a clicked building's facts.
  | 'landmark-card-bridge' | 'landmark-card-building' | 'landmark-card-bridge-touch' | 'landmark-card-building-touch'
  // A tapped POI label on a building the register knows nothing about (#258): the place says what it is.
  | 'landmark-card-building-place' | 'landmark-card-building-place-touch'
  // The same label tap once the pand under the label is found: the place, then its building's year (#258 follow-up).
  | 'landmark-card-building-label-pand' | 'landmark-card-building-label-pand-touch'
  // A named bridge with no origin: the city's bridge register alone.
  | 'landmark-card-bridge-register' | 'landmark-card-bridge-register-touch'
  // A street's name origin, the most common card while driving.
  | 'landmark-card-street' | 'landmark-card-street-touch'
  // A landmark whose name runs past the card's line: 63 characters, the same
  // string the Free Ride card story uses.
  | 'landmark-card-long' | 'landmark-card-long-touch'
  // Phone states. `touch-*` force the compact layout on a pointer device,
  // which is the only way to see the d-pad and the portrait card stack in the
  // workbench; the viewport addon alone just makes a small desktop window.
  | 'touch-hud' | 'touch-hud-steering' | 'touch-hud-street-queued' | 'touch-hud-street-waiting' | 'touch-hud-question' | 'touch-hud-idle' | 'touch-setup' | 'touch-setup-transit' | 'touch-setup-here'
  // Overlay states on a phone: the question, the arrival card, the panels and
  // the expanded article. These are DOM over canvas, so the HUD layout suite
  // cannot reach them and Storybook is where they get reviewed.
  | 'knowledge' | 'touch-knowledge'
  | 'touch-prompt' | 'touch-settings' | 'finish-touch' | 'finish-calm-bare-touch'
  // Every optional block at once: photo, ribbon, first-time gains, guest
  // tease and a personal best (user report 2026-10-02: ran off the screen).
  | 'finish-full' | 'finish-full-touch' | 'finish-stamp' | 'finish-stamp-touch'
  | 'finish-run' | 'finish-run-touch' | 'finish-run-card' | 'finish-run-card-touch' | 'finish-run-card-calm' | 'finish-run-card-calm-touch'
  | 'landmark-panel-touch'
  | 'stacked-notices-touch' | 'neighborhood-fallback-touch' | 'neighborhood-touch'
  // Aboard a cycling IJ ferry: the departure/destination notice under the plaque.
  | 'hud-ferry' | 'touch-hud-ferry'
  // Aboard, 24 m from a pier: the notice says how to dock there.
  | 'hud-ferry-dock' | 'touch-hud-ferry-dock'
  // Desktop utilities: tucked a few seconds into the ride, and back after a
  // mouse wiggle (with the destination card's hover-only "% new" badge).
  | 'hud-idle' | 'hud-wiggle'
  // The riding radar (the always-on minimap since 2026-10-16), heading-up at
  // Westermarkt with the route along Raadhuisstraat and the Dam off the rim.
  | 'hud-radar' | 'touch-hud-radar'
  // The first-run intro over the setup screen, one story per step, with the
  // keyboard hints (desktop) and the ring/tap hints (phone).
  | 'onboarding-ride' | 'onboarding-name' | 'onboarding-score'
  | 'touch-onboarding-ride' | 'touch-onboarding-name' | 'touch-onboarding-score'
  // A home route on a phone: the Feedback / How to play row under Start.
  | 'touch-setup-home'
  // G7 (#277): tours as cover cards under More options; Settings with the account chip signed in.
  | 'advanced-tours' | 'touch-advanced-tours' | 'settings-signed-in' | 'touch-settings-signed-in'
;

/** A landmark name well past the card's line (63 characters): the string the
 *  Free Ride card story already uses, so both stories stress the same name. */
const LONG_LANDMARK_NAME = 'Rijksmuseum en Museumplein (hoofdingang aan de Museumstraat)';
/** Its extract, likewise reused from the Free Ride card story. */
const LONG_LANDMARK_DETAIL = 'The Rijksmuseum is the national museum of the Netherlands, on the Museumplein. Pierre Cuypers designed the building, which opened in 1885; its passage under the middle is a public cycle path, the only one through a national museum.';

const ONBOARDING_STEP: Partial<Record<Scenario, number>> = {
  'onboarding-ride': 0, 'onboarding-name': 1, 'onboarding-score': 2,
  'touch-onboarding-ride': 0, 'touch-onboarding-name': 1, 'touch-onboarding-score': 2,
};

/** Draw the radar once its tiles around the view are all rasterised. */
function drawStoryRadar(win: Window, game: any, ctx: CanvasRenderingContext2D) {
  const R = (win as unknown as { CanalRecallRadar?: any }).CanalRecallRadar;
  const rect = game.hud.layout?.minimap;
  if (!R || !rect) return;
  const local = (lng: number, lat: number) => R.radarLocal(lng, lat);
  const route = [[4.8826, 52.3748], [4.8841, 52.3747], [4.8870, 52.3741], [4.8900, 52.3735], [4.8927, 52.3731]];
  const flat = new Float32Array(route.flatMap(([lng, lat]) => local(lng, lat)));
  // Riding east along Raadhuisstraat, the camera heading-up behind the bike.
  const angle = -0.2;
  const view = {
    at: local(4.8846, 52.3746), rotation: angle + Math.PI / 2, angle, radiusM: 0,
    destination: local(4.8927, 52.3731), route: flat, routeIndex: 1,
  };
  const range = R.RADAR_RADIUS_M[game.hud.layout.mode === 'compact' ? 'compact' : 'desktop'];
  view.radiusM = range[0];
  const radar = new R.RadarMap();
  void radar.load('../data/extracts/amsterdam/own-map-v1/overview.json.gz').then(() => {
    const scratch = win.document.createElement('canvas');
    scratch.width = ctx.canvas.width; scratch.height = ctx.canvas.height;
    const sctx = scratch.getContext('2d')!;
    sctx.setTransform(ctx.getTransform());
    let last = -1;
    const step = () => {
      radar.draw(sctx, rect, view, range[0]);
      if (radar.stats.tilesRendered !== last) { last = radar.stats.tilesRendered; win.requestAnimationFrame(step); return; }
      radar.draw(ctx, rect, view, range[0]);
    };
    step();
  });
}

/** The perf HUD line (engine/perfHud.ts) as the own engine draws it, from a fixed snapshot: the aerial-pan numbers. */
function addPerfHud(doc: Document): void {
  if (doc.getElementById(PERF_HUD_ID)) return;
  const el = doc.createElement('div');
  el.id = PERF_HUD_ID;
  el.style.cssText = PERF_HUD_STYLE + ((doc.defaultView?.innerWidth ?? 1024) < 600 ? PERF_HUD_NARROW_STYLE : '');
  el.textContent = perfHudLine({ tier: 'high', dpr: 2, heapMB: 309, gpuMB: 473, geometries: 1500, textures: 46, cells: 14, chunks: 26, models: 72, p99Ms: 58 });
  doc.body.appendChild(el);
}

function CanalDriveFrame({ scenario = 'default', perfHud = false }: { scenario?: Scenario; perfHud?: boolean }) {
  const configure = useCallback((frame: HTMLIFrameElement) => {
    const doc = frame.contentDocument;
    if (!doc) return;
    if (perfHud) addPerfHud(doc);
    const win = frame.contentWindow as (Window & {
      canalRecallForceTouch?: boolean;
      canalRecallGame?: any;
    }) | null;
    // Must be set before the game's first _resize, and re-applied because the
    // Storybook viewport addon resizes the iframe after load.
    if (win && scenario.includes('touch')) win.canalRecallForceTouch = true;
    const setupStories = new Set([
      'default', 'bike-home', 'bike-here', 'transit', 'advanced', 'advanced-cartoon', 'advanced-questions-off', 'advanced-haze-off', 'advanced-perf-hud', 'knowledge',
      'touch-setup', 'touch-setup-transit', 'touch-setup-here', 'touch-knowledge', 'touch-setup-home', 'advanced-tours', 'touch-advanced-tours',
      ...Object.keys(ONBOARDING_STEP),
    ]);
    if (setupStories.has(scenario)) doc.body.classList.add('storybook-setup');
    else doc.body.classList.remove('storybook-setup');
    const overlay = (win as any)?.CanalRecallOverlay?.getOverlay?.();
    const patchPrefs = (patch: Record<string, unknown>) => {
      if (!overlay) return;
      overlay.store.patchPrefs(patch, overlay.callbacks.zoom);
    };
    const onboardingStep = ONBOARDING_STEP[scenario];
    if (onboardingStep !== undefined && win) {
      // The bundle is loaded by the time onLoad fires; open on the wanted step.
      const ui = (win as unknown as { CanalRecallUi?: { openOnboarding?: (o: unknown) => void } }).CanalRecallUi;
      ui?.openOnboarding?.({ input: scenario.includes('touch') ? 'touch' : 'keyboard', startAt: onboardingStep });
    }
    if (scenario === 'bike-home' || scenario === 'touch-setup-home') {
      patchPrefs({
        travelMode: 'car', viewMode: 'heading', routePattern: 'home',
        homeAddress: 'Da Costakade 13-3, Amsterdam',
      });
    }
    if (scenario === 'bike-here' || scenario === 'touch-setup-here') {
      patchPrefs({
        travelMode: 'car', viewMode: 'heading', routePattern: 'here',
      });
    }
    if (scenario === 'transit' || scenario === 'touch-setup-transit') {
      patchPrefs({
        travelMode: 'transit', cityId: 'amsterdam', viewMode: 'heading', routePattern: 'surprise',
      });
    }
    if (scenario === 'advanced' && overlay) overlay.store.setAdvancedOpen(true);
    if ((scenario === 'advanced-tours' || scenario === 'touch-advanced-tours') && overlay) {
      // The tour catalogue as the ride lists it (no stop names); a 30-character title tests the wrap.
      overlay.store.setTours([
        { id: 'jewish-amsterdam', title: 'Jewish Amsterdam', theme: 'history', stopCount: 7, checked: 'checked 2026-10-17' },
        { id: 'golden-age-canal-ring', title: 'Golden Age canal ring', theme: 'architecture', stopCount: 6, checked: null },
        { id: 'art-museums', title: 'Art museums', theme: 'art', stopCount: 5, checked: null },
        { id: 'churches-and-towers', title: 'Churches and towers of the old centre', theme: 'skyline', stopCount: 6, checked: null },
        { id: 'pizza', title: 'Pizza', theme: 'food', stopCount: 5, checked: 'checked 2026-10-17' },
      ]);
      overlay.store.setAdvancedOpen(true);
    }
    if ((scenario === 'settings-signed-in' || scenario === 'touch-settings-signed-in') && overlay) {
      overlay.store.setAccount({ label: 'Annemarie van der Heijden-Vos', note: '214 names synced', buttonLabel: 'Sign out', busy: false, signedIn: true, photoURL: null });
      overlay.store.setSetupOpen(false);
      overlay.store.setSettingsOpen?.(true);
      if (!overlay.store.setSettingsOpen) doc.getElementById('open-settings')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
    if (scenario === 'advanced-cartoon' && overlay) { patchPrefs({ buildingLook: 'cartoon' }); overlay.store.setAdvancedOpen(true); }
    // The rider's questions-per-minute setting, set to Off, with its row scrolled into view.
    if (scenario === 'advanced-questions-off' && overlay) {
      patchPrefs({ maxAsksPerMinute: 0 });
      overlay.store.setAdvancedOpen(true);
      window.setTimeout(() => doc.querySelector('[aria-label="Questions a minute"]')?.scrollIntoView({ block: 'center' }), 600);
    }
    // The "Distance haze" switch (look/depthFade.ts) turned off, its Comfort & detail row scrolled into view.
    // "Show performance" (engine/perfHud.ts) switched on, its Comfort & detail row scrolled into view.
    if (scenario === 'advanced-perf-hud' && overlay) {
      patchPrefs({ perfHud: true });
      overlay.store.setAdvancedOpen(true);
      window.setTimeout(() => doc.getElementById('perf-hud')?.scrollIntoView({ block: 'center' }), 600);
    }
    if (scenario === 'advanced-haze-off' && overlay) {
      patchPrefs({ distanceHaze: false });
      overlay.store.setAdvancedOpen(true);
      window.setTimeout(() => doc.getElementById('distance-haze')?.scrollIntoView({ block: 'center' }), 600);
    }
    if ((scenario === 'knowledge' || scenario === 'touch-knowledge') && win) {
      const now = Date.now();
      const names = [
        ['Overtoom', 'street', now - 3 * 86_400_000, 2, 1],
        ['Prinsengracht', 'canal', now - 7_200_000, 3, 0],
        ['Zeedijk', 'street', now + 86_400_000, 1, 1],
        ['Blauwbrug', 'bridge', now + 4 * 86_400_000, 2, 0],
        ['Weteringschans', 'street', now + 8 * 86_400_000, 3, 0],
        ['Ferdinand Bolstraat', 'street', now + 12 * 86_400_000, 3, 0],
      ] as const;
      const states = Object.fromEntries(names.map(([name, type, dueAt, repetitions, lapses], index) => {
        const featureKey = `storybook-${index}`;
        return [`${featureKey}_guess_name`, {
          featureKey,
          mode: 'guess_name',
          dueAt,
          intervalDays: 4,
          ease: 2.3,
          repetitions,
          lapses,
          lastReviewedAt: now - (index + 1) * 43_200_000,
          lastEventId: `event-${index}`,
          schedulerVersion: 1,
          featureSnapshot: { name, type, cityId: 'amsterdam', center: [52.37, 4.89] },
        }];
      }));
      const events = Object.fromEntries(new Array(18).fill(null).map((_, index) => [`event-${index}`, {
        id: `event-${index}`,
        featureKey: `storybook-${index % names.length}`,
        mode: 'guess_name',
        rating: index % 5 === 0 ? 'again' : 'good',
        reviewedAt: now - (index % 7) * 86_400_000,
        nextDueAt: now + 86_400_000,
        result: { pointsEarned: 1, timeSpentMs: 4200, skipped: false },
      }]));
      win.localStorage.setItem('mapRecall_reviewStates_v1', JSON.stringify(states));
      win.localStorage.setItem('mapRecall_reviewEvents_v1', JSON.stringify(events));
      doc.getElementById('knowledge-button')?.click();
    }
    if (scenario === 'hud' || scenario === 'hud-idle' || scenario === 'hud-wiggle' || scenario === 'hud-ferry' || scenario === 'hud-ferry-dock' || scenario === 'hud-radar' || scenario === 'neighborhood' || scenario === 'neighborhood-touch' || scenario === 'neighborhood-fallback'
      || scenario === 'stacked-notices' || scenario === 'stacked-notices-touch'
      || scenario === 'neighborhood-fallback-touch'
      || scenario.startsWith('finish')
      || scenario.startsWith('landmark') || scenario.startsWith('touch-hud')
      || scenario === 'touch-prompt' || scenario === 'touch-settings'
      || scenario === 'question-landmark' || scenario === 'touch-question-landmark') {
      overlay?.store.setSetupOpen(false);
      const drawWhenReady = () => {
        const game = (frame.contentWindow as typeof frame.contentWindow & { canalRecallGame?: any })?.canalRecallGame;
        if (!game?.ctx || !game?.hud) { window.setTimeout(drawWhenReady, 50); return; }
        game._render = () => undefined;
        // The stubbed _render never runs the game's utility tuck, so the
        // cluster sat on the arrival card's Share button and on the question
        // card's fourth choice and "No idea" in these stories only (G7, #277;
        // tests/e2e/g7-phone-layout.spec.ts pins the real game). Apply what
        // the game does: hidden on the arrival card, tucked over a question.
        const utility = doc.getElementById('utility-buttons');
        if (utility) {
          if (scenario.startsWith('finish')) utility.style.display = 'none';
          else if (scenario === 'touch-prompt') utility.classList.add('tucked', 'tucked-all');
        }
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
        const paintMap = () => {
          ctx.fillStyle = '#dfe7dd'; ctx.fillRect(0, 0, canvasW, canvasH);
          ctx.strokeStyle = 'rgba(72,91,85,.25)'; ctx.lineWidth = 18;
          for (let x = -canvasH; x < canvasW + canvasH; x += 190) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + canvasH * 0.58, canvasH); ctx.stroke();
          }
        };
        paintMap();
        // The live game repaints the map under the card every frame; the story
        // draws once, so a second card drawn over the first (the arrival card
        // is drawn again when its photo loads, and a phone's card is a
        // different height with the photo) left the first showing through the
        // translucent plaque as a ghost layer. Repaint the map before each draw.
        const renderFinish = () => { paintMap(); game._renderFinish(); };
        if (scenario.startsWith('finish')) {
          const calm = scenario.includes('calm');
          const bare = scenario.includes('bare');
          game.gameyFeatures = !calm;
          // The arrival card's footer reads these; a game that never went
          // through route setup has none, and `routeDifficulty.charAt` threw.
          // Every finish story was failing on it, unnoticed while the frame
          // itself was 404ing.
          game.routeDifficulty = 'medium';
          game.travelMode = scenario.includes('bike') ? 'bike'
            : scenario.includes('transit') ? 'transit'
            : 'car';
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
            // The arrival card counts transit too; without these it threw and
            // every finish story showed an empty dimmed map (found by the
            // screenshot comparison, 2026-09-30).
            totalRoutes: 3, learnedWaterways: new Array(14).fill('w'), learnedStreets: [],
            learnedTransitLines: [], learnedTransitStops: [],
            visitedNeighborhoods: new Array(8).fill('n'), seenLandmarks: new Array(8).fill('l'),
          };
          game._ribbon = calm ? null : {
            id: 'bronze', label: 'BRONZE RIBBON', color: '#D9A05B', dim: 'rgba(217,160,91,.13)', score: 0.5,
            axes: [{ label: 'Recall', score: 0.5 }, { label: 'Unaided', score: 0 }, { label: 'Efficiency', score: 1 }],
          };
          game._shareUrl = 'x'; game._copiedTimer = 0; game._raceKey = null;
          // G5: an arrival that earned a passport stamp shows it as a stamp.
          if (scenario.startsWith('finish-stamp')) {
            game.quizCorrect = 4; game.quizAttempts = 5; game.quizPoints = 370; game.quizBestStreak = 3;
            game._explorationRouteGain = { newNames: 2, newNeighborhoods: 1, newLandmarks: 0 };
            game._finishPassportFresh = ['Grachtengordel'];
            win.localStorage.setItem('canalRecall.neighborhoodPassport.v1', JSON.stringify({ stamped: ['Grachtengordel', 'Jordaan', 'Oude Pijp'] }));
            // The stamp art is its own bundle; the card shows the plain stamp until it lands.
            const art = doc.createElement('script');
            art.src = 'js/stamp-art.bundle.js';
            art.onload = () => {
              const loaded = (win as unknown as { CanalRecallStampArt?: { loadStampFont: () => Promise<unknown> } }).CanalRecallStampArt;
              void loaded?.loadStampFont().then(() => renderFinish());
            };
            doc.head.appendChild(art);
          }
          if (scenario.startsWith('finish-full')) {
            game.quizCorrect = 4; game.quizAttempts = 5; game.quizPoints = 370; game.quizBestStreak = 3;
            game._explorationRouteGain = { newNames: 2, newNeighborhoods: 0, newLandmarks: 1 };
            game._raceKey = 'story-full';
            win.localStorage.setItem('satb_bestTimes', JSON.stringify({ 'story-full': { time: 200 } }));
          }
          // The single-ride states keep today's card (as `?run=0`); the run states opt in.
          game._runsOff = !scenario.startsWith('finish-run');
          if (scenario.startsWith('finish-run')) {
            // Chained stops (G1): two stops already in the open run, so this
            // arrival is the third; the run-card states then end the run.
            const now = Date.now();
            const stop = (id: string, name: string, points: number, bonus: number, names: string[], at: number) => ({
              id, name, basePoints: points, points: Math.round(points * (1 + bonus)), bonus, bestStreak: 2, names, at,
            });
            // Ride review #280's seeding (#282): rides of 130 / 240 / 90, so the card reads
            // 99 points (+10 %), the run line 481, and the run card 130 · 252 +5 % · 99 +10 %.
            const stops = [
              stop('westerkerk', 'Westerkerk', 130, 0, ['Prinsengracht', 'Bloemgracht'], now - 900_000),
              stop('rijks', 'Rijksmuseum', 240, 0.05, ['Spiegelgracht', 'Nieuwe Spiegelstraat'], now - 300_000),
            ];
            game.quizPoints = 90;
            win.localStorage.setItem('canalRecall.openRun.v1', JSON.stringify({
              version: 1, startedAt: now - 1_200_000, lastActiveAt: now - 60_000, startName: 'Noordermarkt',
              stopCount: 2, totalPoints: 130 + 252, bestStreak: 2,
              names: ['Prinsengracht', 'Bloemgracht', 'Spiegelgracht', 'Nieuwe Spiegelstraat'], stops,
            }));
            Object.assign(game, { _runLoaded: false, _run: null, _runCard: null, _runRecordedKey: '' });
            game.routeFrom = { id: 'rijks', name: 'Rijksmuseum' };
            game._rideNamedNames = ['Vondelstraat'];
            if (scenario.startsWith('finish-run-card')) {
              game._recordRunStop();
              game._endRunFromCard();
            }
          }
          game.landmarks = [{
            id: 'theater', name: 'Vondelpark Open Air Theater', type: 'landmark',
            longDetail: 'The Vondelpark Open Air Theatre in Amsterdam has staged free performances every summer since 1865, when the park itself was still new, and it remains one of the oldest open-air stages in the Netherlands.',
            wikipediaUrl: 'https://en.wikipedia.org/wiki/Vondelpark_Open_Air_Theatre',
          }];
          if (bare) {
            game._landmarkImages = new Map();
            renderFinish();
            return;
          }
          const photo = new Image();
          photo.onload = () => { game._landmarkImages.set('theater', photo); renderFinish(); };
          photo.src = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#41603f"/><rect y="200" width="400" height="100" fill="#6d8a70"/><circle cx="200" cy="120" r="70" fill="#8fb08a"/></svg>')}`;
          renderFinish();
          return;
        }
        if (scenario.startsWith('landmark-card-street')) {
          const origin = "After 'the princely title', meaning that of the Princes of Orange. The canal is one "
            + 'of the three main canals, and the plainest in the character of its buildings. Its houses '
            + 'were built for merchants and artisans rather than the richest families of the Golden Age.';
          game._landmarkNotice = { id: 'street-knowledge:prinsengracht', name: 'Prinsengracht', type: 'street', extractLang: 'en', detail: origin, longDetail: origin };
          game._landmarkNoticeAlpha = 1;
          game.currentNeighborhood = 'Grachtengordel';
          game._syncHudLayout?.();
          game._renderLandmarkNotice();
          return;
        }
        if (scenario.startsWith('landmark-card-bridge') || scenario.startsWith('landmark-card-building')) {
          const registerOnly = "Bridge 236: a steel bridge for road traffic, dated 1884 in the city's bridge register.";
          game._landmarkNotice = scenario.startsWith('landmark-card-bridge-register')
            ? { id: 'bridge-knowledge:blauwbrug', name: 'Blauwbrug', type: 'bridge', extractLang: 'en', detail: registerOnly, longDetail: registerOnly }
            : scenario.startsWith('landmark-card-bridge')
            ? {
              id: 'bridge-knowledge:magere brug', name: 'Magere Brug', type: 'bridge', extractLang: 'en',
              detail: 'Around 1670, a ferry bridge was built over the Amstel, which was so narrow that it was only suitable for pedestrians.',
              longDetail: 'Around 1670, a ferry bridge was built over the Amstel, which was so narrow that it was only suitable for pedestrians. '
                + 'Although this bridge was officially called the Kerkstraatbrug, it soon became known as the Magere Brug.',
            }
            : scenario.startsWith('landmark-card-building-label-pand')
            ? {
              // The gurdwara's label point lies in pand 0363100012106767 (building-tiles 14/8412/5382); its
              // building-facts row is [1964, -1, 0] and its tile height 4.79 m.
              id: 'clicked-own:Shri Guru Nanak Gurdwara Sahib:4.84901', type: 'building',
              sourceUrl: 'https://www.openstreetmap.org/node/2628741158',
              ...describeBuilding([1964, -1, 0], 4.79, 'Shri Guru Nanak Gurdwara Sahib',
                { name: 'Shri Guru Nanak Gurdwara Sahib', kind: 'a Sikh gurdwara', address: 'Schakelstraat 21' }),
            }
            : scenario.startsWith('landmark-card-building-place')
            ? {
              id: 'clicked-own:Shri Guru Nanak Gurdwara Sahib:4.84901', type: 'building',
              sourceUrl: 'https://www.openstreetmap.org/node/2628741158',
              ...describeBuilding(null, undefined, 'Shri Guru Nanak Gurdwara Sahib',
                { name: 'Shri Guru Nanak Gurdwara Sahib', kind: 'a Sikh gurdwara', address: 'Schakelstraat 21' }),
            }
            : {
              id: 'clicked-NL.IMBAG.Pand.0363100012169999', name: 'Built 1665', type: 'building',
              detail: 'A warehouse, built in 1665, in the Dutch Golden Age. A national monument (rijksmonument). About 13 m tall, some 4 storeys.',
            };
          game._landmarkNoticeAlpha = 1;
          game.currentNeighborhood = 'Grachtengordel';
          game._syncHudLayout?.();
          game._renderLandmarkNotice();
          return;
        }
        if (scenario.startsWith('landmark')) {
          const dutch = scenario.startsWith('landmark-panel-dutch');
          const bare = scenario.startsWith('landmark-card-bare');
          const long = scenario.startsWith('landmark-card-long');
          const name = long ? LONG_LANDMARK_NAME : 'Oude Kerk';
          // The photo is keyed by the notice's id when it arrives; the long-name
          // card is the same stand-in painting under its own name.
          const id = long ? 'rijksmuseum' : 'oude-kerk';
          game._landmarkNotice = {
            id,
            name,
            type: long ? 'museum' : 'church',
            extractLang: dutch ? 'nl' : 'en',
            imageUrl: bare ? undefined : `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#9fc1c7"/><rect y="220" width="400" height="80" fill="#759bb5"/><path d="M150 220V90l50-60 50 60v130z" fill="#b95c45"/><rect x="185" y="140" width="30" height="80" fill="#3f2f28"/></svg>')}`,
            wikipediaUrl: long ? 'https://en.wikipedia.org/wiki/Rijksmuseum' : 'https://en.wikipedia.org/wiki/Oude_Kerk,_Amsterdam',
            longDetail: long
              ? LONG_LANDMARK_DETAIL
              : dutch
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
          game.currentNeighborhood = long ? 'Museumkwartier' : 'De Wallen';
          if (scenario.startsWith('landmark-card-noticed')) {
            // A fresh drive-by card for a landmark of the ride offers "Noticed" (G3).
            game.landmarks = [...(game.landmarks || []).filter((l: { id: string }) => l.id !== id), { id, name, x: 0, y: 0 }];
            game._landmarkSightingsCache = {};
            game._landmarkNoticeSource = 'drive-by';
            game._landmarkNoticeState = { ...(game._landmarkNoticeState || {}), elapsed: 1 };
          }
          if (scenario.startsWith('landmark-card-folded')) {
            // A drive-by card past its fold (teachingPacer.cardCollapsed): no photo, one fact in two lines.
            game._landmarkNoticeSource = 'drive-by';
            game._landmarkNoticeState = { ...(game._landmarkNoticeState || {}), elapsed: 10 };
            game._renderLandmarkNotice();
            return;
          }
          if (bare) {
            game._renderLandmarkNotice();
            return;
          }
          const paint = new Image();
          paint.onload = () => {
            game._landmarkImages.set(id, paint);
            game._renderLandmarkNotice();
            if (!scenario.startsWith('landmark-card')) game._expandLandmarkNotice();
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
        if (scenario === 'landmark-approach' || scenario === 'landmark-approach-touch') {
          // No card yet and no name on the map: the four choices the question
          // will offer are withheld from every label layer (labelPolicy
          // withheldNames), so the overlay drops them at its own fade.
          game._syncHudLayout();
          game.player = game.player || { x: 0, y: 0, angle: 0, speed: 0, vx: 0, vy: 0 };
          game.landmarkApproachWithheld = ['Westerkerk', 'Homomonument', 'Anne Frank House', 'Huis Bartolotti'];
          game._clearLandmarkNotice?.();
          return;
        }
        if (scenario === 'question-landmark' || scenario === 'touch-question-landmark') {
          game._syncHudLayout();
          game.routeOptions.answerMode = 'multiple';
          game.player = game.player || { x: 0, y: 0, angle: 0, speed: 0, vx: 0, vy: 0 };
          const frameMath = (frame.contentWindow as unknown as { Math: Math }).Math;
          const random = frameMath.random;
          frameMath.random = () => 0.42;
          // The question as landmarkQuestionRuntime opens it; the answer is only on a button.
          game._openQuizPrompt({
            kind: 'landmark', name: 'Westerkerk', subject: 'landmark',
            question: 'Which building is this?',
            context: 'On the right · Grachtengordel-West',
            choices: ['Westerkerk', 'Homomonument', 'Anne Frank House', 'Huis Bartolotti'],
          });
          game._dressLandmarkPrompt();
          frameMath.random = random;
          return;
        }
        if (scenario === 'touch-prompt' || scenario === 'touch-settings') {
          game._syncHudLayout();
          if (scenario === 'touch-settings') {
            doc.getElementById('open-settings')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            return;
          }
          game.routeOptions.answerMode = 'multiple';
          // The prompt stops the bike, so it needs one: without a ride the
          // story showed an empty map (found by the screenshot comparison).
          game.player = game.player || { x: 0, y: 0, angle: 0, speed: 0, vx: 0, vy: 0 };
          // The choices are shuffled; a fixed order keeps the screenshot stable.
          const frameMath = (frame.contentWindow as unknown as { Math: Math }).Math;
          const random = frameMath.random;
          frameMath.random = () => 0.42;
          game._openQuizPrompt({
            kind: 'route', name: 'Prinsengracht', subject: 'water',
            question: 'Which canal are you on?',
            context: 'You have been following it since the Westerkerk.',
            choices: ['Prinsengracht', 'Keizersgracht', 'Herengracht', 'Brouwersgracht'],
          });
          frameMath.random = random;
          return;
        }
        if (scenario === 'hud' || scenario === 'hud-idle' || scenario === 'hud-wiggle' || scenario === 'hud-ferry' || scenario === 'hud-ferry-dock' || scenario === 'hud-radar' || scenario.startsWith('touch-hud')) {
          const ferry = scenario.endsWith('-ferry') || scenario.endsWith('-ferry-dock');
          const asking = scenario === 'touch-hud-question' || ferry;
          const long = scenario === 'touch-hud-long';
          const hood = long ? 'Van Lennepbuurt en Kinkerbuurt-Noord' : 'Jordaan';
          const destinationName = long ? 'Rijksmuseum en Museumplein (hoofdingang)' : 'Westerkerk';
          game.currentNeighborhood = hood;
          game.quizFeedback = asking ? '' : 'Correct — Singel';
          game.showMiniMap = true;
          game.routeTo = { id: 'westerkerk', name: 'Westerkerk' };
          // Place the whole HUD from the live viewport, exactly as a frame
          // would, so the story shows the real arrangement and not a guess.
          game._syncHudLayout();
          // The street under question is withheld: the HUD must never answer it.
          // A portrait phone folds the destination into the plaque, as the
          // live frame does; every other layout keeps its own card.
          const merged = !!game.hud.layout?.destinationInRecall;
          game.hud.drawPlaque(ctx, {
            routeName: long ? 'Burgemeester de Vlugtlaan-Oost' : 'Prinsengracht',
            neighborhood: hood, answerHidden: asking,
            correct: 7, attempts: 9, points: 640, streak: 4, gamey: true,
            trip: game.hud.tripText(42, 6240), feedback: game.quizFeedback,
            restrictionNote: long ? 'No cycling here in real life' : '',
            destination: merged ? { name: destinationName, distancePx: 1860, arrowAngle: -Math.PI / 3 } : null,
          });
          // Desktop idle: the corner cluster fades out. The game loop only
          // tucks while racing, so the story applies the same rule directly.
          if (scenario === 'hud-idle' || scenario === 'touch-hud-idle') {
            const style = doc.createElement('style');
            style.textContent = '#utility-buttons > * { opacity: 0 !important; pointer-events: none; }';
            doc.head.appendChild(style);
          }
          if (scenario === 'hud-wiggle') {
            const d = game.hud.layout?.destination;
            if (d) game.hud.hoverPoint = { x: d.x + 20, y: d.y + 20 };
          }
          if (!merged) game.hud.drawDestination(ctx, destinationName, 1860, 0.42, -Math.PI / 3);
          game.hud.drawCompass(ctx, game.camera);
          if (scenario.endsWith('-radar') && win) drawStoryRadar(win, game, ctx);
          else game.hud.drawCityOverview(ctx, game);
          // Steering: a thumb that landed in the zone and slid up-left, as a
          // held stick draws it. Idle: the faint ring that says "drive here".
          const pad = game.hud.layout?.dpad;
          // The game's own window, not Storybook's: reading it off `window`
          // was undefined, and the steering story threw before the pad drew.
          const ui = (frame.contentWindow as unknown as { CanalRecallUi: { stickRadius: (p: unknown) => number; stickVector: (o: unknown, p: unknown, r: number) => unknown } }).CanalRecallUi;
          // The phone default is the street-follow pad; the stick story keeps
          // the 'Steer' option reviewable.
          if (scenario === 'touch-hud-steering' && pad) {
            const radius = ui.stickRadius(pad);
            const origin = { x: pad.cx + 8, y: pad.cy + 6 };
            const point = { x: origin.x - radius * 0.7, y: origin.y - radius * 0.35 };
            game.hud.drawStick(ctx, { origin, point, radius, vector: ui.stickVector(origin, point, radius) });
          } else {
            const none = { left: false, right: false, back: false };
            game.hud.drawStreetPad(ctx, scenario === 'touch-hud-street-queued'
              ? { queuedTurn: -1, parked: false, turning: false, awaitingChoice: false, buttons: none }
              : scenario === 'touch-hud-street-waiting'
                ? { queuedTurn: 0, parked: false, turning: false, awaitingChoice: true, buttons: none }
                : { queuedTurn: 0, parked: scenario === 'touch-hud', turning: false, awaitingChoice: false, buttons: none });
          }
          // A queued left, with the chevron on the opening it will take.
          if (scenario === 'touch-hud-street-queued' && pad) game.hud.drawTurnMarker(ctx, { x: pad.cx - 30, y: pad.bounds.y - 150 }, Math.PI);
          if (scenario === 'touch-hud') game.hud.drawTouchHint(ctx, 'street');
          if (ferry) {
            game._renderFerryNotice({
              ferryOrigin: { id: '3980940', name: 'Centraal Station', x: 0, y: 0, land: { x: 0, y: 0 } },
              ferryDestinations: 'Buiksloterweg',
              ferryNearest: scenario.endsWith('-ferry-dock') ? { name: 'Buiksloterweg', distance: 72 } : null,
            }, true);
          }
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
  }, [scenario, perfHud]);

  return <iframe
    key={`${scenario}${perfHud ? '-perf' : ''}`}
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

/** The phone viewports (`mobile1` 320×568, `mobile2` 414×896), set the way
 *  Storybook 10 reads them. `touch-…` scenarios force the touch layout in the
 *  frame itself, so the state is the phone one even at a desktop canvas width. */
const phone = { viewport: { value: 'mobile2', isRotated: false } };

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { scenario: 'default' } };
export const BikeFromHome: Story = { args: { scenario: 'bike-home' } };
export const BikeFromHere: Story = { args: { scenario: 'bike-here' } };
export const TransitBriefing: Story = { args: { scenario: 'transit' } };
export const AdvancedOptions: Story = { args: { scenario: 'advanced' } };
export const AdvancedOptionsPhone: Story = {
  args: { scenario: 'advanced' },
  globals: phone,
};
export const AdvancedOptionsCartoonLook: Story = { args: { scenario: 'advanced-cartoon' } };
export const AdvancedOptionsCartoonLookPhone: Story = {
  args: { scenario: 'advanced-cartoon' },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
export const AdvancedOptionsQuestionsOff: Story = { args: { scenario: 'advanced-questions-off' } };
export const AdvancedOptionsQuestionsOffPhone: Story = {
  args: { scenario: 'advanced-questions-off' },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
export const AdvancedOptionsHazeOff: Story = { args: { scenario: 'advanced-haze-off' } };
export const AdvancedOptionsHazeOffPhone: Story = {
  args: { scenario: 'advanced-haze-off' },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
export const AdvancedOptionsPerfHud: Story = { args: { scenario: 'advanced-perf-hud' } };
export const AdvancedOptionsPerfHudPhone: Story = {
  args: { scenario: 'advanced-perf-hud' },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
export const KnowledgeReview: Story = { args: { scenario: 'knowledge' } };
export const Mobile: Story = {
  args: { scenario: 'default' },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
export const TransitBriefingPhone: Story = {
  args: { scenario: 'touch-setup-transit' },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
export const LiveHud: Story = { args: { scenario: 'hud' } };
/** "Show performance" on (engine/perfHud.ts): the mono line bottom-left, above the attribution. */
export const LiveHudPerf: Story = { args: { scenario: 'hud', perfHud: true } };
export const LiveHudPerfPhone: Story = { args: { scenario: 'touch-hud', perfHud: true }, globals: phone };
/** Aboard an IJ ferry: the notice names the departure and the pier to dock at. */
/** Desktop, a few seconds into the ride: Feedback, settings, help and the build stamp are gone. */
export const LiveHudIdle: Story = { args: { scenario: 'hud-idle' } };
/** The same tuck on a phone: a tap on the map brings the corner cluster back,
 *  so "gone" is a state there too. */
export const LiveHudIdlePhone: Story = {
  args: { scenario: 'touch-hud-idle' },
  globals: phone,
};
/** Desktop after a mouse wiggle: the corner cluster is back and the destination card shows "% new" on hover. */
export const LiveHudWiggle: Story = { args: { scenario: 'hud-wiggle' } };
export const LiveHudFerry: Story = { args: { scenario: 'hud-ferry' } };
/** Aboard, 24 m from the Buiksloterweg pier: the notice names it and how to dock. */
export const LiveHudFerryDock: Story = { args: { scenario: 'hud-ferry-dock' } };
/** The riding radar: heading-up, route ahead in bold, the Dam clamped to the rim as an arrow. */
export const LiveHudRadar: Story = { args: { scenario: 'hud-radar' } };
export const LiveHudRadarPhone: Story = {
  args: { scenario: 'touch-hud-radar' },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
export const FinishCard: Story = { args: { scenario: 'finish' } };
/** Every block at once; the card must still fit a laptop screen. */
export const FinishCardFull: Story = { args: { scenario: 'finish-full' } };
export const FinishCardPassportStamp: Story = { args: { scenario: 'finish-stamp' } };
export const PortraitFinishCardPassportStamp: Story = {
  args: { scenario: 'finish-stamp-touch' },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
export const FinishCardFullPhone: Story = {
  args: { scenario: 'finish-full-touch' },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
export const FinishCardCalmMode: Story = { args: { scenario: 'finish-calm' } };
/** Calm arrival on a phone, with the landmark photo kept. */
export const FinishCardCalmModePhone: Story = {
  args: { scenario: 'finish-calm-touch' },
  globals: phone,
};
/** Calm finish with no landmark photo — typography-only arrival. */
export const FinishCardCalmBare: Story = { args: { scenario: 'finish-calm-bare' } };
export const FinishCardBike: Story = { args: { scenario: 'finish-bike' } };
/** The card's footer names the vehicle: a bike ride, on a phone. */
export const FinishCardBikePhone: Story = {
  args: { scenario: 'finish-bike-touch' },
  globals: phone,
};
export const FinishCardTransit: Story = { args: { scenario: 'finish-transit' } };
/** Chained stops (G1): the third stop of a run, with the run line and End run. */
export const FinishCardRun: Story = { args: { scenario: 'finish-run' } };
export const FinishCardRunPhone: Story = { args: { scenario: 'finish-run-touch' }, globals: phone };
/** The run card after End run: three stamped stops, total, best streak, names, story. */
export const RunCard: Story = { args: { scenario: 'finish-run-card' } };
export const RunCardPhone: Story = { args: { scenario: 'finish-run-card-touch' }, globals: phone };
/** Calm mode: no points, no chain bonus. */
/** The Dutch game (#283): the frame shares Storybook's origin, so the language
 *  pref is set before the frame loads and put back when the story unmounts. */
function DutchFrame({ scenario }: { scenario: Scenario }) {
  const KEY = 'canalRecall.language.v1';
  const [previous] = useState(() => {
    try {
      const before = localStorage.getItem(KEY);
      localStorage.setItem(KEY, 'nl');
      return before;
    } catch { return null; }
  });
  useEffect(() => () => {
    try { if (previous === null) localStorage.removeItem(KEY); else localStorage.setItem(KEY, previous); } catch { /* private mode */ }
  }, [previous]);
  return <CanalDriveFrame scenario={scenario} />;
}
export const FinishCardRunDutch: Story = { args: { scenario: 'finish-run' }, render: () => <DutchFrame scenario="finish-run" /> };
export const FinishCardRunDutchPhone: Story = { args: { scenario: 'finish-run-touch' }, render: () => <DutchFrame scenario="finish-run-touch" />, globals: phone };
export const RunCardDutch: Story = { args: { scenario: 'finish-run-card' }, render: () => <DutchFrame scenario="finish-run-card" /> };
export const RunCardDutchPhone: Story = { args: { scenario: 'finish-run-card-touch' }, render: () => <DutchFrame scenario="finish-run-card-touch" />, globals: phone };

export const RunCardCalm: Story = { args: { scenario: 'finish-run-card-calm' } };
export const RunCardCalmPhone: Story = { args: { scenario: 'finish-run-card-calm-touch' }, globals: phone };
export const FinishCardTransitPhone: Story = {
  args: { scenario: 'finish-transit-touch' },
  globals: phone,
};
export const NeighborhoodPhotoCard: Story = { args: { scenario: 'neighborhood' } };
export const NeighborhoodPhotoCardPhone: Story = {
  args: { scenario: 'neighborhood-touch' },
  globals: phone,
};
/** Neighborhood entry with no photo — typography-only postcard. */
export const NeighborhoodFallbackCard: Story = { args: { scenario: 'neighborhood-fallback' } };
/** Landmark trivia and neighborhood postcard sharing the bottom band. */
export const StackedNotices: Story = { args: { scenario: 'stacked-notices' } };
export const LandmarkCard: Story = { args: { scenario: 'landmark-card' } };
/** A drive-by card folded after 8 s keeps its fact (user 2026-10-16, Multatuli: "needs a fact"). */
export const LandmarkCardFolded: Story = { args: { scenario: 'landmark-card-folded' } };
export const LandmarkCardFoldedMobile: Story = {
  args: { scenario: 'landmark-card-folded-touch' },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
/** Landmark card when the extract has no image. */
/** G3: "Which building is this?" — the landmark question, desktop and phone. */
export const LandmarkQuestion: Story = { args: { scenario: 'question-landmark' } };
/** #281: riding up to the landmark the question will ask about; its name and the three distractors' are off the map. */
export const LandmarkApproachWithheld: Story = { args: { scenario: 'landmark-approach' } };
export const LandmarkApproachWithheldPhone: Story = { args: { scenario: 'landmark-approach-touch' }, globals: phone };
export const LandmarkQuestionPhone: Story = { args: { scenario: 'touch-question-landmark' }, globals: phone };
/** G3: a drive-by card with its one-tap "Noticed". */
export const LandmarkCardNoticed: Story = { args: { scenario: 'landmark-card-noticed' } };
export const LandmarkCardNoticedPhone: Story = { args: { scenario: 'landmark-card-noticed-touch' }, globals: phone };
export const LandmarkCardBare: Story = { args: { scenario: 'landmark-card-bare' } };
/** No photo on a phone either: the card is text alone, and still fits. */
export const LandmarkCardBarePhone: Story = {
  args: { scenario: 'landmark-card-bare-touch' },
  globals: phone,
};
/** A 63-character landmark name plus a long extract: the card's name has to
 *  trim, never push the fact off the card. */
export const LandmarkCardLongName: Story = { args: { scenario: 'landmark-card-long' } };
export const LandmarkCardLongNamePhone: Story = {
  args: { scenario: 'landmark-card-long-touch' },
  globals: phone,
};
export const LandmarkPanel: Story = { args: { scenario: 'landmark-panel' } };
export const LandmarkPanelUntranslated: Story = { args: { scenario: 'landmark-panel-dutch' } };
/** The Dutch article on a phone: it has to scroll inside the viewport. */
export const LandmarkPanelUntranslatedPhone: Story = {
  args: { scenario: 'landmark-panel-dutch-touch' },
  globals: phone,
};
export const LandmarkPanelMobile: Story = {
  args: { scenario: 'landmark-panel' },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
/** A correctly named bridge tells why it is called that (no photo). */
export const BridgeOriginCard: Story = { args: { scenario: 'landmark-card-bridge' } };
/** A street's name origin: chip, name and "more" share one compact header. */
export const StreetOriginCard: Story = { args: { scenario: 'landmark-card-street' } };
export const PortraitStreetOriginCard: Story = {
  args: { scenario: 'landmark-card-street-touch' },
  parameters: { viewport: { defaultViewport: 'mobile2' } },
};
/** A clicked ordinary building: year, period, type, listing and size. */
export const BuildingFactsCard: Story = { args: { scenario: 'landmark-card-building' } };
/** A named bridge the register describes but no origin explains. */
export const BridgeRegisterCard: Story = { args: { scenario: 'landmark-card-bridge-register' } };
export const PortraitBridgeRegisterCard: Story = {
  args: { scenario: 'landmark-card-bridge-register-touch' },
  parameters: { viewport: { defaultViewport: 'mobile2' } },
};
export const PortraitBridgeOriginCard: Story = {
  args: { scenario: 'landmark-card-bridge-touch' },
  parameters: { viewport: { defaultViewport: 'mobile2' } },
};
/** A tapped POI label on a blank building (#258): the title is the place, the body what it is. */
export const BuildingPlaceCard: Story = { args: { scenario: 'landmark-card-building-place' } };
export const PortraitBuildingPlaceCard: Story = {
  args: { scenario: 'landmark-card-building-place-touch' },
  parameters: { viewport: { defaultViewport: 'mobile2' } },
};
/** The tapped label with the pand under it resolved: the place's name and kind, then the building's year (#258 follow-up). */
export const BuildingLabelPandCard: Story = { args: { scenario: 'landmark-card-building-label-pand' } };
export const PortraitBuildingLabelPandCard: Story = {
  args: { scenario: 'landmark-card-building-label-pand-touch' },
  parameters: { viewport: { defaultViewport: 'mobile2' } },
};
export const PortraitBuildingFactsCard: Story = {
  args: { scenario: 'landmark-card-building-touch' },
  parameters: { viewport: { defaultViewport: 'mobile2' } },
};
/** A phone is a touch screen: without the touch layout the desktop HUD was
 *  drawn at a quarter size and the card was unreadable. */
export const LandmarkCardMobile: Story = {
  args: { scenario: 'landmark-card-touch' },
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

/** The 'Steer' option's thumbstick, held up-left, so its pressed state is
 *  reviewable. */
export const PortraitHudSteering: Story = {
  args: { scenario: 'touch-hud-steering' },
  parameters: { viewport: { defaultViewport: 'mobile2' } },
};

/** Street following with a left queued: the ◀ stays lit until the bike
 *  reaches a street opening on that side. */
export const PortraitHudStreetQueued: Story = {
  args: { scenario: 'touch-hud-street-queued' },
  parameters: { viewport: { defaultViewport: 'mobile2' } },
};

/** Street following at a T-junction with nothing queued: the arrows pulse to
 *  ask which way. */
export const PortraitHudStreetWaiting: Story = {
  args: { scenario: 'touch-hud-street-waiting' },
  parameters: { viewport: { defaultViewport: 'mobile2' } },
};

/** Landscape, a left queued: the pad sits under the left thumb. */
export const LandscapeHudStreetQueued: Story = {
  args: { scenario: 'touch-hud-street-queued' },
  parameters: { viewport: { defaultViewport: 'mobile2', defaultOrientation: 'landscape' } },
};

/** Mid-question: the street name is withheld and the feedback line is gone,
 *  which is the taller/shorter pair the card stack has to absorb. */
export const PortraitHudAsking: Story = {
  args: { scenario: 'touch-hud-question' },
  parameters: { viewport: { defaultViewport: 'mobile2' } },
};

/** Long street, neighbourhood and destination names plus a cycling-ban
 *  line: the merged plaque has to trim, never overflow. */
export const PortraitHudLongNames: Story = {
  args: { scenario: 'touch-hud-long' },
  parameters: { viewport: { defaultViewport: 'mobile2' } },
};

/** Aboard an IJ ferry on a phone: the notice sits below the plaque and minimap. */
export const PortraitHudFerry: Story = {
  args: { scenario: 'touch-hud-ferry' },
  parameters: { viewport: { defaultViewport: 'mobile2' } },
};

/** Aboard on a phone, 24 m from a pier: the dock hint fits the notice. */
export const PortraitHudFerryDock: Story = {
  args: { scenario: 'touch-hud-ferry-dock' },
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

/** Calm arrival on phone with no landmark photo. */
export const PortraitFinishCardCalmBare: Story = {
  args: { scenario: 'finish-calm-bare-touch' },
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

export const PortraitRouteSetupHere: Story = {
  args: { scenario: 'touch-setup-here' },
  parameters: { viewport: { defaultViewport: 'mobile2' } },
};

/** A home route on a phone: the address field, the home mission line, and
 *  Feedback / How to play in their own row below Start route. */
export const PortraitRouteSetupHome: Story = {
  args: { scenario: 'touch-setup-home' },
  parameters: { viewport: { defaultViewport: 'mobile2' } },
};

/** First-run intro, step 1 of 3: what the ride is and how to steer (keys). */
export const IntroRide: Story = { args: { scenario: 'onboarding-ride' } };
/** Step 2: the question card and how to answer (1–4, 0 for No idea). */
export const IntroNameIt: Story = { args: { scenario: 'onboarding-name' } };
/** Step 3: what the plaque tally means and where learned names live. */
export const IntroScore: Story = { args: { scenario: 'onboarding-score' } };
/** The intro on a phone: a bottom sheet with the ring and tap hints. */
export const IntroRidePhone: Story = {
  args: { scenario: 'touch-onboarding-ride' },
  parameters: { viewport: { defaultViewport: 'mobile2' } },
};
export const IntroNameItPhone: Story = {
  args: { scenario: 'touch-onboarding-name' },
  parameters: { viewport: { defaultViewport: 'mobile2' } },
};
export const IntroScorePhone: Story = {
  args: { scenario: 'touch-onboarding-score' },
  parameters: { viewport: { defaultViewport: 'mobile2' } },
};

export const PortraitKnowledgeReview: Story = {
  args: { scenario: 'touch-knowledge' },
  parameters: { viewport: { defaultViewport: 'mobile2' } },
};

/** G7 (#277): tours as cover cards under More options, desktop and phone. */
export const AdvancedOptionsTours: Story = { args: { scenario: 'advanced-tours' } };
export const AdvancedOptionsToursPhone: Story = {
  args: { scenario: 'touch-advanced-tours' },
  parameters: { viewport: { defaultViewport: 'mobile2' } },
};
/** G7 (#277): the settings panel while riding, with the account chip signed in (long name). */
export const SettingsSignedIn: Story = { args: { scenario: 'settings-signed-in' } };
export const PortraitSettingsSignedIn: Story = {
  args: { scenario: 'touch-settings-signed-in' },
  parameters: { viewport: { defaultViewport: 'mobile2' } },
};
