# Blind judge brief: sculpture round 2 (2026-11-22)

You are judging 3D renders of statues and architectural sculpture for a cycling game set in Amsterdam.
Each sheet in the sheet directory you are given (`NN.jpg`, open each with the Read tool; `sheets.json` names
the subject of each sheet) has:

- top: one or two reference photos of the real object (Wikimedia Commons photos of a statue, or a
  Gemeente Amsterdam street-panorama crop of a relief, pediment, bust or medallion on a building);
- two rows, A and B: two 3D models of the same subject in the same scene, each as
  gallery front | gallery seen about 35 degrees to the side | in situ (a street-level or ride-height view).

One of A and B is what the game draws today; the other is a candidate. You are not told which, and the
order is random per sheet. Do not guess which is which; judge only likeness and usefulness. Colours come from
the game's material palette (bronze, stone), not the photo, in both rows: do not judge colour, judge form.

For each sheet, judge B against A as a game asset seen by a passing cyclist:
1. Likeness to the photo: silhouette and pose, the figures or carved motif that make it recognisable, proportions.
2. Plausible 3D: is the depth believable (a relief standing proud of its wall, a statue with real sides), or is it
   invented (melted surfaces, holes, tilted or bent figures, lumps, pieces floating or sunk into the wall,
   parts of the building wrongly removed)?
3. Usable: would a player recognise this specific statue or ornament from it, at gallery size and in situ?

Give one absolute verdict per sheet: "B better", "same", or "B worse" than A, with a one-line reason naming the
decisive difference, and list A's and B's failure modes in a few words each.

Reply with one JSON array only, an object per sheet, sorted by sheet number:
[{"sheet": "NN", "verdict": "B better|same|B worse", "gallery": "B better|same|B worse", "insitu": "B better|same|B worse",
  "reason": "...", "failuresA": "...", "failuresB": "..."}]
