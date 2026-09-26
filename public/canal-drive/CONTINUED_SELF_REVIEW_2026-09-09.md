# Second autonomous self-review — 9 September 2026

This continues [the earlier source-repair round](./AUTONOMOUS_CONTINUATION_2026-09-09.md).
Three parallel agents worked on roof components, blind storefront extraction,
temporal alternatives and independent integration/render critique. No human
labels were created. Additional paid inference: **$0**. No new source imagery
was downloaded.

## What is live

- **33 frontages have direct source-image reviews; 32 receive primary agent
  fields.** The new ten-building storefront pass supports six commercial/service
  fronts and resolves four previous unknowns as residential-looking fronts.
  Effective storefront suggestions remain **39**, not artificially inflated.
- **Seven optional sign previews**, up from two: IJscuypje, Michel de Letter,
  DORUS, IWKA, Wasserette/WASH PRATIC, Chai kitchen and Toms. These are neutral
  literal-text previews, not reconstructed original sign placement or reviewed
  landmarks. Default remains off; use `?neighbourhood=1&machineSigns=1`.
  Sterk/ScooterCentre's authored anchors are not duplicated or replaced.
- **Four additional primary roof proposals** from six independently inspected
  street+aerial packets: DORUS/Toms/Chai have flat-core/front-pitch proposals;
  WASH PRATIC has a flat proposal. IWKA and Nassaukade 141 remain unknown.
  Two straight facade-top proposals are separate. Roof-only packets cannot
  overwrite independently reviewed shop, sign or awning fields.
- **Awning presence, kind and deployment are separated.** IWKA's tiled rigid
  canopies are not fabric awnings; Chai's installed awning is retracted; Toms and
  Wasserette have insufficient evidence to resolve hardware/absence. Even a
  human `awning=yes` cannot deploy generic fabric without a source-bound
  deployed-fabric observation on that same wall. These are dated observations,
  not claims of current business occupancy or permanent absence.
- **Roof-component diagrams** are available in the review page's collapsed
  “Compare simplified roof geometry” panel. Source face IDs, projected wall
  contact, separate lower slopes and compatible edge heights are retained.
  A provisional reference deck is explicitly not necessarily the main roof.
  The actual rendered roof meshes are unchanged.
- **Roof questions are classified, not counted as votes.** Current routing:
  67 image-shape disagreements, six mesh-detail-only questions, eleven cases
  without eligible image shape, and nineteen candidate-only cases. Unknown or
  missing model answers do not count as disagreements. These categories are
  not accuracy or confidence scores, and agreement is not verification.

## A real renderer failure found and fixed

Expanded sign screenshots showed IWKA as a blank wall. Its fixed 21 m initial
camera was inside the opposite building. Initial frontage framing now stops
before the first intervening footprint, with a 1.5 m margin; IWKA uses about
13.56 m. All 103 initial positions and centre sightlines pass the footprint
check; eleven frontages need a shorter distance. A 0.25 m tolerance ignores
only the initial source-boundary rounding interval, not later self-occlusion.
Courtyards/holes and concave footprints are covered by regressions.

The source plinth also clipped about 4 m of IWKA's wall and 2.5 m of another
selected frontage. Neighbourhood-only display bounds expand from
`[-130,-147,130,131]` to `[-131,-152,130,137]`, with at least 2 m endpoint margin.
Expansion is capped at 10 m per side; no new area data is fetched, and compiled
source bounds plus original/Eland modes are unchanged. This uses already
available context geometry; it is not a new coverage claim for the 250 m radius.

Desktop/mobile repaired screenshots show IWKA again. Wheel, pinch and keyboard
zoom no longer snap a close camera back to 18 m. Resize refits the bounded lens
without moving into the opposite building. The initial-camera check does not
cover arbitrary manual orbit, trees or overhangs: Chai and Wasserette retain
some real tree occlusion. Inventory trees were not removed to make labels clear.

## What did not justify promotion

- Fifteen older-date alternatives across five obscured wide-frontage intervals
  improved three local entrance observations, but did not establish additional
  shops. Construction, hoardings and the Amsterdam 750 banner obscure other
  dates too. All five interval shop judgments remain unknown; no interval
  observation is silently promoted to a whole-wall label.
- Tiny mesh slivers are preserved for inspection but do not alone generate
  substantive roof questions. Review routing uses explicit area, projected
  area, rise, edge-contact and reference-height thresholds, not a new roof class.
- A lower rear slope is not a front apron; projected touching edges at different
  heights are not physical attachment. Simplified all-flat meshes still cannot
  disprove pitch visible in images.
- The fresh storefront pass confirmed all six baseline positives. The useful
  differences were unknown handling, awning semantics and roof detail—not
  evidence to replace every cheap-model shop-presence call or train on these
  agent proposals as if they were independent human gold.

## Safety, reproducibility and checks

The ledger is unchanged: **$1.237401792 of $5**, 388 calls, no unresolved charges.
Manifest image pixels and human history are untouched. All 733 active source
image files still match their hashes. The six-roof promotion additionally pins
the frozen opinion file and verifies thirty active/staged image pairs before
copying a roof-only packet into publication. Frozen blind decisions and later
awning/mesh schema annotations remain separate artifacts.

The expanded regression suite covers components, roof assessment, source-field
merging, awning state, forty frozen storefront images, temporal alternatives,
camera/bounds geometry, keyboard persistence and false exposure. Independent
UI tests intercepted two synthetic review submissions, forwarded none, and
verified the real export byte-identical. Opening geometry records suggestion
exposure; hiding it afterwards cannot falsely mark a decision as unassisted.
The diagram warns when a correction selects a different wall/building while
its source diagnostic remains tied to the original photographed wall.

The eight-view real renderer matrix passes desktop/mobile original,
neighbourhood and Eland modes. Neighbourhood overview remains 168 draw calls;
the small display extension adds 2,184 triangles (336,989 total). Source roof
meshes, material batching and authored landmarks are preserved.

Reports: [blind storefronts](./BLIND_STOREFRONT_REVIEW_EXPERIMENT.md),
[roof components](./ROOF_COMPONENT_EXPERIMENT_2026-09-09.md),
[six new roofs](./STOREFRONT_ROOF_FOLLOWUP_2026-09-09.md),
[temporal bays](./TEMPORAL_GROUND_BAYS_2026-09-09.md),
[sign preview and visual QA](./MACHINE_SIGN_PREVIEW_EXPERIMENT.md).

Useful human checks tomorrow remain the shadowed/ambiguous roof components,
decorative-top taxonomy and a few physical wall associations. There is no need
to re-label the entire dataset before inspecting the improved demo.
