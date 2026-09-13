# Thousand-building neighbourhood preview

Generated 2026-09-13T00:46:31.929Z. Candidate release: `0f625ffc9c7929619629fc2f61019ec8a14cbf4e6427ca3383c015c23fb998d9`. The existing local release remains active.

[Open staged neighbourhood](http://127.0.0.1:5195/canal-drive/city-appearance.html?area=expansion&release=0f625ffc9c7929619629fc2f61019ec8a14cbf4e6427ca3383c015c23fb998d9) · [Source comparisons](http://127.0.0.1:5195/canal-drive/thousand-building-review.html)

## Processing coverage

1009 distinct buildings attempted; 1000 have valid ground-floor analyses and 988 have valid full-façade analyses. 988 have both tiers. Full and ground images never count as separate buildings. 21 tier requests ended as explicit omissions. Analysis elapsed time: 107 minutes, including acquisition/integration pauses between requests.

## Rendered-feature coverage

991 buildings have candidate descriptions attached. The shared compiler emits 12104 observed feature identities across 973 distinct buildings. Generic window and door priors are excluded from these counts. Existing development corrections are retained. Buildings whose crop plane cannot be matched remain omitted.

The scene preserves the existing 7,395 source building geometries and adds 185 source geometry owners in a common coordinate frame, for 7,580 context buildings. This is not 7,580 photographically reconstructed buildings. Source roofs are preserved; this batch does not establish a photographic roof-shape or dormer fidelity score. See thousand-building-roof-scope.md.

## Cost

Confirmed provider charges: $3.5632. One interrupted response has an unknown actual charge, conservatively accounted at its full $0.015 reservation and never resent. Total accounted batch cost: **$3.5782**, against the $10 additional ceiling. Pending reservations: $0. Costs include the retired held-out analyses.

## Verification and limits

The exact candidate was captured at fourteen route positions on desktop and phone: 28 captures, zero browser errors. Peak resident building geometry buffers plus estimated RGBA textures: 9.12 MB. This excludes context/framebuffer/driver allocations and is not a completed full viewport memory gate. Capture hashes and the viewer bundle hash are bound in .cache/city-appearance/thousand-building-final-runtime/manifest.json.

Registration preparation, tier composition, protected materialization, geometry rebasing, publication hash rejection, interrupted/concurrent request recovery, compact normals, Moeders awning LOD/rehydration, physical sign export, and TypeScript checks were run.

Measured reconstruction fidelity is **not accepted**: zero accepted metric registrations; no held-out precision/recall claim; no completed ground-contact or full release gate. The source sample is geographically constrained and historic-building-heavy, with limited interesting retail. Fourteen inadvertently analysed held-out buildings were retired; all thirty held-out IDs are excluded from the reported 1,000-building scope. The original twelve image-numbered examples remain outstanding. The comparison photographs and candidate captures need further architectural and placement review before activation.

## Independent visual and game findings

Five source/full-façade/street comparisons were inspected by the primary agent. All remain unaccepted: missing ornamentation, floor/door placement errors, incomplete stairs and balconies, and a particularly sparse modern apartment frontage. Findings are saved in scripts/review/thousand-building-frontage-gallery-final.json and displayed on the comparison page.

The exact candidate's MapLibre game rendered at the release origin, but the Moeders source-sign tile did not become resident. Thus source-bound text exists in the export and passes isolated rendering tests, but the game smoke fails. Moeders game signs/awning are not claimed fixed. Failure evidence: .cache/city-appearance/thousand-building-game-smoke/0f625ffc9c7929619629fc2f61019ec8a14cbf4e6427ca3383c015c23fb998d9-final-maplibre-sign-tile/failure.json.
