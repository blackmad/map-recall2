# Lane: street furniture from open data, a new "Street furniture" model category (2026-11-01, #170)

Branch `lane/street-furniture-20261101`, worktree
`/Users/blackmad/Code/map-recall2-worktrees/street-furniture-20261101`, dev port 4818
(`PW_PORT=4818`, Playwright only through `bash /tmp/canal-pw.sh … --workers=1`, named specs).
Read `docs/handoffs/LANE-RULES.md` first. Use `/usr/bin/git`. Model: opus. Never `pkill`; stop
your server by its port's PID. Open data only (no Google/Apple imagery).

## Why (user, 2026-11-01)

"does amsterdam have locations for all the trash bins (big square ones)? can we model and place
those? … what other things does the city tell us about? lamps? bollards? benches?" and then: "yes
please street furniture lane, make a new category in the buildings / what's new for 'street
furniture' 3d models". The city's open data knows where every underground waste container, lamp
post, litter bin, bike rack and shelter stands. Today the ride draws none of them (own ground draws
only the canal-side Amsterdammertje bollards, `ownGround/streets.ts bollards()`; keep those). A
rider on Prinsengracht sees the square container tops at every corner in real life.

## Sources (verified this afternoon; no benches or bollards in either)

- Underground containers: `https://api.data.amsterdam.nl/v1/huishoudelijkafval/container/`
  (30,839 rows; `fractieOmschrijving` Rest/Papier/Glas/Plastic/GFT/Textiel; `containerlocatie`
  clusters several containers on one cluster; `containertype` with `volumeM3`; RD coordinates).
  Docs under `https://api.data.amsterdam.nl/v1/docs/datasets/huishoudelijkafval.html`.
- PDOK BGT OGC API: `https://api.pdok.nl/lv/bgt/ogc/v1/collections/{paal,bak,straatmeubilair}/items?bbox=…&f=json`
  (paal: `lichtmast` and other `plus_type`s; bak: `afvalbak`, `afval apart plaats`;
  straatmeubilair: `abri`, `reclamezuil`, `fietsenrek`, `telefooncel`, `herdenkingsmonument`,
  `openbaar toilet`, `kunstobject`). Fetch plumbing to copy: `scripts/own-ground/fetch-bgt.ts`.
- Photos for likeness: data.amsterdam.nl panoramas (lookup per location; see
  `scripts/landmarks/*-survey.ts` for the pano fetch), Beeldbank. The container top is the
  object the user named: measure its plan (the square plate ≈ 1.2 m, the insert, the pillar
  height ≈ 1.1 m) and the fraction colours from photos, and write the measurements down.

## Steps

1. **Extract** to a staging path first (`artifacts/street-furniture/staging/`), then publish as a
   versioned extract `public/data/extracts/amsterdam/street-furniture/` shaped like
   `public/data/extracts/amsterdam/municipal-trees/` (`index.json` with source/apiUrl/licence/
   retrievedAt/counts, z15 tiles `tiles/<z>-<x>-<y>.json.gz`, one record per object: kind,
   subtype, lng/lat, heading if the data has it, cluster id, fraction). City box = the
   Amsterdam extract's bounds. Report counts per kind and subtype, rejected rows and why, and
   the bytes (gzip) per tile for the ride's centre tiles. A coverage script with `--check`.
2. **Models**: typed procedural geometry in `src/canalRecall/streetFurniture/` (the
   `gardenRooms.ts` pattern: measured dimensions, flat vertex colours from `look/palette.ts`,
   unit tests assert triangle counts). Per kind at most 120 triangles, flat-shaded, sharing one
   material (vertex colours) so they add no GL program. In ride order: underground container
   top (square plate + pillar + fraction insert; a cluster places its containers 1.5 m apart in
   a row along the kerb), lamp post (the classic centre hooked lamp and the straight modern
   pole; height by road class, as a documented prior), litter bin (the grey Amsterdam bin on a
   post), bike rack (the "nietje" hoop, repeated per `fietsenrek` feature), abri (posts, glass,
   flat roof), reclamezuil. Skip kunstobject (sculptures stay bespoke landmarks).
3. **Render** in the own engine the way `public/canal-drive/js/inventory-trees-source.js` does:
   stream the tiles by view (`ViewResidency`), instanced meshes, register with the shared frame
   (`sharedFrame.register('street-furniture', …)`, order after trees), cull with
   `rendererShared/instanceCull.ts`, draw only from zoom ≥ 16 and within 220 m, `?furniture=0`
   off switch. Entry `public/canal-drive/js/street-furniture-source.js` (thin) + an entry in
   `scripts/build-3d-bundles.mjs`; the `<script>` tag in `index.html` is the integrator's, say
   where it goes. Budget: ≤ 6 instanced draws, ≤ 40k triangles on screen in the centre at 60°
   pitch, 0 shader compiles and 0 uploads > 1 MB after warm-up. Measure draws/triangles with the
   ride-perf route (`tests/e2e/ride-perf.spec.ts`, `GL_COUNTERS=1`, `?engine=own`) before and
   after and put both in the report.
4. **The category.** `src/canalRecall/buildingCategory.ts`: add `'street-furniture'`
   (label "Street furniture"); it never counts as a landmark, never a POI/card/quiz/route
   candidate (`countsAsLandmark` false). `public/canal-drive/street-furniture/catalogue.json`
   lists each furniture model: id, name, kind, modelUrl (export each kind once as a GLB under
   `public/canal-drive/models/street-furniture/<id>.glb` for the galleries and the feed),
   triangles, instances placed, source. `public/canal-drive/whats-new.html`: a fourth kind
   button "Street furniture", a stat tile "street furniture models" with the instance count in
   the meta line, cards from that catalogue (`kind: 'street-furniture'`), gallery link to a new
   `public/canal-drive/street-furniture.html` (a small viewer page: each model turntable, its
   measurements and the panorama it was measured from; copy `building-gallery.html`'s shape).
   `scripts/landing/content-stats.ts`: a `streetFurniture` stat (models and instances) — edit
   the script, do not commit the generated `content-stats.json`. `scripts/landmarks/census.ts`
   and `test:building-taxonomy` must keep passing (add the category to their tables).
5. **Look at it.** Three spots, desktop + iPhone, with the data.amsterdam panorama of the same
   corner beside each frame: a Prinsengracht corner with a container cluster, a Pijp street
   with lamp posts and bins, a tram stop with an abri. Judge likeness against the photo (shape,
   height, colour) and fix before handing back. Sheets in `staging/street-furniture/`.

## Checks before hand-back

`npm run lint`; your unit tests; `npm run -s test:engine`; `npm run -s test:look`;
`npm run -s test:building-taxonomy`; `node --import tsx scripts/landmarks/census.ts` runs;
the Playwright shots spec (named, `--workers=1`); the perf counters before/after.

## Report

LANE-RULES hand-back block plus: counts per kind/subtype, the measurements table with the
photo each came from, triangle count per model, draws/triangles before/after, what the kit
cannot yet say, holds, and the INTEGRATOR TODO: the index.html script tag, bundles to rebuild,
`content-stats.ts` regen, model-first-added regen, the What's New note text with three
before/after pairs (which files), covers untouched (furniture is not a building). Do not touch
`TODO.md`, `HISTORY.md`, `whats-new-notes.json`, `index.html`, `game.js`, `package.json`,
bundles, `covers.json`, goldens, baselines.
