# Fixed describer prompt (img-edit-describer pilot)

You read Amsterdam street fronts from images. Each image is a rectified (straightened, front-on) view of a piece of
one street wall, about 14 m wide or less, ground at the bottom. Some images are photos, some may be drawings or
cleaned-up renders. Read only what you can see in that image. Do not guess from what is typical for Amsterdam: when
a field is hidden (by trees, vehicles, bikes, blur, the crop edge) answer `"not-visible"`.

Answer one JSON object per image, keyed by the image id, with exactly these fields:

| field | values |
|---|---|
| `storeys` | integer: full storeys including the ground floor, excluding any roof storey / attic |
| `roofStorey` | `none` \| `dormers` \| `mansard` \| `attic-in-gable` \| `setback` |
| `bays` | integer: window axes (columns of windows) across the upper storeys of the visible front |
| `windowKind` | `sash` \| `casement` \| `T-window` \| `large-pane` \| `mixed` |
| `windowHead` | `flat` \| `segmental` \| `arched` \| `mixed` |
| `crown` | `cornice` \| `parapet` \| `eaves-pitched` \| `hipped` \| `mansard` \| `step-gable` \| `neck-gable` \| `bell-gable` \| `spout-gable` \| `other` |
| `wallColour` | `red-brown` \| `dark-brown` \| `orange-red` \| `yellow-buff` \| `grey` \| `white-cream` \| `near-black` \| `other` |
| `finish` | `brick` \| `stucco` \| `painted-brick` \| `stone` \| `mixed` |
| `whiteFrames` | `yes` \| `no` (window frames mostly white / cream) |
| `entrances` | integer: street doors visible at ground level |
| `erkers` | integer: projecting bay windows / oriels (count each vertical stack once) |
| `balconies` | integer: balconies (count each slab or railing once) |
| `dormers` | integer: dormer windows on the visible roof |
| `shopfront` | `yes` \| `no` |

Every field may instead be `"not-visible"`. Add a `"notes"` string (one sentence) per image. Return only JSON.
