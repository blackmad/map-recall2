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
  (`nl` in `street-name-origins.json`, 5,428 of 5,429 names). The one gap,
  `Hamerstraat`, has no Dutch source that states its origin, so it shows the
  corrected English card; the register text filed under that name is Piet
  Meerburg's biography and must never be shown.
- Neighbourhood description, history, name origin and local fact: `nl` in
  `neighborhood-history.json`, from the Dutch article or the reviewed Dutch
  original.
- Landmark facts: `textNl` on a fact (plus `openingNl` per feature) is the
  source article's **own Dutch sentence**, taken from the exact evidence quote
  that already backs the fact (`scripts/add-dutch-facts.ts`). It is a quote, not
  a translation of the English summary; 1,556 of 2,351 facts have one, and the
  rest stay English with an English source line. Dutch cards never mix: a Dutch
  fact with no Dutch lede arrives without the framing line.
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
    wording (e.g. a wrong date or name), and trailing-junk trims.
  - `nlOverrides`: a whole Dutch sentence composed from another register record
    (Vredenburgerbrug, Sint Antoniesbreestraat, Piet Meerburgbrug), each with its
    source.
- `npm run add:dutch-street-origins` re-joins the cache and applies both; a
  replacement that no longer matches the register text fails the run.
- `npm run test:dutch-street-origins` fails if a name documented as an error is
  neither fixed nor withheld, if a withheld name still shows Dutch, or if an
  origin lost its BAG id.

When the error document grows, regenerate the derived file and re-run both
commands. Do not hand-edit the published JSON.

## Known gaps

- The 795 facts without Dutch evidence (English Wikipedia, data-composed text)
  show in English. Mining Dutch articles for them needs the facts pipeline's
  writer **and its entailment verifier**: a mechanical year/anchor match was
  tried on 2026-10-23 and rejected — 1 in 4 picks stated a different claim
  (the Utrechtboog card matched a sentence about the *planned* 2006 opening
  against the fact that it opened in March 2006). Run
  `npm run facts:articles -- --directory=public/data/extracts/amsterdam` then
  `npm run facts:build -- --directory=public/data/extracts/amsterdam
  --city=amsterdam` with a model available (Ollama locally, or
  `--provider=openrouter` with a key) and review the Dutch output as usual;
  `textNl` then comes from that reviewed catalog rather than from a match.
- The debug places modal (a developer tool) is still English; everything a
  player sees on the ride and the quiz now follows the language.
- Rows the error register covers are fixed (`corrections`), composed from the
  counterpart record or the Dutch article (`nlOverrides`, each with its source),
  kept when the Dutch is sound (`keptNl`, each with a reason — Enneüs
  Heermabrug, Jaap Kunstbrug, H. Diesveldsingel), or withheld (Hamerstraat).
- Names the translation cache never covered (mostly bridges whose extract
  spelling differs, "Katten brug" against "Kattenbrug") are read straight from
  the BAG record by id and cached under staging; that is also the repair for a
  spelling variant the cache missed.
- The published `street-name-origins.json` is 2.2 MB raw / **667 KB gzipped**,
  against 367 KB for the English-only column. Measured 2026-10-23: the Dutch
  column costs ~300 KB once, on a request that is already deferred until after
  the ride starts. Splitting it into a sidecar would save that at the price of a
  second request and a reload path for live language switching, so it stays one
  file until the payload actually hurts.
