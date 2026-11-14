# Row grounds: reuse the retail pui on traced row fronts (proposal for lane R)

From lane retail-look-20261114 (round 3b), for the integrator to route. Nothing here edits lane R's files
(`houseLine/rowFront.ts`, `roofMesh.ts`, `houseSpec/decorate.ts`, `facadeExtras.ts`, `facadeOrnaments.ts`, `bayLook.ts`).

## What row fronts draw today

`rowFront.ts levels()` passes the traced ground openings through as `specRecipe.groundBoxes`
(`{a0, a1, sillM, headM, kind: 'door' | 'shop' | 'window'}`, fractions of the front) plus `fasciaHex` and `frontSpanM`.
`threeBuildingMesh.ts` (the `groundCut` branch, around line 920) turns each box into one flat textured quad. That quad
samples the ground cell's bay texture (`boxCells.groundOpeningRect`), and the wall above and below gets plain quads.
So a traced shop is a picture of glass on the wall plane, and a traced door is a picture of a door, flush with the wall.
These are the two tells the retail lane fixed for template shops: no recess, and no frame depth.

## Proposal

Everything below stays behind `retailGround` (or a row flag), so the flag-off output does not change.

1. **Doors: `retailDoor`'s recess.** For each `kind: 'door'` box on a street run, cut the wall over
   `[a0, a1] x [base, doorHead(base, groundM)]`. Then draw the recess that `retailFrontTris` draws (`retailFront.ts`,
   the `if (door)` block):
   - two reveals in `shadeHex(frame, 0.6)`
   - a soffit `#2a2622`
   - a step floor `#4a4540`
   - `doorUnit` at depth `FRONT.recessM` (0.5 m)
   - two `FRONT.mullionM` fins on the glass line

   To make this a one-line call, lane retail would export
   `recessTris(e: WallFrame, a0, a1, base, head, depthM, frameHex): FrontTri[]`, factored unchanged from
   `retailFrontTris`. The cut is the same `WallCut` that `retailFrontOn` already returns (`other: '<id>:row-door'`).
2. **Shop boxes: the `puiAt` anatomy in geometry.** For each `kind: 'shop'` box, keep the textured glass quad as the
   interior. Add the frame that `retailFrontTris` builds around each glass segment, using the record's paint
   (`rowFrontShopHex(fasciaHex)` for the frame, `shadeHex(frame, 1.12)` for the riser):
   - end posts: `fin(a0, a0 + FRONT.postM, 0, FRONT.frameOutM, base, head)` and the same at `a1`
   - stall riser to `sillM` with a sill `box(..., FRONT.sillOutM + 0.03)`
   - mullions at most `FRONT.paneMaxM` (1.9 m) apart
   - a transom bar at `min(head, base + FRONT.doorHeadM)`, with transom lights `glassTone('#7f8b93', 0.5)` above it
     when the box is taller than 2.65 m
   - the reflection band: `REFLECT` over the top `FRONT.reflectShare` (34 %) of the glass, 2.5 cm proud of the
     interior quad

   Lane retail would export this as `puiFrameTris(e, a0, a1, base, sillM, headM, frameHex, opts?)`. It is the
   segment loop of `retailFrontTris`, with the content panels left out because the textured quad is the content.
3. **Fascia.** When `fasciaHex` is set, draw the board, cap and bead from `retailFrontTris`
   (`FRONT.fasciaM`, `capM`, `beadM`) over `[first shop a0, last shop a1]`, with no lettering. Row fronts have no POI
   name, and a plain board reads better than invented letters (round 3b lettering rule: fit or don't draw).

## Cost

From the template runs (`scripts/retail-ground/perf.ts`): about 60 triangles per metre of front with content. The
frame-only `puiFrameTris` (no shelves or goods) is about 25 triangles per metre, plus about 40 per recessed door. A
40-front Haarlemmerdijk row at about 5 m each comes to roughly 6.5 k triangles.

## Order

1. Lane retail exports `recessTris` and `puiFrameTris` from `retailFront.ts`, byte-identical for templates, with a
   test that `retailFrontTris` equals its parts.
2. Lane R (or the integrator) calls both from the `groundCut` branch of `threeBuildingMesh.ts`, behind the flag.
3. Judge on the Haarlemmerdijk row sheet (house:frames pairs) before and after.
