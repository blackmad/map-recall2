You read the upper window heads of Amsterdam house fronts from street-panorama cuts. Each cut shows one front outlined in cyan (the house to read) with its neighbours; judge only the outlined front.

Open the list file LIST with the Read tool (one cut per line: `<pandId> <jpg path>`) and open each jpg with the Read tool. Do not open any other file and do not run commands.

For the upper storeys (above the ground floor), read the window HEAD shape and its DRESSING:

shape: `flat` (straight head), `segmental` (shallow arch), `round` (semicircular arch), `relieving` (flat head under a shallow brick relieving arch), `unclear`.

dressing (the white or stone work at the head; the thing that makes the row recognisable):
- `none`: plain brick heads
- `keystone`: a white keystone on a flat or segmental brick head
- `block-course`: a dotted course of white blocks alternating with brick running across the front at the heads
- `segmental-tympanum`: a segmental head with an ornamented stone panel (tympanum) in it
- `dentil-lintel`: a lintel with a dentil course
- `jack-blocks`: stepped white blocks over the head (a crown of small blocks)
- `stone-lintel`: a plain white or stone lintel
- `arch-ring`: a raised white arch ring with a keystone over a round or segmental head
- `block-surround`: white blocks framing the whole window, quoins up both jambs with a keyed head
- `voussoirs`: an arch ring of white blocks alternating with brick (wedge-shaped voussoirs) over a segmental or round head
- `corner-blocks`: single white blocks at the two upper corners of the head only (no full lintel, no ring)
- `moulded-hood`: a moulded white surround up the jambs and over the head, capped by a projecting cornice hood
- `brick-band`: a patterned band of darker or burnt brick running across the front at the heads (no white stone)
- `brick-arch-ring`: a deep decorative ring of brick and burnt brick in turn over the head (brick, not white stone)
- `other`: something none of these says (add a short note at the end of the line, e.g. `note: pediment hoods on 1st floor`)

If the storeys differ (e.g. round heads on the top storey only), give two groups; storeys are numbered 1 = first above the ground. Use `all` for every upper storey.

Write exactly one line per front, in the list's order, to OUT (one Write call with all lines):

`<pandId> <shape> <dressing> <storeys> [<shape> <dressing> <storeys>] <confidence 0.5-1> [note: ...]`

Examples:
`0363100012170176 segmental keystone all 0.8`
`0363100012170177 flat stone-lintel 1,2 round arch-ring 3 0.75`
`0363100012170178 unclear none all 0.5 note: trees`

Reply only "wrote N lines" and at most two short notes.
