import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from 'react';
import { ArrowLeft, BookOpenCheck, ChevronDown, Clock3, Search } from 'lucide-react';
import {
  CAMERA_TILT_MAX,
  CAMERA_TILT_MIN,
  playableCities,
  type CanalPreferences,
  type ZoomClamp,
} from '../game/preferences.ts';
import { missionBrief } from '../game/missionBrief.ts';
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
      {gloss ? <p className="setup-choice-gloss">{gloss}</p> : null}
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

function CitySelect({
  value,
  onChange,
  options,
}: {
  value: CanalPreferences['cityId'];
  onChange: (value: CanalPreferences['cityId']) => void;
  options: readonly Choice<CanalPreferences['cityId']>[];
}) {
  return (
    <label className="setup-field enamel-field setup-city-select">
      <span className="setup-choice-label">City</span>
      <select
        id="city-id"
        value={value}
        onChange={event => onChange(event.target.value as CanalPreferences['cityId'])}
        aria-label="City"
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>{option.title}</option>
        ))}
      </select>
    </label>
  );
}

const CITY_OPTIONS: Choice<CanalPreferences['cityId']>[] = playableCities().map(city => ({
  value: city.id,
  title: city.name,
}));

const TRAVEL: Choice<CanalPreferences['travelMode']>[] = [
  { value: 'boat', title: 'Boat' },
  { value: 'car', title: 'Bike' },
  { value: 'transit', title: 'Transit' },
];

const VIEW: Choice<CanalPreferences['viewMode']>[] = [
  { value: 'north', title: 'North up', hint: 'Flat map, north at top' },
  { value: 'heading', title: 'Heading up', hint: 'Flat map, turns with you' },
  { value: 'chase', title: 'Chase', hint: 'High 3D, behind the vehicle' },
  { value: 'cockpit', title: 'Cockpit', hint: 'Low 3D, over the bumper' },
];

const ROUTE: Choice<CanalPreferences['routePattern']>[] = [
  { value: 'surprise', title: 'Surprise', hint: 'Landmark to landmark' },
  { value: 'home', title: 'Home', hint: 'Nearby first, expands as you learn' },
  { value: 'study', title: 'Da Costa study', hint: 'Styled street lesson' },
  { value: 'here', title: 'Here', hint: 'Start from where you are now' },
];

const CONTROLS: Choice<CanalPreferences['controlMode']>[] = [
  { value: 'relative', title: 'Steer', hint: 'Left and right turn the vehicle' },
  { value: 'absolute', title: 'Point', hint: 'Push the way you want to go' },
];

const ANSWERS: Choice<CanalPreferences['answerMode']>[] = [
  { value: 'multiple', title: 'Choose', hint: 'Pick from a few names' },
  { value: 'typing', title: 'Type', hint: 'Spell the name yourself' },
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
  const threeD = prefs.viewMode === 'chase' || prefs.viewMode === 'cockpit';
  return (
    <>
      {live ? (
        <ChoiceRow
          label="View"
          name={name('view')}
          value={prefs.viewMode}
          onChange={value => set({ viewMode: value })}
          options={VIEW}
          icons={VIEW_ICONS}
          layout="icons"
          showCurrent
        />
      ) : null}
      {live && threeD ? (
        <>
          <RangeRow label="3D tilt" keys="[ ]" id="live-tilt" min={CAMERA_TILT_MIN} max={CAMERA_TILT_MAX} step="1"
            value={prefs.cameraTilt} onChange={cameraTilt => set({ cameraTilt })} />
          <RangeRow label="3D spin" keys="Shift + [ ]" id="live-bearing" min="-180" max="180" step="5"
            value={prefs.cameraBearing} onChange={cameraBearing => set({ cameraBearing })} />
        </>
      ) : null}
      <RangeRow label="Zoom" id={id('camera-zoom', 'live-zoom')} min="0.1" max="1.3" step="0.05"
        value={prefs.zoom} onChange={zoom => set({ zoom })} />
      <ChoiceRow
        label="Controls"
        name={name('controls')}
        value={prefs.controlMode}
        onChange={value => set({ controlMode: value })}
        options={CONTROLS}
      />
      <ChoiceRow
        label="Answers"
        name={name('answers')}
        value={prefs.answerMode}
        onChange={value => set({ answerMode: value })}
        options={ANSWERS}
      />
      <ToggleGroup label="On the map">
        <ToggleTile id={id('assist-line', 'live-line')} checked={prefs.line} onChange={line => set({ line })} title="Route line" />
        <ToggleTile id={id('assist-arrow', 'live-arrow')} checked={prefs.arrow} onChange={arrow => set({ arrow })} title="Arrow" hint="Points at the destination" />
        <ToggleTile id={id('assist-minimap', 'live-minimap')} checked={prefs.minimap} onChange={minimap => set({ minimap })} title="Minimap" />
        <ToggleTile id={id('gamey-features', 'live-gamey')} checked={prefs.gamey} onChange={gamey => set({ gamey })} title="Scores" hint="Points, streaks and ribbons" />
      </ToggleGroup>
      <ToggleGroup label="Comfort & detail">
        <ToggleTile id={id('sound-enabled', 'live-sound')} checked={prefs.sound} onChange={sound => set({ sound })} title="Sound" />
        <ToggleTile id={id('reduced-motion', 'live-reduced-motion')} checked={prefs.reducedMotion} onChange={reducedMotion => set({ reducedMotion })} title="Less motion" />
        <ToggleTile id={id('trees-enabled', 'live-trees')} checked={prefs.trees} onChange={trees => set({ trees })} title="Trees in 3D" hidden />
      </ToggleGroup>
    </>
  );
}

const HOME_RADIUS_STORAGE_KEY = 'canalRecall.homeLearningRadius.v1';

function homeLearningNote(prefs: CanalPreferences): string {
  const base = 'Saved · starts nearby, expands as you learn · boats use nearby water';
  if (prefs.routePattern !== 'home') return base;
  try {
    const raw = localStorage.getItem(HOME_RADIUS_STORAGE_KEY);
    if (!raw) return base;
    const saved = JSON.parse(raw) as { cityId?: string; address?: string; radiusKm?: number };
    const address = (prefs.homeAddress || '').trim();
    if (!address || saved.address !== address || saved.cityId !== prefs.cityId) return base;
    if (!(typeof saved.radiusKm === 'number') || !(saved.radiusKm > 0)) return base;
    return `Learning near home · ~${saved.radiusKm.toFixed(1)} km · expands as you learn`;
  } catch {
    return base;
  }
}

function briefingMission(prefs: CanalPreferences): string {
  const city = playableCities().find((entry) => entry.id === prefs.cityId);
  let homeKm = 0;
  try {
    const raw = localStorage.getItem(HOME_RADIUS_STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as { cityId?: string; address?: string; radiusKm?: number };
      if (saved.cityId === prefs.cityId && saved.address === (prefs.homeAddress || '').trim()) {
        homeKm = typeof saved.radiusKm === 'number' ? saved.radiusKm : 0;
      }
    }
  } catch { /* ignore */ }
  const brief = missionBrief({
    destinationName: prefs.routePattern === 'home' ? 'home' : 'your destination',
    travelMode: prefs.travelMode === 'boat' ? 'boat'
      : prefs.travelMode === 'transit' ? 'transit' : 'car',
    routePattern: prefs.routePattern,
    cityName: city?.name || 'the city',
    homeLearningRadiusKm: homeKm,
  });
  return brief.tease ? `${brief.line} · ${brief.tease}` : brief.line;
}

const DIFFICULTY_MAIN: Choice<CanalPreferences['difficulty']>[] = [
  { value: 'easy', title: 'Easy' },
  { value: 'medium', title: 'Medium' },
  { value: 'hard', title: 'Hard' },
];

const DIFFICULTY_EXTRA: Choice<CanalPreferences['difficulty']>[] = [
  { value: 'expert', title: 'Expert' },
  { value: 'custom', title: 'Custom' },
];

type KnowledgeFilter = KnowledgeStatus | 'all';

const KNOWLEDGE_FILTERS: Array<{ value: KnowledgeFilter; label: string }> = [
  { value: 'due', label: 'Due' },
  { value: 'learning', label: 'Learning' },
  { value: 'known', label: 'Known' },
  { value: 'mastered', label: 'Mastered' },
  { value: 'all', label: 'All' },
];

function relativeReviewTime(item: KnowledgeItem, now: number): string {
  const difference = item.dueAt - now;
  const absolute = Math.abs(difference);
  const amount = absolute < 3_600_000
    ? Math.max(1, Math.round(absolute / 60_000))
    : absolute < 86_400_000
      ? Math.round(absolute / 3_600_000)
      : Math.round(absolute / 86_400_000);
  const unit = absolute < 3_600_000 ? 'min' : absolute < 86_400_000 ? 'hr' : 'day';
  if (difference <= 0) return `${amount} ${unit}${amount === 1 ? '' : 's'} overdue`;
  return `in ${amount} ${unit}${amount === 1 ? '' : 's'}`;
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
          <h1 id="knowledge-review-title">Your city knowledge</h1>
          <p>What is sticking, what is fading, and what to ride next.</p>
        </div>
        <button
          type="button"
          className="enamel-plaque enamel-framed knowledge-plan"
          onClick={onPlanReview}
          disabled={review.due === 0}
        >
          <BookOpenCheck aria-hidden="true" />
          {review.due ? `Plan review · ${review.due} due` : 'Nothing due now'}
        </button>
      </header>

      {review.tracked === 0 ? (
        <div className="knowledge-empty">
          <div className="knowledge-empty-mark" aria-hidden="true"><BookOpenCheck /></div>
          <h2>Your map starts with one answer</h2>
          <p>Complete a route and recall a street, canal, bridge, stop, or line. It will appear here with its next review time.</p>
          <button type="button" className="enamel-plaque enamel-framed knowledge-plan" onClick={onClose}>Choose a first route</button>
        </div>
      ) : (
        <div className="knowledge-layout">
          <aside className="knowledge-summary" aria-label="Knowledge summary">
            <div className="knowledge-due-block">
              <strong>{review.due}</strong>
              <span>due now</span>
              <p>{review.due ? 'These names have reached their review window.' : 'You are caught up. New reviews will appear here.'}</p>
            </div>
            <dl className="knowledge-stat-list">
              <div><dt>Names tracked</dt><dd>{review.tracked}</dd></div>
              <div><dt>Mastered</dt><dd>{review.mastered}</dd></div>
              <div>
                <dt>Recall rate</dt>
                <dd>{review.accuracy === null ? '—' : `${Math.round(review.accuracy * 100)}%`}</dd>
              </div>
              <div><dt>Reviews logged</dt><dd>{review.reviews}</dd></div>
            </dl>
            <div className="knowledge-legend">
              <h2>Map key</h2>
              <div><i data-status="due" />Due for review</div>
              <div><i data-status="learning" />Learning</div>
              <div><i data-status="known" />Known</div>
              <div><i data-status="mastered" />Mastered</div>
            </div>
          </aside>

          <main className="knowledge-queue">
            <div className="knowledge-queue-head">
              <div>
                <h2>Review queue</h2>
                <p>{visibleItems.length} {visibleItems.length === 1 ? 'name' : 'names'} in this view</p>
              </div>
              <label className="knowledge-search">
                <Search aria-hidden="true" />
                <span className="sr-only">Search knowledge</span>
                <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search names or cities" />
              </label>
            </div>
            <div className="knowledge-tabs" role="tablist" aria-label="Knowledge status">
              {KNOWLEDGE_FILTERS.map(option => (
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
                    <p>{cityLabel(item.cityId)} · {item.type}{item.places > 1 ? ` · ${item.places} places` : ''}</p>
                  </div>
                  <div className="knowledge-mastery" aria-label={`${Math.round(item.mastery * 100)} percent mastery`}>
                    <span style={{ width: `${Math.max(4, item.mastery * 100)}%` }} />
                  </div>
                  <div className="knowledge-item-due">
                    <Clock3 aria-hidden="true" />
                    <span>{relativeReviewTime(item, now)}</span>
                  </div>
                  <div className="knowledge-item-history">
                    {item.repetitions} successful · {item.lapses} {item.lapses === 1 ? 'lapse' : 'lapses'}
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
                      {item.status === 'due' ? 'Queued' : 'Practice again'}
                    </button>
                    <button
                      type="button"
                      className="knowledge-forget"
                      onClick={() => onForgetItem(item.key, item.name)}
                    >
                      Forget
                    </button>
                  </div>
                </article>
              )) : (
                <div className="knowledge-no-results">
                  <h3>No names here</h3>
                  <p>{query ? 'Try another search or status.' : 'Your answers will move names into this group.'}</p>
                </div>
              )}
            </div>
          </main>

          <aside className="knowledge-context">
            <section>
              <h2>Past 7 days</h2>
              <div className="knowledge-activity" aria-label="Reviews in the past seven days">
                {review.activity.map(day => (
                  <div key={day.day}>
                    <span className="knowledge-activity-bar" style={{ height: `${Math.max(3, day.reviews / maxActivity * 100)}%` }} title={`${day.reviews} reviews`} />
                    <small>{day.label}</small>
                  </div>
                ))}
              </div>
              <p>{review.activity.reduce((sum, day) => sum + day.reviews, 0)} reviews this week</p>
            </section>
            <section>
              <h2>By city</h2>
              <div className="knowledge-cities">
                {review.cities.map(city => (
                  <div key={city.cityId}>
                    <strong>{cityLabel(city.cityId)}</strong>
                    <span>{city.tracked} tracked</span>
                    <small>{city.due} due · {city.mastered} mastered</small>
                  </div>
                ))}
              </div>
            </section>
            <p className="knowledge-explainer">Mastery rises across successful reviews. A name turns copper when its spaced-review interval expires.</p>
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

export function OverlayApp({
  store,
  callbacks,
}: {
  store: OverlayStore;
  callbacks: OverlayCallbacks;
}) {
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const prefs = state.prefs;
  const [knowledgeRefresh, setKnowledgeRefresh] = useState(0);
  const knowledgeNow = useMemo(() => Date.now(), [knowledgeRefresh]);
  const knowledgeReview = useMemo(
    () => loadKnowledgeReview(localStorage, knowledgeNow),
    [knowledgeNow],
  );
  const cityName = CITY_OPTIONS.find(option => option.value === prefs.cityId)?.title
    || prefs.cityId;
  const setupScroll = useScrollEdges(state.setupOpen);
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
            <h1 className="enamel-plaque enamel-framed enamel-title">Canal Recall</h1>

            <div className="setup-account" id="account-row">
              <div className="setup-account-copy">
                <strong id="account-label">{state.account.label}</strong>
                <small id="account-note">{state.account.note}</small>
              </div>
              <div className="setup-account-actions">
                <button
                  id="knowledge-button"
                  type="button"
                  className="account-button enamel-quiet"
                  onClick={() => openKnowledge()}
                >
                  Knowledge
                </button>
                <button
                  id="account-button"
                  type="button"
                  className="account-button enamel-quiet"
                  disabled={state.account.busy}
                  onClick={() => callbacks.onAccountClick()}
                >
                  {state.account.buttonLabel}
                </button>
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
                City uses the visible #city-id select below. */}
            <select id="travel-mode" hidden value={prefs.travelMode} onChange={event => patch({ travelMode: event.target.value as CanalPreferences['travelMode'] })}>
              <option value="boat">Boat</option>
              <option value="car">Bike</option>
              <option value="transit">Transit</option>
            </select>
            <select id="view-mode" hidden value={prefs.viewMode} onChange={event => patch({ viewMode: event.target.value as CanalPreferences['viewMode'] })}>
              <option value="north">North-up</option>
              <option value="heading">Heading-up</option>
              <option value="chase">Chase</option>
              <option value="cockpit">Cockpit</option>
            </select>
            <select id="route-pattern" hidden value={prefs.routePattern} onChange={event => patch({ routePattern: event.target.value as CanalPreferences['routePattern'] })}>
              <option value="surprise">Surprise</option>
              <option value="home">Home</option>
              <option value="study">Da Costa study</option>
              <option value="here">Here</option>
            </select>
            <select id="route-difficulty" hidden value={prefs.difficulty} onChange={event => patch({ difficulty: event.target.value as CanalPreferences['difficulty'] })}>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
              <option value="expert">Expert</option>
              <option value="custom">Custom</option>
            </select>

            <CitySelect
              value={prefs.cityId}
              onChange={value => patch({ cityId: value }, true)}
              options={CITY_OPTIONS}
            />
            <ChoiceRow
              label="Travel"
              name="travel"
              value={prefs.travelMode}
              onChange={value => {
                const next: Partial<CanalPreferences> = { travelMode: value };
                // Transit extract is Amsterdam-only for now.
                if (value === 'transit' && prefs.cityId !== 'amsterdam') next.cityId = 'amsterdam';
                patch(next);
              }}
              options={TRAVEL}
              icons={TRAVEL_ICONS}
              layout="strip"
            />
            <ChoiceRow
              label="View"
              name="view"
              value={prefs.viewMode}
              onChange={value => patch({ viewMode: value })}
              options={VIEW}
              icons={VIEW_ICONS}
              layout="icons"
              showCurrent
            />
            <ChoiceRow
              label="Route"
              name="route"
              value={prefs.routePattern}
              onChange={value => patch(value === 'study'
                ? { routePattern: value, travelMode: 'car', viewMode: 'chase', zoom: 0.8 }
                : { routePattern: value })}
              options={ROUTE}
              icons={ROUTE_ICONS}
              layout="strip"
            />
            <ChoiceRow
              label="Difficulty"
              name="difficulty"
              value={prefs.difficulty}
              onChange={value => patch({ difficulty: value })}
              options={
                prefs.difficulty === 'expert' || prefs.difficulty === 'custom'
                  ? [...DIFFICULTY_MAIN, ...DIFFICULTY_EXTRA.filter(d => d.value === prefs.difficulty)]
                  : DIFFICULTY_MAIN
              }
              compact
              icons={DIFFICULTY_ICONS}
              gloss="Naming help. Expert & Custom sit under More options."
            />

            <label id="home-address-field" className="setup-field enamel-field" style={{ display: prefs.routePattern === 'home' ? 'flex' : 'none', marginTop: 10 }}>
              HOME ADDRESS
              <input
                id="home-address"
                type="text"
                autoComplete="street-address"
                placeholder={`Street and number, ${cityName}`}
                value={prefs.homeAddress}
                onChange={event => patch({ homeAddress: event.target.value })}
              />
              <span className="enamel-field-note">{homeLearningNote(prefs)}</span>
            </label>
            <div
              id="gps-origin-note"
              className="setup-field enamel-field"
              style={{ display: prefs.routePattern === 'here' ? 'flex' : 'none', marginTop: 10 }}
            >
              LIVE LOCATION
              <span className="enamel-field-note">
                Starts from where you are now — not a saved home address. Allow location when asked.
              </span>
            </div>

            <details
              className="advanced-options enamel-advanced"
              open={state.advancedOpen}
              onToggle={event => store.setAdvancedOpen((event.target as HTMLDetailsElement).open)}
            >
              <summary>More options</summary>
              <ChoiceRow
                label="Harder difficulties"
                name="difficulty-extra"
                value={prefs.difficulty}
                onChange={value => patch({ difficulty: value })}
                options={DIFFICULTY_EXTRA}
                compact
                icons={DIFFICULTY_ICONS}
                gloss="Expert hides assists. Custom appears when you tweak assists below."
              />
              <ToggleGroup label="Review">
                <ToggleTile
                  id="skip-mastered"
                  checked={prefs.skipMastered}
                  onChange={skipMastered => {
                    patch({ skipMastered });
                    callbacks.onSkipMastered(skipMastered);
                  }}
                  title="Due names only"
                  hint="Ask only names due for review"
                />
                <ToggleTile id="measured-colours-only" checked={prefs.measuredColoursOnly}
                  onChange={measuredColoursOnly => patch({ measuredColoursOnly }, true)}
                  title="Reviewed colours" hint="Only buildings with checked wall colours" />
              </ToggleGroup>
              {prefs.measuredColoursOnly && <p className="setup-choice-gloss" role="status">Buildings without reviewed wall colours are hidden. Coverage may be empty.</p>}
              <RideOptions prefs={prefs} patch={patch} />
              {/* Destructive, so fenced off and labelled rather than sitting as
                  two more quiet buttons just above Start. Both still confirm. */}
              <div className="setup-danger" role="group" aria-labelledby="setup-danger-title">
                  <p id="setup-danger-title" className="setup-danger-title">Your saved data</p>
                <button
                  id="clear-knowledge-button"
                  type="button"
                  className="account-button quiet enamel-quiet setup-danger-button"
                  disabled={state.account.busy}
                  onClick={() => callbacks.onClearKnowledge()}
                >
                  Reset knowledge…
                </button>
                <button
                  id="clear-all-data-button"
                  type="button"
                  className="account-button quiet enamel-quiet setup-danger-button"
                  disabled={state.account.busy}
                  onClick={() => callbacks.onClearAllData()}
                >
                  Clear all data…
                </button>
              </div>
            </details>
            </div>
            {setupScroll.edges.below ? (
              <button type="button" className="setup-scroll-cue" onClick={setupScroll.scrollOn} aria-label="Scroll for more options">
                More <ChevronDown aria-hidden="true" size={14} strokeWidth={2.5} />
              </button>
            ) : null}
            </div>
            <div className="enamel-setup-footer">
              <p className="enamel-field-note" id="mission-brief" style={{ margin: '0 0 8px', textAlign: 'center' }}>
                {briefingMission(prefs)}
              </p>
              <button id="route-start" className="enamel-plaque enamel-framed enamel-start" type="submit">Start route</button>
              <div id="route-error" aria-live="polite">{state.routeError}</div>
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
          backLabel={state.setupOpen ? 'Route setup' : 'Back to ride'}
          onPlanReview={planReview}
          onPracticeAgain={practiceAgain}
          onForgetItem={forgetItem}
        />
      ) : null}
      <div id="settings-panel" className="utility-panel enamel-utility" style={{ display: state.settingsOpen ? 'flex' : 'none' }}>
        <div className="utility-card enamel-plaque enamel-framed enamel-panel">
          <h2>Ride settings</h2>
          <div className="enamel-setup-scroll-wrap">
            <div
              className="utility-scroll enamel-setup-scroll"
              ref={settingsScroll.ref}
              data-more-above={settingsScroll.edges.above ? '' : undefined}
              data-more-below={settingsScroll.edges.below ? '' : undefined}
            >
              <RideOptions prefs={prefs} patch={patch} live />
            </div>
            {settingsScroll.edges.below ? (
              <button type="button" className="setup-scroll-cue" onClick={settingsScroll.scrollOn} aria-label="Scroll for more settings">
                More <ChevronDown aria-hidden="true" size={14} strokeWidth={2.5} />
              </button>
            ) : null}
          </div>
          <div className="utility-actions">
            <div className="utility-actions-row">
              <button
                id="live-knowledge-button"
                className="enamel-plaque enamel-framed enamel-secondary"
                type="button"
                onClick={() => openKnowledge('live-knowledge-button')}
              >
                Your knowledge
              </button>
              <button
                className="enamel-plaque enamel-framed enamel-secondary"
              type="button"
              onClick={() => callbacks.onNewRoute()}
            >
                Route setup
              </button>
            </div>
            <button className="utility-close enamel-plaque enamel-framed enamel-start" type="button" onClick={() => callbacks.onCloseSettings()}>Done</button>
          </div>
        </div>
      </div>
    </>
  );
}
