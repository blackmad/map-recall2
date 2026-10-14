# Sculpture reconstruction from open data: a two-route prototype (2026-10-14)

The statues built this week from the figure kit (Gandhi, Theo Thijssen, Johnny
Jordaan, the Kinderbrug groups, Teun de Jager) were judged "bizarre": they are
hand-assembled primitives, not reconstructions. This prototype tested two ways
to get a real 3D shape from open data on three statues: Gandhi on the
Churchill-laan, Theo Thijssen on the Lindengracht and De Dokwerker on the
Jonas Daniël Meijerplein. Nothing was installed in the game.
`signature-landmarks.json` and the catalogue are untouched.

**Result in one line:** route B works, route A does not. Route B is
single-photo image-to-3D with TripoSR. It gave a recognisable, correctly scaled
6k-triangle figure for all three statues in about 20 s each on this Mac. It is
the best of the three models for the two single figures. Route A is the city
point cloud, and it is blocked: the municipal mobile-mapping files cannot be
downloaded. The open aerial substitute (the PDOK 8 cm surface model) cannot
represent a statue at all.

## Outputs (gitignored, under `artifacts/sculpture-reconstruction/<id>/`)

| File | What |
| --- | --- |
| `compare-kit-A-B.png` | Gallery-size sheet, three rows of four sides (SE, SW, NW, NE): kit model, route A, route B |
| `strip-kit/`, `strip-routeA/`, `strip-routeB/` `strip-four-sides.png` | The rows on their own, from `scripts/landmarks/landmark-strip.ts --glb=…` |
| `routeA-dsm8.glb` | Route A height field, vertex-coloured from the DSM RGB |
| `routeB-triposr.glb` | Route B mesh: 6,000 triangles, vertex-coloured, real height, faced |
| `routeB/` | TripoSR input (`input.png`, `cutout.png`), raw mesh `raw.ply`, `timing.json` |
| `dsm8-rgb.png`, `dsm8-height.png` | Top-down 24 × 24 m view of the DSM crop, with the OSM anchor marked |
| `../commons-provenance.json` | Licence, author, date and sha256 of every Commons photo fetched |

Paths:

- `artifacts/sculpture-reconstruction/de-dokwerker/compare-kit-A-B.png`
- `artifacts/sculpture-reconstruction/theo-thijssen-standbeeld/compare-kit-A-B.png`
- `artifacts/sculpture-reconstruction/gandhi-churchill-laan/compare-kit-A-B.png`

The inputs (tiles, photos, heights, facings, cut-out model) are pinned in
`scripts/sculptures/reconstruction-20261014.json`.

## Route A: the city point cloud

### The municipal mobile-mapping cloud is blocked on its host

The catalogue works. `api.data.amsterdam.nl/v1/puntenwolk/v2/metadata_2025`
with `geometrie[contains]=<rdX>,<rdY>` (header `Accept-Crs: EPSG:28992`)
returns one 100 × 100 m 2025 tile per statue, captured by Georizon:

| Statue | Tile | Points | Mean density over the tile |
| --- | --- | --- | --- |
| Gandhi | `631072dc…_121300484400.laz` (122 MB) | 19.3 M | ~1,900 /m² |
| Theo Thijssen | `778935f5…_120900488200.laz` + `7be80cc5…` (183 MB) | 29.9 M | ~3,000 /m² |
| De Dokwerker | `184a02fb…_122100486600.laz` (165 MB) | 26.2 M | ~2,600 /m² |

At those densities a 2.6 m bronze seen from a passing car would get thousands
of returns per side, which is enough for a real mesh.

The files cannot be fetched. Every `url` in the catalogue is on
`files.lidar.data.amsterdam.nl`, which is NXDOMAIN, also through 8.8.8.8. This
is the same blocker recorded in September (`docs/plans/appearance-programme.md`
§7). Guessed alternative paths on `api.data.amsterdam.nl` and
`data.amsterdam.nl` return 404. The 2024 table is empty. The only public
municipal tiles are the two Oud-Zuid demo tiles on GitHub, and neither covers
a statue.

- Licence: the dataset page says "openbaar" ("Geen; dit is openbare data").
- Owner: Directie Data, published by Datateam GEO.
- **Ask:** datateam.geo@amsterdam.nl to restore the host, or to send the three
  tiles above.

Density on the statues themselves was therefore not measured.

### Substitute: PDOK 2025 8 cm RGB surface model (CC BY 4.0), top-down only

`digitaaloppervlaktemodel_8cm` from PDOK 3D Basisvoorziening is a
dense-matching surface model from 2025 aerial photographs, delivered as LAZ
points. Each statue sits in one ~30 MB tile (`DSM_1212_4842`,
`DSM_1207_4880`, `DSM_1220_4865`).

**It is top-down only.** The data has one Z per 8 cm cell, so a statue is a
2.5-D height field. Sides, undercuts, arms and the gap between legs do not
exist in it. For the same reason a Poisson or ball-pivoting reconstruction
adds nothing here: the raster already is the surface. The script
`recon_dsm_heightfield.py` meshes the cells within 1.6 m of the anchor:
ground is the median of a 2.5–4.5 m ring, raised cells are kept plus a 0.4 m
apron, colours come from the DSM RGB, and a GLB is written in the landmark
frame.

| Statue | Cells within 8 m | Density | Raised cells (> 0.3 m) | Peak above ground | Real height | Recovered | Triangles |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Gandhi | 31,402 | 156 /m² | 1,106 (7.1 m²) | 1.05 m | ~3.2 m | 33 % | 3,200 |
| Theo Thijssen | 31,423 | 156 /m² | 648 (4.2 m²) | **10.68 m** (tree canopy) | 2.68 m | n/a | 2,715 |
| De Dokwerker | 31,420 | 156 /m² | 651 (4.2 m²) | 3.40 m | 4.13 m | 82 % | 3,011 |

What the strips show:

- **Gandhi:** a 1 m soft mound. The dense matching smoothed the figure away;
  only the white plinth top is visible in the RGB.
- **Theo Thijssen:** the statue stands under the Lindengracht limes, so the
  model is the tree canopy, a 10 m column.
- **De Dokwerker:** the best case, on an open square. It comes out as a 3.4 m
  tapering post. The figure's shape is better in the RGB *shadow* on the
  square (`dsm8-rgb.png`) than in the heights.

**Verdict:** the aerial DSM is useful for one thing: checking position and
height of a statue in the open (it confirms the Dokwerker anchor to within
one cell). It cannot supply shape. AHN4/AHN5 LiDAR (about 10–20 points/m²,
also nadir) is sparser still and was not fetched. Route A stays worth doing
only with the municipal mobile-mapping cloud, which sees statues from the
street.

## Route B: TripoSR from one licensed photo

- **Model:** TripoSR (MIT, Tripo AI & Stability AI), weights
  `stabilityai/TripoSR` (MIT, 1.6 GB, Hugging Face cache).
- **Environment:** a pinned `uv` venv outside the repo, Python 3.11 with
  torch 2.5.1, transformers 4.35.0, huggingface-hub 0.17.3, rembg 2.0.59,
  scikit-image 0.24.0, open3d 0.18.0 and trimesh 4.0.5. The pins are in the
  scripts' inline headers.
- **Changes against upstream (`run_triposr.py`):**
  - `torchmcubes` (a CUDA/C++ extension) is replaced by
    `skimage.measure.marching_cubes` through a stub module, with the axis
    order swapped back;
  - the device is MPS, with `PYTORCH_ENABLE_MPS_FALLBACK=1` because ViT's
    bicubic position-embedding resize has no MPS kernel in torch 2.5;
  - the largest rembg component is kept as the cut-out.
- **Post-process (`decimate_scale_glb.py`, separate process):**
  - debris components below 2 % are dropped;
  - Open3D quadric decimation to 6,000 triangles;
  - the mesh is stood up from TripoSR's z-up frame, with the subject's front
    on +x (checked on a strip);
  - it is scaled to the real height, the front is turned to the statue's
    compass facing, and it is exported as a vertex-coloured GLB.
- Open3D and torch segfault when loaded in one process on macOS, hence the
  split.

| Statue | Photo (Commons) | Author, licence | Cut-out | Wall clock (load / cut-out / network / mesh) | Raw → final triangles | Scale |
| --- | --- | --- | --- | --- | --- | --- |
| De Dokwerker | `Amsterdam, De dokwerker 07.JPG` (2013) | A.A.W.J. Rietman, CC BY-SA 4.0 | U²-Net | 22 s (2.3 / 7.3 / 3.4 / 6.1) | 39,072 → 6,000 | 4.13 m, facing 252° |
| Theo Thijssen | `Lindengracht, Theo Thijssen beeld foto 1.jpg` (2017) | Alf van Beem, public domain | U²-Net | ~18 s (2.1 / 8.1 / 1.7 / 6.0) | 98,322 → 6,000 | 2.68 m, facing 0° |
| Gandhi | `Statue of Gandhi, Amsterdam.jpg` (2007) | Antony Antony, CC BY 2.0 | IS-Net | ~18 s (3.3 / 8.4 / 1.5 / 4.4) | 55,334 → 6,000 | 3.2 m, facing 90° |

- **Timing notes:** decimate, scale and export take 1.7 s. The first run also
  downloads the 1.6 GB weights. The cut-out time is mostly rembg loading its
  model.
- **Heights:** these are the kit models' plinth-plus-figure heights. The
  facings are the kit specs' estimates (Dokwerker 252° from the panoramas).
- **Gandhi cut-out:** U²-Net lost the pale limestone block and the staff,
  so IS-Net was used (`routeB-u2net-rejected/` kept for comparison).

What the strips show:

- **De Dokwerker: good.** The stance, the raised chin, the rolled sleeves,
  the hands held away from the body and the granite block all read correctly
  from the front and both sides. The back is plausible but invented: a smooth
  shirt with no folds. From behind, the silhouette is slightly too deep.
  Colour is the dark photo bronze with its baked light; the 1941 lettering
  survives faintly in the vertex colour. This is far closer to the statue than
  the 516-triangle kit model, whose cap disc and arms were already listed as
  wrong.
- **Gandhi: good figure, weak plinth.** The striding pose, the shawl and the
  book under the arm are right. Side and back are a plausible but smoothed
  shawl. Two faults:
  - the staff, a few pixels wide in the 512 px network input, became a stub;
  - the block comes out about half its real height, because the photo looks
    down on it, so with the total fixed at 3.2 m the figure is too big.
  The flowers left on the block in 2007 are baked into the plinth top. Fix by
  scaling the figure and the block separately, or by using a photo with a
  clean block.
- **Theo Thijssen: partly wrong.** The block (lettering visible in the
  colour) and the desk on four legs are right. The man leaning over the desk
  and the boy under it fuse into one hunched mass. The boy is not a separate
  figure, and the back and sides of the group are invented. Multi-figure
  groups need one run per figure, each cut out separately, or more views.

All three are watertight 6k-triangle meshes of 121 KB. That is in the range
of the kit models (516–5,432 triangles), so they fit the landmark budget as
they are. They would still need a material pass (a `materialSlot`/`tint` per
vertex-colour band, or a bronze tint over luminance) to match the city look.

### Licences and rights

- **TripoSR code and weights:** MIT, no restriction on this use.
- **Hunyuan3D-2:** not evaluated. Its Tencent community licence excludes the
  EU, UK and South Korea, so it cannot be used here.
- **TRELLIS and InstantMesh:** need CUDA and were not tried.
- **The meshes:** treat each one as a derivative of its photo. De Dokwerker
  is CC BY-SA 4.0, Gandhi is CC BY 2.0 (attribute Antony Antony), Theo
  Thijssen has no condition (public domain). Credits would go in NOTICE, as
  for the Dokwerker impostor.
- **The sculptures:** they are themselves copyright works (Andriessen died
  in 1979; Bayens' Thijssen dates from 1960). Dutch freedom of panorama
  (Auteurswet art. 18) covers depicting works permanently in public places.
  Whether it covers a 3D model is untested. The impostor route carries the
  same question.

## Recommendation for the 38 sculptures

The backlog list is `SCULPTURES` in `scripts/landmarks/build-poi-backlog.ts`.

| Class | Examples | Route | Expected quality | Cost per statue |
| --- | --- | --- | --- | --- |
| Single standing or seated figure on a plinth (about 18) | Dokwerker, Gandhi, Thorbecke, Multatuli, Carmiggelt, Anne Frank, Martin Luther King, Vondel, Rembrandt, Koningin Emma, Van Hall, Sarphati, Annick van Hardeveld, P.W. Janssen, Waterdraagster, Albert, Westerman | **B**, front photo; the impostor stays as an alternative where B hallucinates badly | Good front and sides, plausible back | about 20 s compute + 10–15 min human (pick photo, check licence, facing, height, review strip) |
| Multi-figure groups (about 6) | Theo Thijssen, Johnny Jordaan, Kinderbrug, Samen spelen, Slavernijverleden, Mama Baranka | **B per figure**: cut out each figure, run each, place them on a kit plinth by hand | Each figure good; layout by hand | 30–60 min |
| Equestrian (1) | Wilhelmina | **B**, side photo first; thin legs may need a manual fix | Probably fair; untested | 20–30 min |
| Abstract, architectural and lettered memorials (about 13) | Living by Numbers, De Knoop, Ravensbrück, Monument Indië, Kunstenaarsverzet, Hel en Vuur, Spanjemonument, No pasarán, Levensboom, Tranen, Hongerwinter, Fusillade, De Schreeuw | **Kit primitives remain right** for flat slabs, walls, letters and rings. Use B only for organic forms (De Schreeuw, Levensboom, Tranen). Check footprint and height against the DSM where in the open | n/a | as today |
| Any class, once the municipal cloud is reachable | all | **A** as ground truth for position, height and silhouette; B as the textured shape, checked against it | measured | about 1 h per statue to build the pipeline once, then minutes |

### What to automate

Most of this already exists as scripts in `scripts/sculptures/`.

1. **Photo selection.** `fetch-commons.ts` (category crawl with licence gate)
   or `fetch_commons_files.py` (named files) chooses candidates. A person
   picks the frontal one; that is the only judgement step besides review.
2. **Generation, one command.** `run_triposr.py` then
   `decimate_scale_glb.py`, then `landmark-strip.ts --glb=…`. Try U²-Net
   first and fall back to IS-Net when the plinth or a thin attribute is
   missing, as the impostor bake already does.
3. **Height and facing.** Take them from the kit spec, or from the DSM peak
   for statues in the open.
4. **Install.** Install would be a far-LOD replacement for the kit model (or
   the near LOD under `?sculptures=1`). Before any install, the integrator
   should decide:
   - the material treatment (vertex colour vs. bronze tint);
   - the freedom-of-panorama question;
   - whether a 6k-triangle figure is wanted at far range or only near.

### Blockers

- The municipal point-cloud host is NXDOMAIN; contact datateam.geo@amsterdam.nl.
- Route B's hidden sides are invented. They look plausible on single figures
  and are wrong on groups, which is unacceptable for a teaching twin unless it
  is flagged.

## Scripts (`scripts/sculptures/`)

| Script | Role |
| --- | --- |
| `probe_laz.py` | Header, dimensions and radius density of a LAZ tile around an RD point |
| `crop_topdown.py` | Square crop of a LAZ tile, written as top-down RGB and height PNGs plus an `.npz` |
| `recon_dsm_heightfield.py` | Route A: statue height field from the DSM crop, written as a GLB with a JSON summary |
| `fetch_commons_files.py` | Named Commons files with their licence gate and a provenance JSON |
| `contact_sheet.py`, `stack_strips.py` | Review sheets |
| `run_triposr.py` | Route B: cut-out and TripoSR on MPS, writing a raw PLY and timing |
| `decimate_scale_glb.py` | Route B: decimate, stand up, scale, face, and write a GLB |
| `glb-stats.ts` | Bounds and triangle count of GLBs |
| `reconstruction-20261014.json` | Pinned inputs of this run |

Python is run as `<venv>/bin/python -I <script>`, from the worktree, with the
downloads in their own directories. The inline `# /// script` headers carry
the pins, so `uv run --script` works too. To reproduce, check out TripoSR
(`VAST-AI-Research/TripoSR` main, MIT) anywhere outside the repo and pass it
as `--src`.
