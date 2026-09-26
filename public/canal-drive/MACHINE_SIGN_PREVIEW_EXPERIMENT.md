# Machine-extracted sign preview — 9 September 2026

Optional preview: `/canal-drive/da-costa-block.html?neighbourhood=1&machineSigns=1`.

This is **off by default**. It adds neutral text annotations on already-observed shopfront walls; it does not create reviewed landmarks, change shopfront classifications, paint facades, add awnings or invent logos. The scene visibly says “Agent-extracted sign preview — unreviewed”. Literal text is a source-image observation, not proof of current tenancy or a reproduction of the actual fascia design.

## Current result

After the independent ten-frontage blind image review, ten source/field-qualified sign records reduce to seven previews after conservative authored-landmark deduplication (the initial experiment had two):

| Current direct-image text | Address | Action |
| --- | --- | --- |
| IJscuypje; ICE CREAM | Da Costakade 28 | Add neutral preview band on its matched wall |
| michel de letter | Da Costastraat 1 / De Clercqstraat 15 | Add neutral preview band on its matched corner wall |
| DORUS | Da Costakade 51 | Add neutral preview band; observed striped awnings are not reconstructed |
| Toms | De Clercqstraat 25 | Glass lettering represented as a neutral annotation, not a literal fascia |
| Chai kitchen | De Clercqstraat 19 | Add text only; observed awning hardware is retracted |
| IWKA | Da Costastraat 6 | Add text only; fixed tiled entrance canopies are not fabric awnings |
| Wasserette; WASH PRATIC | De Clercqstraat 13 | Combine fascia/window text as one explicitly provisional annotation |
| ScooterCentre WEST | De Clercqstraat 8 / 10 | Existing authored building; do not duplicate |
| STERK INGANG STERK | De Clercqstraat 7 | Existing authored building; do not duplicate |
| slijterij STERK | De Clercqstraat 9 | Existing authored business; do not duplicate elsewhere |

The building-level exclusion intentionally errs on the side of omitting a second shop in a shared BAG building. The independent frontage crops and reviews remain available; deduplication does not delete their observations.

## Eligibility and placement

Every preview requires a current direct visual review whose derivation key, referenced crop hashes and any original panorama hashes still match. Building match and appearance eligibility must be explicitly positive, as must both shopfront/sign field eligibility. The effective shopfront must be positive and its non-empty sign text must still be attributed to `agent-visual-review`. Rejected, uncertain, crop-repair, unusable and raw-classifier-only candidates cannot enter the preview.

The renderer then requires the same frontage record already chosen by its per-wall `observationFor` association, a public ground-wall frame and a band rectangle that fits inside that wall polygon. It emits one plane per qualifying frontage, using a neutral high-contrast canvas text texture. No address/name lookup or landmark-name hint is used to invent missing text. Known authored names are used only as exclusion rules.

The seven text bands add at most seven draw calls and fourteen triangles to the scene. In the expanded matched desktop DORUS view, four are in the render frustum: 136 → 140 calls and 314,866 → 314,874 triangles. The initial two-band IJscuypje comparison was 135 → 136 calls and 314,268 → 314,270 triangles. These are matched-view snapshots, not FPS benchmarks. The original block mode remains unchanged even if `machineSigns=1` is supplied without neighbourhood mode; the existing landmark switch also hides preview bands.

## What this experiment establishes

The desktop comparisons show two recognisable text cues where the generic storefronts previously had no business name. The mobile full-facade view has much less room for the longer IJscuypje reading, so close inspection/zoom is still useful; this is not a measured improvement in human recognition. The initial text was too small, and a second pass used more of the canvas and increased the annotation band to the existing authored-sign height. These dimensions remain an illustrative layout, not measurements of the actual sign or facade-specific branding.

Checks:

- `rtk proxy node scripts/check-machine-signs.mjs`: source binding, field gates, withheld placements, bounded literal text and authored deduplication.
- `rtk proxy node scripts/check-machine-sign-render.mjs`: historical initial two-sign regression; its fixed count is superseded by the expanded script below for the current publication.
- `rtk proxy node scripts/check-expanded-machine-sign-render.mjs`: current seven exact labels/observation-wall associations; desktop/mobile DORUS, Chai kitchen, IWKA and Wasserette; DORUS default-off A/B; original/anchor compatibility; hypothetical in-memory same-target human approval cannot deploy a retracted, rigid or unknown canopy. No review writes.

Artifacts are in `.cache/da-costa-neighbourhood/`: `machine-sign-candidates.json`, `machine-sign-render-metrics.json`, `machine-signs-ice-desktop-{off,on}.png`, `machine-signs-ice-mobile-on.png`, and `machine-signs-michel-desktop-on.png`.

No paid inference or human-label writes were used. A useful human check is whether the new IJscuypje/Michel text improves recognition and whether the neutral band locations are acceptable as visibly provisional annotations.

## Expanded visual critique

The expanded automated association/layout/awning-gate suite passed. Direct inspection of the nine captures found a camera/clipping failure, subsequently fixed and independently rechecked; the remaining limitation is partial tree occlusion:

- DORUS is legible on desktop and mobile. One neutral band covers a selected wall segment; it does not reproduce the two real window logos/awning valances across the broader cafe frontage.
- Chai kitchen and Wasserette are correctly associated, but an inventory tree obscures part of each sign from the exact frontage camera. This is especially limiting on mobile. Orbiting or a future viewing-angle adjustment is preferable to moving a measured tree or copying the name onto a neighbouring wall.
- **IWKA obstruction resolved.** The original fixed-21-metre frontage camera was inside/behind the opposite building, producing blank desktop/mobile views. The new normal-ray footprint check reduces IWKA's initial radius to 13.56 m, before the obstruction with 1.5 m clearance. A separate neighbourhood-only display-bound extension also restores roughly 4 m of its wall previously clipped at the study edge. The repaired `frontage-camera-iwka-{1440,390}.png` images were inspected directly: IWKA is now visible and legible on its own wall on desktop and mobile, with no invented tiled canopy or fabric awning.
- The provisional bands can look like manufactured shop fascias although Toms/IWKA lettering is on glass and Wasserette combines two text planes. The persistent unreviewed-preview badge and default-off state are important; these remain identification annotations, not literal sign reconstruction.

Expanded artifacts: `expanded-machine-sign-render-metrics.json`, `expanded-signs-dorus-desktop-off.png`, and `expanded-signs-{dorus,chai,iwka,wasserette}-{desktop,mobile}-on.png`, all in `.cache/da-costa-neighbourhood/`. The original failed IWKA views should remain as regression evidence even after the camera is fixed. At capture time there were 103 frontages / 76 buildings, 33 agent visual reviews, 32 agent-primary proposals, 39 effective storefronts and zero human reviews.

The independent read-only camera audit (`rtk proxy node scripts/check-frontage-camera.mjs`) confirms clear initial camera positions and centre sightlines for all 103 frontages; eleven require a closer radius. The source-boundary tolerance ignores only the first ≤0.25 m inside the target footprint, retaining later self-occlusion and neighbours. Runtime bounds are `[-131,-152,130,137]`, versus compiled `[-130,-147,130,131]`: the largest extension is 6 m, within a 10 m cap; every selected frontage endpoint has at least 2.0159 m margin. Source data, original study and Elandsgracht are not broadened.

The follow-up fixes also resolve the keyboard ArrowUp 18 m snap identified in independent review, and recompute the frontage lens/fit message on resize while preserving the orbit position. Browser regression coverage now includes wheel and keyboard close zoom plus desktop-to-mobile rotation. Malformed display-bound endpoints are handled safely with a regression case.

This remains initial framing, not general collision navigation: manual orbit/zoom can still enter geometry, and trees and overhangs are not collision-tested. The inventory trees retain their physical positions, so Chai kitchen/Wasserette partial occlusion is still a real viewing limitation—not an all-clear visibility result. None of these camera checks establishes literal roof/window reconstruction or human landmark-recognition accuracy.
