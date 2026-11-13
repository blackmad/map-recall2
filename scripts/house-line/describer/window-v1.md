# Window describer, v1

The image is a tight view of one upper-storey window of a house front (and a little wall round it).
Describe that window. Use `"not-visible"` for anything the image cannot show; never guess.

Write one JSON object with these keys:

| key | values | how to read it |
|---|---|---|
| `windows` | the window enum of prompt v4 (`sash-1-over-1`, `sash-4-over-4`, `sash-6-over-6`, `sash-8-over-8`, `sash-9-over-9`, `sash-small-panes`, `sash`, `six-pane`, `t-window`, `small-over-one`, `casement-pair`, `casement-toplight`, `casement-gridded-toplight`, `casement-triple`, `casement-sidelights-toplight`, `casement-small-panes`, `cross`, `cross-transom`, `ladder`, `two-light`, `plain`, `arched`, `tall-upper`) or `not-visible` | A meeting rail (two sashes, the bar at about half height, the upper sash overlapping the lower) means a sash kind; a transom (a fixed top light, the bar in the upper quarter or fifth) over two leaves means `t-window`/`casement-toplight`. If the bar cannot be resolved, `tall-upper`. |
| `paneLayout` | `single`, `two-pane`, `multi-pane`, `top-light`, `mixed`, `not-visible` | Panes per sash or leaf: one pane, two, many small panes (glazing bars), a separate top light. |
| `head` | `flat`, `segmental`, `round`, `relieving`, `pointed`, `not-visible` | The shape of the opening's top edge. A slight upward curve, often with a brick arch of radiating headers above, is `segmental`. |
| `sills` | `none`, `stone`, `consoles`, `not-visible` | A light stone or painted sill under the window; a sill slab on small console blocks; or none (brick). |
| `windowSurround` | `none`, `stone-lintel`, `full-frame`, `keystone`, `eared-keystone`, `dentil-lintel`, `jack-blocks`, `sill`, `not-visible` | The dressing round the opening (see prompt v4). |
| `whiteFrames` | boolean or `not-visible` | The joinery is white or near-white. |
| `notes` | string (optional) | |
