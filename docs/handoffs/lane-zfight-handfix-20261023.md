# Lane: z-fight hand fixes after the shared-helper pass (2026-10-23)

Follow-up to `lane-zfight-frames-20261013.md` and the 2026-10-20 shared-helper
pass (`e32779baf`, `9e0738d05`, pinned by `scripts/landmarks/kit-standoffs.test.ts`).
A fresh survey of all 352 landmark GLBs (`scripts/landmarks/zfight-survey.ts`)
gives 243 above the 0.5 m² gate; the former top two (bercylaan-801-855,
jacob-bontiusplaats-9) are already clear because the shared kits were lifted.
The remaining top offenders are builder-specific, not shared helpers.

This lane fixes the two clearest of the current five worst and records the
others with what blocks them. Work is on branch `fix/zfight-shared-20261023`
(worktree `/Users/blackmad/Code/map-recall2-worktrees/zfight-shared`).

## Landed

### Klimmuur Centraal (`klimmuur-centraal-builder.ts`)
- White/stone cladding bands sat 2.5 cm over the concrete wall faces → 6.5 cm.
- Steep silver sheet sat 3.5 cm over the grey-brick roof; lifted vertically by
  16 cm (≈5 cm along the steep roof normal).
- zfight gate: **680.67 → 49.76 m²** (coplanar 167.85 → 37.87, tight 512.82 →
  11.89). Remaining 11.89 m² is the folding shutter's concrete panel 2 cm in
  front of its frame; left for a later pass (below the model's baseline).

### Academie voor Theater en Dans (`academie-theater-dans-builder.ts`)
- The rear (canal) elevation carried a 19.7 m ochre sheet 18–22 mm off the
  white source shell. It now uses the shell's pale colour at 5 cm.
- zfight gate: **515.15 → 208.96 m²** (coplanar 483.34 → 177.15, tight 31.81
  unchanged). The remaining 177 m² is the glass/white opening field, below the
  recorded baseline; `audit:glb --only-geometry` passes.

All model exports were rebuilt (`build-manual-landmarks.ts --only=…`), LOD1s and
`signature-placement.bundle.js` refreshed, `modelAssetVersions.json` /
`modelLods.json` / `signature-landmarks.json` updated. `model-dates.json` was
left alone (the rebuild rewrote every row from file mtimes; noise).

## Remaining (current survey)
| model | coplanar+tight | blocker |
|---|---|---|
| valley | 2988.17 | glass panes pair with stone balcony/slab faces at 13–29 mm across layered towers; lifting every glass layer 5–7 cm did not move those pairs (tried, reverted). Needs the slab/glass assembly traced per layer. |
| shell-technology-centre | 608.76 | concrete/glass roof strips 7–28 mm where wall glazing tops meet the 3DBAG roof plane. |
| frascati | 520.77 | doubled brick wall between the full-footprint body and the street/hall extrusions; needs the mass split, not an offset. |

`willem-de-zwijgerlaan-350` was tried and reverted: lifting its glazing cleared
the tight band (492 → 28 m²) but moved native coplanar area 8.5 → 18.5 m² and
broke the opening-outside/window-rhythm baselines, so the audit gate failed.

## Evidence
- Demo page: `artifacts/zfight-demo/index.html` (before/after renders with the
  game depth bias, gallery cards, numbers).
- Fresh survey: `artifacts/zfight-now/report.md`; per-model patches with
  `node --import tsx scripts/landmarks/zfight-patches.ts --id=<id> --top=20`.
- Gallery after cards: `artifacts/zfight-demo/after-0.png` (Klimmuur),
  `after-1.png` (Academie).

## Checks
- `npm run lint`
- `npm run test:geometry-audit`
- `npm run check:manual-landmarks` — 353 passed
- `npm run check:signature-bundle` — 353 specs
- `npm run audit:glb -- --id=klimmuur-centraal,academie-theater-dans --only-geometry`
  — 2 pass, 0 fail
