# Amsterdam imagery/data sources for building recipes (verified 2026-10-09)

Key finding: the repo already uses the panorama API, monument register, 3DBAG and BAG heavily. The genuinely new inputs are the beeldbank search (RSS) and bouwdossiers (manual/unverified). Most "new" work is wiring existing pieces into the recipe-drafting step.

## 1. Amsterdam/panorama-textures
- Python (NumPy/SciPy/Pillow; GDAL only for BAG loading). MPL-2.0. Archived Nov 2020, small, proof-of-concept. 
- Does: samples a grid on a vertical wall plane, subtracts camera position, maps the directions into an equirectangular panorama, samples pixels, writes a JPG texture (.obj output from 3D Amsterdam digital twin). Files: src/texture.py, array_math.py, sample.py (Palace/Tussauds RD examples).
- Limits: hardcoded 8000x4000; wall from two opposing corners (vertical rectangle only); no vehicle heading/pitch/roll, no occlusion, no multi-view choice. Our repo's own note (docs/amsterdam-panorama-building-treatment-handoff.md) already analysed it and our rectifier (scripts/pano-facades/build-pano-facade.ts, scripts/build-panorama-facade-review.ts) does the same job with the repo's world-aligned convention.
- Verdict: do not import; it is the same math we already have. Use only as an independent cross-check fixture.
- Pipeline sketch for a per-BAG-pand frontal crop: BAG pand -> 3DBAG LoD2.2 wall polygons facing a street -> pick the longest street-facing wall -> API `near=` lookup (below) with `newest_in_range=true` and radius ~25 m -> choose pano whose camera-to-wall-normal angle is smallest and distance 8-25 m -> fetch equirectangular_full (8000 px) -> project wall quad (vertical plane) -> 1 px/cm crop. Flag occlusion by trees/cars by also rendering a second year's pano (`mission_year` tags) and comparing. Feed both crops plus the Beeldbank photo to the LLM.

## 2. Related repos (github.com/Amsterdam-AI-Team and github.com/Amsterdam)
Amsterdam-AI-Team (Python, mostly 2020-2022 research, a few 2024-26 chatbot/prototype repos):
- **Urban_PointCloud_Processing** (GPL-3.0): classifies LAS point clouds (buildings/facades by region growing, ground, trees, lights, signs, cars) using AHN + BGT. Gives facade point sets and labelled occluders (cars/trees) per wall, but no window detection. Useful for an occlusion mask; heavy, needs point clouds.
- **Geolocalization_of_Street_Objects**: Faster R-CNN on panoramas (bicycle symbols) + multi-view triangulation to RD coordinates; ~667k pano images from 2019. Good template for "detect windows/doors in pano -> triangulate", but we would train our own detector. No licence stated.
- **Urban_PointCloud_Analysis**, **PointCloud_Tree_Modelling** (C++): street furniture/tree extraction; marginal for facades.
- **Indoor-PointCloud-to-CityJSON**: irrelevant.
- The wider github.com/Amsterdam org (API search returned nothing relevant) has no facade/window/building-classification repo. Archived: Amsterdam/panorama-textures, PanoViewer (Marzipano). I found no maintained Amsterdam facade detector; window/door detection must come from our LLM or an off-the-shelf model (e.g. CMP facade-style segmentation, Grounding DINO/SAM on the rectified crop).
- Datasets (not repos) in api.data.amsterdam.nl that matter: `puntenwolk/v2` (point-cloud tile catalogue, already audited in scripts/audit-amsterdam-point-cloud-catalog.ts), `monumenten`, `bag`, `bomen`, `civieleconstructies`.

## 3. Panorama API (api.data.amsterdam.nl/panorama), verified live
- Query: `GET /panorama/panoramas/?near=LON,LAT&srid=4326&radius=30&page_size=N` (also `bbox=`, `tags=mission-bi`, `newest_in_range=true`, `limit_results=1`; pagination via _links.next; 48 results within 30 m of Da Costakade 102). Returns HAL JSON.
- Record fields: `pano_id`, `timestamp`, `geometry` Point [lon,lat,height], `heading`, `pitch`, `roll`, `mission_year`, `mission_type` (woz, bi...), `tags`, `surface_type` (L land / W water), `mission_distance`, plus links: `equirectangular_full` (8000 px), `_medium` (4000), `_small` (2000) at t1.data.amsterdam.nl/panorama/YYYY/MM/DD/<mission>/<pano>/equirectangular/panorama_8000.jpg; cubic tiles `cubic_img_pattern .../cubic/{z}/{f}/{y}/{x}.jpg`; `adjacencies`. 2025 recordings (`recording_2025-..._NNNNN`) use a different base path (…/2025/360geo/<id>/cubic/). Camera height can be 0 in 2025 records (repo handoff).
- Server-side crop: `GET /panorama/thumbnail/?lon=&lat=&radius=30&width=1200&fov=90&heading=&pitch=` returns JSON {url, heading, pano_id}; the url then returns a perspective JPEG (aimed at the point if heading omitted). Already used in scripts/street-appearance/acquire.ts.
- Licence: Kernregistratie Panoramabeelden, CC BY 4.0, (c) Gemeente Amsterdam. Rate limits: none published; sends `X-Api-Key` header "for statistics, not authentication". Be polite (cache, 2-4 concurrent).

## 4. data.amsterdam.nl monument pages
- API: `GET https://api.data.amsterdam.nl/v1/monumenten/monumenten/<uuid>/?_format=json`, list with `?_count=true&_pageSize=2000` -> 9,817 monuments (Rijks + gemeentelijk). Fields: identificatie, monumentnummer, weergavenaam/adressering, status, type, architectOntwerp, jaarBeginVan, oorspronkelijkeFunctie, geometrie (RD polygon), puntCoordinaten, `_links.betreftBagPand` (BAG id + volgnummer), `heeftMonumentenSitueringen` (-> address/nummeraanduiding). Also `complexen`, `situeringen`, `_links.schema`.
- Panorama match: **not in the API.** The record has no panorama link. The portal view for the example (`?center=…&zoom=14`) most likely just runs the panorama `near=`/thumbnail lookup around the monument point (consistent with the lookup our own handoff doc captured for the address page). So "matched pano + heading per pand" must be computed by us: use puntCoordinaten/geometrie -> `thumbnail/?lon&lat&radius=25` (returns pano_id and aimed heading) -> store. Cheap: ~10k calls.
- Repo already fetches this: scripts/fetch-amsterdam-monuments.ts (-> scripts/data/amsterdam-monuments.json, with BAG pand ids). Dutch descriptions are excluded; the RCE register (CC0) at monumentenregister.cultureelerfgoed.nl is also used.

## 5. Stadsarchief
- Beeldbank search: `GET https://archief.amsterdam/api/opensearch/?q=Da+Costakade+102` returns OpenSearch RSS (totalResults, startIndex, itemsPerPage=100; 11 hits for that query). Items carry `link` = https://archief.amsterdam/beeldbank/detail/<uuid> and an image enclosure; the title/description fields came back empty in my test, so metadata (date, photographer, rights) requires scraping the detail page or the media URL pattern `/detail/<record>/media/<media>` (as in docs/references/da-costakade-13-17-beeldbank.json). Free-text address search works; there is no BAG-id filter. Catalogue ~300k images. 
- Licence: data.overheid.nl lists the dataset "Geen open licentie"; individual images are mostly marked public domain / CC0 or CC-BY on the detail page (older material; check per record, store the rights statement). Contact stadsarchief@amsterdam.nl for bulk terms. Underlying system is Memorix (Vitec); I could not find IIIF or a documented JSON API. Separate bulk open data: OAI-PMH/A2A (13.9M archival records, 4 GB) via data.overheid.nl, no images.
- Bouwdossiers: https://archief.amsterdam/bouwdossiers (guide PDF HandleidingBouwdossiersJW2024.pdf; consent form for dossiers under privacy limits; ordering info at amsterdam.nl "Bouwtekeningen en bouwvergunningen opvragen"). It is a human search/viewer, address-searchable, with no API I could verify. Treat drawings as manual research (the repo already tracks requests in docs/references/construction-plan-requests.json). Unverified: that scans are downloadable and under what rights.

## 6. Existing repo usage (do not duplicate)
- scripts/street-appearance/acquire.ts, observe-row.ts, investigate-*.ts: panorama thumbnail/bbox lookups.
- scripts/build-panorama-facade-review.ts and scripts/pano-facades/build-pano-facade.ts: aimed panorama thumbnails, facade rectification and review manifests.
- scripts/city-appearance/inventory-expansion.mjs, scripts/facade-rebuild/migrate-allowlisted-cache.ts: panorama + heritage inventories per area; scripts/facade-twin/build-block.ts attributes panoramas CC BY 4.0, BAG CC0, 3DBAG CC BY, Rijksmonumenten CC0.
- scripts/fetch-amsterdam-monuments.ts, fetch-monument-gables.ts, monument-register/: monument snapshot with BAG pand links and gable types.
- scripts/audit-amsterdam-point-cloud-catalog.ts: puntenwolk v2 catalogue.
- scripts/import-amsterdam-trees.mjs, fetch-amsterdam-bridge-register.ts, fetch-street-name-origins.ts (memory note: BAG openbareruimtes `beschrijvingNaam`, 5,349/5,671 streets; Dutch only; licence not verified).
- docs/amsterdam-panorama-building-treatment-handoff.md: pano API lookup, 2025 base path, history pagination capped at 500, private source-pack repo; docs/references/*beeldbank*.json and next-batch-archive-research.json: manual Beeldbank research with no automation.
- scripts/ordinary-buildings/, docs/plans/district-rectification-*.md: ordinary-building pilots and rectification expansion.

## Ranked: what to integrate first
1. **Per-pand pano selector on existing rectifier** (monument + BAG pand -> street-facing 3DBAG wall -> best pano/year via `near=` -> rectified crop + perspective thumbnail, cached with pano_id/date/CC BY attribution). Mostly reuse of build-pano-facade.ts; 2-3 days to batch ~10k monuments, plus 1 day for a second-year occlusion fallback.
2. **Beeldbank address search script**: RSS `q=<street number>` -> list of detail URLs -> scrape detail for date/rights/image, store only CC0/PD items, hand to the LLM as historical context. ~1-2 days; yield is uneven (11 hits for a known address) and rights need per-record checks.
3. **Recipe-drafting inputs from monument register**: feed architect/year/function and RCE description to the LLM alongside images (already fetched; wiring only, <1 day).
4. **Automatic window/door detection on rectified crops** (off-the-shelf open-vocabulary detector + SAM, not an Amsterdam repo) to pre-fill bays/storeys and validate LLM output. ~3-5 days; R&D risk.
5. **Bouwdossiers**: keep manual for landmarks only; automate nothing until access terms/downloadability are confirmed with Stadsarchief (a request email, 0.5 day).
