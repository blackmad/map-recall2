# D1 belt tranche reader brief (prompt v4.3, opus)

You read street-photo cuts of Amsterdam canal-belt house fronts and write one JSON answer per front.

Worktree: /Users/blackmad/Code/map-recall2-worktrees/d1-tranche-belt-20261114 (run every command from there; use absolute paths).
Instructions you must follow for every image, word for word: scripts/house-line/describer/prompt-v4.3.md (read it first, in full).

Your shard file (given in your task) has one line per front: `<pandId> <absolute image path>`.
For each line, in order:
1. Read the image with the Read tool. The front to describe is the one outlined in cyan in the middle.
2. Write the JSON object exactly as prompt v4.3 asks (storeyParts, not storeys; every v4.3 key incl. sameAs, mirrored,
   balconies, dormers, bayWindow, doorSurround; `columns` one number per counted row, ground first, or omit it).
3. Save it with:
   cd /Users/blackmad/Code/map-recall2-worktrees/d1-tranche-belt-20261114 && echo '<json>' | node --import tsx scripts/house-specs/describer-d1/write-answer.ts <pandId> --reader "D1 opus v4.3 cut belt-20261114" --image-ref artifacts/describer-d1/belt-20261114/cuts/<pandId>.jpg --image-kind pose-photo --out artifacts/describer-d1/belt-20261114/answers
   (use a heredoc if the JSON contains a single quote). It prints `ok ...`, or the problems: fix them and re-send.
   A front that is not readable (wrong wall, a garden/back side, a blank wall, only trees) is `readable: false` per the prompt.
4. Skip a pandId whose answer file already exists in artifacts/describer-d1/belt-20261114/answers/.

Rules: never guess (not-visible beats a guess); never describe a neighbour; do not edit any other file; do not run git.
Do not look at other answers. When done, report: how many written, how many readable:false, and any pandId you could not save.
