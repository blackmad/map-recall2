import { useEffect, useMemo, useState, useSyncExternalStore, type FormEvent, type ReactNode } from 'react';
import { ArrowLeft, BookOpenCheck, Clock3, Search } from 'lucide-react';
import {
  BIKE_SKINS,
  BIKE_SKIN_IDS,
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
  onSkipMastered: (enabled: boolean) => void;
  onCloseSettings: () => void;
  /** Leave the current ride and reopen route setup. */
  onNewRoute: () => void;
}

function Field({
  label, id, value, onChange, children,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="setup-field">{label}
      <select id={id} value={value} onChange={event => onChange(event.target.value)}>
        {children}
      </select>
    </label>
  );
}

function Check({
  id, checked, onChange, children, hidden,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  hidden?: boolean;
}) {
  return (
    <label style={hidden ? { display: 'none' } : undefined}>
      <input id={id} type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} />
      {children}
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

const BIKE_SKIN_OPTIONS: Choice<CanalPreferences['bikeSkin']>[] = BIKE_SKIN_IDS.map(id => ({
  value: id,
  title: BIKE_SKINS[id].label,
  hint: BIKE_SKINS[id].motion ? 'Steer + spin' : 'Look only',
}));

const VIEW: Choice<CanalPreferences['viewMode']>[] = [
  { value: 'north', title: 'North', hint: 'Flat map, north at top' },
  { value: 'heading', title: 'Heading', hint: 'Flat map, turns with you' },
  { value: 'chase', title: 'Chase', hint: 'High 3D, behind the vehicle' },
  { value: 'cockpit', title: 'Cockpit', hint: 'Low 3D, over the bumper' },
];

const ROUTE: Choice<CanalPreferences['routePattern']>[] = [
  { value: 'surprise', title: 'Surprise', hint: 'Landmark to landmark' },
  { value: 'home', title: 'Home', hint: 'Nearby first, expands as you learn' },
  { value: 'here', title: 'Here', hint: 'Start from where you are now' },
];

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
  onPlanReview,
}: {
  review: KnowledgeReview;
  now: number;
  onClose: () => void;
  onPlanReview: () => void;
}) {
  const [filter, setFilter] = useState<KnowledgeFilter>(review.due ? 'due' : 'all');
  const [query, setQuery] = useState('');
  const visibleItems = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return review.items.filter(item => (filter === 'all' || item.status === filter)
      && (!term || item.name.toLocaleLowerCase().includes(term) || cityLabel(item.cityId).toLocaleLowerCase().includes(term)));
  }, [filter, query, review.items]);
  const maxActivity = Math.max(1, ...review.activity.map(day => day.reviews));

  return (
    <section id="knowledge-review" className="knowledge-review" aria-labelledby="knowledge-review-title">
      <header className="knowledge-header">
        <button type="button" className="knowledge-back" onClick={onClose}>
          <ArrowLeft aria-hidden="true" />
          Route setup
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

  const openKnowledge = () => {
    setKnowledgeRefresh(value => value + 1);
    store.setKnowledgeOpen(true);
  };

  const planReview = () => {
    patch({ skipMastered: true });
    callbacks.onSkipMastered(true);
    store.setKnowledgeOpen(false);
  };

  return (
    <>
      <div id="route-setup" className="enamel-setup" style={{ display: state.setupOpen ? 'flex' : 'none' }}>
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
                  onClick={openKnowledge}
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

            <div className="enamel-setup-scroll">
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
            {prefs.travelMode === 'car' ? (
              <>
                <ChoiceRow
                  label="Bicycle"
                  name="bike-skin"
                  value={prefs.bikeSkin}
                  onChange={value => patch({ bikeSkin: value })}
                  options={BIKE_SKIN_OPTIONS}
                  compact
                  gloss="Chase bike look. Swapfiets is photoreal reference (no spin)."
                />
                {BIKE_SKINS[prefs.bikeSkin]?.babySeat ? (
                  <label className="master-toggle" style={{ marginTop: 6 }}>
                    <input
                      type="checkbox"
                      checked={prefs.bikeBabySeat}
                      onChange={event => patch({ bikeBabySeat: event.target.checked })}
                    />
                    <span><strong>Baby seat</strong><small>Rear child seat on the luggage rack.</small></span>
                  </label>
                ) : null}
              </>
            ) : null}
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
              onChange={value => patch({ routePattern: value })}
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
              <div className="preference-grid">
                <label className="master-toggle">
                  <input
                    id="skip-mastered"
                    type="checkbox"
                    checked={prefs.skipMastered}
                    onChange={event => {
                      patch({ skipMastered: event.target.checked });
                      callbacks.onSkipMastered(event.target.checked);
                    }}
                  />
                  <span><strong>Space reviews</strong><small>Only names due</small></span>
                </label>
                <label className="master-toggle">
                  <input id="gamey-features" type="checkbox" checked={prefs.gamey} onChange={event => patch({ gamey: event.target.checked })} />
                  <span><strong>Scores & streaks</strong><small>Points and ribbons</small></span>
                </label>
              </div>
              <div className="setup-grid">
                <Field label="ANSWERS" id="answer-mode" value={prefs.answerMode} onChange={value => patch({ answerMode: value as CanalPreferences['answerMode'] })}>
                  <option value="multiple">Multiple choice</option>
                  <option value="typing">Type the name</option>
                </Field>
                <Field label="CONTROLS" id="control-mode" value={prefs.controlMode} onChange={value => patch({ controlMode: value as CanalPreferences['controlMode'] })}>
                  <option value="relative">Relative — steer vehicle</option>
                  <option value="absolute">Absolute — compass directions</option>
                </Field>
                <Field label="THEME" id="theme-mode" value={prefs.themeMode} onChange={value => patch({ themeMode: value as CanalPreferences['themeMode'] })}>
                  <option value="clean">Clean map</option>
                  <option value="8bit">8-bit arcade</option>
                  <option value="16bit">16-bit</option>
                  <option value="psx">PSX</option>
                  <option value="cyberpunk">Cyberpunk</option>
                </Field>
                <label className="setup-field">CAMERA ZOOM
                  <input id="camera-zoom" type="range" min="0.35" max="1.3" step="0.05" value={prefs.zoom} onChange={event => patch({ zoom: Number(event.target.value) })} />
                </label>
              </div>
              <div className="assist-options">
                <Check id="assist-line" checked={prefs.line} onChange={line => patch({ line })}> Route line</Check>
                <Check id="assist-arrow" checked={prefs.arrow} onChange={arrow => patch({ arrow })}> Destination arrow</Check>
                <Check id="assist-minimap" checked={prefs.minimap} onChange={minimap => patch({ minimap })}> Minimap</Check>
                <Check id="trees-enabled" checked={prefs.trees} onChange={trees => patch({ trees })} hidden> Trees in 3D</Check>
                <Check id="reduced-motion" checked={prefs.reducedMotion} onChange={reducedMotion => patch({ reducedMotion })}> Reduced motion</Check>
                <Check id="detailed-3d" checked={prefs.detailed3d} onChange={detailed3d => patch({ detailed3d })}> Detailed 3D beta</Check>
                <Check id="google-tiles" checked={prefs.googleTiles} onChange={googleTiles => patch({ googleTiles })}> Google photoreal (overview)</Check>
                <Check id="sound-enabled" checked={prefs.sound} onChange={sound => patch({ sound })}> Sound</Check>
              </div>
              <button
                id="clear-knowledge-button"
                type="button"
                className="account-button quiet enamel-quiet"
                disabled={state.account.busy}
                onClick={() => callbacks.onClearKnowledge()}
                style={{ marginTop: 10, width: '100%' }}
              >
                Reset knowledge…
              </button>
              <button
                id="clear-all-data-button"
                type="button"
                className="account-button quiet enamel-quiet"
                disabled={state.account.busy}
                onClick={() => callbacks.onClearAllData()}
                style={{ marginTop: 8, width: '100%' }}
              >
                Clear all data…
              </button>
            </details>
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
          onClose={() => store.setKnowledgeOpen(false)}
          onPlanReview={planReview}
        />
      ) : null}
      <div id="settings-panel" className="utility-panel enamel-utility" style={{ display: state.settingsOpen ? 'flex' : 'none' }}>
        <div className="utility-card enamel-plaque enamel-framed enamel-panel">
          <h2>Navigation settings</h2>
          <div className="utility-scroll">
          <label className="master-toggle">
            <input id="live-gamey" type="checkbox" checked={prefs.gamey} onChange={event => patch({ gamey: event.target.checked }, true)} />
            <span><strong>Game-y features</strong><small>Streaks, multipliers, points, and route ribbons.</small></span>
          </label>
          <div className="assist-options">
            <Check id="live-line" checked={prefs.line} onChange={line => patch({ line }, true)}> Route line</Check>
            <Check id="live-arrow" checked={prefs.arrow} onChange={arrow => patch({ arrow }, true)}> Destination arrow</Check>
            <Check id="live-minimap" checked={prefs.minimap} onChange={minimap => patch({ minimap }, true)}> Minimap</Check>
            <Check id="live-trees" checked={prefs.trees} onChange={trees => patch({ trees }, true)} hidden> Trees in 3D</Check>
            <Check id="live-reduced-motion" checked={prefs.reducedMotion} onChange={reducedMotion => patch({ reducedMotion }, true)}> Reduced motion</Check>
            <Check id="live-detailed-3d" checked={prefs.detailed3d} onChange={detailed3d => patch({ detailed3d }, true)}> Detailed 3D beta</Check>
            <Check id="live-google-tiles" checked={prefs.googleTiles} onChange={googleTiles => patch({ googleTiles }, true)}> Google photoreal (overview)</Check>
            <Check id="live-sound" checked={prefs.sound} onChange={sound => patch({ sound }, true)}> Sound</Check>
          </div>
          <Field label="CONTROLS" id="live-controls" value={prefs.controlMode} onChange={value => patch({ controlMode: value as CanalPreferences['controlMode'] }, true)}>
            <option value="relative">Relative — steer vehicle</option>
            <option value="absolute">Absolute — compass directions</option>
          </Field>
          <Field label="VIEW" id="live-view" value={prefs.viewMode} onChange={value => patch({ viewMode: value as CanalPreferences['viewMode'] }, true)}>
            <option value="north">2D — north up</option>
            <option value="heading">2D — heading up</option>
            <option value="chase">3D — chase (high / behind)</option>
            <option value="cockpit">3D — cockpit (low / bumper)</option>
          </Field>
          {(prefs.viewMode === 'chase' || prefs.viewMode === 'cockpit') ? (
            <>
              <label className="setup-field">3D TILT ([ / ])
                <input
                  id="live-tilt"
                  type="range"
                  min={CAMERA_TILT_MIN}
                  max={CAMERA_TILT_MAX}
                  step="1"
                  value={prefs.cameraTilt}
                  onChange={event => patch({ cameraTilt: Number(event.target.value) }, true)}
                />
              </label>
              <label className="setup-field">3D SPIN (SHIFT + [ / ])
                <input
                  id="live-bearing"
                  type="range"
                  min="-180"
                  max="180"
                  step="5"
                  value={prefs.cameraBearing}
                  onChange={event => patch({ cameraBearing: Number(event.target.value) }, true)}
                />
              </label>
            </>
          ) : null}
          {prefs.travelMode === 'car' ? (
            <>
              <Field label="BICYCLE" id="live-bike-skin" value={prefs.bikeSkin} onChange={value => patch({ bikeSkin: value as CanalPreferences['bikeSkin'] }, true)}>
                {BIKE_SKIN_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.title}</option>
                ))}
              </Field>
              {BIKE_SKINS[prefs.bikeSkin]?.babySeat ? (
                <Check id="live-bike-baby-seat" checked={prefs.bikeBabySeat} onChange={bikeBabySeat => patch({ bikeBabySeat }, true)}>
                  {' '}Baby seat
                </Check>
              ) : null}
            </>
          ) : null}
          <Field label="THEME" id="live-theme" value={prefs.themeMode} onChange={value => patch({ themeMode: value as CanalPreferences['themeMode'] }, true)}>
            <option value="clean">Clean map</option>
            <option value="8bit">8-bit arcade</option>
            <option value="16bit">16-bit</option>
            <option value="psx">PSX</option>
            <option value="cyberpunk">Cyberpunk</option>
          </Field>
          <label className="setup-field">CAMERA ZOOM
            <input id="live-zoom" type="range" min="0.35" max="1.3" step="0.05" value={prefs.zoom} onChange={event => patch({ zoom: Number(event.target.value) }, true)} />
          </label>
          </div>
          <div className="utility-actions">
            <button
              className="enamel-plaque enamel-framed enamel-secondary"
              type="button"
              onClick={() => callbacks.onNewRoute()}
            >
              New route
            </button>
            <button className="utility-close enamel-plaque enamel-framed enamel-start" type="button" onClick={() => callbacks.onCloseSettings()}>Done</button>
          </div>
        </div>
      </div>
    </>
  );
}
