# Lane: facade facts from the monument register (2026-11-09)

User, 2026-11-09, on `https://monumentenregister.cultureelerfgoed.nl/monumenten/3155`: "are we using this to get the canal houses right?" and "go for it". We use one field of it today. This lane turns the register's descriptions into typed facade facts and feeds them to the canal-house recipes.

## What exists (measured 2026-11-09 on origin/main)

- `scripts/data/amsterdam-monument-register/records.json.gz` + `manifest.json`: the full Amsterdam RCE (rijksmonumenten, CC0) and municipal (gemeentelijke monumenten) records with descriptions, coordinates and BAG pand/VBO links, generation 2026-10-05. Commands in the README (`archive.ts fetch|resume|rebuild|verify`).
- `scripts/fetch-monument-gables.ts` + `src/canalRecall/monumentGables.ts` (`classifyGable`): the point-in-footprint match and the gable word parser → `public/data/extracts/amsterdam/monument-gables.json` v1 (2026-10-03): 4,326 pands, one string each (cornice 1,898 · neck 1,065 · bell 753 · plain 462 · step 117 · spout 30 · raisedNeck 1) + `listedLandmarks` (483 parts).
- Consumers: `engine/ownWorldView.ts loadDecorationExtracts` (crown profile per gable, listed = old whatever BAG says), `check-roof-shapes.ts`, `large-tier/audit.ts`, `canal-belt-reuse.ts`.
- Not used: everything else in the description. Monument 3155 reads "Koetshuis met bovenwoning (in de kern 17e eeuw, vooral in de 19e eeuw zeer verbouwd). Laat 19e eeuwse gevel met siermetselwerk onder oudere punttop." We take `punttop` → spout and drop the type, the two dates, the material and the alteration.

## Deliverable

A versioned extract `monument-facts.json` (staging first, `--publish` after review, as the gables script does) with one record per matched pand, and the recipes reading it. Opus. Measurement first; nothing in the game changes until step 3.

### Step 1 — measure what the text holds (report before parsing)
Over every Amsterdam record with a description: count how many contain each class of fact, with 5 quoted examples each:
period/date words (`17e eeuw`, `ca. 1680`, `XVIIIa`, `1740`, `laat 19e eeuws`), core-vs-facade dating (`in de kern`, `gevel uit`), building type (`koetshuis`, `pakhuis`, `woonhuis`, `winkel-woonhuis`, `grachtenhuis`), gable (`hals`, `klok`, `trap`, `lijst`, `tuit`, `punttop`, `verhoogde`, `ingezwenkte`), style (`Lodewijk XIV/XV/XVI`, `classicistisch`, `neo-`, `Amsterdamse School`, `eclectisch`), material and finish (`baksteen`, `siermetselwerk`, `natuursteen`, `zandsteen`, `gepleisterd`, `bepleisterd`, `geschilderd`, `banden`, `blokken`), elements (`hijsbalk`, `stoep`, `kelderingang`, `onderpui`/`pui`, `fronton`, `kroonlijst`, `consoles`, `dakkapel`, `attiek`, `festoenen`, `oeil-de-boeuf`, `klauwstukken`, `vensters met roedenverdeling`, `schuiframen`, `luiken`), storeys (`twee verdiepingen`, `drie bouwlagen`, `souterrain`), alterations (`verbouwd`, `gewijzigd`, `gerestaureerd`, `onderpui gewijzigd`).
Also: how many monuments have no pand match today (the 4,326 against the register's Amsterdam count), by reason (point outside every footprint, several pands under one monument, several monuments on one pand), and how many matched pands lie inside the ride-priority buurten (centre and inner ring, memory `buurt-priority-by-ride`).

### Step 2 — the parser
`src/canalRecall/facade/registerFacts.ts`, pure, typed, tested: description → `{ facadeDate?: {year|range, confidence}, coreDate?, type?, gable? (reuse classifyGable), style?: string[], finish?: 'brick'|'ornamentalBrick'|'stone'|'plaster'|'painted'|…, stoneBands?: boolean, elements: string[] (from a fixed vocabulary with the Dutch term kept), storeys?: number, basement?: boolean, altered?: {what: string[], when?} , sourceNr, sourceText }`.
Gate: a hand-checked set of 200 records (`fixtures/registerFacts.golden.json`, picked by stratified sample across the classes in step 1, each record checked by reading the text) with per-field precision and recall ≥ 0.9 for date, type, gable, finish, and ≥ 0.8 for elements and style; every disagreement listed. Roman-numeral periods (`XVIIIa` = first quarter 18th c.) and `ca.` handled. The parser never invents: a field missing from the text stays undefined.

### Step 3 — feed the recipes, behind a flag
Read the facts in the recipe path (`canalhouseRecipes.ts`, `facade/houseRecord.ts`, the kit) with `?registerFacts=0` byte-identical:
1. Date: the register's facade date (else core date) over BAG when the pand is listed; the row-coherence and symmetric-gable rules keep their place (memory `row-coherence`, `symmetric-gables`).
2. Gable: register gable over the generator's guess where both exist and disagree, with the disagreement count reported.
3. Finish: plaster/painted/stone/ornamental brick drive the wall material and the white-accent rules (memory `canal-house-windows-and-white-accents`); `banden`/`blokken` → speklagen and quoins.
4. Elements: hijsbalk, stoep, kelderingang, fronton, consoles, dakkapel, attiek, festoenen, luiken → the kit components that exist; list the ones the kit cannot express yet in the hand-back (memory `building-lanes-improve-the-kit`: add the component in this lane when the photo and the register agree it is there, typed, byte-identical when absent).
5. Type: koetshuis/pakhuis → the warehouse and coach-house recipes where they exist.
Acceptance is likeness, not gates: before|after strips of two Grachtengordel rows and one Jordaan row against the panoramas (`roads-judged-against-photo` applies to buildings too: side by side with the photo), desktop DPR 2 at the demo-shots spots, plus the Nassaukade 506 benchmark unchanged (memory `nassaukade-506-benchmark`). Goldens: `CHANGED` list reviewed, nothing outside listed pands changes.

### Step 4 — cross-check against the Digitaal Grachtenboek (sample only)
`https://www.amsterdam-monumentenstad.nl/database/` (Walther Schoonenberg's database, 8,273 binnenstad objects, hand-classified `Geveltype`, `Bouwstijl`, `Bouwjaar`, `Gebouwtype`; index page `database.php` lists every id; object pages `grachtenboek_objecten.php?id=N`, ~15 kB). Fetch a sample of **≤ 150** object pages, one request every 2 s, identifying user agent, raw pages to the source archive repo; **no full crawl in this lane**, the user decides that after this report, and the ask-for-an-export message goes to the user to send (draft it in the hand-back). Compare his gable, style and year with the parsed facts on the same addresses (address → pand via `bag-facts`), report agreement per field. His prose and photos are his copyright: facts only, nothing of his text into the game.

## Rules
`LANE-RULES.md`; `/usr/bin/git`; own worktree + port; link `node_modules`; browser runs under `/tmp/canal-pw.sh`; dev server stopped by port PID; data generator writes to staging and publishes only after review, with the coverage diff in the hand-back; raw fetches archived per `source-archive-per-lane`; hand back SHA, the step-1 table, the golden scores, the strips, the kit-cannot-say list, and TODO/HISTORY/What's New text for the integrator (What's New only if a visible change ships).
