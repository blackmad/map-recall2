# Lane: time of day — an opt-in dusk ride

Rules: `LANE-RULES.md`. Plan: `slop-newyork-plan-20261029.md` §4 lane G, §5.
Evidence: `docs/research/slop-newyork-20261029.md` §1 (interior mapping,
`distantWindowLight`) and §2 (presets, sky-matched fog). Model: opus.
User, 2026-10-29: time of day is "a cute thing"; no NPCs, no audio. Depends
on lane B (the shader facades carry the lit windows).

## Constraints that do not move

- LOOK §Light stays one sun at 215°/40° for every likeness strip, gallery
  card and parity test. The dusk preset is a ride mood behind
  `?mood=dusk` (and later a setting), never the default and never the rig a
  building is reviewed under.
- Geographic learning first: nothing in the dusk look may hide the street
  under question or the corridor. Street-name and spoiler rules unchanged.
- One sun still: no point lights. Slop's clustered lighting is WebGPU-only
  and we do not want 100 forward lights on a phone; lamp pools are emissive
  decals on the ground if at all.
- Programs stay ≤ 32: the dusk terms are uniform branches
  (`if (uNight > 0.0)`) inside the existing facade and ground programs, not
  new materials.

## Build

1. A `mood` record beside the light rig (`rendererShared/lightRig.ts`):
   sun elevation and colour, hemisphere sky and ground, exposure, fog
   colour and density, `uNight` 0..1. Dusk: sun ~8° at ~250°, warm,
   intensity about a third of day; sky `#9fb3cf` over `#6b5a4a`; the
   palette's shade ratio untouched.
2. **Lit windows** on the shader facades: slop's interior mapping
   (`js/tsl-materials.js:230-385`) reduced to a room 2–3 bays wide with a
   warm or cool lamp, per-room lit probability from the seed, curtains as a
   tone band; ported to GLSL under `uNight`. Beyond the pixel footprint,
   `distantWindowLight` (`:166-187`): power-of-two 1–2 px clusters,
   world-anchored, cross-faded, mean brightness preserved, so far towers do
   not twinkle. Kits, recipes and landmarks get only a flat window emissive
   from their existing glass material under the same uniform (report which
   of them have no glass mask).
3. **Sky-matched fog**: replace `fog_fragment` with a sample of a small
   azimuth × elevation horizon texture per mood (cheap on phones; slop
   samples the PMREM at roughness 0 along the view with elevation ≥ 0.015).
4. Ground: the klinker and asphalt tones through the same exposure; the
   water a shade darker; no reflections (user 2026-10-13).
5. HUD: the mood is visible in the ride summary so a screenshot can be
   attributed.

## Measure

Desktop fixed ride and the iPhone profile with `?mood=dusk` against day:
frame p95, draws, programs (must stay 32), GPU memory. Day frames
pixel-identical to before the lane (`building-look`, `look-parity`,
`look-consistency` specs).

## Acceptance

The user rides it at the Dam, the Keizersgracht ring and the IJ at dusk on
desktop and phone, from a before/after sheet at gallery size. Not accepted
if the corridor or the question street is harder to read than by day.

## Checks

`npm run lint`; `npm run check:canal`; `PW_PORT=<port> npx playwright test
building-look look-parity look-consistency ride-perf --project=desktop` and
`ride-perf --project=iphone` under the lock, both with and without the flag.
