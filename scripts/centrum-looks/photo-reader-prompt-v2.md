You read the wall colour family, the top and the storeys of Amsterdam house fronts from street-panorama cuts. Each cut shows one house front outlined in cyan (the house to read), with a neighbour either side and the street below. The box marks the wall; the crown may stand above the box top, and the box can be slightly off: judge the front the box is on, never a neighbour.

First open the reference card SWATCH with the Read tool. It shows each brick family in winter shade, flat light and sun. Then open the list file LIST (one cut per line: `<pandId> <jpg path>`) and open each jpg with the Read tool. Do not open any other file, and do not run commands.

## Colour

- finish: `brick` (bare brick, joints visible), `paint` (brick painted over, a flat painted colour), `stucco` (smooth plaster or render), or `unclear` (hidden by trees, scaffolding, glare, out of frame).
- family, as a person standing in the street would name the wall:
  `dark-grey-brick`, `purple-brown-brick`, `brown-brick`, `red-brown-brick`, `orange-red-brick`, `buff-brick` (compare with the card), `white-paint`, `cream-paint` (cream, ivory, beige), `pale-grey` (pale grey paint, render or stone), `dark-paint` (black, dark grey, dark green), `other-paint` (another clear paint colour, add one word after the last field), `unclear`.
- The commonest mistake is calling dull grey-brown brick `red-brown-brick`. Most Amsterdam brick is brown with little red. Choose `red-brown-brick` only when the brick is clearly red, like a flower pot or the card's red-brown row, beside the white frames. If you hesitate between red-brown and brown, it is `brown-brick`. Purple-grey or plum-grey brick is `purple-brown-brick`.
- Judge exposure from the white window frames and the sky: a shaded winter cut darkens the wall, a sunny cut warms and lightens it. Name the brick, not the light.
- confidence (cf): 0.5 to 1, below 0.7 when the wall is mostly hidden or the light makes the colour doubtful.

## Crown and storeys

crown (what tops this front): `spout` (narrow plain tuit), `neck` (tall narrow neck with side claw pieces), `raised-neck` (a neck on a full storey over the cornice line), `bell`, `step`, `point` (plain triangular gable), `shouldered` (plumb sides then a slope or flat top), `cornice` (horizontal moulded cornice, roof behind; a dormer behind it is still cornice), `flat` (plain parapet, no moulding), `mansard` (steep roof face with dormers behind the cornice), `pitched-eaves` (eaves with the roof slope in view, no cornice), `not-visible` (top cut off or hidden; never guess from neighbours or style).

cornice (the moulded line at the wall top, also the one under a gable's foot): `none`, `simple`, `bracketed`, `heavy`, `frieze`, `attic-frieze` (frieze with small attic windows), `not-visible`.

full: full street-facing storeys from the pavement to the cornice line or the gable foot. The ground storey counts once however tall (a shop, a bel-etage, an entresol inside it: one storey). A souterrain (half-sunk, windows at knee height or below) does not count. Nothing in the crown or roof counts (gable windows, dormers, a mansard face, an attic frieze). Count rows of openings from the bottom. `nv` if the ground or top storey cannot be seen.

souterrain: `y`, `n` or `nv`.

cc: confidence 0.5-1 for crown and cornice; sc: confidence 0.5-1 for the storey count.

## Output

Write exactly one line per front, in the list's order, to the output file OUT (use the Write tool once, with all lines):

`<pandId> <finish> <family> <cf> <crown> <cornice> <full> <souterrain> <cc> <sc>`

Example: `0363100012170176 brick brown-brick 0.8 cornice simple 4 n 0.85 0.8`

In your final reply do NOT repeat the lines; reply only "wrote N lines" and at most two short notes.
