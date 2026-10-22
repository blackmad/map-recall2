/**
 * React bindings for the interface language.
 *
 * `useLanguage()` subscribes a component to the switch; `useT()` returns a
 * `t` that is stable per language. Without this, a component that rendered
 * before the player hit the toggle would keep its old strings until the next
 * unrelated state change — exactly the half-translated screen a language
 * switch must not produce.
 */

import { useCallback, useSyncExternalStore } from 'react';
import {
  language as currentLanguage,
  setLanguage,
  subscribe,
  t,
  type Language,
  type MessageKey,
  type MessageParams,
} from './index.ts';

export function useLanguage(): Language {
  return useSyncExternalStore(subscribe, currentLanguage, currentLanguage);
}

export type Translate = (key: MessageKey, params?: MessageParams) => string;

export function useT(): Translate {
  const active = useLanguage();
  return useCallback<Translate>((key, params) => {
    // Read through `t` so a component that renders outside the store (a test,
    // a detached root) still speaks the current language.
    void active;
    return t(key, params);
  }, [active]);
}

export function useSetLanguage(): (language: Language) => Language {
  return useCallback((next: Language) => setLanguage(next), []);
}
