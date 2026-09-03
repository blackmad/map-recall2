# RGB point-cloud city demo

Open `/canal-drive/rgb-city-demo.html` from the development server. The page
draws the existing appearance-backed Amsterdam city and overlays exact 3DBAG
LoD2.2 roof polygons coloured from PDOK's pinned 2025 20 cm RGB DSM LAZ tiles.
The button flies between sampled buildings; rejected planes can be shown as red
dashed outlines, and clicking an accepted proposal shows point count, grid
coverage, modal height offset, orthophoto colour and cross-source RGB distance.

This is deliberately a research demo, not publication of building evidence.
Twenty buildings were selected on a reproducible 5×4 grid across 42,534 staged
3DBAG buildings. They produced 143 semantic roof planes and required 23 RGB LAZ
tiles. Seventy-one planes on 18 buildings passed point density/coverage checks
and agreed with independent pinned `2025_orthoHR` sampling within RGB distance
20. The other 72 abstained: 37 cross-source disagreements, 22 too few points,
9 sparse samples and 4 mixed colours. Every feature remains
`reviewStatus=machine-proposal`, `acceptedForNow=false`.

Pipeline:

```sh
npm run select:rgb-city-demo -- --input=.cache/3dbag-appearance/amsterdam-buildings.staging.geojson
npm run cache:building-surfaces -- --root=.cache/rgb-city-demo/panorama --building-ids=.cache/rgb-city-demo/building-ids.json --limit=20
npm run measure:roof-planes -- --root=.cache/rgb-city-demo
npm run cache:roof-point-cloud -- --root=.cache/rgb-city-demo --limit=20 --resolution=20cm
npm run measure:roof-point-cloud -- --root=.cache/rgb-city-demo --resolution=20cm
npm run build:rgb-city-demo -- --root=.cache/rgb-city-demo --coverage=.cache/3dbag-appearance/amsterdam-coverage.json
npm run test:rgb-city-demo
```

The DSM is photogrammetric top-surface evidence. It is excellent for roofs and
does not observe vertical façades; façade colour still needs a documented
street-level RGB cloud or reviewed oblique/panorama evidence.
