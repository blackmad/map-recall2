/**
 * Canal Recall overlay state. React paints it; the Game reads it. Neither
 * side should go back to inventing a parallel copy of `CanalPreferences`.
 */

import {
  patchLivePreferences,
  type CanalPreferences,
  type ZoomClamp,
} from '../game/preferences.ts';

export interface AccountState {
  visible: boolean;
  label: string;
  note: string;
  buttonLabel: string;
  busy: boolean;
}

export interface OverlayState {
  prefs: CanalPreferences;
  setupOpen: boolean;
  settingsOpen: boolean;
  advancedOpen: boolean;
  routeError: string;
  account: AccountState;
}

export const GUEST_ACCOUNT: AccountState = {
  visible: true,
  label: 'Playing as guest',
  note: 'Sign in to sync learned streets',
  buttonLabel: 'Sign in',
  busy: false,
};

export function createOverlayStore(initial: CanalPreferences) {
  let state: OverlayState = {
    prefs: initial,
    setupOpen: true,
    settingsOpen: false,
    advancedOpen: false,
    routeError: '',
    account: { ...GUEST_ACCOUNT },
  };
  const listeners = new Set<() => void>();
  const emit = (): void => {
    for (const listener of listeners) listener();
  };

  return {
    getState: (): OverlayState => state,
    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    replacePrefs(prefs: CanalPreferences): void {
      state = { ...state, prefs };
      emit();
    },
    patchPrefs(patch: Partial<CanalPreferences>, zoom: ZoomClamp): void {
      state = { ...state, prefs: patchLivePreferences(state.prefs, patch, zoom) };
      emit();
    },
    setSetupOpen(setupOpen: boolean): void {
      state = { ...state, setupOpen, settingsOpen: setupOpen ? false : state.settingsOpen };
      emit();
    },
    setSettingsOpen(settingsOpen: boolean): void {
      state = { ...state, settingsOpen };
      emit();
    },
    setAdvancedOpen(advancedOpen: boolean): void {
      state = { ...state, advancedOpen };
      emit();
    },
    setRouteError(routeError: string): void {
      state = { ...state, routeError };
      emit();
    },
    setAccount(account: Partial<AccountState>): void {
      state = { ...state, account: { ...state.account, ...account } };
      emit();
    },
  };
}

export type OverlayStore = ReturnType<typeof createOverlayStore>;
