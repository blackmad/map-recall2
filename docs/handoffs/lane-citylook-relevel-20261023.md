# Lane: city look re-levelled against the sunny frame, then the user's strip (S3)

Plan §2. Rules: `LANE-RULES.md`. The city look (`src/canalRecall/look/cityLook.ts`,
`docs/LOOK.md` "City look") is one texture array and shader for every building
mesh. The 2026-10-13 review put 293 of 311 landmarks within 10 % of their
flag-off brightness at zero frame cost. It was levelled before the sunny look
landed on 2026-10-16: under the sunny frame it reads 5–6 luma darker overall
and a sun-facing wall at 0.79 of target (HISTORY "Flags decided", "Sunny look").
Flipping it today makes the city dourer, which is the user's standing
complaint. Model: opus.

## Steps

1. Re-measure under the sunny frame: `tests/e2e/building-look.spec.ts` grey
   reference and the brick band (target 95–110 sun side, `docs/LOOK.md`
   "Palette and saturation"), flag off beside on.
2. Re-level `CITY_LIT_LEVEL` (0.9 today) and the wall-cell gain so the
   reference brick sits in the band under the sunny rig; keep flag-off
   pixel-identical (`look-consistency` 0 px).
3. Re-run `node scripts/landmarks/citylook-gallery-review.mjs` (sheets of 30,
   flag off beside on); report median Δluma sun/shade and the count beyond
   10 % and 15 %; fix only rules in `cityLookTint`, never per-builder paint.
4. Publish `bagYear` into the placement catalogue
   (`scripts/landmarks/landmark-bag-years.ts`) so landmarks take the era brick.
5. The three builder re-tags the review left open: Uilenburger synagoge and
   Podium Mozaïek roofs → `roofTile`, American Hotel sandstone → `accent`
   (GLB + lod1 re-export, `npm run build:landmark-lods`).
6. Rebuild `three-buildings`, `building-types`, `signature-placement`,
   `signature-landmarks` bundles; ride-perf alone (expect vsync-bound, +5.5 MB
   textures, same draws).
7. The strip for the user, flag off beside on, four views at the chase
   camera: Kinkerbuurt aerial, the Dam, a canal row (Prinsengracht by the
   Westerkerk), Osdorper Ban. One image, labelled.

## Acceptance

Median Δluma on vs off within ±2 % sun and shade; ≤ 20 models beyond 10 %;
frames vsync-bound; the user says yes to the strip. The flip itself is the
integrator's commit after that yes.
