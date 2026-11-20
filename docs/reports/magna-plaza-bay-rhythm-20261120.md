# Magna Plaza: the long fronts' bay rhythm (for the landmark lane)

Found by lane retail-fit-20261120 (round 3), while fitting the Mango and Magna Plaza shop windows. Retail-fit stops here; the
fix is a landmark rebuild.

## What the model draws

`scripts/landmarks/venue-builders.ts`, `id==='magna-plaza'`:
- All four elevations repeat one bay every 5.3 m: `for(let x=-width*.44; x<=width*.44; x+=5.3)` on the long fronts (and
  `-depth*.44 … x+=5.3` on the east/west elevations). The bays skip the corner turrets.
- Each bay has a ground arch `win(x,1.5,…,2.5,3.6,true)`, two upper arches, a stone pier at `x-2.1` and a dormer gable.
- The retail-fit glass retag (`scripts/retail-fit/magna-plaza-glass-retag.patch`) leaves this geometry byte-identical.
  Staged openings: 12 per long front and 4 per short front, at exactly 5.3 m pitch.

## What the panoramas show

Gemeente Amsterdam panoramas, 2025-01-09 and 2023-01-13. Crops are in
`artifacts/retail-fit/photos/walls/0363100012167578/` (`magna-288.png` is Spuistraat, `magna-107.png` is Nieuwezijds
Voorburgwal), and window centres were measured with `scripts/retail-fit/wall-points.ts`:
- **The street-level storey is two tiers.** A low rusticated stone basement carries pairs of small arched windows (two per
  bay, about 1.0–1.2 m wide, sills near the pavement). Above it, a stone band, then the tall rectangular shop windows of the
  bel-étage. These are where Mango's lettering and SALE posters sit, with transoms and stone-and-brick-banded piers between
  them.
- **The pitch is about 3.3–3.7 m, not 5.3 m.** Bay centres along the walls:
  - Nieuwezijds Voorburgwal (w02-107b): 2.5, 5.9, 9.1, 12.4, 15.7 and 18.7 m, so 3.0–3.4 m.
  - Spuistraat (w05-288b): 3.96, 7.6 and 11.6 m, so 3.6–4.0 m.
- Only 11 of the 24 per-window reads land within 2.5 m of a modelled opening, because the model has roughly two thirds as
  many bays as the building.
- The piers carry the striped brick and stone blocks that the model's upper storeys already express, so the band
  heights look right.

## Suggested change (landmark lane)

1. Set the long-front bay pitch from the measured centres (about 3.4 m, using the BAG front length less the turrets), and
   the east/west pitch from their own walls.
2. Split the ground storey in two:
   - a basement row of paired small arches, in `stone` with `dark` panes;
   - a tall rectangular glazed row above it, with panes named so they start with `glass` (for example `glassShop`, which
     geometryAudit's OPENING_MATERIAL treats as an opening).
3. Rebuild with `build-manual-landmarks --only=magna-plaza`, then LODs, covers and `check:covers`.
4. Then ask retail-fit to re-stage the openings (`npx tsx scripts/retail-fit/stage-openings.ts --model=magna-plaza`) and
   re-match the 24 reads, which are by lng/lat in `retail-fits.json`, so they carry over.
