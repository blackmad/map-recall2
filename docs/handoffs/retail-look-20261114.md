# Retail look: shop ground floors that read as Amsterdam shops (2026-11-14, opus)

Branch `lane/retail-look-20261114`, worktree `map-recall2-worktrees/retail-look-20261114`, port 4621.

## Why
David, 2026-11-14: the ground-floor retail rendering "looks very cheap and out of place". On the Kinkerstraat
row sheet (`_pruned-sheets/house-rows-r/`, kinkerstraat round 3) every shop draws as the same flat band: a pale
stall riser, a strip of white dots standing in for a sign, flat glass. The photos above it show dark slim frames,
recessed entrances, deep fascias with real lettering or a plain dark board, awnings, and varied pane rhythms.
`?retailGround=1` (flag, off) is not better: dark timber boxes over the front, floating white door frames, no
awnings (`ui/2026-11-14-shopfront-hendrix/hendrix-retailGround-on-pair.jpg` in the screenshots repo).

## Goal
Shop ground floors that read like the photo at ride distance and in first person, on the default path. Likeness
is the bar, not gates.

1. Survey first (Node): what draws a shop ground today, flag off and on — `bayTextures.ts` shop variants
   (`quietShopAt`, `brownCafeAt`, …), `retailGround.ts` templates, `shopSignature.ts`, `shopfronts.json` fields,
   the house-rows row path's shop ground (lane R draws "one shopfront" for row grounds: read-only for you, R owns
   `rowFront.ts`, `roofMesh.ts`, `decorate.ts`, `facadeExtras.ts`, `facadeOrnaments.ts`, `bayLook.ts`). List the
   cheap tells with a frame each.
2. Pick 8 shop fronts on streets players ride (Kinkerstraat 86–110, Haarlemmerdijk, Utrechtsestraat, Ferdinand
   Bolstraat, a Jordaan corner, a chain store) and build a photo | today | after sheet (house:frames, rule 10:
   72°, 1440×900, dpr 2, plus the chase frame).
3. Fix by cause in typed modules: frame proportions and depth (slim dark mullions, a real stall riser in the
   wall material or dark timber, a recessed door reveal), a fascia that is a board with a cornice line rather
   than a dotted strip (lettering only from OSM name, else a plain board; no invented names), glass that reads as
   glass (reflection, interior depth, not a flat gradient), awning only when evidence says so, colour from OSM /
   chain identity / a restrained palette — never bright random. Byte-identical for non-shop pands.
4. Decide with evidence whether the default painter or `retailGround` should carry it; do not flip the flag —
   report the recommendation with frames.
5. Named regressions for the pinned fronts. Report triangle/byte cost per shopping tile.

## Rules
`/usr/bin/git` only; never a bare stash; commit with `-c core.hooksPath=/dev/null` and the trailers
`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` / `Claude-Session: https://claude.ai/code/session_011MSpAwdr7AP748FfuXEo5M`.
Push your lane branch only. No TODO/HISTORY/whats-new/CLAUDE.md edits, no world compile, no publish; package.json
scripts/tests only. Open data only; chain logos need Commons provenance; User-Agent
`MapRecall/1.0 (+https://github.com/blackmad/map-recall2)`, never an email. Browser runs via `/tmp/canal-pw.sh`
with PW_PORT=4621, one at a time; house:frames unwrapped. Stop your server by port PID. Screenshots to a worktree
of `~/Code/map-recall2-screenshots`, branch `retail-look-20261114`, under `ui/2026-11-14-retail-look/`; copy
sheets to `_pruned-sheets/retail-look-20261114/`. Hand back: SHA, causes, what changed, cost, sheet paths,
recommendation on the flag, kit gaps.
