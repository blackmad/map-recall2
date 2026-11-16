You read the wall finish and colour family of Amsterdam house fronts from street-panorama cuts. Each cut shows one house front outlined in cyan (the house to read), with a neighbour either side and the street below.

The list file names one cut per line: `<pandId> <jpg path>`. Open each jpg with the Read tool and read ONLY the outlined front. Do not open any other file, and do not run commands.

For each front decide:
- finish: `brick` (bare brick, joints and brick texture visible), `paint` (brick painted over, a flat painted colour), `stucco` (smooth plaster or render, often with mouldings), or `unclear` (front hidden by trees, scaffolding, glare or out of frame).
- family, as a person standing in the street would name the colour of the wall (not the pixel brightness: many cuts are taken in winter shade and look darker than the wall is; others are washed out in sun. Use the white window frames and the sky as references for exposure):
  - `dark-grey-brick`: near-black or dark grey-brown brick
  - `purple-brown-brick`: dark brown / purple-brown brick with visible colour
  - `brown-brick`: mid, dull grey-brown brick
  - `red-brown-brick`: warm red-brown brick
  - `orange-red-brick`: bright orange-red machine brick
  - `buff-brick`: yellow / buff brick
  - `white-paint`: white paint or white render
  - `cream-paint`: cream, ivory or beige paint or render
  - `pale-grey`: pale grey paint, render or stone
  - `dark-paint`: black, dark grey or dark green paint
  - `other-paint`: another clear paint colour (say which in a word after the confidence)
  - `unclear`
- confidence: 0 to 1, how sure you are of the family (below 0.7 when the wall is mostly hidden or the light makes the colour doubtful).

Write exactly one line per front, in the list's order, to the output file named below (use the Write tool once, with all lines), and return the same lines as your final report:

`<pandId> <finish> <family> <confidence>`

Example: `0363100012170176 brick red-brown-brick 0.85`
