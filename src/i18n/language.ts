/**
 * Which language the interface speaks, and where that choice is remembered.
 *
 * One store for both sites (the ride and the quiz share an origin): the ride's
 * overlay is React, the quiz is React, and the legacy canvas runtime asks for a
 * plain string. All three read this module, so a toggle in one place is never
 * out of step with the other two.
 *
 * A first-time player follows the browser: Dutch browsers start in Dutch,
 * everything else in English (user decision 2026-10-22). An explicit choice is
 * remembered and wins from then on, including a deliberate switch back to
 * English on a Dutch browser.
 */

export const LANGUAGES = ['en', 'nl'] as const;
export type Language = (typeof LANGUAGES)[number];

/** Same key shape as the other `canalRecall.*` stores; read by both sites. */
export const LANGUAGE_STORAGE_KEY = 'canalRecall.language.v1';

/**
 * Pre-2026-10-22 saves have no key at all. `null` therefore means "follow the
 * browser" rather than "English", which is what an absent value in a browser
 * set to Dutch must resolve to.
 */
export interface KeyValueStoreLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export function isLanguage(value: unknown): value is Language {
  return value === 'en' || value === 'nl';
}

/** `nl-BE`, `NL`, `nl` → Dutch; every other preference → English. */
export function languageFromTags(tags: readonly string[] | null | undefined): Language {
  for (const tag of tags || []) {
    if (typeof tag !== 'string') continue;
    const base = tag.trim().toLowerCase().split(/[-_]/)[0];
    if (base === 'nl') return 'nl';
    // The first tag that names a language decides: a browser listing
    // `en-US, nl` prefers English and must not be talked into Dutch.
    if (base === 'en') return 'en';
  }
  return 'en';
}

export function browserLanguage(): Language {
  if (typeof navigator === 'undefined') return 'en';
  const tags = Array.isArray(navigator.languages) && navigator.languages.length
    ? navigator.languages
    : [navigator.language];
  return languageFromTags(tags);
}

export function readLanguage(store: KeyValueStoreLike | null | undefined): Language {
  try {
    const raw = store?.getItem(LANGUAGE_STORAGE_KEY);
    return isLanguage(raw) ? raw : browserLanguage();
  } catch {
    return browserLanguage();
  }
}

export function writeLanguage(store: KeyValueStoreLike | null | undefined, language: Language): void {
  try {
    store?.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    /* private mode */
  }
}

export function clearLanguage(store: KeyValueStoreLike | null | undefined): void {
  try {
    if (store?.removeItem) store.removeItem(LANGUAGE_STORAGE_KEY);
    else store?.setItem(LANGUAGE_STORAGE_KEY, '');
  } catch {
    /* private mode */
  }
}
