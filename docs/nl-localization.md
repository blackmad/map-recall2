# Dutch interface and Dutch trivia sources

Status 2026-10-22. The game speaks English and Dutch, the player picks, and
trivia cards use genuine Dutch sources when the source text is Dutch.

## The message catalog (`src/i18n/`)

- `messages/en.ts` is the source of truth: every key, typed as `MessageKey`.
- `messages/nl.ts` must define exactly those keys (`Record<MessageKey, string>`).
- `index.ts` holds `t(key, params)`, the current language, storage
  (`canalRecall.language.v1`), `<html lang>` sync, and a `canal-language-change`
  window event so the separately bundled overlay, HUD and legacy runtime stay in
  step inside one tab.
- `useT.ts` / `useLanguage()` are the React bindings; a toggle re-renders every
  panel rather than leaving half a screen in the old language.
- `legacy.ts` is bundled to `public/canal-drive/js/i18n.bundle.js` as
  `window.CanalI18n` for the plain-JS runtime, and translates static markup:

```html
<h2 data-i18n="help.title">How to play</h2>
<input data-i18n-placeholder="quiz.searchPlaceholder">
<button data-i18n-title="quiz.menu" data-i18n-aria="quiz.menu">
```

First visit follows the browser (`nl-*` → Dutch, otherwise English); an explicit
choice is remembered, including a deliberate switch back to English.

### Adding or changing a string

1. Add the key to both catalogs (English first). Placeholders are `{name}` and
   must match between the two — `npm run test:canal-i18n` checks that, that no
   Dutch value is empty, and that no Dutch value is still the English text
   (cognates such as Zoom, Route, Landmark are allowlisted there).
2. Use `t('key')` in React (`useT()`), or `CanalI18n.t('key')` in plain JS.
3. For text that arrives as data (account labels, route errors), pass `#key`
   and resolve it where it is drawn, so a language switch re-reads it.

`npm run build:canal-i18n` rebuilds the legacy bundle; it is part of `npm run
build`.

## Where the language switch lives

- Ride: route setup (under the title) and live settings (`<LanguageSwitch>`).
- Quiz: beside the account chip in the header.
- Both sites share one stored choice.

## Dutch trivia sources

The Dutch column of a card is never a machine translation of the English. It is
used only when the data carries Dutch, and English is the fallback:

- Street, water and bridge name origins: the BAG register's own sentence
  (`nl` in `street-name-origins.json`, ~5,280 of 5,429 names).
- Neighbourhood description, history, name origin and local fact: `nl` in
  `neighborhood-history.json`, from the Dutch article or the reviewed Dutch
  original.
- Cards pick at render time (`triviaText`, `featureDescription`,
  `triviaSourceLabel` in `src/mapRecall/trivia.ts`), so a toggle flips a card
  that is already open.

### Register errors (important)

`docs/amsterdam-street-name-register-errors.md` documents where the municipal
register is wrong: text filed under the wrong name, fragments, sentences cut
mid-word, and factual mistakes. Dutch mode must not copy those.

- `scripts/dutch-street-origin-corrections.json` is derived from that document:
  - `withheldNl`: names whose Dutch is not shown at all (the card falls back to
    the corrected English, and the source line says `— Engels`);
  - `corrections`: targeted Dutch replacements taken from the register's quoted
    wording (e.g. a wrong date or name).
- `npm run add:dutch-street-origins` re-joins the cache and applies both; a
  replacement that no longer matches the register text fails the run.
- `npm run test:dutch-street-origins` fails if a name documented as an error is
  neither fixed nor withheld, if a withheld name still shows Dutch, or if an
  origin lost its BAG id.

When the error document grows, regenerate the derived file and re-run both
commands. Do not hand-edit the published JSON.

## Known gaps

- Landmark trivia (`facts.json`) is still generated from English sources; Dutch
  mode shows those cards in English. Regenerating with Dutch articles is the
  next content pass.
- Quiz settings/danger modals, the debug places modal, the postcard export and
  the feedback launch button are still English.
- Withheld register rows (120) could be rewritten in Dutch from their cited
  sources instead of falling back; 28 names have no cached Dutch at all.
- The published `street-name-origins.json` is ~2.2 MB (was ~1.3 MB) because it
  now carries both languages. It is fetched after the ride starts; split it into
  a lazily loaded sidecar if that ever matters.
