# Ride-visible landmarks, large-recipe tier (issue #105), 2026-10-29

Branch `lane/ride-landmarks-20261029`. Targets come from `docs/reports/landmark-targets-20261029.md` (#104).

**Outcome: 0 installs.** No candidate passed both the hard gates and the likeness gate on every street-facing
group. I did not use `--allow-inferred`, which every installed large house so far has needed. One factory bug is
fixed (below). The drafted houses are kept out of the tree at `staging/ride-landmarks-20261029/houses/` (gitignored),
with the two factory queues. They are not committed because `fit-golden` would list all 17 of them as CHANGED.

## 1. Identity, ranks 1–20 (BAG, 3DBAG, OSM only; no images)

| # | Name in #104 | What it is | Main BAG pand | Decision |
|---|---|---|---|---|
| 1 | Prins en Keizer | four OSM `building:part` tiers (9/12/15/18 m) over one 1973 office block, Vijzelstraat 66–80 / Keizersgracht 650 / Kerkstraat | 0363100012165685 | **blocked:** pand not in the building tiles (the OSM parts draw it), so `all-walls`/`facts` cannot run |
| 2 | NFTA | film academy, Markenplein 1, 1999 glass box | 0363100012170259 | built; held (see §2) |
| 3 | Academie van Bouwkunst | Waterlooplein 211–213 / Nieuwe Amstelstraat 8; stepped neo-gothic gables in the crop | 0363100012171994 | **bespoke track** (ornamented historic front) |
| 4 | Kalverpassage | Kalverstraat 218–222 / Singel 451–463; already `singel-457-165086`, uninstalled after user review | 0363100012165086 | skip (bespoke; held before) |
| 5 | Atrium Parkeergarage | the WTC/Atrium complex, Strawinskylaan; the garage pand is 244160, the Atrium office is 074056 | 0363100012074056 | skip: crops show only the plinth of a 48 m block |
| 6 | Belastingdienst | Kingsfordweg 1–117, 1994 | 0363100012107557 | **blocked:** pand not in the building tiles (OSM outline w57864988) |
| 7 | Weesperplein | Metrostation Weesperplein 1–5 (1977), an underground station | 0363100012186191 | **dropped:** not a building above ground |
| 8 | Hirschgebouw | Leidseplein 1912 department store; `hirschpassage-2-165488` exists, not installed | 0363100012165488 | **bespoke track** (pilasters, arcade, domed corner) |
| 9 | DoubleTree (17 ways) | Oosterdokseiland merge: OBA Centrale (Oosterdokskade 143, 2008) and Post CS (Oosterdokskade 5, 1968) | 0363100012164964 / 164966 | skip: a name merge, and the OBA is a bespoke target |
| 10 | De Makroon | Nieuwe Passeerdersstraat 2–318, 2015; `passeerdersstraat-242951` exists, footprint gate fails | 0363100012242951 | skip (already authored and failing) |
| 11 | Y-Helling | NDSM-plein 82–92, 4.3 m shed covered in graffiti | 0363100012238702 | skip: the kit cannot draw a mural front; low |
| 12 / 16 | OBA Roelof Hartplein / Het Nieuwe Huis | one building: Het Nieuwe Huis 1928, Roelof Hartplein 50–430 (OSM w277117928 is the same pand) | 0363100012148010 | merged; built; held |
| 13 | Byzantium | Stadhouderskade 15–22 / Tesselschadestraat 1 | 0363100012135250 | skip: every crop oblique (36–44°) or partial |
| 14 | AkzoNobel Center | Christian Neefestraat 2–50 / Beethovenplein (low block 240015; the tower is 240149) | 0363100012240015 + 240149 | 240015 held (LoD2.2 IoU 0.39, no crop pairs a panel); tower built, held |
| 15 | Het Dok | tt. Vasumweg 32–42, a 65 m housing tower | 0363100012252442 | built; held |
| 17 | Pakhuis Australië | Veemkade 562–568 / Piet Heinkade: a warehouse with a 34 m block over it | 0363100012139498 | built; held |
| 18 | De Joodse Invalide | Weesperplein 1–11, already installed as `nieuwe-achtergracht-100-253824` (likeness-inferred) | 0363100012253824 | skip: already covered. #104 mislabels it `generic` because it matched the twin registration 170299 |
| 19 | Sint-Nicolaaslyceum | Beethovenplein 2–4 | 0363100012239853 | built; held |
| 20 | ABN AMRO World HQ | Gustav Mahlerlaan, four OSM tower parts (63–105 m) | (no BAG pand over 150 m² inside the parts) | **bespoke track** (recognised Zuidas skyline icon) |

## 2. Built, and why each is held

Each building was drafted by the factory (`draftLargeIntent`), measured (`measure.ts --write`) and compiled
(`large.ts --strict`). Where noted, I then made one hand pass.

| House | Gates | Likeness (street groups) | Why held |
|---|---|---|---|
| `nfta-markenplein-170259` (hand pass: curtain-wall on all fronts, 16/10/11 pier bays, glass #93aea4, piers #bdbab2) | pass, 2.5k tris | NO EVIDENCE ×2, FAIL ×1 | SW crop 50 % foliage and SE crop 37 % washed out. On NW, the judge reads the translucent green channel glass as wall: "wall not drawn; glazing 1.00 vs photo 0.35" |
| `akzonobel-tower-240149` | pass | NO EVIDENCE, FAIL ×2 | crops washed out 65–85 % (reflective glass); crops are 32 m tall on a 46 m tower |
| `het-dok-252442` | pass | NO EVIDENCE, WARN, FAIL ×3 | crops cover only the lower third of a 65 m tower |
| `pakhuis-australie-139498` | **FAIL** footprint IoU 0.81 | Veemkade front PASS; the others FAIL | `footprint: "bag"` fixes IoU (1.00) but leaves 170 m of open edge (shell-repair gate) |
| `het-nieuwe-huis-148010` | **FAIL** eaves walls[0] (21.29 vs 20.58 m) | FAIL; 6 groups NO PHOTO | the curved Amsterdam School corners split into 311 3DBAG surfaces; the BAG-wall crops do not pair those panels (0.5 m / 5° / 60 %) |
| `sint-nicolaaslyceum-239853` | **FAIL** eaves ×2 | FAIL ×4 | cantilevered slabs and ribbon balconies; the kit draws them as punched windows |
| `akzonobel-240015` | **FAIL** tris, footprint IoU 0.39 | NO PHOTO everywhere | the LoD2.2 shell is not the BAG footprint |

Ranks 21–40 were also run through the factory (queue `staging/ride-landmarks-20261029/queue2.json`): Barlaeus,
KPN Teleport (measure crashed in `export-glb.ts:81`), Sarphati Plaza, Parnas, The Edge, De Valerius, Apollo, Pieter
Nieuwlandcollege, Forum, Atlanta and Loods 6 (crops only). None is installable as drafted. The nearest is Barlaeus
(gates pass, 4.3k tris; walls[0] FAIL "window shape square vs photo tall", walls[2] NO EVIDENCE at 29 % foliage,
walls[5] NO PHOTO), and it is a 19th-century front, so it belongs on the bespoke or type track anyway.

## 3. Fixed in this lane

- `scripts/landmarks/factory.ts` `nearbyStreets`: `streets-routing.json` paths are `[lat, lng]`, but they were passed
  to `lngLatToRd` as `[lng, lat]`. As a result, no factory draft ever had a named street. Every non-blank group then
  counted as street-facing for the likeness gate, which made installs harder than they needed to be. The fix is in
  commit `1df5616fd`. Drafts made before it (for example `pand-236656`, `pand-083604`) could be redrafted with
  `--force`, but only where `factoryMayWrite` allows it.

## 4. What blocks this tier (feeds the next kit and judge pass)

1. **Curtain walls cannot pass the judge.** A `curtain-wall` group with no spandrels has no wall-slot material, so
   `likeness.ts` reports "wall not drawn" and glazing 1.00, while the photo reads the mullion grid as wall
   (0.35–0.87). Every glass front in this set FAILs on this (NFTA, AkzoNobel tower, Apollo, Pieter Nieuwland
   walls[3], Het Dok walls[5]). The installed glass houses (Rietveld, Stadsloket West, Politie NZV) all went in as
   `likeness-inferred`. A fix would judge a curtain front on the model's mullion and spandrel material against the
   photo's frame cells. This changes the verdict policy, so it is the user's or integrator's call. I did not change it.
2. **Crop-to-panel pairing** (0.5 m / 5° / 60 %) misses when 3DBAG facets a curved or stepped front differently from
   the BAG wall the crop was cut for (Het Nieuwe Huis 6 of 8 groups, Sarphati Plaza 5 of 8, AkzoNobel 8 of 8).
3. **Tall buildings:** `all-walls` crops stop at about 32 m, so towers (Het Dok, AkzoNobel tower, Atrium) never have
   evidence for their upper storeys.
4. **Pands missing from the building tiles** (Prins en Keizer 165685, Belastingdienst 107557) need an identity or tile
   pass before any recipe.
5. **Kit cannot yet express:** translucent channel glass with scattered small clear windows and a wide concrete edge
   frame (NFTA); cantilevered slab balconies and ribbon parapets (Sint-Nicolaaslyceum); graffiti and mural fronts
   (Y-Helling); a warehouse with a modern block on top as one pand (Pakhuis Australië, where the BAG footprint differs
   from the LoD2.2 shell).

## 5. Integrator

- Archive these crops (written into the shared `source-archive` worktree, not committed there):
  `pand-reference-walls/0363100012{074056,078546,080492,125840,135250,139498,142095,148010,148632,153698,165158,169565,170259,171994,182840,238702,239633,239853,240015,240149,251533,252442}`.
  The other untracked dirs there (066028, 070481, 085435, 116511) belong to other lanes.
- #104 should treat `nieuwe-achtergracht-100-253824` as covering 170299, so De Joodse Invalide leaves the open list.
- Nothing to rebuild: no GLB, catalogue, covers or bundle changed.
