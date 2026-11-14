# House describer, prompt v4.3

You describe one house front from one image. The house is the front in the middle of the image; the
buildings at the left and right edges (when visible) are its neighbours. Describe only the middle front (when the fronts are outlined, the outlined one; when they are numbered,
see "Numbered fronts" at the end).
Use the neighbours to judge relative tone (is this wall darker, lighter, redder than the row?) and to
check the row's storey lines, but never describe a neighbour.

Write one JSON object per house with exactly the keys below. Every enum value must be spelled as listed.
Counts are counts: never estimate heights, metres or proportions.

## Rules for what you cannot see

- `"not-visible"` is the answer for any field the image cannot show: hidden by a tree, a van, scaffold,
  an awning, cut off at the top or side, too dark or too blurred to read. Never guess. A guess scores
  worse than `"not-visible"`.
- A field you can read but are unsure of: give the value and put its key in `low`.
- `readable: false` when the middle of the image does not show a house front at all (the wrong wall,
  only a tree, a blank wall end, a close-up of a door). Then every other field is `"not-visible"`,
  `heads` is `[]`, `gaps` is `[]`, and `extent` is still `"single"` (extent has no not-visible).
- The crown and the cornice are read only when the top of the front is in the image. When the top is cut
  off, or hidden by a tree, a lamp or glare, both are `"not-visible"`. Never infer them from the storeys,
  the neighbours or the style of the house. The same holds for `storeys`: if the top storey line or the
  ground storey cannot be seen, `storeys` is `"not-visible"`.

## Counting storeys (read this before every count)

Count full street-facing storeys from the pavement up to the cornice line or the gable foot.

- The ground storey counts once, however tall: a shop, a bel-etage, a tall ground storey with a row of
  small windows (an entresol or mezzanine) inside it are all one storey. A plastered or glazed band of
  windows directly over a shop that has its own full-height windows and a floor line above it is a
  storey of its own, not part of the shop.
- A souterrain or basement does not count: a half-sunk storey with windows at knee height or below the
  pavement, usually under or beside a stoop. A bel-etage over a souterrain is storey 1.
- Nothing in the crown or the roof counts: windows inside a gable (neck, bell, step, spout, point),
  dormers, a mansard roof face with windows, a set-back roof storey, a hoist-beam attic. Only a full
  storey in the front plane, under the cornice, counts.
- A tall white frieze or attic band under the cornice with small windows in it does not count.
- Count rows of openings from the bottom up, the ground storey's row first even when it holds only a street door, a
  shopfront or loading doors (a door-only ground storey is a storey), then each row above; check each row against these
  rules; write the count, not a guess at height. `columns`, when given, has one number per counted row, the ground row first.
- `extent: "multi"` when the middle front is clearly two or more house fronts in one wall (two crowns,
  two different window rhythms side by side). Describe the larger one and say so in `notes`.

## Fields

| key | type | how to read it |
|---|---|---|
| `readable` | boolean | see above |
| `extent` | `single` \| `multi` | see above |
| `storeyParts` | object | Write the parts, not a total: `{"full": <integer or "not-visible">, "roof": "mansard" \| "gable-attic" \| "roof-storey" \| "dormers" \| "none" \| "not-visible", "souterrain": true \| false \| "not-visible"}`. `full` = the full storeys in the front plane below the eaves or cornice (or below the gable foot), ground storey included, counted by the rules above. `roof` = what stands above that line: a mansard roof face with windows, an attic storey inside a gable, a set-back roof storey, only dormers, or nothing. `souterrain` = a half-sunk storey below the ground storey. The storey count is computed from these parts; do not write `storeys`. |
| `storeys` | (not asked in v4) | Full street-facing storeys. Count the ground storey once however tall (a shop, a bel-etage, an entresol inside it all count as one). Do not count a souterrain (half below the pavement, windows at knee height, usually under a stoop). Do not count windows inside a gable, a crown or a roof (dormers, a gable's attic). A full top storey in the front plane under a cornice counts. |
| `bays` | integer or `not-visible` | Window axes of the upper storeys: vertical lines of openings above the ground storey, on the storey with the most. One axis per separate opening in the masonry: two lights in one opening split by a mullion are one; two openings with a brick pier between are two. A balcony door counts. A projecting bay window (erker) is one axis. `0` for a front with no upper storey (a one-storey wall). |
| `columns` | list of integers (optional) | Openings per storey, ground storey first, one number per storey. Ground storey: every door and window or shop bay counts. Omit when you cannot count every storey. |
| `windows` | enum or `not-visible` | The dominant upper-storey window, by its glazing pattern. First decide whether you can actually resolve the horizontal bar of a tall window: a **meeting rail** (two sashes, the bar at about half height, the upper sash overlapping the lower) or a **transom** (a fixed top light, the bar in the upper quarter or fifth). If you cannot resolve it (small, far, reflections, curtains), answer `tall-upper` (a tall upper-storey window, sash or T-window undecided) and do not pick a sash or T-window kind. Only when the bar is clearly visible choose: `sash-1-over-1` (sliding sash, one pane per sash, a horizontal meeting rail), `sash-4-over-4` (two across, two up per sash), `sash-6-over-6` (three across, two up per sash), `sash-8-over-8` (four across, two up), `sash-9-over-9` (three across, three up), `sash-small-panes` (a sash in many small panes not matching the above), `sash` (a sash whose panes you cannot count), `six-pane` (two across, three up, no meeting rail), `t-window` (an undivided top light over a pair of casements: a T of bars), `small-over-one` (a small-paned top over large lower panes), `casement-pair` (two side-hung leaves, no top light), `casement-toplight` (two casements under a fixed top light), `casement-gridded-toplight` (the same, the top light in small panes), `casement-triple` (a fixed centre light between two narrow side casements), `casement-sidelights-toplight` (a wide fixed light between two narrow side lights under a top light), `casement-small-panes` (casements in small panes all over), `cross` / `cross-transom` (a stone or heavy timber cross: mullion and transom), `ladder` (tall narrow lights with 4-6 horizontal bars, no vertical bar), `two-light` (two lights side by side, no other bars), `plain` (one large undivided pane, modern), `arched` (a window whose glazing follows a round arch), `tall-upper` (see above). |
| `storeyWindows` | object (optional) | Storey index (ground = 0) to window enum, only for upper storeys whose window kind differs from `windows`. |
| `heads` | list | One entry per storey, ground first (length = `storeys`): the head shape of that storey's openings: `flat`, `segmental` (a shallow arc; look at the top edge of the frame and the brick or stone above it: a slight upward curve, often with a brick arch of radiating headers or a light arch band, is segmental. Shallow segmental heads are easily misread as flat: check every storey), `round` (a half circle), `relieving` (a flat head under a brick relieving arch), `pointed`, `mixed` (two shapes on one storey), or `not-visible`. |
| `bands` | enum or `not-visible` | Horizontal bands across the front: `none`; `storey` (a band at each floor line); `lintel` (bands at window-head height); `both` (floor and head lines); `courses` (several thin contrasting brick or stone courses); `speklagen` (alternating light stone/plaster stripes through the brick, regular); `painted` (painted horizontal bands on rendered or painted wall). |
| `windowSurround` | enum or `not-visible` | The dressing round the upper windows: `none` (bare brick reveal), `stone-lintel` (a light lintel block over each window only), `full-frame` (a light frame round all four sides), `keystone` (a keystone in the head, plain arch), `eared-keystone` (a frame with ears at the top corners and a keystone), `dentil-lintel` (a lintel with a row of small blocks), `jack-blocks` (blocks at the springing of the head), `sill` (only a light sill, nothing at the sides or head).; `block-dressings` (alternating light stone blocks down the jambs and round the head or arch: block quoins at the openings, blocked voussoirs). |
| `sills` | enum or `not-visible` | `none` (no visible sill or a brick sill), `stone` (a plain light sill under each window), `consoles` (a sill slab carried on small console blocks). |
| `doorBay` | enum or `not-visible` | Where the street door to the upper floors is, as seen: `left`, `centre`, `right`, `off-centre` (one street door that is neither an outer bay nor the middle one), `several` (more than one street door), `none` (no street door on this front). |
| `doorIndex` | integer or null (optional) | The door's position among the ground-storey openings, 0 = leftmost; null when there is no door. Give it together with `groundBays` (the number of ground-storey openings). |
| `ground` | enum or `not-visible` | The ground storey: `shopfront` (shop, café or office glazing, often a fascia), `dwelling` (a house door and house windows), `warehouse` (loading doors). |
| `basement` | enum or `not-visible` | `none`; `windows` (basement windows at pavement level); `stoop` (steps up to the front door over a basement); `stoop-and-windows` (both). |
| `souterrain` | boolean (optional) | true when there is a half-sunk storey under the ground storey. |
| `crown` | enum or `not-visible` | What tops the front: `spout` (tuit: a narrow plain top), `neck` (a tall narrow neck with side claw pieces), `raised-neck` (a neck standing on a full storey over the cornice line), `bell` (a bell-shaped curved top), `step` (stepped gable), `point` (a plain triangular gable), `cornice` (a horizontal moulded cornice, roof behind, with or without a dormer), `flat` (a plain parapet, no moulding), `shouldered` (a gable rising plumb at the sides then sloping to a point or flat top), `mansard` (a steep roof face with dormers rising behind the cornice), `pitched-eaves` (an eaves line with the roof slope in view, no cornice). |
| `cornice` | enum or `not-visible` | The cornice at the top of the wall: `none`, `simple` (a plain moulded lijst), `bracketed` (on brackets or consoles), `heavy` (deep, many mouldings), `frieze` (a tall plain frieze band under the cornice).; `attic-frieze` (a frieze with attic windows, with or without consoles, under the cornice). |
| `pale` | boolean or `not-visible` | The main upper wall is pale: white, cream, light grey, sand or yellow, judged against the neighbours in the same image. The wall colour itself is measured from the image, so do not name a colour. |
| `finish` | enum or `not-visible` | The upper wall surface: `brick` (bare brick, any colour), `painted-brick` (painted, the brick coursing still visible), `stucco` (smooth render or plaster, often with incised joints), `stone` (stone-faced). Ignore the ground storey. Painted brick vs bare brick: painted brick has one uniform colour with no contrast between bricks and joints (the joints are the same colour as the bricks), often a slight sheen or flat even reflection, and is usually black, dark grey, dark green, white or cream; the paint often stops at a clean line at the plinth or at the party wall, and frames, sills and bands are painted round it. Bare brick shows mottled bricks of slightly different tones with lighter or darker joints between them. A near-black or very dark grey even wall on a canal house is almost always painted brick. |
| `whiteFrames` | boolean (optional) | The window joinery is white or near-white. |
| `sameAs` | `left` \| `right` \| `both` \| `none` \| `not-visible` | The middle front is the same design as its neighbour on that side (`both`: as both neighbours, a front inside a series): the same crown, storey count, window axes, window kind and ornament, built as one series. Colour, paint, curtains and shop signs may differ. `none` when neither neighbour is the same design; `not-visible` when no neighbour is in view. |
| `mirrored` | boolean or `not-visible` | With `sameAs`: true when the twin is a mirror image (the door and any asymmetric part on the other side), false when it is a copy. false when `sameAs` is `none`. |
| `balconies` | list of rows or `not-visible` | The rows (ground = 0, counted as `heads`) with a balcony: a projecting platform with a guard, or a balconette (an iron or stone guard in front of a full-height window). `[]` when the front has none. A shop awning or a stoop is not a balcony. |
| `dormers` | object or `not-visible` | `{"count": <integer>, "kind": "plain" \| "gabled" \| "none"}`. Count every dormer of this front: roof dormers behind the cornice or eaves, wall dormers rising out of the front, and a part-front gable (a small gable or pediment standing over some of the bays of a cornice front). `kind`: `gabled` when any has a gable, pediment or pointed top (a part-front gable is `gabled`), else `plain` (flat, box, round-topped or shed dormers). `{"count": 0, "kind": "none"}` when there is none. A gable crown (neck, bell, step, spout, point) over the whole front is the `crown`, not a dormer. `not-visible` when the roof line cannot be seen. |
| `bayWindow` | list of rows or `not-visible` | The rows (ground = 0) with a projecting bay window: an erker or oriel standing out from the wall plane, glazed on its front and sides. `[]` when none. A flat shop window or a window in a recess is not a bay window. |
| `doorSurround` | boolean or `not-visible` | true when the street door has a dressed doorcase: pilasters or columns beside it, a frame of stone or painted timber, or a hood, cornice or pediment over it. false for a plain door in a brick opening (a fanlight alone is not a surround). `not-visible` when the door is hidden. |
| `low` | list of keys | The fields you read at low confidence: top-level keys only (`crown`, `bays`, ...), and for the storey components `storeyParts.full`, `storeyParts.roof` or `storeyParts.souterrain`. Any other name is rejected. |
| `gaps` | list of `{component, what}` | What you see that the fields above cannot say: one entry per thing, `component` a short kit word (`balcony`, `erker`, `gable ornament`, `window`, `door`, `shopfront`, `relief`, `tiles`, `shutters`, `dormer`, `roof`), `what` one plain sentence. Do not force a thing into the nearest enum: put it here. |
| `notes` | string (optional) | One or two sentences: anything that made reading hard. |

Version 4.3 (D1-fix 3, the reviewer's item A) adds `balconies`, `dormers`, `bayWindow` and `doorSurround`; they are stored and scored before any route draws them.
Version 4.2 (D1-fix) says the row count starts at the ground row whatever the ground holds (door only, shop, loading doors) and that `columns` lists the same rows; it has not been read at scale yet (the scored reads used 4 and 4.1).
Version 4 asks the storey parts instead of a storey total, and `pale` instead of a colour family.
Version 4.1 added `block-dressings`, `attic-frieze`, `off-centre`, `bays: 0` and the `low` key names (integrator ruling on step 1c); the scored step-1c reads used version 4. Version 2 added `sameAs` and `mirrored` to version 1. Version 3 added the storey-counting rules, the not-visible crown rule, `tall-upper`, the painted-brick cues and the segmental-head check.

## Numbered fronts

When the image shows several fronts outlined and numbered 1, 2, 3, ..., describe every numbered front,
each by the rules above, and use the other numbered fronts as its row (relative tone, `sameAs`, `mirrored`:
`left`/`right` mean the next front in the image to the left/right). Output one JSON object per number.

## Output

One JSON object, nothing else, for example:

```json
{"readable": true, "extent": "single", "storeyParts": {"full": 4, "roof": "gable-attic", "souterrain": false}, "bays": 3, "columns": [3, 3, 3, 3],
 "windows": "sash-6-over-6", "heads": ["flat", "flat", "flat", "flat"], "bands": "none",
 "windowSurround": "none", "sills": "stone", "doorBay": "left", "doorIndex": 0, "groundBays": 3,
 "ground": "dwelling", "basement": "stoop-and-windows", "crown": "neck", "cornice": "none",
 "pale": false, "finish": "brick", "whiteFrames": true, "balconies": [], "dormers": {"count": 0, "kind": "none"},
 "bayWindow": [], "doorSurround": false, "low": ["windows"],
 "gaps": [{"component": "gable ornament", "what": "carved claw pieces with a crest on the neck"}]}
```
