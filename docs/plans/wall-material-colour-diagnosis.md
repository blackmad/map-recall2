# Cream-wall colour diagnosis

2026-09-26. Follow-up to the owner's “seems too dark” report for cohort entry 17.

## Finding

The complaint is supported by inspection of the isolated target. The source upper
wall is pale yellow-green/cream; the trial is greyer, darker tan/beige. Neighbouring
buildings and trees obscured the original comparison, but removing them does not
remove the colour mismatch. Entry 17 remains unresolved, not visually accepted.

Two effects must be kept separate:

- The shared cream sprite is `#dfd2b6` (RGB 223, 210, 182). In a browser-only test,
  the fixed light at intensity 0.18 produced target-face medians of (183,172,149)
  for entry 11 and (187,176,152) for entry 17. Intensity zero produced the sprite
  base for both. These measurements describe this renderer and these faces, not
  the real wall's reflectance.
- The reference colours differ: entry 11 is deeper ochre, while entry 17 is pale
  yellow-green. Removing shading made entry 11 too pale and did not correct the
  hue of entry 17. A shared texture/material family does not justify one colour
  swatch for every member of that family.

The next colour experiment retains the shared light and tests a small reusable
palette of smooth-render colours. No independent camera-specific compensation
and no claim that a single photograph establishes exact albedo.

## Evidence protocol

Preserve ordinary game views. Add a separately labelled isolated diagnostic that
hides neighbouring extrusions and study detail layers while keeping the same
camera, target geometry, texture and light. Isolation must be reversible and must
survive selection, mode and camera changes without resurrecting occluders.

For both frontal and oblique cameras, capture a normal image and a magenta owner
identity image. Derive focused crops and distributions only from the owner mask;
retain source and screenshot hashes. Fewer than 100 visible wall pixels is an
explicit insufficient-evidence result, never a passing colour assessment.

Review each dimension separately:

1. Correct owner and exposed source wall; exclude windows, balconies, vegetation,
   ground-floor treatments and neighbouring walls.
2. Material family and whether texture is actually visible in the source.
3. Brightness, hue and chroma direction; avoid treating a shadowed photo sample
   as an unlit material colour. Record disagreement or illumination uncertainty.
4. Same judgement at both cameras; retain real-game occlusion separately from
   the isolated material judgement.
5. Texture size and temporal stability at gameplay zooms before claiming texture
   acceptance. A family-only pass does not establish physical course scale.

Do not expand the trial to the remaining 90 owners on the strength of six broad
family passes. Unknowns remain explicit. The owner need not grade the cohort.


## Tested colour variant

A reusable pale cream render `#ece8c8`, with identical procedural variation and
light, improves entry 17 in both isolated views. The owner-mask median changes
from (187,176,152) to (198,194,167). The reference still has a slightly greener
cast; exact colour remains unaccepted. Applying the same candidate to entry 11
made that building too pale, supporting distinct shared colour variants within
the smooth-render material family.

The live opt-in trial applies this variant to entry 17 through
`public/data/wall-materials/colour-trials.json`, bound to the source photo hash
and owner ID. Base assessments and historical report assignments are preserved.
Sol and Terra independently support improvement in direction only. Local raw
browser experiment evidence is in `.cache/wall-material-demo/cream-variants/`;
repeatable pipeline captures are in `pass-5-isolated` (prior colour) and
`pass-6-isolated` (new colour) under the same cache root.
