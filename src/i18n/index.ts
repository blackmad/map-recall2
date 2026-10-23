/**
 * The interface's language and its strings.
 *
 * A single module-level language, a `t()` that reads it, and a subscription so
 * React re-renders and the canvas HUD (which draws every frame) simply reads
 * the new value on the next frame. The legacy runtime gets the same functions
 * through `legacy.ts`, so there is one catalog and one switch for the whole
 * game — including the parts still written in plain JS.
 */

import { en, type MessageKey } from './messages/en.ts';
import { nl } from './messages/nl.ts';
import {
  LANGUAGES,
  LANGUAGE_STORAGE_KEY,
  browserLanguage,
  clearLanguage,
  isLanguage,
  readLanguage,
  writeLanguage,
  type Language,
} from './language.ts';

export { LANGUAGES, LANGUAGE_STORAGE_KEY, browserLanguage, isLanguage, readLanguage, writeLanguage, clearLanguage };
export type { Language, MessageKey };

export const CATALOGS: Record<Language, Record<MessageKey, string>> = { en, nl };
export const SOURCE_LANGUAGE: Language = 'en';
export type MessageParams = Record<string, string | number>;

/** Language names as the player should see them, in their own words. */
export const LANGUAGE_NAMES: Record<Language, string> = {
  en: en['language.en'],
  nl: en['language.nl'],
};

let current: Language | null = null;
const listeners = new Set<(language: Language) => void>();

/**
 * The ride loads several bundles (overlay, HUD, legacy runtime) and each one
 * carries its own copy of this module. A toggle in the overlay must reach the
 * others in the same tab, where `storage` events never fire — so the change is
 * also announced on `window` and every copy listens.
 */
export const LANGUAGE_EVENT = 'canal-language-change';
let crossBundleListening = false;

function announce(language: Language): void {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  try {
    window.dispatchEvent(new CustomEvent(LANGUAGE_EVENT, { detail: { language } }));
  } catch {
    /* an old browser without CustomEvent: same-bundle listeners still work */
  }
}

function listenForOtherBundles(): void {
  if (crossBundleListening || typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
  crossBundleListening = true;
  window.addEventListener(LANGUAGE_EVENT, (event) => {
    const next = (event as CustomEvent<{ language?: unknown }>).detail?.language;
    if (!isLanguage(next) || next === current) return;
    current = next;
    syncDocumentLanguage();
    notify(next);
  });
}

function notify(language: Language): void {
  for (const listener of [...listeners]) {
    try {
      listener(language);
    } catch {
      /* a broken listener must not stop the others */
    }
  }
}

function storage(): typeof localStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** The language in force. Resolves from storage/browser on first use. */
export function language(): Language {
  if (!current) current = readLanguage(storage());
  return current;
}

function syncDocumentLanguage(): void {
  if (typeof document === 'undefined') return;
  try {
    document.documentElement?.setAttribute('lang', language());
  } catch {
    /* no document element during boot */
  }
}

/** Change the interface language, remember it, and tell every surface. */
export function setLanguage(next: Language, options: { persist?: boolean } = {}): Language {
  const resolved = isLanguage(next) ? next : SOURCE_LANGUAGE;
  if (current === resolved) {
    if (options.persist !== false) writeLanguage(storage(), resolved);
    return resolved;
  }
  current = resolved;
  if (options.persist !== false) writeLanguage(storage(), resolved);
  syncDocumentLanguage();
  notify(resolved);
  announce(resolved);
  return resolved;
}

export function toggleLanguage(): Language {
  return setLanguage(language() === 'en' ? 'nl' : 'en');
}

/** Subscribe to language changes; returns the unsubscribe function. */
export function subscribe(listener: (language: Language) => void): () => void {
  listeners.add(listener);
  listenForOtherBundles();
  return () => {
    listeners.delete(listener);
  };
}

/** Called once by each site's entry point, before anything paints. */
export function applyDocumentLanguage(): Language {
  const resolved = language();
  syncDocumentLanguage();
  return resolved;
}

const PLACEHOLDER = /\{(\w+)\}/g;

function fill(template: string, params?: MessageParams): string {
  if (!params) return template;
  return template.replace(PLACEHOLDER, (match, name: string) => {
    const value = params[name];
    return value === undefined || value === null ? match : String(value);
  });
}

/**
 * Look up a message in the current language. A key the Dutch catalog has not
 * reached yet falls back to English rather than printing the key, and unknown
 * keys return the key itself in development (never an empty string).
 */
export function t(key: MessageKey, params?: MessageParams): string {
  const catalog = CATALOGS[language()];
  const template = catalog[key] ?? en[key];
  if (template === undefined) {
    if (typeof console !== 'undefined') console.warn(`[i18n] missing message: ${key}`);
    return String(key);
  }
  return fill(template, params);
}

/** `translate('nl', key)` for text that is not about the current interface language. */
export function translate(target: Language, key: MessageKey, params?: MessageParams): string {
  const template = CATALOGS[target][key] ?? en[key];
  return template === undefined ? String(key) : fill(template, params);
}

/** True when a Dutch string is still the English one, for review tooling. */
export function untranslatedKeys(): MessageKey[] {
  return (Object.keys(en) as MessageKey[]).filter((key) => nl[key] === en[key] && /\p{L}{3}/u.test(en[key]));
}

/** Placeholder names used by a template, in order of appearance. */
export function messagePlaceholders(template: string): string[] {
  return [...template.matchAll(PLACEHOLDER)].map((match) => match[1]!);
}

/** Test seam: forget the cached language (storage is re-read on next use). */
export function resetLanguageForTests(): void {
  current = null;
  listeners.clear();
}
