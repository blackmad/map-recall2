# Row-sheet review (D1 belt, 2026-11-14)

You judge whether a set of house descriptions makes a street in a game look more like the real street.
Sheets: /Users/blackmad/Code/map-recall2-worktrees/d1-tranche-belt-20261114/artifacts/describer-d1/belt-20261114/sheets/<side>-<n>.jpg (side given in your task). Each sheet row is one camera pose on a canal-side row of houses,
three panels: left = the street photo, middle = the game today, right = the game with the new descriptions ("staged").
The row caption names the house numbers that pose stands for; "held" or "-" marks a house with no new description.
The first page leads with an "as played" pair (today | staged) from the default chase camera.
The photo and game panels do not line up exactly (the game frame is a little tighter and lower): compare the same houses
by position in the row, not pixel by pixel. Trees are hidden in the game frames. Water, sky and ground are not judged.

For each row, compare middle and right against the photo, in this order of importance:
1. colour and finish of the walls (dark brick, painted black, pale stucco, stone: right family and darkness, row rhythm);
2. roofline (gables, cornices, heights against the neighbours);
3. white parts (cornices, window frames, bands);
4. storeys and window bays.
Give one word per row: better, same or worse (the staged panel against today, as a likeness of the photo), with one line
of reason naming the houses (by number) that drive it. "No frame" in a panel: write "no frame" instead of a verdict.
Then a verdict per sheet page (a page is a publish unit: one stretch of the street side): better, same or worse with the
number range and one line of reason. Then a side verdict: better, same or worse overall, and the house-number stretches (if any) that are clearly worse and
should be held while the rest publishes.

Write your result as JSON to /Users/blackmad/Code/map-recall2-worktrees/d1-tranche-belt-20261114/artifacts/describer-d1/belt-20261114/review/<side>.json:
{"side": "<side>", "rows": [{"key": "...", "verdict": "better|same|worse|no frame", "why": "..."}], "pages": [{"page": 1, "numbers": "2-70", "verdict": "...", "why": "..."}], "verdict": "...",
 "holdStretches": ["Herengracht 120-140: why"], "notes": "..."}
Edit no other file; no git. Report in under 100 words.
