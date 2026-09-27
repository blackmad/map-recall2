# Material demo: contextual façade windows over water

Observed 2026-09-26 in the opt-in cohort demo. This is an unresolved rendering
defect, not visually accepted façade appearance.

On `material-demo.html?scope=cohort&owner=52` (Lauriergracht 119), the normal
front view shows windows suspended over the canal in both **Current game** and
**Material trial**. The expanded material layer does not create them: owner 52 is
excluded from the original extrusion only in trial mode, while the floating
windows are already present in current mode. In a 1500×1000 Playwright viewport,
`map.queryRenderedFeatures([400, 550])` at one floating window reports only
the `water` layer, with no building mass underneath.

The separate `StudyFacades` custom layer draws those pixels. Temporarily disabling
the active `_studyFacadeAreas` renderer, or setting its MapLibre layer
`city-appearance-contextual-facades-da-costa-jordaan-v1` visibility to `none`,
removes the floating windows while leaving building masses and the material
trial in place. This proves an orphan or alignment problem between contextual
façade detail and the scene at that view; it does **not** yet prove which
upstream owner, tile, or coordinate transform is wrong. Hiding the entire
façade layer also removes legitimate windows and is not a fix.

For a bounded material-only comparison, use **Isolate selected owner** in the
demo. It keeps the exact BAG owner and suppresses contextual detail streams.
The result is a bare mass and cannot validate a complete façade. Before visual
acceptance, trace the offending mesh to its source owner and wall, compare its
registered coordinates with the rendered building footprint, then withhold only
detail whose host mass or alignment is absent. Regression-test both this canal
view and a correctly attached window façade. Keep this issue separate from the
provisional cohort material assignment and the unchanged default game gate.
