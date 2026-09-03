import { useSyncExternalStore, type FormEvent, type ReactNode } from 'react';
import type { CanalPreferences, ZoomClamp } from '../game/preferences.ts';
import type { OverlayStore } from './store.ts';

export interface OverlayCallbacks {
  zoom: ZoomClamp;
  onStart: () => void;
  onLiveChange: () => void;
  onAccountClick: () => void;
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

export function OverlayApp({
  store,
  callbacks,
}: {
  store: OverlayStore;
  callbacks: OverlayCallbacks;
}) {
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const prefs = state.prefs;
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
      <div id="route-setup" style={{ display: state.setupOpen ? 'flex' : 'none' }}>
        <form id="route-card" onSubmit={start}>
          <div className="setup-eyebrow">Learn Amsterdam by moving through it</div>
          <h1>Amsterdam Canal Recall</h1>
          <p className="lede">Choose a route, then learn the city by moving through it.</p>
          <div className="setup-section-title">Your route</div>
          <div className="setup-grid">
            <Field label="🎯 DIFFICULTY" id="route-difficulty" value={prefs.difficulty} onChange={value => patch({ difficulty: value as CanalPreferences['difficulty'] })}>
              <option value="easy">Easy — full navigation help</option>
              <option value="medium">Medium — GPS-like</option>
              <option value="hard">Hard — sparse help</option>
              <option value="expert">Expert — memory only</option>
              <option value="custom">Custom</option>
            </Field>
            <Field label="⛵ TRAVEL" id="travel-mode" value={prefs.travelMode} onChange={value => patch({ travelMode: value as CanalPreferences['travelMode'] })}>
              <option value="boat">Boat through the canals</option>
              <option value="car">Bike through the streets</option>
            </Field>
            <Field label="🗺️ VIEW" id="view-mode" value={prefs.viewMode} onChange={value => patch({ viewMode: value as CanalPreferences['viewMode'] })}>
              <option value="north">North-up map</option>
              <option value="heading">Heading-up map</option>
              <option value="chase">3D chase camera</option>
              <option value="cockpit">3D near-first-person</option>
            </Field>
            <Field label="🏠 ROUTE LOOP" id="route-pattern" value={prefs.routePattern} onChange={value => patch({ routePattern: value as CanalPreferences['routePattern'] })}>
              <option value="surprise">Surprise landmark route</option>
              <option value="home">Home-base errands</option>
            </Field>
          </div>
          <label id="home-address-field" className="setup-field" style={{ display: prefs.routePattern === 'home' ? 'flex' : 'none', marginTop: 14 }}>
            HOME ADDRESS
            <input
              id="home-address"
              type="text"
              autoComplete="street-address"
              placeholder="Street and number, Amsterdam"
              value={prefs.homeAddress}
              onChange={event => patch({ homeAddress: event.target.value })}
            />
            <span style={{ fontSize: 11, color: '#718487' }}>Saved · boats start at nearby water</span>
          </label>
          <details
            className="advanced-options"
            open={state.advancedOpen}
            onToggle={event => store.setAdvancedOpen((event.target as HTMLDetailsElement).open)}
          >
            <summary>⚙ Advanced options</summary>
            <div className="preference-grid">
              <div id="account-row" className="master-toggle" style={{ display: state.account.visible ? 'flex' : 'none' }}>
                <span style={{ flex: 1 }}>
                  <strong id="account-label">{state.account.label}</strong>
                  <small id="account-note">{state.account.note}</small>
                </span>
                <button
                  id="account-button"
                  type="button"
                  className="account-button"
                  disabled={state.account.busy}
                  onClick={() => callbacks.onAccountClick()}
                >
                  {state.account.buttonLabel}
                </button>
              </div>
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
                <span><strong>↻ Space reviews</strong><small>Only names due</small></span>
              </label>
              <label className="master-toggle">
                <input id="gamey-features" type="checkbox" checked={prefs.gamey} onChange={event => patch({ gamey: event.target.checked })} />
                <span><strong>★ Scores & streaks</strong><small>Points and ribbons</small></span>
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
          <button id="route-start" type="submit">Start route</button>
          <div id="route-error" aria-live="polite">{state.routeError}</div>
        </form>
      </div>
      <div id="settings-panel" className="utility-panel" style={{ display: state.settingsOpen ? 'flex' : 'none' }}>
        <div className="utility-card">
          <h2>Navigation settings</h2>
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
          <button className="utility-close" type="button" onClick={() => callbacks.onCloseSettings()}>Done</button>
        </div>
      </div>
    </>
  );
}
