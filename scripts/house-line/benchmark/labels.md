# Facade benchmark: reading convention (lane F4, #379)

Labels are read from the **round-0 pose photo** (the panorama cut house:frames makes, cropped as the critic sees it, cyan
line = the pand's BAG wall), never from the game. One record per pand, `labels` in `benchmark-v1.json`; the type and the
validator are `src/canalRecall/houseSpec/critic/labels.ts`. When the photo does not show the front (a tree, a van, scaffold,
the wrong wall, another building in front), set `readable: false`, say why in `notes`, and give no labels.

| Field | How to read it |
|---|---|
| storeys | Full street-facing storeys: the ground storey once however tall, no souterrain, no attic inside the gable or roof (the H5h convention, docs/house-line.md §4c). |
| columns | Openings per storey, ground storey first, one number per storey (length = storeys). One column per separate opening in the masonry; a mullioned pair in one opening is one; a projecting bay (erker) is one. Ground storey: doors and windows/shop bays each count. |
| windowKind | Upper storeys: `sash` (schuifraam, a horizontal meeting rail), `T-window` (top light over two casements), `casement` (side-hung leaves, no top light), `large-pane` (one big fixed light, modern), `mixed`. |
| windowHead | `flat`, `segmental` (shallow arch), `round`, `pointed`, `mixed`. |
| paneLayout | `single` (one pane per sash/leaf), `two-pane`, `multi-pane` (roedes, small panes), `top-light` (a separate light over the window), `mixed`. |
| whiteAccents | Booleans: `bands` (white/light horizontal bands or speklagen across the front), `surrounds` (light frames or dressings round the openings, eared heads, arches in stone), `keystones`, `quoins` (light corner blocks), `whiteFrames` (the window joinery itself is white). |
| doorBay | Where the street door of the upper house(s) is, seen from the street: `left`, `centre`, `right`, `several`, `none` (no door on this wall). |
| doorReveal | `flush` (door in the wall plane), `inset` (a visible reveal, set back), `portiek` (a recessed porch), `unknown`. |
| shopfront | The ground storey is a shop/café/office front (display glass, fascia) rather than a house ground floor. |
| shopfrontForm | `display-windows` (stallriser + windows + door), `full-glass` (floor-to-ceiling glass), `recessed-entrance` (the door set back between glass), `two-storey`, `closed` (shutters, blind panel), `none`. |
| crown | What tops the front: `step`, `neck`, `bell`, `spout`, `point` (plain pointed gable), `cornice` (a horizontal cornice with or without a dormer), `flat` (parapet, no cornice), `mansard`, `pitched-eaves` (eaves line, roof slope visible), `other`. |
| cornice | `timber`, `stone`, `parapet` (a plain wall top), `none`. |
| roof | `dormer` (a dormer over the cornice), `pitched`, `mansard`, `not-visible`. |
| finish | `brick`, `painted-brick`, `render` (stucco/plaster), `stone`, `mixed`. |
| wallTone | Colour family (`red-brown`, `dark-brown`, `orange-red`, `yellow-buff`, `white-cream`, `grey`, `near-black`, `green`, `other`) and darkness (`light`, `mid`, `dark`) of the main wall, judged against the neighbours in the same frame. |
| oneFront | The pand's wall is one house front (false: two or more fronts, a block, a corner building with several bays). |
| confidence | Overall: `high`, `med`, `low`. |

Use `unknown` where an enum allows it and the photo cannot say (a crown cut off, a door behind a van). Record the photo
in `photo` (panorama id, capture date, distance, obliquity, the archived ref).
