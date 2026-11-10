# Buurt lane brief (P0, 2026-11-10): give a ride-ring buurt its own look

The user's top priority is the number of buurten with their own look on the explorer and coverage pages: 89 of 518 today. A buurt gets its own look when installed block faces, house types or designs draw its pands. You own one or two buurten (named in your spawn message) and one build-year family at a time.

## Before you start
- Read `docs/handoffs/LANE-RULES.md` and `CLAUDE.md`.
- Read the three buurt lanes from today. They are your how-to, including the mistakes they hit:
  - `docs/reports/buurt-landlust-20261110.md`, with its Opus verdict `docs/reports/landlust-r3-strip-verdict-20261110.md` and `landlust-strip-verdict-20261110.md`;
  - `docs/reports/buurt-vogelbuurt-20261110.md`, with `vogelbuurt-strip-verdict-20261110.md`;
  - `docs/reports/buurt-indische-20261110.md`, with `indische-strip-verdict-20261110.md`.
- Your buurt's row is in `docs/reports/ride-ring-buurten-20261110.md`: ride metres, pands, decade, library.
- The pipeline lives in `scripts/block-face/`:
  - discovery and strips;
  - types in `types/<district>/`;
  - `auto-place.ts --buurt=<slug> --district=<district>` (both flags are required);
  - `batch.ts` gates;
  - `compile.ts --install`;
  - `roof-golden.ts`;
  - review sheets.

## Rules
- Use `/usr/bin/git` only. Never use git stash, npm install or pkill; stop servers by their port's PID.
- Run Playwright only via `bash /tmp/canal-pw.sh` with your PW_PORT.
- Do not edit `game.js`, `index.html`, `package.json`, bundles, covers, explorer-looks, TODO.md or HISTORY.md. The integrator rebuilds those.
- You may re-record `scripts/block-face/roof-golden.json` after checking that its CHANGED list names only your faces.
- Open data only: Amsterdam panoramas (data.amsterdam.nl), Beeldbank, BAG, 3DBAG, OSM. No Google or Apple.
- Likeness to the photo is the acceptance bar, not gates passing.
  - Measure window kind, head and pane layout per storey, speklagen, sills, quoins, white frames, doors and door reveals, dormers, crown and gable, and brick tone.
  - Roofs come from the front photo, not 3DBAG.
  - Gables are symmetric. In a same-type, same-year row, clamp a lone eaves outlier of more than 0.8 m to the row line.
- Building lanes improve the kit. When the photo shows something the kit cannot say, add the component (typed, tested, byte-identical when absent) rather than fitting the nearest option. Report what the kit still cannot say.
- Stay within 3,000 triangles per front.
- Never let restriping pick strip dates you have not looked at.
- Hold a pand rather than install a bad likeness.

## Flow
1. Census your buurt: pands by build-year family and type. Pick the largest family that has a coherent street presence along ridden streets.
2. Pull panorama strips for representative faces. Draft or extend the types from the photos.
3. Auto-place, batch, and look at every sheet yourself.
4. Install the runs that look right. Hold the rest with a reason.
5. Write the strip sheets into `/Users/blackmad/Code/map-recall2-source-data/block-face-strips/<buurt>-20261110/`. The integrator commits that repo.
6. Run `npm run test:block-face` and `npm run lint`.
7. Commit, then push your branch: `CANAL_PW_EXCLUSIVE=1 bash /tmp/canal-pw.sh /usr/bin/git push origin <branch>`.
8. Write `docs/reports/buurt-<slug>-20261110.md`: census, types, placed/held/vetoed counts (split as vetoed-before-comparison / compared-and-held / placed), kit additions, and what the kit cannot say.

If one family is done and the buurt still has a large uncovered family, start the next family in the same lane.

## Report back
Report:
- the SHA;
- pands installed per buurt;
- sheet folder path;
- holds and why;
- kit additions;
- what the integrator must rebuild.

An Opus reviewer will judge your sheets by eye after you report, so make the sheets complete: photo, model, overlay, per pand.
