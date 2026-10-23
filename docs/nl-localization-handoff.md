# NL localization handoff

Status 2026-10-23. Branch `lane/nl-localization-20261022`, worktree
`~/Code/map-recall2-worktrees/nl-localization-20261022`, pushed to
`origin`. Everything below is committed; the working tree is clean.

Read this together with `docs/nl-localization.md` (the rules) — this file is the
state and the next steps.

## What exists now

| Surface | Dutch? | Where |
|---|---|---|
| Ride: setup, live settings, knowledge, finish card, rules panel, HUD, prompt chip, help, loading lines, route errors, account, intro | yes | `src/i18n`, `src/canalRecall/overlay`, `src/canalRecall/game` |
| Quiz: header, question modes, summary, details, settings, auth, postcard, loading, start screen | yes | `src/components`, `src/App.tsx` |
| Debug places modal | no (developer tool) | `src/components/DebugPlacesModal.tsx` |
| Landing / credits / gallery pages | no (out of scope so far) | `public/canal-drive/*.html` |
| Name origins (streets/water/bridges) | 5,428 / 5,429 | `public/data/extracts/amsterdam/street-name-origins.json` |
| Neighbourhood description/history/name/local fact | where the data has Dutch | `neighborhood-history.json` |
| Landmark facts | 1,564 / 2,351 | `facts.json` (`textNl`) |

Language: browser default (`nl-*` → Dutch), remembered in
`canalRecall.language.v1`, shared by both sites. Switch lives in route setup, live
ride settings and the quiz header.

## Architecture in one screen

```
src/i18n/
  language.ts   Language type, browser detection, storage, read/write/clear
  messages/en.ts  source of truth, typed MessageKey (594 keys)
  messages/nl.ts  Record<MessageKey, string> — missing key is a type error
  index.ts      t(key, params), language(), setLanguage(), subscribe(),
                canallanguage-change window event (keeps separate bundles in step)
  useT.ts       useT()/useLanguage() — a switch re-renders every panel
  legacy.ts     bundled to public/canal-drive/js/i18n.bundle.js as window.CanalI18n;
                translates data-i18n / data-i18n-title / data-i18n-placeholder /
                data-i18n-aria markup, and relabels the feedback launcher
scripts/
  add-dutch-street-origins.ts   EN + BAG Dutch, applies the error policy
  check-dutch-street-origins.ts test:dutch-street-origins
  dutch-street-origin-corrections.json  withheldNl / corrections / nlOverrides / keptNl
  add-dutch-facts.ts            textNl from the Dutch evidence quote + openingNl
  apply-dutch-facts.ts          merges reviewed, verified agent-written Dutch
```

Conventions that matter:

- **`#key` for data-borne text.** Account labels and route errors travel as
  `#account.guest` and are resolved where they are drawn, so a language switch
  re-reads them. Never compare against a translated word (see "gotchas").
- **`t` name collision.** Some legacy methods already have a local `t`; import
  the catalog as `tr` there (`presentationRuntime.ts`, `landmarkRuntime.ts`).
- **Static markup** keeps its English text and gets a `data-i18n*` attribute; the
  legacy bundle fills it and updates it on switch.

## Trivia: how Dutch is chosen

Never machine-translated. A card prints Dutch only when the data carries Dutch:

- `TriviaText.textNl`, `wikipediaExtractNl`, `StreetKnowledgeEntry.nameOriginNl`,
  `Fact.textNl`.
- Pickers run at render time: `triviaText`, `featureDescription`,
  `triviaSourceLabel`, `factText`, `factKindLabel`, `factSourceLabel`. So an open
  card flips language with the toggle.
- English fallback is labelled as English in Dutch mode
  (`Gemeente Amsterdam (straatnamenregister) — Engels`, `Wikipedia (Engels)`).

### Name origins and the register error policy

`docs/amsterdam-street-name-register-errors.md` lists where the municipal
register is wrong. `scripts/dutch-street-origin-corrections.json` is derived from
it:

- `withheldNl` — no Dutch column at all (wrong-name text, or no Dutch source
  stating the fact). Only `Hamerstraat` remains in the extract.
- `corrections` — targeted Dutch replacements from the register's own wording.
- `nlOverrides` — a whole Dutch sentence from the counterpart record or article,
  each with a `source`.
- `keptNl` — documented rows whose Dutch is sound, each with a reason.

Run `npm run add:dutch-street-origins` then `npm run test:dutch-street-origins`.
The test fails if a documented error is neither fixed, kept nor withheld, if a
withheld name still shows Dutch, or if an origin loses its BAG id. Names the
translation cache misses (spelling variants) are read from the BAG record by id
(`beschrijvingNaam`) and cached under staging.

### Facts backlog (795)

Facts whose evidence is English have no Dutch. Two ways forward:

1. **Agent pass (proven, no keys).** Pick a feature, fetch its Dutch article
   (action API, batch/pacing — the REST summary endpoint 429s), write a card
   sentence from one exact Dutch evidence sentence, then spawn a fresh-context
   verifier with only {EN claim, NL sentence, NL evidence}. Write the reviewed
   rows to a JSON list `{featureId, en, nl, evidence, nlUrl, verdict, reason}`
   and run `npm run apply:dutch-facts -- <file>`. That records
   `textNlEvidence`, `textNlSourceUrl`, `textNlWriter`, `textNlVerification`.
   Pilot: 8 facts, all grounded, commit `19593668e`.
2. **Facts pipeline with a model.** `facts:articles` then `facts:build` against
   Dutch articles with Ollama or `--provider=openrouter` + `OPENROUTER_API_KEY`
   in a private env file (`FACT_ENV_FILE`). No key or local Ollama exists in this
   environment (checked `.env*`, dotfiles, `~/Code`, OpenCode auth).
   A mechanical year/anchor matcher was tried and rejected: 1 in 4 picks stated a
   different claim (Utrechtboog "planned 2006" vs "opened March 2006").

Expect well under 100% coverage either way: many of the 795 are Amsterdam bridge
details whose Dutch articles never state them.

## Verification recipe

```sh
npx tsc --noEmit -p tsconfig.json
npm run test:canal-i18n          # key parity, placeholders, no English left in NL
npm run test:dutch-street-origins
npm run test:dutch-facts
npm run test:canal-overlay && npm run test:canal-preferences && npm run test:play-delight
npm run build:canal-i18n && npm run build:canal-ui && npm run build:canal-overlay \
  && npm run build:canal-game-presentation && npm run build:canal-game-landmarks && npm run build:quiz
```

Browser check (NL): set the language and reload, then look at the screens —
`addInitScript` before `goto` was flaky, an explicit set + `reload()` is reliable.

```ts
await page.goto('/canal-drive/');
await expect.poll(() => page.evaluate(() => Boolean((window as any).canalRecallGame))).toBe(true);
await page.evaluate(() => localStorage.setItem('canalRecall.language.v1', 'nl'));
await page.reload();
// check document.documentElement.lang === 'nl', #route-start text, #help-panel h2
// live settings: canalRecallGame._overlay.store.setSetupOpen(false); setSettingsOpen(true)
```

Screenshots used during review: `artifacts/nl-check/`.

## Gotchas we already paid for

- **Do not compare a translated word.** The finish card's colour compared
  `caption === 'Link copied'` and settings compared `buttonLabel === 'Sign out'`;
  both now use stable ids/flags (`action.id`, `account.signedIn`).
- **`add:dutch-facts` must not wipe reviewed text.** It re-cuts quotes from
  evidence; it now preserves a sentence that has `textNlEvidence`,
  `textNlWriter` and a grounded verdict.
- **Separate bundles.** Wikipedia's summary API rate-limits at ~30 requests;
  batch titles through `action=query` (20 per call), back off on 429 and do not
  cache the failure.
- **`public/data/extracts/*/staging/` is gitignored** — caches for BAG lookups,
  Dutch ledes and the reviewed batch files live there; provenance that must ship
  goes on the fact itself.
- **Payload.** `street-name-origins.json` is 2.2 MB raw / 667 KB gzipped vs
  367 KB English-only; the Dutch column costs ~300 KB once on an already deferred
  request. Splitting it into a sidecar was measured and rejected.

## Suggested next steps, in order

1. More agent batches for facts, preferring features with rich Dutch articles
   (stations, bridges with own articles, museums) over street-detail facts.
2. Optional: localize the remaining quiz debug modal and the landing/credits
   pages, if players ever see them.
3. Optional: run the model pipeline for the facts backlog if a key is supplied;
   the agent route is the fallback that needs nothing.

## Commits

```
e672dc95d Ride UI: one Dutch/English message catalog with a live language toggle
3472a1011 Quiz UI: the same catalog in Map Recall, with a header language switch
f0d8a8110 Trivia: Dutch sources behind a Dutch interface
5ccff59fa Dutch origins: fix the register's documented errors instead of copying them
960306bd9 Dutch: account, intro, site switch and the guide
43a892fa3 Dutch origins: fix or drop the rest of the register's bad rows
d461c8fe7 Dutch facts: the Dutch article's own sentence, not a translation
45091bc10 Dutch: finish the player-facing surfaces
bbdb9e131 Dutch origins: close the last gaps
9cdd3f630 Dutch facts: keep the gaps honest, and record why
19593668e Dutch facts: no-key pilot, verified and traceable
```
