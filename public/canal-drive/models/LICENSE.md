# 3D models: Creative Commons Attribution 4.0 (CC BY 4.0)

The original 3D building, landmark, bridge, vehicle and street-furniture
models made for Ride Amsterdam (everything under `public/canal-drive/models/`
and `public/canal-drive/building-types/`, the ordinary-building chunks and
recipe tiles, and the GLBs the build scripts in `scripts/` generate) are
licensed under the
[Creative Commons Attribution 4.0 International licence](https://creativecommons.org/licenses/by/4.0/).

You may share and adapt them for any purpose, including commercially, as long
as you give credit. Suggested credit:

> 3D models © Ride Amsterdam (rideamsterdam.nl), CC BY 4.0. Built on 3DBAG
> (CC BY 4.0), BAG/BGT (CC0) and © OpenStreetMap contributors (ODbL).

**Not covered:** `pink-city-bicycle-runtime.glb` is Kin Chen's "Pink city
bicycle", released CC0 via MorfVision / BlenderKit; it keeps that licence.

## What the models are built from

The geometry is original: modelled by hand or generated from recipes, with
flat materials and no imported meshes or photo textures. It uses open data,
which carries its own terms:

- **3DBAG** (TU Delft 3D geoinformation group): heights and roof planes, CC BY 4.0.
- **BAG and BGT** (Kadaster / Gemeente Amsterdam): footprints and ground, CC0.
- **OpenStreetMap**: some footprints and identities, © OpenStreetMap
  contributors, ODbL 1.0. The models are Produced Works under the ODbL; the
  underlying OSM data stays under the ODbL.
- **Reference photos** (Amsterdam panoramas, Beeldbank, Wikimedia Commons) guided
  proportions and details by eye. No photo pixels are included in the models.

Each model's own credit, sources and notes are in its attribution entry in
`signature-landmarks.json`, `catalogue.json` or the matching builder spec under
`scripts/landmarks/`.

The game code under `public/canal-drive/` is covered separately by
[`../LICENSE`](../LICENSE) (GPL-3.0).
