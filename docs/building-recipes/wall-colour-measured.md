# Hand-sampled wall colours must be carried as measured

Large recipes (`kind: "large"`) only. Written by the large-buildings lane, 2026-11-20.

## The trap

The city look (`src/canalRecall/look/cityLook.ts`, `slotForMaterial` and
`slotTintBytes`) lifts every brick-slot tint into the city's brick range.
The one exception is a material whose `userData.tintSource` is `'measured'`.

A colour you sampled by hand from a panorama crop and wrote into a group's
`palette.brick` is not marked measured unless you say so. The recipe
compiles with your hex, the contact sheet shows it, and then the game shows
the lifted city brick instead.

Zeemanlab is the example. #8a4636 and #6a3a2e both rendered as the same
orange-red until their groups were listed as measured.

## The fix

List every group whose palette you sampled in `measured.groups`. Set
`measured.otherWalls` when the house palette's brick was sampled too:

```json
"measured": {"date": "2025-01-09", "groups": [0, 1, 3, 4, 6], "otherWalls": true}
```

- **`measured.groups`.** `fitLarge` adds that group's `wall@g<i>` slot to
  `recipe.measuredSlots`. It also adds the glass slot when the group has a
  `palette.glass`, and the split slot when the group has one. Cladding
  colours and lines are always added.
- **`measured.otherWalls`.** This adds the house `wall` slot, and the
  `window-grid` wall slot when `otherWalls` resolves to the window grid.
- **The writer.** `largeMeshToGroup` (`largeCompile.ts`) writes
  `tintSource: 'measured'` onto exactly those slots' materials, and
  `export-glb` carries it into the GLB.

## Still lifted

Only the wall, glass, split and cladding slots are carried as measured.

A group's `palette.stone` and `palette.frame` are still lifted by the look. A
grey stone sampled at #9a968c rendered cream. If the stone colour carries the
likeness, report it as a kit gap rather than shifting it into a wall slot.

## Check before you blind

- Frame the house in game with a scratch bundle. The recipe contact sheet
  does not run the city look, so it cannot show the lift.
- Compare the wall tone with the photo crop.
- If two groups that differ in the photo render the same tone, a
  `measured.groups` entry is missing.
