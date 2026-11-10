# Register extras: why forced extras drew nothing (lane register-extras, 2026-11-10)

Follow-up to `register-recipes-verdict-20261110.md`. That review found that forced register extras drew nothing in the
live ride: stoop and door surround were absent on Langestraat 175320, and the held and no-hold runs were
pixel-identical in 11 of 12 frames. We traced one forced extra end to end in `?engine=own&world=live`. These were the
suspects: the decorator not reaching the worker, the per-wall budget, the tier, and the baked shells. We found three
causes.

## Root causes (measured)

1. **The thin fade erased every facade extra (render).** It was erased in the live ride whenever the camera faced
   east or west, and in any level view. `look/thinFade.ts` read the focal length as `projectionMatrix.elements[5]`.
   The shared frame keeps the camera matrices at identity and draws with `clipFromWorld = P · V`, so that element is
   P11 times the north component of the camera's up vector.
   - Measured in the ride: `e[5]` was 0.11 at Felix 169116 and 0.06 at Nieuwmarkt. The true P11 is 1.73.
   - The focal length was therefore 3–6 % of the true value, and every thin triangle was dithered out. All extras are
     thin, including stoops, door surrounds, cornices and string courses.
   - On 175320 the extras chunk was installed and visible, with 112k triangles carrying the forced door surround, stoop
     and basement well (worker job replayed in Node). It drew 8 px; hiding it changed nothing.
   - Fix: `projectionFocal11()` uses the length of the projection's y row. A new test in `thinFade.test.ts` turns a
     pitched ride camera through five headings and three pitches. The old read fails it, giving 985 px/m facing north
     at 60° and about 0 facing west.
2. **The strip harness never left its first spot.** `register-frontal-strip.spec.ts` changed only the `#race=` fragment
   between spots. That is a same-document navigation, so the rider stayed at the first spot and every later frame was
   drawn by the coarse tier, which has no extras chunk.
   - This is why 11 of 12 verdict frames were identical: only the first spot, plus its neighbour, was in the detail
     tier.
   - Fix: `cam=<slug>` forces a full load per spot. The spec now asserts that the aimed pand has its `near` and
     `extras` chunks. The old navigation fails that assertion at the second spot (felix-169116).
3. **Forced parts lost to the dice (budget and group).** `registerForce` set a stated part's chance to 1, but the part
   was still dressed in registry order, after dice-won crowns, doors and trim that spent the wall's 180-triangle budget
   or took its group.
   - Forced alone, a part drew on this many of 40 test walls:

     | part | walls (of 40) |
     |---|---|
     | iron balconies | 4 |
     | corner pilasters | 6 |
     | bay window | 8 |
     | shutters | 13 |
     | console cornice | 15 (a dice kroonlijst took the crown) |
     | gable stone | 15 |
     | string courses | 17 |

   - Fix: `registerFirst()` in `facadeExtras.ts` dresses the stated parts first. Each part forced alone now draws on
     36–40 of 40. With nothing stated the wall is unchanged: `test:facade-extras` still gives 9166 triangles.

Ruled out:
- The decorator does reach the worker: features are posted whole, and the probe saw `registerForce` on the chunk
  source.
- Tier: extras are built for the 2×2 z16 detail tiles around the rider.
- Baked shells: they draw coarse only. The extras come from the runtime `extras:` chunks in every world mode.

## Strip

The cameras come from `scripts/register-facts/frontal-cams.ts`. It picks the street front and a land panorama in front
of it, 12–40 m away, scored by obliquity. Where one exists, it adds a second view from the other side of the normal
(`-b`). That gives 19 frames for the 12 houses.

- Sheets: `map-recall2-screenshots-a1/buildings/2026-11-10-register-extras/strip-{1,2}.jpg`, columns photo | before (main as shipped) | after (this branch, shipping holds).
- Review sheets `review-{1,2}.jpg`, columns photo | fixes with holds | fixes with nothing held. Single frames are in `frames/`.

In narrow streets (Langestraat, Vijzelstraat side streets) no frontal 15–25 m panorama exists, so those frames are
55–60° oblique at 12–14 m.

## Per read

| read | verdict | evidence |
|---|---|---|
| stoop | **ship** | Drawn at the stated door: 175320 (photo: raised stoop), 171023-b. Small (1–2 white steps, no railing), never wrong. |
| door surround | **ship** | Pale jambs and head at the stated door: 175320, 171023-b (photo: white classical surround). Small. |
| hoist beam | hold | Not in view where stated: 176312 is at 38 m, 168578 was not drawn in frame. |
| kroonlijst, console cornice | hold | A cornice-gable front (`monumentGable: cornice`) gets roofKind `gable`, and the cornice extra refuses it because the roof draws the crown. On mansard roofs the crown is out of frame. |
| gable stone, wall anchors | hold | Not distinguishable at 12–40 m. |
| corner pilasters | hold | Stated on 169116, but the photo shows a plain brick front. Register pilasters are often on a side wall or indoors. |
| cellar entrance | hold | Basement well not visible beside the 175320 stoop. |
| balcony | hold | No balcony visible on 175318 in frame. About 90 % of these statements come from long texts. |
| bay window | hold | Draws as a flat pale glass panel on the 176346 gallery block, which reads wrong. |
| shutters | hold | Not drawn on 168578 (1935 office) in frame. |
| speklagen → string courses | hold | String courses are a 6 cm cream drip edge. Nieuwmarkt 20–22 changed by 6 px. |
| dakkapel | hold | Roof planes are not in frame from the street. |

## Kit cannot yet express

- Speklagen as bands: 20–30 cm white stone courses through the brick, several per storey, with block quoins (Nieuwmarkt
  20–22).
- A raised stoop with iron railings over a cellar entrance (175320, 171023). The kit stoop is 1–2 plain steps.
- Consoles under a cornice that the roof draws (`monumentGable: cornice`).
- A rich door surround with a fanlight (175320). The kit surround is plain jambs and a head.
- The 176346 Utrecht gallery block (a landmark candidate), the 176312 corner bay with its half-timbered gable, and
  painted-black brick (unchanged from the verdict).

## Note for the integrator

Fix 1 is visible city-wide. Every generic house's dice extras (stoops, door surrounds, string courses, pilasters,
flower boxes) were invisible in level and east/west views since the thin fade landed (#230). Now they draw as tuned in
October.
