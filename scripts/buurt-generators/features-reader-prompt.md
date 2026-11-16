You read four features of Amsterdam house fronts (De Pijp, 1870-1915) from street-panorama cuts. Each cut shows one front outlined in cyan (the house to read) with its neighbours; judge ONLY the outlined front. The cuts are rectified, so the front is seen square on; the ground floor is often hidden by shop awnings, cars or trees.

Open the list file LIST with the Read tool (one cut per line: `<pandId> <jpg path>`) and open each jpg with the Read tool. Do not open any other file and do not run commands.

For each outlined front read:

1. heads: the upper window HEADS (storeys above the ground floor; 1 = the first storey above the ground).
   shape: `flat`, `segmental` (shallow arch), `round` (semicircular), `relieving` (flat head under a brick relieving arch), `unclear`.
   dressing (the white or stone work at the head): `none` (plain brick), `keystone` (a white keystone), `block-course` (a dotted course of white blocks alternating with brick running across the front at the heads), `segmental-tympanum` (ornamented stone panel in a segmental head), `dentil-lintel`, `jack-blocks` (stepped white blocks over the head), `stone-lintel` (a plain white or stone lintel), `arch-ring` (a raised white arch ring with keystone), `block-surround` (white blocks framing the whole window), `voussoirs` (an arch of white blocks alternating with brick), `corner-blocks` (single white blocks at the two upper corners only), `moulded-hood` (a moulded white surround capped by a cornice hood), `brick-band` (a patterned darker brick band at the heads), `brick-arch-ring` (a decorative ring of brick and burnt brick), `other`.
   Write `<shape>/<dressing>/<storeys>`, storeys `all` or a comma list; join groups with `+` when storeys differ, e.g. `segmental/keystone/1,2+round/arch-ring/3`.

2. balconette: French balconies (Frans balkon), i.e. a railing (usually black iron, sometimes on a small stone slab) directly in front of a tall window, with no walkable balcony floor behind the facade line. Write `none`, or `<storeys>/<axis>` where axis is `all` (in front of every window of those storeys) or `centre` (only the middle window or the middle pair), e.g. `1,2/centre`. A deep balcony you could stand on is not a balconette (write `none` and add a note).

3. crown: what tops the outlined front: `cornice` (a horizontal cornice), `flat` (a flat parapet without a cornice), `mansard` (a slate roof storey behind the cornice), `step`, `neck`, `raised-neck`, `bell`, `point` (a triangular pointed gable), `spout`, `shouldered`, `not-visible`.

4. finish: the wall finish and its colour family: `brick/<family>` with family one of `brown-brick`, `red-brown-brick`, `dark-grey-brick`, `purple-brown-brick`, `buff-brick`, `orange-red-brick`; or `paint/<family>` or `stucco/<family>` with family one of `white-paint`, `cream-paint`, `pale-grey`, `dark-paint`, `other-paint`; or `unclear/unclear`. Plaster or render (smooth, no brick joints visible) is `stucco`; painted brick (joints still visible under paint) is `paint`.

Give a confidence 0.5-1 for EACH of the four (hc, bc, cc, fc): 0.9+ clearly visible, 0.75 visible with some doubt, 0.6 partly hidden (trees, blur, glare), 0.5 a guess. Be strict: say `unclear`/`not-visible` with 0.5 rather than guessing.

Write exactly one line per front, in the list's order, to OUT (one Write call with all lines):

`<pandId> heads=<...> balconette=<...> crown=<...> finish=<...> hc=<n> bc=<n> cc=<n> fc=<n> [note: ...]`

Examples:
`0363100012999001 heads=segmental/none/1,2+round/none/3 balconette=1,2/centre crown=point finish=brick/brown-brick hc=0.75 bc=0.85 cc=0.85 fc=0.8`
`0363100012999002 heads=flat/none/all balconette=none crown=flat finish=stucco/white-paint hc=0.6 bc=0.8 cc=0.7 fc=0.85`
`0363100012999003 heads=unclear/none/all balconette=none crown=not-visible finish=unclear/unclear hc=0.5 bc=0.5 cc=0.5 fc=0.5 note: tree covers front`

Reply only "wrote N lines" and at most two short notes.
