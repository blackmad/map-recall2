# Lane: measured buurt lightness (#118, 2026-10-29)

Branch `lane/buurt-lightness-20261029`. User decision: "if it's darker let it be darker".

## What changed

- `src/canalRecall/buurtProfiles/exposure.ts` (new, typed, tested in `exposure.test.ts`): `fitExposure` brings
  every photo source onto ONE reference frame (the panorama thumbnails, 20 fronts per buurt city-wide) by the offset
  measured on pands both sources cover (median-to-median against the reference only below 8 shared pands), then one
  city-wide transform (lift x `liftShare`, chroma ratio x `BRICK_CHROMA_SHARE`, hue rotation) for every buurt.
  `applyExposure` clamps only impossible brick (glare L* > 72, shadow L* < 14, C* < 12, the brick-family bound).
- `scripts/buurt-profiles/derive.ts` uses it, with `CITY_LIFT_SHARE = 0`: a buurt keeps the L* its photos measure.
  New flags: `--lift-share=<0..1>`, `--out=<dir>`, `--dump-samples` (writes `samples.json` with buurt and calibrated Lab).

## What the data said

- The brief's suspicion that the block-face source was over-lifted is not borne out: on 30 pands that both
  thumbnails and block faces cover, block-face brick reads 0.6 L* darker than the thumbnails, and their medians were
  close (36.4 vs 35.0). Shared reference alone moved profiles by <= 0.7 L* (column 2) and 0-10 % of pixels per frame.
- The lift that made De Pijp light was the city-wide one (+8.2 L*, thumbnail median 35 -> palette 43), applied to
  every buurt. Removing it darkens 10-40 % of each frame by ~15 RGB; median profile brick L* 45.9 -> 37.8.
- Panorama walls (118 bricks) share 1 pand with the thumbnails, so they use the median fallback (dL +12.9).
- De Pijp thumbnails do not read dark: Frans Halsbuurt thumbs median L* 45, Gerard Doubuurt bricks 26-53 (city 35).

## Sheet

`docs/images/look/buurt-lightness-12spot-20261029.jpg`: photo | before (#102) | shared ref, lift 1 | after.
Brick sits closer to the panoramas at Ten Kate-, Kerk-, Runstraat, Eerste Looiersdwarsstraat and Van Breestraat;
the city is darker overall, as the photos are.

## Still wrong

- Saenredamstraat's right side still draws saturated red, and Tweede Jan Steenstraat's left side rosy-pink: unchanged
  by the profile (0-20 % of pixels move there), so those fronts come from block-face types / other sources, not the
  generic profile. The De Pijp type palettes (`scripts/block-face/types/`) carry light brick (Frans Halsbuurt
  block-face houses Lab L* 39-52, C* 22-26): a type-library lane should re-measure them against the photos.
- Kerkstraat's white and grey fronts are not back: raw thumbnails are underexposed (white render reads L* ~55-60),
  so `photoPainted` (L* >= 62) calls many painted fronts brick; their top-decile swatch is then clamped to a salmon
  L* 72 C* 34 brick (`#e3a280`-like swatches in most centre profiles). Painted classification should move into the
  shared exposure frame (classify after `applyExposure`'s source offset, with a city white point); not done here.
- The thumbnails' per-buurt medians are noisy (same-pand pairs differ by +-15 L*; buurten have 12-20 fronts).

## Integrator

1. `cp ../generic-uplift-20261029/staging/buurt-profiles/pano-samples.json staging/buurt-profiles/` (untracked input),
   then `node --import tsx scripts/buurt-profiles/derive.ts --publish` (expect `city transform L +0.0`; revision
   differs from the published `de7eba...`-era file).
2. `npm run build:canal-three-buildings` (both three-buildings bundles embed the profiles JSON).
3. `node --import tsx --test src/canalRecall/buurtProfiles/*.test.ts` passes on the regenerated set (checked).
4. Wire `src/canalRecall/buurtProfiles/*.test.ts` into a package script (no npm script runs them today).

## Per-buurt brick L* (c19 era, or first era; weighted over swatches with C* >= 10)

| code | name | level | n | before (#102) | shared ref, lift 1 | after (shared ref, lift 0) |
|---|---|---|---|---|---|---|
| AA | Haarlemmerbuurt | wijk | 74 | 39.8 | 39.8 | 31.6 |
| AB | Jordaan | wijk | 179 | 46.1 | 46.1 | 37.9 |
| AC | Grachtengordel-West | wijk | 41 | 47.5 | 47.5 | 41.0 |
| AD | Burgwallen-Nieuwe Zijde | wijk | 76 | 43.5 | 43.5 | 37.2 |
| AE | Burgwallen-Oude Zijde | wijk | 87 | 51.0 | 51.0 | 45.2 |
| AF | Nieuwmarkt/Lastage | wijk | 107 | 41.3 | 41.3 | 33.9 |
| AG | Grachtengordel-Zuid | wijk | 71 | 44.7 | 44.7 | 37.1 |
| AH | De Weteringschans | wijk | 108 | 39.5 | 39.5 | 31.3 |
| AJ | Weesperbuurt/Plantage | wijk | 47 | 45.4 | 45.4 | 37.2 |
| AK | Oostelijke Eilanden/Kadijken | wijk | 69 | 49.0 | 49.0 | 40.8 |
| BB | Coenhaven/Minervahaven | wijk | 20 | 53.2 | 53.2 | 45.0 |
| EB | Spaarndammerbuurt/Zeeheldenbuurt | wijk | 190 | 48.3 | 48.3 | 40.2 |
| EE | Landlust | wijk | 99 | 43.1 | 43.1 | 34.9 |
| EF | Erasmuspark | wijk | 38 | 42.8 | 42.8 | 34.6 |
| EH | Staatsliedenbuurt | wijk | 94 | 46.7 | 46.7 | 38.5 |
| EJ | Frederik Hendrikbuurt | wijk | 40 | 41.3 | 41.3 | 33.2 |
| EK | Van Galenbuurt | wijk | 107 | 42.4 | 42.8 | 34.7 |
| EL | Geuzenbuurt | wijk | 55 | 52.9 | 52.9 | 45.3 |
| EM | Hoofdweg e.o. | wijk | 129 | 43.4 | 43.7 | 35.6 |
| EN | Chassébuurt | wijk | 84 | 45.9 | 46.1 | 37.9 |
| EP | Bellamybuurt | wijk | 195 | 45.2 | 45.8 | 37.6 |
| EQ | Da Costabuurt | wijk | 111 | 45.7 | 46.4 | 38.2 |
| ER | Westindische Buurt | wijk | 37 | 48.8 | 48.8 | 40.6 |
| ES | Van Lennepbuurt | wijk | 152 | 44.2 | 44.6 | 36.4 |
| ET | Overtoomse Sluis | wijk | 28 | 46.8 | 46.8 | 39.1 |
| EU | Helmersbuurt | wijk | 76 | 48.8 | 49.4 | 41.2 |
| EV | Vondelparkbuurt | wijk | 35 | 46.1 | 46.1 | 38.0 |
| KA | Hoofddorppleinbuurt | wijk | 17 | 40.1 | 40.1 | 32.0 |
| KB | Schinkelbuurt | wijk | 18 | 48.8 | 48.8 | 41.8 |
| KC | Willemspark | wijk | 44 | 44.6 | 44.6 | 36.5 |
| KD | Museumkwartier | wijk | 134 | 42.3 | 42.3 | 34.1 |
| KE | Oude Pijp | wijk | 194 | 48.2 | 48.8 | 40.6 |
| KF | Nieuwe Pijp | wijk | 69 | 45.1 | 45.1 | 37.0 |
| KG | Zuid Pijp | wijk | 51 | 55.7 | 55.7 | 47.4 |
| KH | Stadionbuurt | wijk | 20 | 38.6 | 38.6 | 30.8 |
| KJ | Apollobuurt | wijk | 97 | 38.8 | 38.8 | 30.7 |
| KK | Scheldebuurt | wijk | 53 | 41.3 | 41.3 | 33.2 |
| KL | IJselbuurt | wijk | 32 | 51.1 | 51.1 | 43.0 |
| KM | Rijnbuurt | wijk | 135 | 52.1 | 53.0 | 45.0 |
| MA | Oostelijk Havengebied | wijk | 21 | 38.3 | 38.3 | 30.1 |
| MB | Weesperzijde | wijk | 37 | 40.7 | 40.7 | 32.6 |
| MC | Oosterparkbuurt | wijk | 52 | 35.6 | 35.6 | 27.5 |
| MD | Transvaalbuurt | wijk | 35 | 43.9 | 43.9 | 36.1 |
| ME | Dapperbuurt | wijk | 41 | 50.9 | 50.9 | 42.7 |
| MF | Indische Buurt-West | wijk | 51 | 46.3 | 46.3 | 38.2 |
| MG | Indische Buurt-Oost | wijk | 46 | 40.9 | 41.7 | 33.6 |
| MM | Frankendael | wijk | 17 | 42.4 | 42.4 | 34.1 |
| MN | Middenmeer | wijk | 17 | 28.3 | 28.3 | 20.4 |
| NF | Nieuwendammerdijk/Buiksloterdijk | wijk | 21 | 42.4 | 42.4 | 34.2 |
| NK | Volewijck | wijk | 56 | 50.6 | 50.6 | 40.8 |
| NL | IJplein/Vogelbuurt | wijk | 35 | 47.3 | 47.3 | 34.8 |
| NM | Tuindorp Buiksloot | wijk | 17 | 47.8 | 47.8 | 39.7 |
| NP | Noordelijke IJ-oevers-Oost | wijk | 18 | 41.0 | 41.0 | 33.4 |
| AA01 | Planciusbuurt-Noord | buurt | 17 | 38.6 | 38.6 | 31.1 |
| AA02 | Westelijke eilanden | buurt | 17 | 38.4 | 38.4 | 30.2 |
| AA04 | Planciusbuurt-Zuid | buurt | 16 | 42.5 | 42.5 | 34.4 |
| AA05 | Haarlemmerbuurt-West | buurt | 12 | 55.7 | 55.7 | 49.2 |
| AB01 | Marnixbuurt-Noord | buurt | 14 | 44.2 | 44.2 | 36.1 |
| AB02 | Driehoekbuurt | buurt | 16 | 47.9 | 47.9 | 39.8 |
| AB03 | Anjeliersbuurt-Noord | buurt | 16 | 51.0 | 51.0 | 42.9 |
| AB04 | Zaagpoortbuurt | buurt | 20 | 46.6 | 46.4 | 38.8 |
| AB05 | Anjeliersbuurt-Zuid | buurt | 16 | 47.7 | 47.7 | 39.5 |
| AB06 | Marnixbuurt-Midden | buurt | 19 | 55.4 | 55.4 | 47.3 |
| AB07 | Bloemgrachtbuurt | buurt | 12 | 35.0 | 35.0 | 26.9 |
| AB08 | Groenmarktkadebuurt | buurt | 16 | 52.8 | 52.8 | 47.1 |
| AB09 | Marnixbuurt-Zuid | buurt | 18 | 37.9 | 37.9 | 29.8 |
| AB10 | Elandsgrachtbuurt | buurt | 16 | 43.0 | 43.0 | 35.0 |
| AB11 | Passeerdersgrachtbuurt | buurt | 16 | 56.9 | 56.9 | 51.7 |
| AC01 | Langestraat e.o. | buurt | 13 | 54.3 | 54.3 | 46.2 |
| AD02 | Hemelrijk | buurt | 14 | 41.8 | 41.8 | 34.5 |
| AD03 | Nieuwendijk-Noord | buurt | 13 | 34.1 | 34.1 | 26.7 |
| AD05 | Nieuwe Kerk e.o. | buurt | 13 | 41.0 | 41.0 | 36.2 |
| AE01 | Kop Zeedijk | buurt | 15 | 60.3 | 60.3 | 60.8 |
| AE02 | Oude Kerk e.o. | buurt | 13 | 40.4 | 40.4 | 40.1 |
| AE03 | Burgwallen-Oost | buurt | 28 | 40.1 | 40.6 | 32.7 |
| AE04 | Nes e.o. | buurt | 14 | 39.4 | 39.4 | 32.0 |
| AE05 | BG-terrein e.o. | buurt | 17 | 45.2 | 45.2 | 37.7 |
| AF03 | Scheepvaarthuisbuurt | buurt | 12 | 26.8 | 26.8 | 20.7 |
| AF05 | Nieuwmarkt | buurt | 15 | 38.9 | 38.9 | 32.3 |
| AF06 | Uilenburg | buurt | 18 | 38.7 | 38.7 | 32.7 |
| AF08 | Zuiderkerkbuurt | buurt | 15 | 50.8 | 50.8 | 43.7 |
| AF09 | Waterloopleinbuurt | buurt | 12 | 55.9 | 55.9 | 49.3 |
| AG02 | Geelvinckbuurt | buurt | 15 | 46.8 | 46.8 | 40.0 |
| AG03 | Rembrandtplein e.o. | buurt | 13 | 36.9 | 36.9 | 28.9 |
| AG06 | Amstelveldbuurt | buurt | 17 | 39.6 | 39.9 | 31.9 |
| AH01 | Leidsebuurt-Noordwest | buurt | 17 | 42.1 | 42.1 | 34.0 |
| AH02 | Leidsebuurt-Noordoost | buurt | 15 | 51.5 | 51.5 | 43.3 |
| AH03 | Weteringbuurt | buurt | 14 | 44.7 | 44.7 | 36.5 |
| AH05 | Leidsebuurt-Zuidwest | buurt | 12 | 40.3 | 40.3 | 32.5 |
| AH06 | Leidsebuurt-Zuidoost | buurt | 17 | 38.9 | 38.9 | 30.7 |
| AH07 | Den Texbuurt | buurt | 12 | 48.7 | 48.7 | 40.5 |
| AJ01 | Weesperbuurt | buurt | 17 | 48.7 | 48.7 | 40.6 |
| AJ03 | Sarphatistrook | buurt | 18 | 30.5 | 30.5 | 22.3 |
| AK04 | Oostenburg | buurt | 15 | 50.7 | 50.7 | 42.5 |
| AK05 | Czaar Peterbuurt | buurt | 15 | 44.7 | 44.7 | 36.9 |
| AK07 | Kadijken | buurt | 16 | 46.5 | 46.5 | 38.4 |
| AK08 | Kazernebuurt | buurt | 15 | 44.4 | 44.4 | 36.2 |
| BB05 | Minervahaven-Zuidwest | buurt | 20 | 53.2 | 53.2 | 45.0 |
| EB04 | Spaarndammerbuurt-Noordwest | buurt | 57 | 56.3 | 56.8 | 48.7 |
| EB05 | Spaarndammerbuurt-Midden | buurt | 37 | 45.3 | 45.7 | 37.5 |
| EB06 | Spaarndammerbuurt-Zuidwest | buurt | 20 | 51.7 | 51.7 | 43.5 |
| EB07 | Spaarndammerbuurt-Noordoost | buurt | 21 | 55.6 | 55.6 | 47.5 |
| EB08 | Zeeheldenbuurt | buurt | 19 | 44.7 | 44.7 | 37.6 |
| EB09 | Westergasfabriek | buurt | 17 | 44.9 | 44.9 | 36.9 |
| EB10 | Spaarndammerbuurt-Zuidoost | buurt | 19 | 47.9 | 47.9 | 39.6 |
| EE01 | Bosleeuw | buurt | 19 | 47.9 | 47.9 | 40.7 |
| EE02 | Gibraltarbuurt | buurt | 20 | 45.3 | 45.3 | 37.1 |
| EE04 | Landlust-Noord | buurt | 18 | 46.6 | 46.6 | 38.5 |
| EE05 | Erasmusparkbuurt-Oost | buurt | 20 | 46.0 | 46.0 | 37.8 |
| EE06 | Landlust-Zuid | buurt | 19 | 47.3 | 47.3 | 39.2 |
| EF01 | Robert Scottbuurt-Oost | buurt | 19 | 48.4 | 48.4 | 40.6 |
| EF02 | Erasmusparkbuurt-West | buurt | 19 | 40.5 | 40.5 | 32.3 |
| EH01 | Westerstaatsman | buurt | 21 | 48.1 | 48.1 | 39.9 |
| EH02 | Fannius Scholtenbuurt | buurt | 17 | 51.1 | 51.1 | 43.3 |
| EH05 | De Wittenbuurt-Zuid | buurt | 18 | 55.9 | 55.9 | 48.7 |
| EH06 | Buyskade e.o. | buurt | 19 | 51.3 | 51.3 | 43.4 |
| EJ01 | Frederik Hendrikbuurt-Noord | buurt | 15 | 42.4 | 42.4 | 34.1 |
| EJ03 | Frederik Hendrikbuurt-Zuidoost | buurt | 16 | 39.1 | 39.1 | 30.9 |
| EK02 | Orteliusbuurt-Noord | buurt | 27 | 44.2 | 44.5 | 36.3 |
| EK03 | Jan Maijenbuurt | buurt | 43 | 41.0 | 41.5 | 33.3 |
| EK04 | John Franklinbuurt | buurt | 36 | 43.6 | 44.0 | 35.9 |
| EL01 | Pieter van der Doesbuurt | buurt | 18 | 47.0 | 47.0 | 38.8 |
| EL02 | Trompbuurt | buurt | 17 | 55.8 | 55.8 | 48.6 |
| EL03 | Geuzenhofbuurt | buurt | 20 | 58.4 | 58.4 | 51.0 |
| EM01 | Orteliusbuurt-Midden | buurt | 28 | 48.7 | 49.2 | 41.0 |
| EM02 | Balboaplein e.o. | buurt | 62 | 37.4 | 37.9 | 29.7 |
| EM03 | Orteliusbuurt-Zuid | buurt | 19 | 51.3 | 51.3 | 43.3 |
| EM04 | Columbusplein e.o. | buurt | 20 | 46.7 | 46.7 | 38.6 |
| EN01 | Filips van Almondekwartier | buurt | 35 | 44.2 | 44.9 | 36.7 |
| EN02 | Kortenaerkwartier | buurt | 14 | 47.9 | 47.9 | 39.8 |
| EN03 | Van Brakelkwartier | buurt | 21 | 55.6 | 55.6 | 47.4 |
| EN04 | De Wester Quartier | buurt | 14 | 54.1 | 54.1 | 45.9 |
| EP01 | Bellamybuurt-Noord | buurt | 19 | 55.0 | 55.0 | 46.9 |
| EP02 | Bellamybuurt-Zuid | buurt | 176 | 43.7 | 44.4 | 36.3 |
| EQ01 | Da Costabuurt-Noord | buurt | 111 | 45.7 | 46.4 | 38.2 |
| ER01 | Postjeskade e.o. | buurt | 19 | 48.1 | 48.1 | 39.9 |
| ER02 | Paramariboplein e.o. | buurt | 18 | 49.6 | 49.6 | 41.3 |
| ES01 | Lootsbuurt | buurt | 42 | 44.5 | 45.0 | 36.9 |
| ES02 | Borgerbuurt | buurt | 44 | 53.4 | 53.4 | 45.3 |
| ES03 | Da Costabuurt-Zuid | buurt | 66 | 45.4 | 45.8 | 37.7 |
| ET02 | Vondelparkbuurt-West | buurt | 18 | 39.5 | 39.5 | 32.6 |
| EU01 | Cremerbuurt-Oost | buurt | 26 | 51.4 | 51.6 | 43.5 |
| EU02 | WG-terrein | buurt | 17 | 51.9 | 51.9 | 43.7 |
| EU03 | Helmersbuurt-Oost | buurt | 33 | 46.8 | 47.4 | 39.2 |
| EV01 | Vondelparkbuurt-Midden | buurt | 18 | 45.8 | 45.8 | 37.7 |
| EV02 | Vondelparkbuurt-Oost | buurt | 17 | 49.9 | 49.9 | 41.7 |
| KA02 | Surinamepleinbuurt | buurt | 16 | 40.1 | 40.1 | 32.0 |
| KB01 | Schinkelbuurt-Noord | buurt | 17 | 48.8 | 48.8 | 41.8 |
| KC02 | Willemsparkbuurt-Noord | buurt | 14 | 56.5 | 56.5 | 49.5 |
| KC03 | Valeriusbuurt-West | buurt | 14 | 42.8 | 42.8 | 34.7 |
| KC04 | Valeriusbuurt-Oost | buurt | 16 | 40.2 | 40.2 | 32.1 |
| KD02 | Cornelis Schuytbuurt | buurt | 16 | 41.8 | 41.8 | 34.1 |
| KD03 | Concertgebouwbuurt | buurt | 16 | 43.4 | 43.4 | 35.3 |
| KD04 | P.C. Hooftbuurt | buurt | 16 | 46.7 | 46.7 | 38.5 |
| KD06 | Banpleinbuurt | buurt | 17 | 46.5 | 46.5 | 38.4 |
| KD07 | Hondecoeterbuurt | buurt | 16 | 31.3 | 31.3 | 23.3 |
| KD08 | Johannes Vermeerbuurt | buurt | 19 | 45.9 | 45.9 | 37.7 |
| KD09 | Duivelseiland | buurt | 16 | 57.3 | 57.3 | 49.2 |
| KD10 | Harmoniehofbuurt | buurt | 13 | 48.6 | 48.6 | 40.5 |
| KE01 | Frans Halsbuurt | buurt | 42 | 54.5 | 55.1 | 46.9 |
| KE02 | Gerard Doubuurt | buurt | 13 | 58.1 | 58.1 | 51.5 |
| KE03 | Hercules Seghersbuurt | buurt | 16 | 51.3 | 51.3 | 43.1 |
| KE04 | Sarphatiparkbuurt | buurt | 106 | 46.0 | 46.6 | 38.4 |
| KE05 | Hemonybuurt | buurt | 17 | 49.7 | 49.7 | 41.9 |
| KF01 | Cornelis Troostbuurt | buurt | 20 | 39.0 | 39.0 | 30.9 |
| KF02 | Lizzy Ansinghbuurt | buurt | 17 | 44.9 | 44.9 | 36.7 |
| KF03 | Van der Helstpleinbuurt | buurt | 16 | 44.8 | 44.8 | 36.6 |
| KF04 | Willibrordusbuurt | buurt | 16 | 50.5 | 50.5 | 42.3 |
| KG01 | Burgemeester Tellegenbuurt-West | buurt | 16 | 61.5 | 61.5 | 53.3 |
| KG02 | Burgemeester Tellegenbuurt-Oost | buurt | 17 | 54.7 | 54.7 | 46.6 |
| KG03 | Diamantbuurt | buurt | 18 | 59.1 | 59.1 | 51.0 |
| KH04 | Marathonbuurt-Oost | buurt | 18 | 38.3 | 38.3 | 30.6 |
| KJ01 | Hiltonbuurt | buurt | 15 | 37.5 | 37.5 | 29.3 |
| KJ02 | Minervabuurt-Noord | buurt | 17 | 42.6 | 42.6 | 34.4 |
| KJ03 | Minervabuurt-Midden | buurt | 18 | 40.7 | 40.7 | 33.5 |
| KJ04 | Minervabuurt-Zuid | buurt | 17 | 47.0 | 47.0 | 38.9 |
| KJ05 | Beethovenbuurt | buurt | 17 | 39.5 | 39.5 | 31.3 |
| KJ06 | Diepenbrockbuurt | buurt | 13 | 34.3 | 34.3 | 26.7 |
| KK01 | Wielingenbuurt | buurt | 18 | 43.2 | 43.2 | 35.0 |
| KK02 | Scheldebuurt-West | buurt | 15 | 39.8 | 39.8 | 31.7 |
| KK03 | Scheldebuurt-Midden | buurt | 16 | 49.5 | 49.5 | 41.5 |
| KL01 | IJselbuurt-West | buurt | 16 | 48.7 | 48.7 | 41.2 |
| KL02 | IJselbuurt-Oost | buurt | 16 | 59.7 | 59.7 | 51.5 |
| KM01 | Kromme Mijdrechtbuurt | buurt | 13 | 44.1 | 44.1 | 36.0 |
| KM02 | Rijnbuurt-West | buurt | 19 | 55.1 | 55.1 | 46.8 |
| KM04 | Rijnbuurt-Oost | buurt | 103 | 52.6 | 53.6 | 45.5 |
| MB01 | Weesperzijde-Noord | buurt | 19 | 41.8 | 41.8 | 33.7 |
| MB02 | Weesperzijde-Midden/Zuid | buurt | 18 | 36.9 | 36.9 | 28.7 |
| MC01 | Oosterparkbuurt-Noordwest | buurt | 18 | 35.4 | 35.4 | 27.3 |
| MC03 | Oosterparkbuurt-Zuidwest | buurt | 15 | 43.9 | 43.9 | 35.6 |
| MC04 | Oosterparkbuurt-Zuidoost | buurt | 17 | 39.8 | 39.8 | 33.0 |
| MD01 | Transvaalbuurt-West | buurt | 19 | 50.5 | 50.5 | 42.5 |
| MD02 | Transvaalbuurt-Oost | buurt | 16 | 43.9 | 43.9 | 36.1 |
| ME01 | Dapperbuurt-Noord | buurt | 15 | 46.9 | 46.9 | 38.9 |
| ME02 | Dapperbuurt-Zuid | buurt | 19 | 53.1 | 53.1 | 44.9 |
| MF01 | Timorpleinbuurt-Noord | buurt | 19 | 45.0 | 45.0 | 36.8 |
| MF02 | Timorpleinbuurt-Zuid | buurt | 16 | 50.1 | 50.1 | 41.9 |
| MF03 | Ambonpleinbuurt | buurt | 16 | 53.6 | 53.6 | 45.4 |
| MG01 | Makassarpleinbuurt | buurt | 45 | 40.9 | 41.7 | 33.6 |
| MM03 | Don Bosco | buurt | 17 | 42.4 | 42.4 | 34.1 |
| MN01 | Linnaeusparkbuurt | buurt | 17 | 28.3 | 28.3 | 20.4 |
| NF03 | Nieuwendammerdijk-West | buurt | 18 | 45.9 | 45.9 | 37.7 |
| NK01 | Bloemenbuurt-Noord | buurt | 18 | 52.5 | 52.5 | 44.5 |
| NK02 | Bloemenbuurt-Zuid | buurt | 20 | 48.4 | 48.4 | 41.0 |
| NK03 | Van der Pekbuurt | buurt | 18 | 53.2 | 53.2 | 46.2 |
| NL01 | Vogelbuurt-Noord | buurt | 16 | 38.9 | 38.9 | 30.7 |
| NL03 | Vogelbuurt-Zuid | buurt | 17 | 47.5 | 47.5 | 41.0 |
| NM01 | Blauwe Zand | buurt | 17 | 47.8 | 47.8 | 39.7 |
| NP01 | Hamerstraatkwartier-West | buurt | 18 | 41.0 | 41.0 | 33.4 |
| | median over profiles | | | 45.9 | 46.0 | 37.8 |
