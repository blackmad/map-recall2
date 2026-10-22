import test from 'node:test';
import assert from 'node:assert/strict';
import { en } from './messages/en.ts';
import { nl } from './messages/nl.ts';
import {
  CATALOGS,
  LANGUAGES,
  language,
  messagePlaceholders,
  resetLanguageForTests,
  setLanguage,
  t,
  translate,
  untranslatedKeys,
} from './index.ts';
import { browserLanguage, clearLanguage, languageFromTags, readLanguage, writeLanguage } from './language.ts';

const keys = Object.keys(en) as (keyof typeof en)[];

test('the Dutch catalog defines exactly the English keys', () => {
  assert.deepEqual(Object.keys(nl).sort(), [...keys].sort());
});

test('no Dutch message is empty', () => {
  for (const key of keys) assert.ok(nl[key].trim().length > 0, `${key} is empty`);
});

test('placeholders match between English and Dutch', () => {
  for (const key of keys) {
    assert.deepEqual(
      messagePlaceholders(nl[key]).sort(),
      messagePlaceholders(en[key]).sort(),
      `placeholders differ for ${key}`,
    );
  }
});

test('only deliberate cognates remain identical in Dutch', () => {
  // Words Dutch and English genuinely share. Anything else identical is a
  // missed translation, not a stylistic choice.
  const allowed = new Set([
    'Route', 'Scores', 'Zoom', 'Zoom {percent}%',
    'Start route', 'Start tour',
    'EN', 'NL', 'English', 'Nederlands', 'Cockpit', 'Expert', 'Cartoon', 'Tours', 'Tour', 'min', 'Water', 'In {context}', 'Hint', 'Bonus', 'Account', 'Quiz', 'Map Recall', '{km} km radius', 'Landmark', 'Park',
  ]);
  const suspicious = untranslatedKeys().filter((key) => !allowed.has(en[key]));
  assert.deepEqual(suspicious, []);
});

test('every catalog covers every language', () => {
  for (const code of LANGUAGES) {
    for (const key of keys) assert.equal(typeof CATALOGS[code][key], 'string', `${code}/${key}`);
  }
});

test('t follows the language setting and fills placeholders', () => {
  resetLanguageForTests();
  setLanguage('en', { persist: false });
  assert.equal(t('hud.zoom', { percent: 65 }), 'Zoom 65%');
  setLanguage('nl', { persist: false });
  assert.equal(t('hud.zoom', { percent: 65 }), 'Zoom 65%');
  assert.equal(t('setup.startRoute'), 'Start route');
  assert.equal(t('options.toursLabel' as never), 'options.toursLabel');
});

test('a missing placeholder keeps its braces rather than printing "undefined"', () => {
  resetLanguageForTests();
  setLanguage('en', { persist: false });
  assert.equal(t('hud.zoom'), 'Zoom {percent}%');
});

test('translate() reads a named language without switching the interface', () => {
  resetLanguageForTests();
  setLanguage('en', { persist: false });
  assert.equal(translate('nl', 'setup.travel.boat'), 'Boot');
  assert.equal(language(), 'en');
});

test('a Dutch browser starts in Dutch, an English one in English', () => {
  assert.equal(languageFromTags(['nl-NL', 'en-US']), 'nl');
  assert.equal(languageFromTags(['en-GB', 'nl']), 'en');
  assert.equal(languageFromTags([]), 'en');
  assert.equal(languageFromTags(null), 'en');
  assert.equal(languageFromTags(['de-DE']), 'en');
  assert.equal(browserLanguage(), 'en');
});

test('a stored choice wins, including an explicit switch back to English', () => {
  const store = new Map<string, string>();
  const kv = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
  };
  writeLanguage(kv, 'nl');
  assert.equal(readLanguage(kv), 'nl');
  writeLanguage(kv, 'en');
  assert.equal(readLanguage(kv), 'en');
  store.set('canalRecall.language.v1', 'fr');
  assert.equal(readLanguage(kv), 'en', 'an unknown stored value falls back to the browser');
  clearLanguage(kv);
  assert.equal(readLanguage(kv), 'en');
});

test('storage that throws never breaks the language read', () => {
  const broken = {
    getItem: () => { throw new Error('blocked'); },
    setItem: () => { throw new Error('blocked'); },
  };
  assert.equal(readLanguage(broken), 'en');
  assert.doesNotThrow(() => writeLanguage(broken, 'nl'));
  assert.doesNotThrow(() => clearLanguage(broken));
  assert.doesNotThrow(() => clearLanguage(undefined));
});
