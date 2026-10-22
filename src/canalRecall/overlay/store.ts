/**
 * Canal Recall overlay state. React paints it; the Game reads it. Neither
 * side should go back to inventing a parallel copy of `CanalPreferences`.
 */

import {
  patchLivePreferences,
  type CanalPreferences,
  type ZoomClamp,
} from '../game/preferences.ts';
import type { RoutePoi } from '../game/routeSelection';

export interface AccountState {
  visible: boolean;
  label: string;
  note: string;
  /** Filled into a `note` placeholder, e.g. how many names sync. */
  noteCount?: number;
  buttonLabel: string;
  busy: boolean;
  /** Set by the recall store's user listener; older callers infer it from `buttonLabel`. */
  signedIn?: boolean;
  photoURL?: string | null;
  /** False when this build has no Firebase config (guest-only). */
  available?: boolean;
}

/** A tour as the setup picker lists it: no stop names, which could answer a question on the way. */
export interface TourOption {
  id: string;
  title: string;
  theme: string;
  stopCount: number;
  /** "checked 2026-10-17" for shop and café tours; see tourRoute.tourCheckedLabel. */
  checked: string | null;
}

export interface OverlayState {
  prefs: CanalPreferences;
  setupOpen: boolean;
  settingsOpen: boolean;
  knowledgeOpen: boolean;
  advancedOpen: boolean;
  routeError: string;
  routePois: readonly RoutePoi[];
  destinationId: string;
  tours: readonly TourOption[];
  /** The tour chosen in setup; '' rides a single route. */
  tourId: string;
  account: AccountState;
}

/**
 * Labels prefixed `#` are catalog keys, resolved where they are drawn: the
 * account state survives a language switch, so its words cannot be baked in.
 */
export const GUEST_ACCOUNT: AccountState = {
  visible: true,
  label: '#account.guest',
  note: '#account.guestNote',
  buttonLabel: '#account.signIn',
  busy: false,
  signedIn: false,
  photoURL: null,
};

export function createOverlayStore(initial: CanalPreferences) {
  let state: OverlayState = {
    prefs: initial,
    setupOpen: true,
    settingsOpen: false,
    knowledgeOpen: false,
    advancedOpen: false,
    routeError: '',
    routePois: [],
    destinationId: '',
    tours: [],
    tourId: '',
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
    setKnowledgeOpen(knowledgeOpen: boolean): void {
      state = { ...state, knowledgeOpen };
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
    setRoutePois(routePois: readonly RoutePoi[]): void {
      state = { ...state, routePois, destinationId: routePois.some(poi => poi.id === state.destinationId) ? state.destinationId : '' };
      emit();
    },
    setDestinationId(destinationId: string): void {
      state = { ...state, destinationId };
      emit();
    },
    setTours(tours: readonly TourOption[]): void {
      state = { ...state, tours, tourId: tours.some(tour => tour.id === state.tourId) ? state.tourId : '' };
      emit();
    },
    setTourId(tourId: string): void {
      state = { ...state, tourId, destinationId: tourId ? '' : state.destinationId };
      emit();
    },
    setAccount(account: Partial<AccountState>): void {
      state = { ...state, account: { ...state.account, ...account } };
      emit();
    },
  };
}

export type OverlayStore = ReturnType<typeof createOverlayStore>;
