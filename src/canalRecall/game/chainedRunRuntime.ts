// Chained stops on the Game (G1, #271): records each arrival into the open
// run, deals the next stop 1–3 km away, keeps the run alive while riding,
// ends it on "End run" or ten idle minutes, and draws the run card.
//
// The rules are in chainedRun.ts (pure, tested). Installed onto the
// presentation runtime by `installChainedRun`, so `this` is the Game
// instance; `ChainedRunHost` is the slice of it this file uses. `?run=0`
// restores the single-ride arrival exactly.

import {
  addStop,
  endRun,
  formatPoints,
  isIdle,
  loadRun,
  pauseRun,
  pickNextStop,
  resumeRun,
  runTransition,
  withNextLeg,
  runLine,
  runsEnabled,
  runStory,
  saveRun,
  touchRun,
  type OpenRun,
  type RunGameState,
  type RunLeg,
  type RunSessionCounters,
} from './chainedRun';
import type { MasterySample, RoutePoi } from './routeSelection';
import type { Hud } from './collaborators';
import { t } from '../../i18n/index.ts';

/** Riding refreshes the run's clock at most this often (one localStorage write). */
const RUN_TOUCH_MS = 15_000;

const INK = '#1f1c17';
const MUTED = '#5f584d';
const BODY = '#2e2a23';
const ACCENT = '#8a4a18';
const COPPER = '#c9844a';
const RULE = 'rgba(31,28,23,0.16)';

type FinishId = 'again' | 'route' | 'copy' | 'end';
type Bounds = { x: number; y: number; w: number; h: number };

interface PoiPoint { id: string; name: string; lat: number; lng: number }

export interface ChainedRunHost {
  ctx: CanvasRenderingContext2D;
  hud: Hud;
  state: number;
  viewport: { mode: string; width: number; height: number };
  input: { wasPressed(code: string): boolean };
  gameyFeatures: boolean;
  freeRide?: boolean;
  travelMode: string;
  cityId: string;
  routeFrom: { id: string; name: string } | null;
  routeTo: ({ id: string; name: string; tourStop?: boolean } & Partial<PoiPoint>) | null;
  routePois: RoutePoi[];
  raceTime: number;
  quizPoints: number;
  quizBestStreak: number;
  _rideNamedNames?: string[];
  _tour?: unknown;
  _tourArrival?: unknown;
  recall: { homeMasterySamples?(cityId: string): MasterySample[] } | null;
  _finishButtonBounds?: Array<Bounds & { id: FinishId }>;
  _finishCardBounds?: Bounds;
  _runFinishAction(id: 'again' | 'route' | 'copy'): void;

  /** Storybook's single-ride states: the same as `?run=0`. */
  _runsOff?: boolean;
  _run?: OpenRun | null;
  _runLoaded?: boolean;
  /** The finished run on show; replaces the arrival card until the next ride. */
  _runCard?: OpenRun | null;
  _runRecordedKey?: string;
  _runTouchedAt?: number;
  /** Game state at the last tick, for run transitions (route setup closes, pause stops the clock). */
  _runLastState?: number;
}

type SessionWindow = Window & { __canalRecallSession?: Partial<RunSessionCounters> & Record<string, unknown> };

/** The dev's local play counters (gameplay plan, Measurement). Nothing is sent. */
function sessionCounters(): Partial<RunSessionCounters> & Record<string, unknown> {
  const win = window as SessionWindow;
  win.__canalRecallSession ||= {};
  const session = win.__canalRecallSession;
  session.ridesThisSession ??= 0;
  session.stopsThisRun ??= 0;
  session.runsEnded ??= 0;
  session.stopsPerRun ??= [];
  return session;
}

function storage(): Storage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}

export class GameChainedRunRuntime {
  /** Whether this ride takes part in a run: not `?run=0`, not a tour, not Free Ride. */
  _runEnabled(this: ChainedRunHost): boolean {
    return runsEnabled(window.location.search) && !this._runsOff && !this._tour && !this.freeRide;
  }

  /** The open run, read from localStorage once per page (a reload continues it). */
  _openRun(this: ChainedRunHost & GameChainedRunRuntime): OpenRun | null {
    if (!this._runLoaded) {
      this._runLoaded = true;
      const loaded = loadRun(storage(), Date.now());
      this._run = loaded.run;
      sessionCounters().stopsThisRun = loaded.run?.stopCount ?? 0;
    }
    return this._run ?? null;
  }

  /**
   * Once per arrival: the stop joins the open run. Called from the arrival
   * card's first frame, after game.js has saved the ride's exploration.
   */
  _recordRunStop(this: ChainedRunHost & GameChainedRunRuntime): void {
    const to = this.routeTo;
    if (!to) return;
    // Once per arrival: the flag is cleared whenever the card is not up (_runTick).
    if (this._runRecordedKey) return;
    this._runRecordedKey = `${this.routeFrom?.id ?? ''}>${to.id}`;
    this._runCard = null;
    const session = sessionCounters();
    session.ridesThisSession = (session.ridesThisSession ?? 0) + 1;
    if (!this._runEnabled()) return;
    const { run } = addStop(this._openRun(), {
      id: to.id, name: to.name, fromName: this.routeFrom?.name ?? '',
      points: this.quizPoints || 0, bestStreak: this.quizBestStreak || 0,
      names: this._rideNamedNames || [],
    }, Date.now());
    this._run = run;
    this._runTouchedAt = Date.now();
    saveRun(storage(), run);
    session.stopsThisRun = run.stopCount;
  }

  /** Per frame: keeps a riding run alive, ends one left idle on the arrival card, and takes E there. */
  _runTick(this: ChainedRunHost & GameChainedRunRuntime): void {
    if (this.state !== GameState.FINISHED) this._runRecordedKey = '';
    if (!runsEnabled(window.location.search)) return;
    const now = Date.now();
    const previous = this._runLastState ?? this.state;
    this._runLastState = this.state;
    if (previous !== this.state) this._runStateChanged(previous, now);
    const run = this._openRun();
    if (this.state === GameState.RACING) {
      if (this._runCard) this._runCard = null;
      if (run && this._runEnabled() && now - (this._runTouchedAt ?? 0) >= RUN_TOUCH_MS) {
        this._runTouchedAt = now;
        this._run = touchRun(run, now);
        saveRun(storage(), this._run);
      }
      return;
    }
    if (this.state !== GameState.FINISHED) {
      if (this._runCard) this._runCard = null;
      return;
    }
    if (run && isIdle(run, now)) { this._endRunFromCard(); return; }
    // game.js reads Enter/M/C on the arrival card; E (End run) is this lane's.
    if (run && !this._runCard && this.input.wasPressed('KeyE')) this._endRunFromCard();
  }

  /** Route setup from the arrival card closes the run quietly; pause stops its idle clock. */
  _runStateChanged(this: ChainedRunHost & GameChainedRunRuntime, previous: number, now: number): void {
    const name = (state: number): RunGameState => state === GameState.MENU ? 'menu'
      : state === GameState.RACING ? 'racing' : state === GameState.FINISHED ? 'finished'
        : state === GameState.PAUSED ? 'paused' : 'other';
    const run = this._openRun();
    if (!run) return;
    const step = runTransition(name(previous), name(this.state));
    if (step === 'close') { this._closeRun(false); return; }
    if (step === 'pause') this._run = pauseRun(run, now);
    else if (step === 'resume') this._run = resumeRun(run, now);
    else return;
    saveRun(storage(), this._run);
  }

  /** Ends the open run into lastRun and the counters; with `card`, the run card shows it. */
  _closeRun(this: ChainedRunHost & GameChainedRunRuntime, card: boolean): void {
    const run = this._openRun();
    if (!run) return;
    endRun(storage(), run);
    this._run = null;
    this._runCard = card ? run : null;
    const session = sessionCounters();
    session.runsEnded = (session.runsEnded ?? 0) + 1;
    session.stopsPerRun = [...(session.stopsPerRun ?? []), run.stopCount];
    session.stopsThisRun = 0;
  }

  /**
   * The dealt leg to ride again after a reload, or null. For the startup hook
   * in game-route.js `_checkShareLink` (integrator applies it at merge).
   */
  _runResumeLeg(this: ChainedRunHost & GameChainedRunRuntime): RunLeg | null {
    if (!this._runEnabled()) return null;
    return this._openRun()?.nextLeg ?? null;
  }

  /** End run: the run card replaces the arrival card. */
  _endRunFromCard(this: ChainedRunHost & GameChainedRunRuntime): void {
    this._closeRun(true);
  }

  /** Arrival-card tap targets beyond game.js's three. */
  _runFinishTap(this: ChainedRunHost & GameChainedRunRuntime, id: FinishId): void {
    if (id === 'end') this._endRunFromCard();
    else this._runFinishAction(id);
  }

  /**
   * The next stop for Next stop (game-route.js `_startNextRouteFromArrival`,
   * after a due review ride): 1–3 km from the arrival, favouring streets the
   * rider does not know yet, never a stop this run has reached. Null outside
   * a run (`?run=0`, tours, Free Ride), which keeps the surprise pick.
   */
  _pickRunNextStop(this: ChainedRunHost & GameChainedRunRuntime, from: PoiPoint): PoiPoint | null {
    this._runCard = null;
    if (!this._runEnabled()) return null;
    const run = this._openRun();
    const samples = this.recall?.homeMasterySamples?.(this.cityId || 'amsterdam') ?? [];
    const excludeIds = [...(run?.stops.map(stop => stop.id) ?? []), this.routeFrom?.id ?? ''].filter(Boolean);
    const to = pickNextStop(this.routePois, from, { samples, excludeIds });
    if (this._run) {
      const point = (p: PoiPoint) => ({ id: p.id, name: p.name, lat: p.lat, lng: p.lng });
      this._run = withNextLeg(touchRun(this._run, Date.now()), to ? { from: point(from), to: point(to) } : null);
      saveRun(storage(), this._run);
    }
    return to;
  }

  /** The arrival card's one run line, or null outside a run. */
  _runArrivalLine(this: ChainedRunHost & GameChainedRunRuntime): string | null {
    if (!this._runEnabled()) return null;
    const run = this._openRun();
    return run ? runLine(run, { calm: !this.gameyFeatures }) : null;
  }

  /** The run card: stamped stops, total, best streak, names, one line of story. */
  _renderRunCard(this: ChainedRunHost & GameChainedRunRuntime, run: OpenRun): void {
    const ctx = this.ctx;
    const W = this.viewport.width, H = this.viewport.height;
    ctx.fillStyle = 'rgba(28,24,18,.34)';
    ctx.fillRect(0, 0, W, H);
    const compact = this.viewport.mode === 'compact';
    const calm = !this.gameyFeatures;
    const cardW = Math.min(520, W - 24);
    const padX = compact ? 18 : 30;
    const cx = W / 2;
    const cardX = cx - cardW / 2;
    const innerW = cardW - padX * 2;
    const font = window.CanalRecallUi.hudSurface.fontMono;
    ctx.font = '13px system-ui, sans-serif';
    const story = wrapText(ctx, runStory(run), innerW, 2);
    const ROW = 30;
    const MARGIN = 16;
    const bottomReserve = compact ? 76 : MARGIN;
    const BUTTON_H = 44;
    const actionsH = compact ? BUTTON_H * 2 + 8 : 34;
    const fixedH = 30 + 74 + story.length * 18 + 16 + 24 + 64 + 24 + actionsH + 26;
    const room = H - MARGIN - bottomReserve;
    const listRows = Math.max(1, Math.min(run.stops.length, Math.floor((room - fixedH) / ROW)));
    const hidden = run.stopCount - listRows;
    const shown = run.stops.slice(-listRows);
    const cardH = fixedH + listRows * ROW;
    const scale = Math.min(1, room / cardH);
    const cardY = scale < 1 ? MARGIN : Math.max(MARGIN, Math.min(Math.round((H - cardH) / 2), H - cardH - bottomReserve));
    ctx.save();
    if (scale < 1) { ctx.translate(cx, cardY); ctx.scale(scale, scale); ctx.translate(-cx, -cardY); }
    this.hud.paperCard(ctx, { x: cardX, y: cardY, width: cardW, height: cardH }, { solid: true, radius: 16 });
    const rule = (y: number) => {
      ctx.strokeStyle = RULE; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cardX + padX, y + 0.5); ctx.lineTo(cardX + cardW - padX, y + 0.5); ctx.stroke();
    };
    let y = cardY + 30;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = ACCENT; ctx.font = `700 11px ${font}`;
    ctx.fillText(t('run.complete'), cardX + padX, y + 11);
    ctx.fillStyle = INK; ctx.font = '800 26px system-ui, sans-serif';
    ctx.fillText(t(run.stopCount === 1 ? 'count.stops.one' : 'count.stops.other', { count: run.stopCount }), cardX + padX, y + 42);
    y += 74;
    ctx.fillStyle = BODY; ctx.font = '13px system-ui, sans-serif';
    story.forEach((line, index) => ctx.fillText(line, cardX + padX, y - 8 + index * 18));
    y += story.length * 18;
    rule(y); y += 16;

    // The stops, stamped: a numbered copper ring each, the place, its points.
    ctx.fillStyle = MUTED; ctx.font = `700 11px ${font}`;
    ctx.fillText(hidden > 0 ? t('run.stopsLast', { shown: listRows, count: run.stopCount }) : t('run.stops'), cardX + padX, y + 4);
    y += 24;
    shown.forEach((stop, index) => {
      const number = run.stopCount - shown.length + index + 1;
      const sy = y + index * ROW;
      ctx.strokeStyle = ACCENT; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cardX + padX + 11, sy + 4, 11, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = ACCENT; ctx.font = `700 11px ${font}`; ctx.textAlign = 'center';
      ctx.fillText(String(number), cardX + padX + 11, sy + 8);
      ctx.textAlign = 'left';
      const pointsText = calm ? '' : `${formatPoints(stop.points)}${stop.bonus > 0 ? `  +${Math.round(stop.bonus * 100)} %` : ''}`;
      ctx.font = `12px ${font}`;
      const pointsW = pointsText ? ctx.measureText(pointsText).width + 12 : 0;
      ctx.fillStyle = INK; ctx.font = '600 14px system-ui, sans-serif';
      ctx.fillText(wrapText(ctx, stop.name, innerW - 32 - pointsW, 1)[0] ?? '', cardX + padX + 32, sy + 9);
      if (pointsText) {
        ctx.textAlign = 'right'; ctx.fillStyle = MUTED; ctx.font = `12px ${font}`;
        ctx.fillText(pointsText, cardX + cardW - padX, sy + 9);
        ctx.textAlign = 'left';
      }
    });
    y += listRows * ROW;
    rule(y); y += 16;

    const stats = calm
      ? [{ label: t('ride.stat.stops'), value: String(run.stopCount) }, { label: t('ride.stat.names'), value: String(run.names.length) }]
      : [
        { label: t('ride.stat.points'), value: formatPoints(run.totalPoints) },
        { label: t('ride.stat.bestStreak'), value: String(run.bestStreak) },
        { label: t('ride.stat.names'), value: String(run.names.length) },
      ];
    ctx.textAlign = 'center';
    stats.forEach((stat, index) => {
      const sx = cardX + padX + (innerW / stats.length) * (index + 0.5);
      ctx.fillStyle = INK; ctx.font = `700 ${compact ? 19 : 21}px ${font}`;
      ctx.fillText(stat.value, sx, y + 24);
      ctx.fillStyle = MUTED; ctx.font = '11px system-ui, sans-serif';
      ctx.fillText(stat.label, sx, y + 42);
    });
    y += 64;
    rule(y); y += 24;

    const actions: Array<{ id: FinishId; key: string; caption: string }> = [
      { id: 'again', key: 'ENTER', caption: t('ride.newRun') },
      { id: 'route', key: compact ? '' : 'M', caption: t('ride.routeSetup') },
    ];
    const buttons: Array<Bounds & { id: FinishId }> = [];
    if (compact) {
      actions.forEach((action, index) => {
        const bounds = { x: cardX + padX, y: y + index * (BUTTON_H + 8), w: innerW, h: BUTTON_H };
        const primary = index === 0;
        ctx.fillStyle = primary ? COPPER : 'rgba(31,28,23,.05)';
        roundRect(ctx, bounds.x, bounds.y, bounds.w, bounds.h, 12); ctx.fill();
        if (!primary) { ctx.strokeStyle = RULE; ctx.lineWidth = 1; ctx.stroke(); }
        ctx.fillStyle = INK; ctx.font = '700 14px system-ui, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(action.caption, bounds.x + bounds.w / 2, bounds.y + 28);
        buttons.push({ ...bounds, id: action.id });
      });
    } else {
      ctx.textAlign = 'left';
      let ax = cardX + padX;
      for (const action of actions) {
        ctx.font = `700 11px ${font}`;
        const keyW = ctx.measureText(action.key).width + 14;
        ctx.fillStyle = 'rgba(31,28,23,.08)';
        roundRect(ctx, ax, y + 4, keyW, 20, 5); ctx.fill();
        ctx.fillStyle = INK; ctx.fillText(action.key, ax + 7, y + 18);
        ax += keyW + 8;
        ctx.fillStyle = MUTED; ctx.font = '12px system-ui, sans-serif';
        ctx.fillText(action.caption, ax, y + 18);
        const captionW = ctx.measureText(action.caption).width;
        buttons.push({ x: ax - keyW - 8, y, w: keyW + 8 + captionW, h: 28, id: action.id });
        ax += captionW + 22;
      }
    }
    ctx.restore();
    ctx.textAlign = 'center';
    for (const bounds of buttons) {
      bounds.x = cx + (bounds.x - cx) * scale;
      bounds.y = cardY + (bounds.y - cardY) * scale;
      bounds.w *= scale; bounds.h *= scale;
    }
    this._finishButtonBounds = buttons;
    this._finishCardBounds = { x: cx - (cardW / 2) * scale, y: cardY, w: cardW * scale, h: cardH * scale };
  }
}

export function installChainedRun(target: { prototype: object }): void {
  for (const name of Object.getOwnPropertyNames(GameChainedRunRuntime.prototype)) {
    if (name === 'constructor') continue;
    Object.defineProperty(target.prototype, name, Object.getOwnPropertyDescriptor(GameChainedRunRuntime.prototype, name)!);
  }
}
