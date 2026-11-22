# Sculpture round 2 (lane sculpture-r2-20261122, 2026-11-22)

This round retried the six October statue failures (part A) and tried image-to-3D wall reliefs on landmarks (part B).
Every mesh came from TripoSR (MIT) or TRELLIS.2 (MIT, ComfyUI native, int8), run locally. No Hunyuan3D, no cloud
services, and no Google or Apple imagery was used.

The acceptance test was one blind A/B judge: a fresh Opus subagent that saw only the sheet directory and never the key.

- Sheets: `~/Code/map-recall2-screenshots/sculptures/2026-11-22-r2/01.jpg` to `09.jpg` (screenshots repo commit 832a0fe).
- Key: `key.json` in the same directory.
- Self-check strips: `selfcheck-*.jpg`.

## How sculptures are drawn today

- **Kit figures.** Every statue and ornament is drawn by default as a procedural kit figure, built from bronze or stone
  parts inside the landmark builder.
- **Installed statues replace them.** A statue becomes installed when it has a record at
  `scripts/sculptures/installed/<id>.json` plus its GLB. `scripts/landmarks/installed-figures.ts`
  (`applyInstalledFigures`, called in `build-manual-landmarks.ts`) removes the kit triangles inside the record's cut
  box and adds the mesh in the record's palette material. The result is baked into the landmark GLB and its LODs.
- **Installed statues are on by default.** They need no flag.
- **The `?sculptures=1` path is separate.** It is the impostor/splat path, used only by De Dokwerker at near LOD.

## What changed in code (lane commits)

**`src/canalRecall/sculptures/wallRelief.ts`** is a new typed module, tested in `wallRelief.test.ts` (9 tests, part of
`test:sculptures`). It places a generated relief on a landmark wall:

- `placeRelief` fits the mesh to a measured width and height on a wall frame (origin, outward normal).
- It clamps the depth so the relief is cut flat at the wall plane, and drops the generator's back lump.
- `alignToPlane` levels a relief that the photo reconstructed tilted.
- `dropBackFacing` keeps a recessed field (such as a medallion's) while still dropping the back.
- `inWallCut` tests a point against an oriented wall-frame cut box.

**`scripts/landmarks/installed-figures.ts`** gains an optional `wallCut` (one box or several) per figure. It removes
kit triangles inside an oriented box on a diagonal wall, which the axis-aligned `cut` cannot express. A record without
`wallCut` builds exactly as before.

**Toolchain hash:** `src/canalRecall/sculptures` is in `SHARED_SOURCE_DIRS` (`manual-source-hash.ts`). Adding
`wallRelief.ts` therefore changes the toolchain hash, and the next build re-exports every manual landmark. The output
is byte-identical for models without a new record, but the integrator should expect a full rebuild after the merge.

**Drivers:**

| Script | Purpose |
|---|---|
| `scripts/sculptures/r2-statue.ts` | Statue candidate: decimate to 6k, kit material, kit plinth, compose |
| `r2-relief.ts` | Relief candidate: place on its landmark, compose, write the record |
| `r2-views.ts` | Gallery and ride-pose views, rendered in Node |
| `r2-sheets.py` | Blind sheets: seeded shuffle, key written outside the sheet directory |
| `r2-stage.py` | Stage the winners' install records |
| `r2-judge-brief.md` | The judge's brief |

**Configs:** `rebuild-r2-20261122.json` (statues) and `reliefs-r2-20261122.json` (reliefs: wall frames, sizes and cuts).

**Changes to existing scripts:**

- `rebuild.ts` and `commons-candidates.ts` take `--config`, and `rebuild.ts` also takes `--sources-dir`. The October
  provenance in `rebuild-sources/` is untouched.
- Their User-Agent is now the repo URL (it had no email; it now matches policy).
- `decimate_scale_glb.py --level` levels a statue base that TripoSR tilted. Without the flag, behaviour is unchanged.

**Bake-off scripts** under `scripts/image-to-3d/` were brought over from lane tripo-ornaments-20261121:

- `birefnet_local.py` (BiRefNet without the ComfyUI server);
- `polygon_cutout.py` (a hand polygon mask, used where BiRefNet failed);
- `place-render.ts --model-glb` (in-situ render of a candidate at the panorama pose).

## Verdicts

The judge's verdicts were unblinded with the key. "new" means the candidate this round. Triangles are the added mesh,
counted in the built GLB.

| # | Item | Model | Candidate (tool, seed) | Blind verdict | Tris | Status |
|---|---|---|---|---|---|---|
| 01 | Spinoza (statue) | spinoza-standbeeld | TRELLIS.2 int8, seed 42 (1 photo) | **new better**: bell cloak, curly head, birds; today is a capsule with a diver's head | 6000 | install-ready |
| 02 | Mama Baranka (statue) | mama-baranka | TripoSR + `--level=0.06`, photo cac10d4136 | **new better**: organic standing woman; today is blocky primitives | 6000 | install-ready |
| 03 | Walraven van Hall (statue) | walraven-van-hall | TripoSR, photo 82071fd7cb (front) | **new better**: the branching network reads; today is a log with sticks | 6000 | install-ready (caveat: trunk sits high on its branches) |
| 04 | Amsterdam arms with lions (relief) | hoofdbureau-elandsgracht | TRELLIS.2, seed 7 (bake-off cut-out) | **new better**: rampant lions, crowned shield, banner; today's lions are slabs | 3284 | install-ready |
| 05 | Pelican medallion (relief) | hofkerk | TripoSR | **new worse**: a hollow ring where the pelican should be | 2336 | **held** |
| 06 | East pediment (relief) | palace-on-the-dam | TripoSR, hand polygon cut-out | **new better**: carved tympanum; today has organ-pipe bars | 5220 | install-ready with caveat (see below) |
| 07 | West-Indisch Huis pediment (relief) | west-india-house | TripoSR, hand polygon cut-out | **new better**: a relief group where the tympanum was blank | 2738 | install-ready |
| 08 | Barlaeus attic group (relief) | barlaeus-gymnasium | TripoSR | **new better**: three winged figures; today is box pillars | 5511 | install-ready |
| 09 | Huis met de Hoofden busts (relief, ×6) | huis-met-de-hoofden | TRELLIS.2, seed 42 (bake-off bust), one bust repeated | **new better**: human heads and shoulders; today's busts read as vases | 10800 (6 × 1800) | install-ready (caveat: one bust shape for six different gods) |

The judge's caveats on the winners:

- **Spinoza:** the head is small and soft.
- **Walraven van Hall:** the trunk is raised "spider-like" on its branches.
- **Palace pediment:** it reads as a lumpy lid that overhangs the cornice, with no single legible figure.
- **West-Indisch Huis:** the relief is bunched in the centre; the garlands and eagle are not distinct.
- **Huis met de Hoofden:** the six busts are one generated bust repeated.

**Palace fix after judging.** The palace's first cut box also removed the horizontal cornice top, which left a
53.7 m open boundary loop and failed `audit:glb` holes. I tightened the cut to along ±11.6, up 0.1–2.9 and out
0.05–0.5 (relief label `tsr-cut2`); the relief mesh itself is unchanged. The audit now passes (warn only: 58 small
loops, largest 28.9 m).

The relief still stands up to 0.8 m proud and covers the raking cornice (`after-cut-fix-palace-pediment.jpg`). A later
fit pass should shrink it to the inner tympanum at about 0.4 m depth. It is "better" by the blind verdict, so it is
proposed, and the integrator may prefer to hold it until that pass is done.

**Held at self-check, before any sheet.** The strips are in the screenshots directory.

| Item | Why it was held |
|---|---|
| Waterdraagster (Bellamyplein) | TripoSR bends the figure in all three photos. Today's kit is clean. |
| Winkler Prins | Both TripoSR meshes have the wrong proportions: a fat drum about 2.5 m wide, where the real column is slender. Today's stainless disc stack is already the right form. |
| Theo Thijssen's boy | Already resolved and installed in October (master-boy-desk), so it was not redone. |
| Oudemanhuispoort cartouche | A melted slab replaced the arch and pediment. |
| Het Sieraad door piers (L/R) | A lumpy slab; Krop's figures are lost. |
| Beurs van Berlage tympanum, Waag Metselaarspoort | Never generated: no usable panorama view (the Beurs view is 5.7 m away at 74° pitch; the Waag views were obstructed). |

**TRELLIS.2.** The machine was loaded (load average about 39), so each job took 16+ minutes. Only Spinoza s42 and
Mama s42 ran. I stopped the queue after the judge returned, because Mama's TripoSR candidate had already won. The
reliefs reused the bake-off TRELLIS.2 seeds 7 and 1234 (Hoofdbureau; seed 7 was chosen at self-check) and seed 42
(the HMDH bust). The relief seed sweeps for Barlaeus, Hofkerk, Oudemanhuispoort, Sieraad, the palace and the
West-Indisch Huis were not run.

## Sources

**Statue photos.** All are on Wikimedia Commons, CC BY-SA unless noted. Full URLs and authors are in
`scripts/sculptures/rebuild-sources-r2/<id>.json`.

| Statue | Photos (title, author) | Licence |
|---|---|---|
| Spinoza | "2019 Spinozamonument (07/09/11)", Ceescamel; "Spinoza -.jpg", Nicolas Dings; "Amsterdam-spinoza.JPG", Serge Ottaviani | CC BY-SA |
| Mama Baranka | "Mama Baranka in 2019 (1/3/5)", Ceescamel; "Amsterdam Nelson Carrilho Mama Baranka", FaceMePLS | CC BY-SA; FaceMePLS CC BY 2.0 (the winning input) |
| Waterdraagster | "Waterdraagster 2.JPG", Marion Golsteijn (CC BY-SA 3.0); 2021 (1)/(2), Ceescamel | CC BY-SA |
| Winkler Prins | Detail photo, Brbbl; "Volten, Het ding…", Ceescamel | CC BY-SA |
| Walraven van Hall | "vooraanzicht" and "zijaanzicht1", Ceescamel; "Monumento a Walraven van Hall", Bettylella | CC BY-SA |

**Relief photos.** These are Gemeente Amsterdam street panoramas, CC BY 4.0. Panorama ids, poses and URLs are in
`scripts/sculptures/rebuild-sources-r2/reliefs.json`.

**Sculptors.** Only the 17th-century works are more than 70 years after the maker's death.

| Item | Sculptor | Died | More than 70 years ago? |
|---|---|---|---|
| Spinoza | Nicolas Dings | alive | no |
| Mama Baranka | Nelson Carrilho | alive | no |
| Waterdraagster | Leo Braat | 1979 | no |
| Winkler Prins | André Volten | 2002 | no |
| Walraven van Hall | Fernando Sánchez Castillo | alive | no |
| Hoofdbureau arms | Hildo Krop (attributed in the config) | 1970 | no |
| Het Sieraad piers | Hildo Krop | 1970 | no |
| Palace pediment | Artus Quellinus | 1668 | yes |
| Huis met de Hoofden busts | 1622, workshop of Pieter de Keyser (attribution) | — | yes |
| West-Indisch Huis pediment | 17th century, maker not recorded here | — | yes |
| Barlaeus attic group | 1885 building, maker not recorded here | — | very likely |
| Hofkerk medallion | maker not recorded here | — | unknown |

All of these are permanent works in public space; the models are derived from open-licence photos.

## Checks

- `test:sculptures`: 24/24 pass.
- `test:landmark-kits`: 331/331 pass.
- Typecheck: the commit hook ran `tsc`.
- **Install dry run.** I copied the staged records into `installed/` and built all eight models with
  `build-manual-landmarks.ts --only=…`, which logged the installed figures. Then:
  - `build:landmark-lods --only=…` built all 8 lod2 models (p50 11.7 KB, max 34 KB).
  - `check:landmark-lods`: current.
  - `audit:glb --id` passes on 7 of 8.
  - The exception is huis-met-de-hoofden. It fails window-rhythm and geometry-regression on main too (a pre-existing
    photo-spec window failure), so this lane does not cause it.
- Afterwards I reverted every generated file and removed the copied records. `test:three-buildings` was not touched,
  so it was not run.

## Install steps (integrator)

1. Merge `lane/sculpture-r2-20261122`.
2. Install the winners:
   `cp -R scripts/sculptures/staged-r2-20261122/. scripts/sculptures/installed/`
   This installs spinoza-standbeeld, mama-baranka, walraven-van-hall, hoofdbureau-elandsgracht, palace-on-the-dam,
   west-india-house, barlaeus-gymnasium and huis-met-de-hoofden. Leave out `palace-on-the-dam.json` and its folder
   to hold the palace.
3. Rebuild the landmarks: `node --import tsx scripts/landmarks/build-manual-landmarks.ts` (a full run, since the
   toolchain hash changed), or `--only=` with the eight ids.
4. Build LODs: `npm run build:landmark-lods -- --only=<the eight ids>`, then `npm run check:landmark-lods`.
5. Rebuild the covers and bundles as usual after landmark installs: build-covers / `check:covers`, the landmark
   bundles, and the landmark cards.
6. Run `audit:glb --id=<each>`. Expect huis-met-de-hoofden's pre-existing window-rhythm failure.
7. Add What's New entries: the Spinoza cloak, Mama Baranka, the Walraven van Hall tree, the Hoofdbureau lions, the
   Barlaeus figures, and the pediments.
