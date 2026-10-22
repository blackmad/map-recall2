/**
 * The bridge the plain-JS runtime and the static HTML use.
 *
 * `public/canal-drive/js/{game,game-route,hud,vector-map}.js` are not compiled
 * by this repo's TypeScript pipeline, and the setup/help markup lives in
 * `index.html`. Both need the same catalog as the React overlay, so this entry
 * is bundled (unminified names, minified body) to `js/i18n.bundle.js` and
 * exposed as `window.CanalI18n`.
 *
 * Static copy is marked up rather than replaced wholesale:
 *
 *   <button data-i18n="common.done">Done</button>
 *   <input data-i18n-placeholder="knowledge.searchPlaceholder">
 *   <button data-i18n-title="help.title" data-i18n-aria="help.title">
 *
 * `localizeDom()` fills those in, and re-fills them on a language change, so
 * the English text stays in the HTML as the readable fallback for a build
 * whose bundle has not loaded yet.
 */

import {
  applyDocumentLanguage,
  language,
  setLanguage,
  subscribe,
  t,
  translate,
  toggleLanguage,
  LANGUAGES,
  LANGUAGE_NAMES,
  untranslatedKeys,
  type Language,
  type MessageKey,
  type MessageParams,
} from './index.ts';

const ATTRIBUTES: Array<[string, string]> = [
  ['data-i18n', 'text'],
  ['data-i18n-placeholder', 'placeholder'],
  ['data-i18n-title', 'title'],
  ['data-i18n-aria', 'aria-label'],
];

function fillAttribute(element: Element, kind: string, key: string): void {
  const value = t(key as MessageKey);
  if (kind === 'text') element.textContent = value;
  else element.setAttribute(kind, value);
}

/**
 * Translate every marked node under `root`. Idempotent, so a language switch
 * can simply call it again over the whole document.
 */
export function localizeDom(root: ParentNode | null = typeof document === 'undefined' ? null : document): void {
  if (!root) return;
  for (const [marker, kind] of ATTRIBUTES) {
    for (const element of Array.from(root.querySelectorAll(`[${marker}]`))) {
      const key = element.getAttribute(marker);
      if (key) fillAttribute(element, kind, key);
    }
  }
}

let domInstalled = false;

/** Wire the document: set `<html lang>`, translate marked nodes, keep both in step. */
export function installDocumentLanguage(): void {
  applyDocumentLanguage();
  localizeDom();
  if (!domInstalled) {
    domInstalled = true;
    subscribe(() => {
      localizeDom();
      if (typeof document !== 'undefined') {
        document.documentElement?.setAttribute('lang', language());
      }
    });
  }
}

export {
  applyDocumentLanguage,
  language,
  LANGUAGES,
  LANGUAGE_NAMES,
  setLanguage,
  subscribe,
  t,
  toggleLanguage,
  translate,
  untranslatedKeys,
};
export type { Language, MessageKey, MessageParams };
