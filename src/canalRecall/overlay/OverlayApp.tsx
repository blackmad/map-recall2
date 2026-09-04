import { useEffect, useSyncExternalStore, type FormEvent, type ReactNode } from 'react';
import type { CanalPreferences, ZoomClamp } from '../game/preferences.ts';
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
  onSkipMastered: (enabled: boolean) => void;
  onCloseSettings: () => void;
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

function ChoiceRow<T extends string>({
  label,
  name,
  value,
  onChange,
  options,
  compact = false,
  icons,
}: {
  label: string;
  name: string;
  value: T;
  onChange: (value: T) => void;
  options: readonly Choice<T>[];
  compact?: boolean;
  icons?: Partial<Record<T, import('lucide-react').LucideIcon | null>>;
}) {
  return (
    <div className={`setup-choice-row${compact ? ' compact' : ''}`} role="radiogroup" aria-label={label}>
      <div className="setup-choice-label">{label}</div>
      <div className="setup-choice-options">
        {options.map(option => {
          const Icon = icons?.[option.value];
          return (
            <button
              key={option.value}
              type="button"
              className={`setup-choice enamel-tile${value === option.value ? ' active' : ''}`}
              aria-pressed={value === option.value}
              data-choice={`${name}:${option.value}`}
              onClick={() => onChange(option.value)}
            >
              {Icon ? <EnamelIcon icon={Icon} label={option.title} /> : null}
              <span className="setup-choice-text">
                <strong>{option.title}</strong>
                {option.hint ? <small>{option.hint}</small> : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const TRAVEL: Choice<CanalPreferences['travelMode']>[] = [
  { value: 'boat', title: 'Boat', hint: 'Canals' },
  { value: 'car', title: 'Bike', hint: 'Streets' },
];

const VIEW: Choice<CanalPreferences['viewMode']>[] = [
  { value: 'north', title: 'North-up', hint: 'Flat map' },
  { value: 'heading', title: 'Heading-up', hint: 'Flat map' },
  { value: 'chase', title: 'Chase', hint: '3D' },
  { value: 'cockpit', title: 'Cockpit', hint: '3D' },
];

const ROUTE: Choice<CanalPreferences['routePattern']>[] = [
  { value: 'surprise', title: 'Surprise route', hint: 'Landmark to landmark' },
  { value: 'home', title: 'Home base', hint: 'Errands from an address' },
];

const DIFFICULTY: Choice<CanalPreferences['difficulty']>[] = [
  { value: 'easy', title: 'Easy' },
  { value: 'medium', title: 'Medium' },
  { value: 'hard', title: 'Hard' },
  { value: 'expert', title: 'Expert' },
  { value: 'custom', title: 'Custom' },
];

export function OverlayApp({
  store,
  callbacks,
}: {
  store: OverlayStore;
  callbacks: OverlayCallbacks;
}) {
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const prefs = state.prefs;

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

  return (
    <>
      <div id="route-setup" className="enamel-setup" style={{ display: state.setupOpen ? 'flex' : 'none' }}>
        <div className="enamel-setup-rail">
          <form id="route-card" className="enamel-setup-form" onSubmit={start}>
            <h1 className="enamel-plaque enamel-framed enamel-title">Amsterdam Canal Recall</h1>

            {state.account.visible ? (
              <div className="setup-account" id="account-row">
                <div className="setup-account-copy">
                  <strong id="account-label">{state.account.label}</strong>
                  <small id="account-note">{state.account.note}</small>
                </div>
                <div className="setup-account-actions">
                  <button
                    id="account-button"
                    type="button"
                    className="account-button enamel-quiet"
                    disabled={state.account.busy}
                    onClick={() => callbacks.onAccountClick()}
                  >
                    {state.account.buttonLabel}
                  </button>
                  <button
                    id="clear-knowledge-button"
                    type="button"
                    className="account-button quiet enamel-quiet"
                    disabled={state.account.busy}
                    onClick={() => callbacks.onClearKnowledge()}
                  >
                    Reset knowledge…
                  </button>
                </div>
              </div>
            ) : null}

            {/* Hidden selects keep Playwright and any legacy getElementById wiring working. */}
            <select id="travel-mode" hidden value={prefs.travelMode} onChange={event => patch({ travelMode: event.target.value as CanalPreferences['travelMode'] })}>
              <option value="boat">Boat</option>
              <option value="car">Bike</option>
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
            </select>
            <select id="route-difficulty" hidden value={prefs.difficulty} onChange={event => patch({ difficulty: event.target.value as CanalPreferences['difficulty'] })}>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
              <option value="expert">Expert</option>
              <option value="custom">Custom</option>
            </select>

            <ChoiceRow
              label="Travel"
              name="travel"
              value={prefs.travelMode}
              onChange={value => patch({ travelMode: value })}
              options={TRAVEL}
              icons={TRAVEL_ICONS}
            />
            <ChoiceRow
              label="View"
              name="view"
              value={prefs.viewMode}
              onChange={value => patch({ viewMode: value })}
              options={VIEW}
              icons={VIEW_ICONS}
            />
            <ChoiceRow
              label="Route"
              name="route"
              value={prefs.routePattern}
              onChange={value => patch({ routePattern: value })}
              options={ROUTE}
              icons={ROUTE_ICONS}
            />
            <ChoiceRow
              label="Difficulty"
              name="difficulty"
              value={prefs.difficulty}
              onChange={value => patch({ difficulty: value })}
              options={DIFFICULTY}
              compact
              icons={DIFFICULTY_ICONS}
            />

            <label id="home-address-field" className="setup-field enamel-field" style={{ display: prefs.routePattern === 'home' ? 'flex' : 'none', marginTop: 10 }}>
              HOME ADDRESS
              <input
                id="home-address"
                type="text"
                autoComplete="street-address"
                placeholder="Street and number, Amsterdam"
                value={prefs.homeAddress}
                onChange={event => patch({ homeAddress: event.target.value })}
              />
              <span className="enamel-field-note">Saved · boats start at nearby water</span>
            </label>

            <details
              className="advanced-options enamel-advanced"
              open={state.advancedOpen}
              onToggle={event => store.setAdvancedOpen((event.target as HTMLDetailsElement).open)}
            >
              <summary>More options</summary>
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
            </details>
            <button id="route-start" className="enamel-plaque enamel-framed enamel-start" type="submit">Start route</button>
            <div id="route-error" aria-live="polite">{state.routeError}</div>
          </form>
        </div>
        <div className="enamel-setup-vista" aria-hidden="true" />
      </div>
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
            <option value="chase">3D — chase camera</option>
            <option value="cockpit">3D — near first person</option>
          </Field>
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
          <button className="utility-close enamel-plaque enamel-framed enamel-start" type="button" onClick={() => callbacks.onCloseSettings()}>Done</button>
        </div>
      </div>
    </>
  );
}
