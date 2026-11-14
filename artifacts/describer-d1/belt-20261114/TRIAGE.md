# Outline triage (D1 belt, 2026-11-14)

Each line of /Users/blackmad/Code/map-recall2-worktrees/d1-tranche-belt-20261114/artifacts/describer-d1/belt-20261114/shards/triage.txt is `<pandId> <cut image>`. The cut shows a street photo with a cyan outline that is meant
to sit on ONE house front (pand <pandId>). The earlier reader said the outline was off. For each line, Read the image and
decide one word:
- `ok`     the outline sits on one front;
- `shift`  the outline is shifted or skewed but ONE front clearly holds most of it (more than about 60 %);
- `off`    no single front holds most of it (it straddles two or more fronts about evenly), it sits on a side or rear
             wall rather than a street front, or you cannot tell which front is meant.
Append one line per pand to /Users/blackmad/Code/map-recall2-worktrees/d1-tranche-belt-20261114/artifacts/describer-d1/belt-20261114/outline-triage.tsv: `<pandId>\t<word>\t<short reason>` (for example with
`printf '%s\t%s\t%s\n' ... >> file`). Skip a pandId already in that file. Edit no other file; no git.
