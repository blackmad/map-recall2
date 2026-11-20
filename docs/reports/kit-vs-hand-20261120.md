# Kit vs hand: Valkenburgerstraat 69-165 (2026-11-20)

**The question.** For a block-sized modern housing building, which route gets closer to the photos: the large-building kit (a large recipe installed with `install-large`), or a bespoke landmark builder? Cost is the second criterion.

**The subject.** BAG pand 0363100012185504, built in 1998. It has about 3,326 m² of floor area and 196 m of street wall on four streets: Valkenburgerstraat, Koerierstersplein, Rapenburgerstraat and the corner. It belongs to the "1985-2004 · housing · block" cluster.

| | A: kit (large recipe) | B: hand (landmark builder) |
|---|---|---|
| Commit | `1005bc1e27` (recipe source only, not installed) | `a22023b714` (landmark registered) |
| Blind result vs today | won 5/5 faces; PASS 5/5 (today 0/5) | won 5/5 faces; PASS 5/5 (today 0/5) |
| Blind A vs B (5 faces + gallery) | won 1 (vb-se2); PASS 3/6 | **won 5** (nw, nw2, ne, se1, gallery); PASS 4/6 |
| Likeness gate (large.ts) | g0/g1/g4 FAIL; g2/g3/g5 NO EVIDENCE because the crops are washed out; all six installed with `--allow-inferred` | n/a (openings and inventory gates pass) |
| Triangles | 9,638 | 19,697 |
| GLB bytes | 731,588 | 267,624 |
| Wall-clock | about 6 min to an installable recipe, then about 8 min for frames and commit | about 15 min to the first build, then about 4 min fixing stepped-top walls and seam windows |
| Tokens (this lane's transcript) | about 68 k output, 0.4 M input, 14 M cache read | about 146 k output, 0.24 M input, 45 M cache read |

Notes on the table:
- Wall-clock times overlap a little, because A's frames ran while B was being written. Token figures are split by timestamp window, so they are rough.
- Each of the three blind judges used about 60 k tokens.
- B's bytes are smaller than A's even though it has twice the triangles. The recipe GLB carries per-vertex colour and normals that the landmark exporter shares.

## Blind judging

Method:
- Frames come from `house:frames` in game (`?engine=own`, `?world=live`), five poses from `scripts/data/large-buildings-20261120/frames-valkenburgerstraat-69.json`.
- The gallery pair is an offline aerial render from NW and SE.
- Each pairing went to a fresh opus judge as photo | X | Y, with sides randomised by a seeded RNG.
- Key: `artifacts/kit-vs-hand/blind-key.json`. Images: `artifacts/kit-vs-hand/blind/p{1,2,3}/`.

Per-face winners, decoded with the key (confidence in brackets):

| face | A vs today | B vs today | A vs B |
|---|---|---|---|
| vb-nw (Valkenburgerstraat, long front) | A (med-high) | B (med-high) | B (low) |
| vb-nw2 (Valkenburgerstraat, west) | A (high) | B (high) | B (low-med) |
| vb-ne (Koerierstersplein courtyard) | A (high) | B (high) | B (med) |
| vb-se1 (Rapenburgerstraat) | A (high) | B (high) | B (high) |
| vb-se2 (Rapenburgerstraat east) | A (high) | B (high) | A (low-med) |
| gallery | | | B (med) |

The judges' top differences:
- **Today loses every face** for the same reasons: it is uniform brick with an office window grid, and it has a continuous red-fascia shopfront band. The shopfronts are wrong on the residential Rapenburgerstraat and Koerierstersplein sides.
- **A and B both** get the colour split along the Valkenburgerstraat front and the feature glazing on Rapenburgerstraat.
- **B over A, Koerierstersplein:** B has the white upper block over a brick maisonette base with coloured doors, and the brown-backed two-level loggia. A shows a dark glass slot instead.
- **B over A, Rapenburgerstraat se1:** B has the white-framed panel with two gridded windows and the second tall glazed bay. A's panels are oversized and pink.
- **B over A, Valkenburgerstraat:** B has the light balcony stack and the glazed bay column. A makes the corner a solid grey tower, and its north-west end is a blue curtain wall that appears in no photo (the gallery judge's main reason).
- **A over B, se2:** A keeps the pink/brick split there. B is all red, and its tall grid reads tilted.
- **Shared misses:**
  - Both models make the right-hand building at the Koerierstersplein pose red brick. In the photo it is a white facade with a dark panel; it is a neighbour outside this pand, and its look comes from its own generic model.
  - Neither shows the white-railed balcony stack at the right of se2.

Contact sheet (photo | today | A | B per face, plus the gallery row): `artifacts/kit-vs-hand/sheet.jpg`.

## Kit gaps (what A needed and the kit could not say)

1. **Per-house rows inside one wall plane.**
   - The Valkenburgerstraat front is five different fronts on one 3DBAG plane: dark-grey ribbon brick, a white glazed bay stack, a red strip, and two mauve fronts.
   - `houses` can split the colours, but `ribbonStoreys`, `brickStoreys` and window grids are per group, not per house. So the dark front cannot have ribbons while its neighbour has punched windows.
2. **Projecting bay-window stack.** There is no component for a four-storey glazed box about 0.7 m proud, with a rail on top.
3. **Proud render panels.**
   - Rapenburgerstraat has a white rendered panel 0.2 m proud of the brick, framing two tall gridded windows.
   - The kit only has a colour per group, so A put the panels flush and the wrong colour.
4. **One source colour per group.** w05 (white panel) and w07 (maroon panel) share one group, and the kit picks one colour for both.
5. **Loggia with a coloured back wall.** `loggiaBands` cuts dark slots; the Koerierstersplein loggia has brown brick backs and rails.
6. **Letterbox slot windows** staggered between tall windows. They can only be approximated through `bayWindows` slot patterns.
7. **Glass-block panels** under the windows of the dark front.
8. **Set-back penthouses and stepped 3DBAG tops.** The kit gives set-backs the group's system; the photos show a separate glazed and mauve top storey.
9. **Washed-out crops.** Three of six groups returned NO EVIDENCE (over 30 % washed out). The gate cannot tell a good fit from a bad one there, and the install needs `--allow-inferred`.
10. **No shopfront veto.**
    - The kit's ground storey defaulted to shops on residential sides.
    - B could choose doors per front. This lane did not find a per-group "residential ground" switch in the large tier.

Gaps 1, 3, 4 and 5 account for most of B's wins.

## Recommendation for the ~64 block-sized buildings (23 in 1985-2004, 41 in 2005+)

**Kit by default, hand only above a composition threshold, not a size threshold. Close kit gaps 1, 3 and 4 first.**

Reasons:
- **Either route is a large win over today.** Both beat today 5/5 with 5/5 PASS. Today's generic block is what riders see on all 64.
- **The kit is about 2-3x cheaper.**
  - Tokens: about 68 k vs 146 k output, and 14 M vs 45 M cache reads.
  - Wall-clock: about 14 min vs about 19 min, mostly measuring.
  - It passes the large-recipe gates and hashes without a landmark registry entry, LODs or covers churn.
  - B is half the bytes, but twice the triangles.
- **B's margin over A is real but modest.** It won 5 of 6, but two of those wins were low confidence. A still passed 3 of 6 head-to-head against B, and 5/5 against today.
- **B's wins come from multi-front composition, not from size.** They come from several distinct house-fronts on one plane, proud panels, and coloured loggias.

A practical rule for the 64:
- Use the **kit** when each street wall reads as one system (a single brick or render field with a repeated window type, balconies or loggias). Most 2005+ blocks look like this.
- Use **hand** when a single wall plane carries **three or more** visibly different fronts (material plus window system), or when there are proud panels or loggias that define the street read. 1985-2004 "postmodern row" blocks like this one are the typical case.
- Expect roughly a quarter of the 64 to need hand. This is a guess from the cluster previews and needs checking on the first batch.

Kit work that would flip most of these cases back to the kit:
- per-house components inside a group: ribbons, brickStoreys, windows (gap 1);
- a proud-panel component with its own colour (gaps 3 and 4);
- loggia back-wall colour and rails (gap 5);
- a `ground: residential` default for housing clusters (gap 10).

## Caveats

- This is one building, with one judge per pairing, and several calls were low confidence.
- The pand-reference crops (`pand-reference-walls/0363100012185504`) were not archived to map-recall2-source-data from this lane.
- The landmark build changes the shared `toolchain` hash in `modelSourceHashes.json`, because material-slot-tags and the builder registration changed. This lane did not commit that change, so the integrator should expect the toolchain hash to move on the next full build.
- B needs LODs, the signature bundle and covers rebuilt by the integrator before it shows in the shipping game.
- A is kept only as recipe source. The recipe directory exists, but nothing installs it. Re-running `install-large --house=valkenburgerstraat-69-185504 --install` would put both in the world, so don't.
