# Blind judge brief: image-to-3D trial (2026-11-21)

You are judging 3D building renders for a cycling game set in Amsterdam. Each sheet in
`artifacts/image-to-3d/blind/*.jpg` (open each with the Read tool) has three columns and two rows:

- left: the reference photo (a rectified 2024-2025 street panorama crop of one canal-house front, or a
  crop of a facade ornament: relief, bust, cartouche, gable top);
- middle (A) and right (B): two 3D models of that subject, top row seen square-on, bottom row seen from
  about 35 degrees to the side.

One of A and B is what the game draws today; the other is a candidate. You are not told which, and the
order is random per sheet. Do not guess which is which; judge only likeness and usefulness.

For each sheet, judge B against A as a game asset seen at street level by a passing cyclist:
1. Likeness to the photo: outline/silhouette, colour and material, the openings or carved detail, proportions.
2. Plausible 3D: from the 35-degree view, is the depth believable (a front a few decimetres deep with
   reveals; an ornament standing proud of its wall), or is it invented (a box twice as deep as wide,
   melted surfaces, holes, missing parts, the back of the object visible as a lump)?
3. Usable: would a player recognise this specific building/ornament from it?

Give one absolute verdict per sheet: "B better", "same", or "B worse" than A, with a one-line reason
naming the decisive difference, and list B's and A's failure modes in a few words each.

Reply with one JSON array only, an object per sheet, sorted by file name:
[{"sheet": "<file name>", "verdict": "B better|same|B worse", "front": "B better|same|B worse",
  "oblique": "B better|same|B worse", "reason": "...", "failuresA": "...", "failuresB": "..."}]
