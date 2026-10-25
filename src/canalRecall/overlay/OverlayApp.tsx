import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from 'react';
import { SiteSwitch } from '../../components/SiteSwitch.tsx';
import { AccountChip } from '../../components/AccountChip.tsx';
import { canalPageLinks } from '../../siteLinks.ts';
import { ArrowLeft, BookOpenCheck, ChevronDown, Clock3, Search } from 'lucide-react';
import {
  ASK_BUDGETS,
  CAMERA_TILT_MAX,
  CAMERA_TILT_MIN,
  isPitchedView,
  playableCities,
  type CanalPreferences,
  type ZoomClamp,
} from '../game/preferences.ts';
import { difficultyGloss } from '../game/setupCopy.ts';
import {
  loadKnowledgeReview,
  type KnowledgeItem,
  type KnowledgeReview,
  type KnowledgeStatus,
} from '../knowledgeReview.ts';
import type { OverlayStore } from './store.ts';
import {
  DIFFICULTY_ICONS,
  EnamelIcon,
  ROUTE_ICONS,
  TRAVEL_ICONS,
  VIEW_ICONS,
} from './enamelIcons.tsx';
import { useT, type Translate } from '../../i18n/useT.ts';
import { LanguageSwitch } from '../../components/LanguageSwitch.tsx';

/** The ride's own links to the landing page and Map Quest, by where this page is served. */
const siteLinksHere = canalPageLinks(typeof location === 'undefined' ? '/' : location.pathname);

export interface OverlayCallbacks {
  zoom: ZoomClamp;
  onStart: () => void;
  onLiveChange: () => void;
  onAccountClick: () => void;
  onClearKnowledge: () => void;
  onClearAllData: () => void;
  onPracticeAgain: (itemKey: string) => void;
  /** Hard reset one named item after the host confirms with the player. */
  onForgetItem: (itemKey: string, name: string) => void;
  onSkipMastered: (enabled: boolean) => void;
  onCloseSettings: () => void;
  /** Leave the current ride and reopen route setup. */
  onNewRoute: () => void;
}

/** An on/off setting drawn as the same paper tile as a choice. A real
    checkbox sits inside so ids, `.checked` and Space keep working. */
function ToggleTile({
  id, checked, onChange, title, hint, hidden,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  hint?: string;
  hidden?: boolean;
}) {
  return (
    <label
      className={`setup-choice enamel-tile toggle-tile${checked ? ' active' : ''}`}
      style={hidden ? { display: 'none' } : undefined}
      title={hint || title}
    >
      <input id={id} type="checkbox" className="toggle-tile-input" checked={checked} onChange={event => onChange(event.target.checked)} />
      <span className="toggle-tile-mark" aria-hidden="true" />
      <span className="setup-choice-text">
        <strong>{title}</strong>
        {hint ? <small>{hint}</small> : null}
      </span>
    </label>
  );
}

function ToggleGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="setup-choice-row toggles" role="group" aria-label={label}>
      <div className="setup-choice-label"><span>{label}</span></div>
      <div className="setup-choice-options">{children}</div>
    </div>
  );
}

function RangeRow({
  label, keys, id, min, max, step, value, onChange,
}: {
  label: string;
  /** Keyboard shortcut, shown only to pointer players. */
  keys?: string;
  id: string;
  min: number | string;
  max: number | string;
  step: number | string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="setup-choice-row range-row">
      <span className="setup-choice-label">
        <span>{label}</span>
        {keys ? <span className="setup-choice-current key-hint">{keys}</span> : null}
      </span>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={event => onChange(Number(event.target.value))} />
    </label>
  );
}

type Choice<T extends string> = {
  value: T;
  title: string;
  hint?: string;
};

type ChoiceLayout = 'tiles' | 'strip' | 'icons';

function ChoiceRow<T extends string>({
  label,
  name,
  value,
  onChange,
  options,
  compact = false,
  layout = 'tiles',
  icons,
  gloss,
  showCurrent = false,
  keepGloss = false,
}: {
  label: string;
  name: string;
  value: T;
  onChange: (value: T) => void;
  options: readonly Choice<T>[];
  compact?: boolean;
  /** `strip` = equal one-line buttons; `icons` = icon-led compact strip. */
  layout?: ChoiceLayout;
  icons?: Partial<Record<T, import('lucide-react').LucideIcon | null>>;
  gloss?: string;
  /** Show the selected option title beside the section label (helps icon-only rows). */
  showCurrent?: boolean;
  /** Keep the gloss on a phone too: it explains the current choice, which an
   *  icon or a bare level name cannot. */
  keepGloss?: boolean;
}) {
  const rowClass = [
    'setup-choice-row',
    compact ? 'compact' : '',
    layout === 'strip' ? 'strip' : '',
    layout === 'icons' ? 'icons' : '',
  ].filter(Boolean).join(' ');
  const currentTitle = options.find(option => option.value === value)?.title;

  return (
    <div className={rowClass} role="radiogroup" aria-label={label}>
      <div className="setup-choice-label">
        <span>{label}</span>
        {showCurrent && currentTitle ? (
          <span className="setup-choice-current">{currentTitle}</span>
        ) : null}
      </div>
      {gloss ? <p className={`setup-choice-gloss${keepGloss ? ' keep' : ''}`} data-gloss={name}>{gloss}</p> : null}
      <div
        className="setup-choice-options"
        style={layout !== 'tiles' ? { gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` } : undefined}
      >
        {options.map(option => {
          const Icon = icons?.[option.value];
          const showHint = layout === 'tiles' && !!option.hint;
          const a11y = option.hint ? `${option.title}. ${option.hint}` : option.title;
          return (
            <button
              key={option.value}
              type="button"
              className={`setup-choice enamel-tile${value === option.value ? ' active' : ''}`}
              aria-pressed={value === option.value}
              aria-label={a11y}
              title={option.hint || option.title}
              data-choice={`${name}:${option.value}`}
              onClick={() => onChange(option.value)}
            >
              {Icon ? <EnamelIcon icon={Icon} label={option.title} /> : null}
              {layout === 'icons' ? null : (
                <span className="setup-choice-text">
                  <strong>{option.title}</strong>
                  {showHint ? <small>{option.hint}</small> : null}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** The ride is Amsterdam-only (2026-10-22): the city picker is gone, and no
    stored, shared or patched preference may start another extract. */
const RIDE_CITY = 'amsterdam' as const;
const RIDE_CITY_NAME = 'Amsterdam';

/** Off-screen controls for the review scripts and Playwright: they drive
    destinations and tours by id, so the elements stay in the DOM while the
    setup card itself no longer shows either picker. */
function AutomationSelects({
  store,
  routePois,
  destinationId,
  tours,
  tourId,
}: {
  store: OverlayStore;
  routePois: readonly { id: string; name: string }[];
  destinationId: string;
  tours: readonly { id: string; title: string }[];
  tourId: string;
}) {
  const t = useT();
  return (
    <div className="setup-automation-controls">
      <select
        id="city-id"
        hidden
        value={RIDE_CITY}
        aria-hidden="true"
        tabIndex={-1}
      >
        <option value={RIDE_CITY}>{RIDE_CITY_NAME}</option>
      </select>
      <select
        id="poi-destination"
        value={destinationId}
        aria-label="Destination"
        aria-hidden="true"
        tabIndex={-1}
        onChange={event => store.setDestinationId(event.target.value)}
      >
        <option value="">Surprise me</option>
        {[...routePois].sort((a, b) => a.name.localeCompare(b.name)).map(poi => (
          <option key={poi.id} value={poi.id}>{poi.name}</option>
        ))}
      </select>
      {tours.length ? (
        <select
          id="tour-picker"
          value={tourId}
          aria-label="Tours"
          aria-hidden="true"
          tabIndex={-1}
          onChange={event => store.setTourId(event.target.value)}
        >
          <option value="">No tour</option>
          {tours.map(tour => (
            <option key={tour.id} value={tour.id}>{tour.title}</option>
          ))}
        </select>
      ) : null}
    </div>
  );
}

/**
 * Choice rows are built from the catalog rather than declared as constants:
 * a module-level `title: 'Boat'` would be frozen in the language that happened
 * to be active when the bundle loaded, and a toggle would leave the setup
 * screen half translated.
 */
const travelChoices = (t: Translate): Choice<CanalPreferences['travelMode']>[] => [
  { value: 'boat', title: t('setup.travel.boat') },
  { value: 'car', title: t('setup.travel.bike') },
  { value: 'transit', title: t('setup.travel.transit') },
];

const viewChoices = (t: Translate): Choice<CanalPreferences['viewMode']>[] => [
  { value: 'north', title: t('setup.view.north'), hint: t('setup.view.northHint') },
  { value: 'heading', title: t('setup.view.heading'), hint: t('setup.view.headingHint') },
  { value: 'chase', title: t('setup.view.chase'), hint: t('setup.view.chaseHint') },
];

const buildingLookChoices = (t: Translate): Choice<CanalPreferences['buildingLook']>[] => [
  { value: 'photo', title: t('setup.look.photo'), hint: t('setup.look.photoHint') },
  { value: 'procedural', title: t('setup.look.procedural'), hint: t('setup.look.proceduralHint') },
  { value: 'storybook', title: t('setup.look.storybook'), hint: t('setup.look.storybookHint') },
  { value: 'cartoon', title: t('setup.look.cartoon'), hint: t('setup.look.cartoonHint') },
  { value: 'untextured', title: t('setup.look.untextured'), hint: t('setup.look.untexturedHint') },
];

const routeChoices = (t: Translate): Choice<CanalPreferences['routePattern']>[] => [
  { value: 'surprise', title: t('setup.route.surprise'), hint: t('setup.route.surpriseHint') },
  { value: 'home', title: t('setup.route.home'), hint: t('setup.route.homeHint') },
  { value: 'here', title: t('setup.route.here'), hint: t('setup.route.hereHint') },
  { value: 'free', title: t('setup.route.free'), hint: t('setup.route.freeHint') },
];

const controlChoices = (t: Translate): Choice<CanalPreferences['controlMode']>[] => [
  { value: 'relative', title: t('options.controls.steer'), hint: t('options.controls.steerHint') },
  { value: 'absolute', title: t('options.controls.point'), hint: t('options.controls.pointHint') },
];

const askBudgetChoices = (t: Translate): Choice<string>[] => [
  { value: '1', title: '1' },
  { value: '2', title: '2' },
  { value: '3', title: '3' },
  { value: '5', title: '5' },
  { value: '0', title: t('common.off') },
];

const answerChoices = (t: Translate): Choice<CanalPreferences['answerMode']>[] => [
  { value: 'multiple', title: t('options.answers.choose'), hint: t('options.answers.chooseHint') },
  { value: 'typing', title: t('options.answers.type'), hint: t('options.answers.typeHint') },
];

const difficultyMain = (t: Translate): Choice<CanalPreferences['difficulty']>[] => [
  { value: 'easy', title: t('setup.difficulty.easy') },
  { value: 'medium', title: t('setup.difficulty.medium') },
  { value: 'hard', title: t('setup.difficulty.hard') },
];

const difficultyExtra = (t: Translate): Choice<CanalPreferences['difficulty']>[] => [
  { value: 'expert', title: t('setup.difficulty.expert') },
  { value: 'custom', title: t('setup.difficulty.custom') },
];

/**
 * The ride options, drawn once and used by both route setup ("More options")
 * and the in-ride settings panel, so the two never drift into different
 * controls for the same preference. `live` pushes each change into the ride
 * and prefixes ids so both copies can sit in the DOM together.
 */
function RideOptions({
  prefs,
  patch,
  live = false,
}: {
  prefs: CanalPreferences;
  patch: (next: Partial<CanalPreferences>, live?: boolean) => void;
  live?: boolean;
}) {
  const set = (next: Partial<CanalPreferences>) => patch(next, live);
  const id = (setupId: string, liveId: string) => (live ? liveId : setupId);
  const name = (base: string) => (live ? `live-${base}` : base);
  const threeD = isPitchedView(prefs.viewMode);
  const t = useT();
  const views = viewChoices(t);
  return (
    <>
      {live ? (
        <ChoiceRow
          label={t('setup.view')}
          name={name('view')}
          value={prefs.viewMode}
          onChange={value => set({ viewMode: value })}
          options={views}
          icons={VIEW_ICONS}
          layout="icons"
          showCurrent
          gloss={views.find(option => option.value === prefs.viewMode)?.hint}
          keepGloss
        />
      ) : null}
      {live && threeD ? (
        <>
          <RangeRow label={t('options.tilt')} keys="[ ]" id="live-tilt" min={CAMERA_TILT_MIN} max={CAMERA_TILT_MAX} step="1"
            value={prefs.cameraTilt} onChange={cameraTilt => set({ cameraTilt })} />
          <RangeRow label={t('options.spin')} keys="Shift + [ ]" id="live-bearing" min="-180" max="180" step="5"
            value={prefs.cameraBearing} onChange={cameraBearing => set({ cameraBearing })} />
        </>
      ) : null}
      <RangeRow label={t('options.zoom')} id={id('camera-zoom', 'live-zoom')} min="0.1" max="1.3" step="0.05"
        value={prefs.zoom} onChange={zoom => set({ zoom })} />
      <ChoiceRow
        label={t('setup.look')}
        name={name('building-look')}
        value={prefs.buildingLook}
        onChange={value => set({ buildingLook: value })}
        options={buildingLookChoices(t)}
      />
      <ChoiceRow
        label={t('options.controls')}
        name={name('controls')}
        value={prefs.controlMode}
        onChange={value => set({ controlMode: value })}
        options={controlChoices(t)}
      />
      <ChoiceRow
        label={t('options.answers')}
        name={name('answers')}
        value={prefs.answerMode}
        onChange={value => set({ answerMode: value })}
        options={answerChoices(t)}
      />
      <ChoiceRow
        label={t('options.asksPerMinute')}
        name={name('asks-per-minute')}
        value={String(prefs.maxAsksPerMinute)}
        onChange={value => set({ maxAsksPerMinute: Number(value) as CanalPreferences['maxAsksPerMinute'] })}
        options={askBudgetChoices(t)}
        layout="strip"
        gloss={t('options.asksPerMinuteGloss')}
      />
      <ToggleGroup label={t('options.onTheMap')}>
        <ToggleTile id={id('assist-line', 'live-line')} checked={prefs.line} onChange={line => set({ line })} title={t('options.routeLine')} />
        <ToggleTile id={id('assist-arrow', 'live-arrow')} checked={prefs.arrow} onChange={arrow => set({ arrow })} title={t('options.arrow')} hint={t('options.arrowHint')} />
        <ToggleTile id={id('assist-minimap', 'live-minimap')} checked={prefs.minimap} onChange={minimap => set({ minimap })} title={t('options.minimap')} />
        <ToggleTile id={id('gamey-features', 'live-gamey')} checked={prefs.gamey} onChange={gamey => set({ gamey })} title={t('options.scores')} hint={t('options.scoresHint')} />
      </ToggleGroup>
      <ToggleGroup label={t('options.comfort')}>
        <ToggleTile id={id('reduced-motion', 'live-reduced-motion')} checked={prefs.reducedMotion} onChange={reducedMotion => set({ reducedMotion })} title={t('options.lessMotion')} />
        <ToggleTile id={id('trees-enabled', 'live-trees')} checked={prefs.trees} onChange={trees => set({ trees })} title={t('options.trees')} />
      </ToggleGroup>
    </>
  );
}

const HOME_RADIUS_STORAGE_KEY = 'canalRecall.homeLearningRadius.v1';

function homeLearningNote(prefs: CanalPreferences, t: Translate): string {
  const base = t('setup.homeAddress.saved');
  if (prefs.routePattern !== 'home') return base;
  try {
    const raw = localStorage.getItem(HOME_RADIUS_STORAGE_KEY);
    if (!raw) return base;
    const saved = JSON.parse(raw) as { cityId?: string; address?: string; radiusKm?: number };
    const address = (prefs.homeAddress || '').trim();
    if (!address || saved.address !== address || saved.cityId !== prefs.cityId) return base;
    if (!(typeof saved.radiusKm === 'number') || !(saved.radiusKm > 0)) return base;
    return t('setup.homeAddress.learning', { km: saved.radiusKm.toFixed(1) });
  } catch {
    return base;
  }
}


type KnowledgeFilter = KnowledgeStatus | 'all';

function knowledgeFilters(t: Translate): Array<{ value: KnowledgeFilter; label: string }> {
  return [
    { value: 'due', label: t('knowledge.filter.due') },
    { value: 'learning', label: t('knowledge.filter.learning') },
    { value: 'known', label: t('knowledge.filter.known') },
    { value: 'mastered', label: t('knowledge.filter.mastered') },
    { value: 'all', label: t('knowledge.filter.all') },
  ];
}

function relativeReviewTime(item: KnowledgeItem, now: number, t: Translate): string {
  const difference = item.dueAt - now;
  const absolute = Math.abs(difference);
  const amount = absolute < 3_600_000
    ? Math.max(1, Math.round(absolute / 60_000))
    : absolute < 86_400_000
      ? Math.round(absolute / 3_600_000)
      : Math.round(absolute / 86_400_000);
  const unit = absolute < 3_600_000
    ? t('knowledge.unit.min')
    : absolute < 86_400_000 ? t('knowledge.unit.hour') : t('knowledge.unit.day');
  if (difference <= 0) return t('knowledge.overdue', { amount, unit });
  return t('knowledge.inFuture', { amount, unit });
}

/** A route error either arrives as text (a network message) or as `#key` from
 *  the legacy runtime, so a language switch re-reads it instead of leaving the
 *  visible line in the other language. */
function routeErrorText(error: string, t: Translate): string {
  if (!error) return '';
  return error.startsWith('#') ? t(error.slice(1) as Parameters<Translate>[0]) : error;
}

function cityLabel(cityId: string): string {
  return playableCities().find(city => city.id === cityId)?.name
    || cityId.replace(/(^|-)([a-z])/g, (_match, separator, letter) => `${separator ? ' ' : ''}${letter.toUpperCase()}`);
}

function KnowledgeReviewScreen({
  review,
  now,
  onClose,
  backLabel,
  onPlanReview,
  onPracticeAgain,
  onForgetItem,
}: {
  review: KnowledgeReview;
  now: number;
  onClose: () => void;
  backLabel: string;
  onPlanReview: () => void;
  onPracticeAgain: (itemKey: string) => void;
  onForgetItem: (itemKey: string, name: string) => void;
}) {
  const [filter, setFilter] = useState<KnowledgeFilter>(review.due ? 'due' : 'all');
  const [query, setQuery] = useState('');
  const t = useT();
  const filters = knowledgeFilters(t);
  const visibleItems = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return review.items.filter(item => (filter === 'all' || item.status === filter)
      && (!term || item.name.toLocaleLowerCase().includes(term) || cityLabel(item.cityId).toLocaleLowerCase().includes(term)));
  }, [filter, query, review.items]);
  const maxActivity = Math.max(1, ...review.activity.map(day => day.reviews));
  // A full-screen view takes focus, and Escape leaves it, like any dialog.
  const backRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    backRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <section id="knowledge-review" className="knowledge-review" aria-labelledby="knowledge-review-title">
      <header className="knowledge-header">
        <button type="button" className="knowledge-back" onClick={onClose} ref={backRef}>
          <ArrowLeft aria-hidden="true" />
          {backLabel}
        </button>
        <div>
          <h1 id="knowledge-review-title">{t('knowledge.title')}</h1>
          <p>{t('knowledge.subtitle')}</p>
        </div>
        <button
          type="button"
          className="enamel-plaque enamel-framed knowledge-plan"
          onClick={onPlanReview}
          disabled={review.due === 0}
        >
          <BookOpenCheck aria-hidden="true" />
          {review.due ? t('knowledge.plan', { count: review.due }) : t('knowledge.nothingDue')}
        </button>
      </header>

      {review.tracked === 0 ? (
        <div className="knowledge-empty">
          <div className="knowledge-empty-mark" aria-hidden="true"><BookOpenCheck /></div>
          <h2>{t('knowledge.emptyTitle')}</h2>
          <p>{t('knowledge.emptyBody')}</p>
          <button type="button" className="enamel-plaque enamel-framed knowledge-plan" onClick={onClose}>{t('knowledge.firstRoute')}</button>
        </div>
      ) : (
        <div className="knowledge-layout">
          <aside className="knowledge-summary" aria-label={t('knowledge.summary')}>
            <div className="knowledge-due-block">
              <strong>{review.due}</strong>
              <span>{t('knowledge.dueNow')}</span>
              <p>{review.due ? t('knowledge.dueNowBody') : t('knowledge.caughtUp')}</p>
            </div>
            <dl className="knowledge-stat-list">
              <div><dt>{t('knowledge.tracked')}</dt><dd>{review.tracked}</dd></div>
              <div><dt>{t('knowledge.mastered')}</dt><dd>{review.mastered}</dd></div>
              <div>
                <dt>{t('knowledge.recallRate')}</dt>
                <dd>{review.accuracy === null ? '—' : `${Math.round(review.accuracy * 100)}%`}</dd>
              </div>
              <div><dt>{t('knowledge.reviewsLogged')}</dt><dd>{review.reviews}</dd></div>
            </dl>
            <div className="knowledge-legend">
              <h2>{t('knowledge.mapKey')}</h2>
              <div><i data-status="due" />{t('knowledge.status.due')}</div>
              <div><i data-status="learning" />{t('knowledge.status.learning')}</div>
              <div><i data-status="known" />{t('knowledge.status.known')}</div>
              <div><i data-status="mastered" />{t('knowledge.status.mastered')}</div>
            </div>
          </aside>

          <main className="knowledge-queue">
            <div className="knowledge-queue-head">
              <div>
                <h2>{t('knowledge.queue')}</h2>
                <p>{visibleItems.length === 1
                  ? t('knowledge.count.one', { count: visibleItems.length })
                  : t('knowledge.count.other', { count: visibleItems.length })}</p>
              </div>
              <label className="knowledge-search">
                <Search aria-hidden="true" />
                <span className="sr-only">{t('knowledge.search')}</span>
                <input value={query} onChange={event => setQuery(event.target.value)} placeholder={t('knowledge.searchPlaceholder')} />
              </label>
            </div>
            <div className="knowledge-tabs" role="tablist" aria-label={t('knowledge.statusLabel')}>
              {filters.map(option => (
                <button
                  key={option.value}
                  type="button"
                  role="tab"
                  aria-selected={filter === option.value}
                  onClick={() => setFilter(option.value)}
                >
                  {option.label}
                  <span>{option.value === 'all' ? review.tracked : review[option.value]}</span>
                </button>
              ))}
            </div>
            <div className="knowledge-items">
              {visibleItems.length ? visibleItems.map(item => (
                <article className="knowledge-item" key={item.key}>
                  <i className="knowledge-status" data-status={item.status} aria-label={item.status} />
                  <div className="knowledge-item-name">
                    <h3>{item.name}</h3>
                    <p>{cityLabel(item.cityId)} · {item.type}{item.places > 1 ? ` · ${t('knowledge.places.other', { count: item.places })}` : ''}</p>
                  </div>
                  <div className="knowledge-mastery" aria-label={t('knowledge.masteryPercent', { percent: Math.round(item.mastery * 100) })}>
                    <span style={{ width: `${Math.max(4, item.mastery * 100)}%` }} />
                  </div>
                  <div className="knowledge-item-due">
                    <Clock3 aria-hidden="true" />
                    <span>{relativeReviewTime(item, now, t)}</span>
                  </div>
                  <div className="knowledge-item-history">
                    {t('knowledge.successful', { count: item.repetitions })} · {item.lapses === 1
                      ? t('knowledge.lapse.one', { count: item.lapses })
                      : t('knowledge.lapse.other', { count: item.lapses })}
                  </div>
                  <div className="knowledge-item-actions">
                    <button
                      type="button"
                      className="knowledge-practice"
                      disabled={item.status === 'due'}
                      onClick={() => {
                        setFilter('due');
                        onPracticeAgain(item.key);
                      }}
                    >
                      {item.status === 'due' ? t('knowledge.queued') : t('knowledge.practiceAgain')}
                    </button>
                    <button
                      type="button"
                      className="knowledge-forget"
                      onClick={() => onForgetItem(item.key, item.name)}
                    >
                      {t('knowledge.forget')}
                    </button>
                  </div>
                </article>
              )) : (
                <div className="knowledge-no-results">
                  <h3>{t('knowledge.noNames')}</h3>
                  <p>{query ? t('knowledge.noNamesSearch') : t('knowledge.noNamesBody')}</p>
                </div>
              )}
            </div>
          </main>

          <aside className="knowledge-context">
            <section>
              <h2>{t('knowledge.activity')}</h2>
              <div className="knowledge-activity" aria-label={t('knowledge.activityLabel')}>
                {review.activity.map(day => (
                  <div key={day.day}>
                    <span className="knowledge-activity-bar" style={{ height: `${Math.max(3, day.reviews / maxActivity * 100)}%` }} title={day.reviews === 1
                      ? t('knowledge.reviews.one', { count: day.reviews })
                      : t('knowledge.reviews.other', { count: day.reviews })} />
                    <small>{day.label}</small>
                  </div>
                ))}
              </div>
              <p>{(() => {
                const total = review.activity.reduce((sum, day) => sum + day.reviews, 0);
                return total === 1 ? t('knowledge.weekTotal.one', { count: total }) : t('knowledge.weekTotal.other', { count: total });
              })()}</p>
            </section>
            <section>
              <h2>{t('knowledge.byCity')}</h2>
              <div className="knowledge-cities">
                {review.cities.map(city => (
                  <div key={city.cityId}>
                    <strong>{cityLabel(city.cityId)}</strong>
                    <span>{t('knowledge.cityTracked', { count: city.tracked })}</span>
                    <small>{t('knowledge.cityDue', { due: city.due, mastered: city.mastered })}</small>
                  </div>
                ))}
              </div>
            </section>
            <p className="knowledge-explainer">{t('knowledge.explainer')}</p>
          </aside>
        </div>
      )}
    </section>
  );
}

/** Which edges of a scroll box still hide content. On a phone the setup rail
 *  scrolls, and a list that happens to end exactly at a row label gives no
 *  hint that more sits below — so the rail fades and offers a "More" cue. */
function useScrollEdges(active: boolean) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [edges, setEdges] = useState({ above: false, below: false });
  const measure = useCallback(() => {
    const node = ref.current;
    if (!node) return;
    const above = node.scrollTop > 4;
    const below = node.scrollTop + node.clientHeight < node.scrollHeight - 4;
    setEdges(previous => (previous.above === above && previous.below === below ? previous : { above, below }));
  }, []);
  useEffect(() => {
    const node = ref.current;
    if (!node || !active) return;
    measure();
    node.addEventListener('scroll', measure, { passive: true });
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    observer?.observe(node);
    for (const child of Array.from(node.children)) observer?.observe(child);
    const mutations = typeof MutationObserver === 'function' ? new MutationObserver(measure) : null;
    mutations?.observe(node, { childList: true, subtree: true, attributes: true, attributeFilter: ['open', 'style'] });
    window.addEventListener('resize', measure);
    return () => {
      node.removeEventListener('scroll', measure);
      observer?.disconnect();
      mutations?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [active, measure]);
  const scrollOn = useCallback(() => {
    const node = ref.current;
    if (node) node.scrollBy({ top: Math.max(120, node.clientHeight * 0.7), behavior: 'smooth' });
  }, []);
  return { ref, edges, scrollOn };
}

/** Scroll an opened section to the top of its rail, so what it revealed is
 *  in sight. Waits a frame for the content to lay out. */
function revealOpenedSection(section: HTMLElement): void {
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  requestAnimationFrame(() => section.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' }));
}

export function OverlayApp({
  store,
  callbacks,
}: {
  store: OverlayStore;
  callbacks: OverlayCallbacks;
}) {
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const t = useT();
  const accountSignedIn = state.account.signedIn === true;
  // Account labels that arrive as `#key` are catalog messages (they outlive a
  // language switch, so their words cannot be baked in by the host).
  const accountValue = (value: string, params?: Record<string, string | number>) =>
    value.startsWith('#') ? t(value.slice(1) as Parameters<Translate>[0], params) : value;
  const accountLabel = accountValue(state.account.label);
  const accountNote = accountValue(state.account.note, { count: state.account.noteCount ?? 0 });
  const accountButton = accountValue(state.account.buttonLabel);
  const prefs = state.prefs;
  const [knowledgeRefresh, setKnowledgeRefresh] = useState(0);
  const knowledgeNow = useMemo(() => Date.now(), [knowledgeRefresh]);
  const knowledgeReview = useMemo(
    () => loadKnowledgeReview(localStorage, knowledgeNow),
    [knowledgeNow],
  );
  const cityName = RIDE_CITY_NAME;
  const setupScroll = useScrollEdges(state.setupOpen);
  const selectedTour = state.tours.find(tour => tour.id === state.tourId) || null;
  const settingsScroll = useScrollEdges(state.settingsOpen);

  useEffect(() => {
    document.body.classList.toggle('setup-open', state.setupOpen);
    return () => document.body.classList.remove('setup-open');
  }, [state.setupOpen]);

  const patch = (next: Partial<CanalPreferences>, live = false) => {
    store.patchPrefs(next, callbacks.zoom);
    if (live) callbacks.onLiveChange();
  };

  const start = (event: FormEvent) => {
    event.preventDefault();
    callbacks.onStart();
  };

  // Knowledge opens from route setup or, mid-ride, from settings; closing
  // returns focus to whichever button opened it.
  const knowledgeOpener = useRef('knowledge-button');
  const closeKnowledge = useCallback(() => {
    store.setKnowledgeOpen(false);
    // Back to where the player came from, not to the top of the document.
    requestAnimationFrame(() => document.getElementById(knowledgeOpener.current)?.focus());
  }, [store]);

  const openKnowledge = (opener = 'knowledge-button') => {
    knowledgeOpener.current = opener;
    setKnowledgeRefresh(value => value + 1);
    store.setKnowledgeOpen(true);
  };

  const planReview = () => {
    patch({ skipMastered: true });
    callbacks.onSkipMastered(true);
    store.setKnowledgeOpen(false);
  };
  const practiceAgain = (itemKey: string) => {
    callbacks.onPracticeAgain(itemKey);
    setKnowledgeRefresh(value => value + 1);
  };
  const forgetItem = (itemKey: string, name: string) => {
    callbacks.onForgetItem(itemKey, name);
    setKnowledgeRefresh(value => value + 1);
  };

  return (
    <>
      {/* Covered by the knowledge screen: out of the tab order and the
          accessibility tree, not just out of sight. */}
      <div id="route-setup" className="enamel-setup" inert={state.knowledgeOpen} style={{ display: state.setupOpen ? 'flex' : 'none' }}>
        <div className="enamel-setup-rail">
          <form id="route-card" className="enamel-setup-form" onSubmit={start}>
            <h1 className="enamel-plaque enamel-framed enamel-title">Ride Amsterdam</h1>
            <LanguageSwitch idPrefix="setup-language" />

            <div className="setup-account" id="account-row">
              <div className="setup-account-copy">
                <strong id="account-label">{accountLabel}</strong>
                <small id="account-note">{accountNote}</small>
              </div>
              <div className="setup-account-actions">
                <button
                  id="knowledge-button"
                  type="button"
                  className="account-button enamel-quiet"
                  onClick={() => openKnowledge()}
                >
                  {t('settings.knowledge')}
                </button>
                <AccountChip
                  id="account-button"
                  user={accountSignedIn ? { label: accountLabel, photoURL: state.account.photoURL } : null}
                  available={state.account.available !== false}
                  busy={state.account.busy}
                  onSignIn={() => callbacks.onAccountClick()}
                  onSignOut={() => callbacks.onAccountClick()}
                  progressHref={siteLinksHere.progress}
                />
              </div>
            </div>

            <div className="enamel-setup-scroll-wrap">
            <div
              className="enamel-setup-scroll"
              ref={setupScroll.ref}
              data-more-above={setupScroll.edges.above ? '' : undefined}
              data-more-below={setupScroll.edges.below ? '' : undefined}
            >
            {/* Hidden selects keep Playwright and any legacy getElementById wiring working.
                City, destination and tours are in AutomationSelects: off-screen,
                because the setup card no longer shows them. */}
            <select id="travel-mode" hidden value={prefs.travelMode} onChange={event => patch({ travelMode: event.target.value as CanalPreferences['travelMode'] })}>
              <option value="boat">{t('setup.travel.boat')}</option>
              <option value="car">{t('setup.travel.bike')}</option>
              <option value="transit">{t('setup.travel.transit')}</option>
            </select>
            <select id="view-mode" hidden value={prefs.viewMode} onChange={event => patch({ viewMode: event.target.value as CanalPreferences['viewMode'] })}>
              <option value="north">{t('setup.view.north')}</option>
              <option value="heading">{t('setup.view.heading')}</option>
              <option value="chase">{t('setup.view.chase')}</option>
            </select>
            <select id="max-asks-per-minute" hidden value={String(prefs.maxAsksPerMinute)} onChange={event => patch({ maxAsksPerMinute: Number(event.target.value) as CanalPreferences['maxAsksPerMinute'] })}>
              {ASK_BUDGETS.map(budget => <option key={budget} value={String(budget)}>{budget === 0 ? t('common.off') : String(budget)}</option>)}
            </select>
            <select id="route-pattern" hidden value={prefs.routePattern} onChange={event => patch({ routePattern: event.target.value as CanalPreferences['routePattern'] })}>
              <option value="surprise">{t('setup.route.surprise')}</option>
              <option value="home">{t('setup.route.home')}</option>
              <option value="here">{t('setup.route.here')}</option>
              <option value="free">{t('setup.route.free')}</option>
            </select>
            <select id="route-difficulty" hidden value={prefs.difficulty} onChange={event => patch({ difficulty: event.target.value as CanalPreferences['difficulty'] })}>
              <option value="easy">{t('setup.difficulty.easy')}</option>
              <option value="medium">{t('setup.difficulty.medium')}</option>
              <option value="hard">{t('setup.difficulty.hard')}</option>
              <option value="expert">{t('setup.difficulty.expert')}</option>
              <option value="custom">{t('setup.difficulty.custom')}</option>
            </select>

            <AutomationSelects
              store={store}
              routePois={state.routePois}
              destinationId={state.destinationId}
              tours={state.tours}
              tourId={state.tourId}
            />
            <ChoiceRow
              label={t('setup.travel')}
              name="travel"
              value={prefs.travelMode}
              onChange={value => patch({ travelMode: value }, true)}
              options={travelChoices(t)}
              icons={TRAVEL_ICONS}
              layout="strip"
            />
            <ChoiceRow
              label={t('setup.view')}
              name="view"
              value={prefs.viewMode}
              onChange={value => patch({ viewMode: value })}
              options={viewChoices(t)}
              icons={VIEW_ICONS}
              layout="icons"
              showCurrent
              gloss={viewChoices(t).find(option => option.value === prefs.viewMode)?.hint}
              keepGloss
            />
            <ChoiceRow
              label={t('setup.route')}
              name="route"
              value={prefs.routePattern}
              onChange={value => {
                patch({ routePattern: value });
                // The address field opens below Destination, under the fold
                // on a phone: a Home pick with no address looked like it did
                // nothing (clarity review 2026-10-17).
                if (value === 'home' && !prefs.homeAddress.trim()) {
                  requestAnimationFrame(() => {
                    const field = document.getElementById('home-address') as HTMLInputElement | null;
                    field?.scrollIntoView({ block: 'center', behavior: 'smooth' });
                    field?.focus({ preventScroll: true });
                  });
                }
              }}
              options={routeChoices(t)}
              icons={ROUTE_ICONS}
              layout="strip"
              // Free Ride has no route and no questions; say so, since the
              // strip shows only the word (freeRide.ts).
              gloss={prefs.routePattern === 'free' ? t('setup.route.freeHint') : undefined}
              keepGloss
            />
            {/* Difficulty grades the questions, and Free Ride asks none. */}
            {prefs.routePattern !== 'free' && <ChoiceRow
              label={t('setup.difficulty')}
              name="difficulty"
              value={prefs.difficulty}
              onChange={value => patch({ difficulty: value })}
              options={
                prefs.difficulty === 'expert' || prefs.difficulty === 'custom'
                  ? [...difficultyMain(t), ...difficultyExtra(t).filter(d => d.value === prefs.difficulty)]
                  : difficultyMain(t)
              }
              compact
              icons={DIFFICULTY_ICONS}
              gloss={difficultyGloss(prefs.difficulty, t)}
              keepGloss
            />}

            <label id="home-address-field" className="setup-field enamel-field" style={{ display: prefs.routePattern === 'home' ? 'flex' : 'none', marginTop: 10 }}>
              {t('setup.homeAddress')}
              <input
                id="home-address"
                type="text"
                autoComplete="street-address"
                placeholder={t('setup.homeAddress.placeholder', { city: cityName })}
                value={prefs.homeAddress}
                onChange={event => patch({ homeAddress: event.target.value })}
              />
              <span className="enamel-field-note">{homeLearningNote(prefs, t)}</span>
            </label>
            <div
              id="gps-origin-note"
              className="setup-field enamel-field"
              style={{ display: prefs.routePattern === 'here' ? 'flex' : 'none', marginTop: 10 }}
            >
              {t('setup.liveLocation')}
              <span className="enamel-field-note">
                {t('setup.liveLocation.note')}
              </span>
            </div>

            <details
              className="advanced-options enamel-advanced"
              open={state.advancedOpen}
              onToggle={event => {
                const details = event.target as HTMLDetailsElement;
                store.setAdvancedOpen(details.open);
                // The controls opened below the fold on desktop, so the click
                // seemed to do nothing (clarity review 12). Bring them up.
                if (details.open) revealOpenedSection(details);
              }}
            >
              <summary>{t('setup.moreOptions')}</summary>
              <ChoiceRow
                label={t('setup.difficulty.harder')}
                name="difficulty-extra"
                value={prefs.difficulty}
                onChange={value => patch({ difficulty: value })}
                options={difficultyExtra(t)}
                compact
                icons={DIFFICULTY_ICONS}
                gloss={t('setup.difficulty.harderGloss')}
              />
              <ToggleGroup label={t('setup.review')}>
                <ToggleTile
                  id="skip-mastered"
                  checked={prefs.skipMastered}
                  onChange={skipMastered => {
                    patch({ skipMastered });
                    callbacks.onSkipMastered(skipMastered);
                  }}
                  title={t('setup.review.dueOnly')}
                  hint={t('setup.review.dueOnlyHint')}
                />
                <ToggleTile id="measured-colours-only" checked={prefs.measuredColoursOnly}
                  onChange={measuredColoursOnly => patch({ measuredColoursOnly }, true)}
                  title={t('setup.review.measuredColours')} hint={t('setup.review.measuredColoursHint')} />
              </ToggleGroup>
              {prefs.measuredColoursOnly && <p className="setup-choice-gloss" role="status">{t('setup.review.measuredColoursHidden')}</p>}
              <RideOptions prefs={prefs} patch={patch} />
              {/* Destructive, so fenced off and labelled rather than sitting as
                  two more quiet buttons just above Start. Both still confirm. */}
              <div className="setup-danger" role="group" aria-labelledby="setup-danger-title">
                  <p id="setup-danger-title" className="setup-danger-title">{t('setup.savedData')}</p>
                <button
                  id="clear-knowledge-button"
                  type="button"
                  className="account-button quiet enamel-quiet setup-danger-button"
                  disabled={state.account.busy}
                  onClick={() => callbacks.onClearKnowledge()}
                >
                  {t('setup.resetKnowledge')}
                </button>
                <button
                  id="clear-all-data-button"
                  type="button"
                  className="account-button quiet enamel-quiet setup-danger-button"
                  disabled={state.account.busy}
                  onClick={() => callbacks.onClearAllData()}
                >
                  {t('setup.clearAll')}
                </button>
              </div>
            </details>
            </div>
            {/* Docked in its own row under the rail, never over a field: it
                floated on the Destination select's chevron (clarity review 11).
                The row is kept while hidden so the rail does not jump. */}
            <button
              type="button"
              className="setup-scroll-cue"
              data-idle={setupScroll.edges.below ? undefined : ''}
              aria-hidden={setupScroll.edges.below ? undefined : true}
              tabIndex={setupScroll.edges.below ? undefined : -1}
              onClick={setupScroll.scrollOn}
              aria-label={t('setup.scrollMoreOptions')}
            >
              {t('common.more')} <ChevronDown aria-hidden="true" size={14} strokeWidth={2.5} />
            </button>
            </div>
            <div className="enamel-setup-footer">
              <button id="route-start" className="enamel-plaque enamel-framed enamel-start" type="submit">{prefs.routePattern === 'free' ? t('setup.startFreeRide') : selectedTour ? t('setup.startTour') : t('setup.startRoute')}</button>
              <div id="route-error" aria-live="polite">{routeErrorText(state.routeError, t)}</div>
              <SiteSwitch links={siteLinksHere} current="ride" id="setup-site-switch" />
            </div>
          </form>
        </div>
        <div className="enamel-setup-vista" aria-hidden="true" />
      </div>
      {state.knowledgeOpen ? (
        <KnowledgeReviewScreen
          review={knowledgeReview}
          now={knowledgeNow}
          onClose={closeKnowledge}
          backLabel={state.setupOpen ? t('knowledge.backToSetup') : t('knowledge.backToRide')}
          onPlanReview={planReview}
          onPracticeAgain={practiceAgain}
          onForgetItem={forgetItem}
        />
      ) : null}
      <div id="settings-panel" className="utility-panel enamel-utility" style={{ display: state.settingsOpen ? 'flex' : 'none' }}>
        <div className="utility-card enamel-plaque enamel-framed enamel-panel">
          <h2>{t('settings.title')}</h2>
          <LanguageSwitch idPrefix="live-language" />
          <SiteSwitch links={siteLinksHere} current="ride" id="settings-site-switch" />
          <div className="setup-account" id="settings-account-row">
            <div className="setup-account-copy" role="status" aria-live="polite">
              <strong id="settings-account-label">{accountSignedIn ? t('settings.signedInAs', { name: accountLabel }) : accountLabel}</strong>
              <small>{accountNote}</small>
            </div>
            <div className="setup-account-actions">
              <a id="settings-progress-link" className="account-button enamel-quiet" href={siteLinksHere.progress}>{t('settings.progress')}</a>
              <button
                id="settings-account-button"
                type="button"
                className="account-button enamel-quiet"
                disabled={state.account.busy}
                onClick={() => callbacks.onAccountClick()}
              >
                {accountButton}
              </button>
            </div>
          </div>
          <div className="enamel-setup-scroll-wrap">
            <div
              className="utility-scroll enamel-setup-scroll"
              ref={settingsScroll.ref}
              data-more-above={settingsScroll.edges.above ? '' : undefined}
              data-more-below={settingsScroll.edges.below ? '' : undefined}
            >
              <RideOptions prefs={prefs} patch={patch} live />
            </div>
            {/* Docked in its own row under the rail, never over a field: it
                floated on the Destination select's chevron (clarity review 11).
                The row is kept while hidden so the rail does not jump. */}
            <button
              type="button"
              className="setup-scroll-cue"
              data-idle={settingsScroll.edges.below ? undefined : ''}
              aria-hidden={settingsScroll.edges.below ? undefined : true}
              tabIndex={settingsScroll.edges.below ? undefined : -1}
              onClick={settingsScroll.scrollOn}
              aria-label={t('settings.scrollMore')}
            >
              More <ChevronDown aria-hidden="true" size={14} strokeWidth={2.5} />
            </button>
          </div>
          <div className="utility-actions">
            <div className="utility-actions-row">
              <button
                id="live-knowledge-button"
                className="enamel-plaque enamel-framed enamel-secondary"
                type="button"
                onClick={() => openKnowledge('live-knowledge-button')}
              >
                {t('settings.knowledge')}
              </button>
              <button
                className="enamel-plaque enamel-framed enamel-secondary"
              type="button"
              onClick={() => callbacks.onNewRoute()}
            >
                {t('settings.routeSetup')}
              </button>
            </div>
            <button className="utility-close enamel-plaque enamel-framed enamel-start" type="button" onClick={() => callbacks.onCloseSettings()}>{t('common.done')}</button>
          </div>
        </div>
      </div>
    </>
  );
}
