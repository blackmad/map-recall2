# Lane: memorial figures, a hand pass (content, 2026-10-13)

The queue lane shipped four memorials with rough block figures:
Rembrandtmonument (Rembrandtplein; the seated Rembrandt and the Night
Watch bronze group by Mikhail Dronov and Alexander Taratynov, 22 figures),
Vondelmonument (Vondelpark; seated Vondel with four allegories), the
Nationaal monument Slavernijverleden (Oosterpark; Erwin de Vries's leaning
figure, post figure and roped walkers) and De Dokwerker (hand model). The
sculpture splat track is parked; this is the hand pass in between.

Inputs: `scripts/landmarks/{rembrandtmonument,vondelmonument,slavernijmonument}-builder.ts`
and inventories, `scripts/landmarks/commons-ref.mjs` and `pano-view.mjs`
(the queue lane's photo tools), `docs/buildings-pipeline.md` (bespoke
builders, slots, audit), the figure helpers in existing builders (search
`figure(` in `scripts/landmarks/*.ts`; the Hoofdbureau's krop figures,
the Homomonument). Lane owns these builders, inventories, re-exports and
sheets. Do not edit `game.js`, `index.html`, `package.json`, bundles,
`TODO.md`, `HISTORY.md`. Open data only (Commons with licence recorded,
panoramas CC BY 4.0).

## Deliverables
1. A shared **low-poly figure kit** in `scripts/landmarks/figure-kit.ts`:
   a posed human (standing, seated, striding, arms raised) from tapered
   limbs with a head, shoulders and hips at measured proportions
   (≤ 300 tris each), `materialSlot` bronze/stone, posable by joint angles.
2. Re-model the four memorials with it: Rembrandt seated with hat and
   palette, the Night Watch group's 22 figures in their plan positions (the
   group's plan is well photographed from above), Vondel seated with the
   four allegories and their attributes (lyre, mask), the Slavernijverleden
   walkers as striding figures on the rope, De Dokwerker's stance; plinth
   inscriptions as stroke-font lettering where legible in photos.
3. Gates per model (`audit:glb`, slots 100 %, inventory), gallery strips
   and street-level shots before/after.

## Checks
`npm run lint`, `npm run audit:glb -- --id=<ids>`, `node --import tsx
scripts/landmarks/check-manual-landmarks.ts`, `npm run check:landmark-inventory`.
Report: branch, SHA, per-model table, sheet paths, unfinished.
