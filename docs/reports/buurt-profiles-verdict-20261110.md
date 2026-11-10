# Buurt profiles citywide: Opus verdict (2026-11-10)

Reviewed: lane/profiles-citywide-20261107 at dc40c59b9; sheet
`docs/images/look/profiles-citywide-18spot-20261109.jpg`; report and coverage record of 2026-11-09;
`buurt-profiles.json` checked directly for the knob distributions.

## Spots (panorama against the after card)

| # | spot | verdict | reason |
|---|---|---|---|
| 1 | Tweede Egelantiersdwarsstraat (AB05) | WARN | Photo is warm dark-brown brick on the left and white/cream fronts on the right; the c19 era (n 9) swatches are one brown plus six greys, painted 89 %. Grey is what the photo does not show. Unchanged by this lane. Shops 34 % fits the cafe corner. |
| 2 | Tichelstraat (AB03) | WARN | Swatches (warm browns plus one orange) match the brick. Shops 45 % is high for a quiet residential street. |
| 3 | Eerste Looiersdwarsstraat (AC04) | PASS | Dark brown and red-brown brick, one pale. The saturated reds are the palette lane's problem, not this one's. Shops 31 % is plausible. |
| 4 | Bellamystraat (EP02) | PASS | Pinks and light greys are gone and the browns read closer to the photo's brick. Shops 41 % is high for this street (WARN on that number only). |
| 5 | Ten Katestraat (EP02) | WARN | The photo is a very dark purple-brown; the swatches are a uniform orange-brown. Storey 3.60 m (clamped to +8 %) would make houses taller that already read tall. Shops 41 % suits the market street. |
| 6 | Nicolaas Beetsstraat (ES02) | PASS | Shops fall from 100 % to 30 % (the photo shows none, so this is better but still high). The brown-orange brick is close. |
| 7 | Tweede Jan Steenstraat (KE05) | PASS | Brown brick plus grey and pale matches the mixed row. Shops 25 % is fine. |
| 8 | Saenredamstraat (KE01) | WARN | Painted share rises from 36 % to 48 %: half the swatches are now pale, while the photo is brick with white cornices plus one rendered block. Brighter is the requested direction, so this is accepted. Storey 2.70 m pulls these tall-storeyed Pijp houses lower, which is the wrong direction. |
| 9 | Daniel Stalpertstraat (KE02) | WARN | The photo is a red-brown brick block with white frames; the card shows 4 whites and 2 greys of 9 and painted 54 %, which over-paints it. Unchanged palette. Shops 51 % is high. |
| 10 | Van Breestraat (KD02, Cornelis Schuytbuurt) | PASS | n grows from 16 to 24 and adds the cream/sandstone the photo shows. Shops 10 % is right. |
| 11 | Kerkstraat (AG04) | PASS | It moves from the wijk fallback to its own Spiegelbuurt canal era (n 18), with darker browns and painted 33 % → 17 %. The photo is mostly brick, so that is acceptable. Shops 100 % → 49 % is a clear improvement. |
| 12 | Runstraat (AC03) | FAIL | Regression. Before, it drew the wijk Grachtengordel-West canal era (n 26). After, its own profile has only a modern era, so the canal pand gets "no profile era" and swatches that include greens. The photo is classic canal brick and render. |
| 13 | Schellingwoude-Oost (NQ05) | WARN | Still the city school default (orange-red). The photo is dark purple-brown brick. The wijk NQ school era (n 27, #662b1d…) would be closer. |
| 14 | Baaibuurt-West (MH04) | FAIL | Likeness only, not a regression. The photo is pale yellow/buff brick and the city default is orange-red. Wijk MH is modern-only, so a wijk fallback cannot help. |
| 15 | Buiksloterham-Noord (NB05) | WARN | City default red-brown is near the industrial brick. Wijk NB is modern-only. |
| 16 | Tuindorp Oostzaan-Oost (NC02) | FAIL | Regression. Its new own school era (n 12, exactly the minimum) has 1 brown, 1 salmon and 5 greys, painted 58 %. The photo is warm red-brown brick with white frames and no paint. The city default it replaced was closer. |
| 17 | Betondorp (MP03) | PASS | Browns, reds, greys and whites with painted 43 % suit the mix of brick and rendered concrete better than the city default. |
| 18 | De Aker-Oost (FG03) | WARN | Pale buff brick villa against the orange city default; no change. Wijk FG is modern-only. |

Tally: 7 PASS, 8 WARN, 3 FAIL. Of the FAILs, 12 and 16 are regressions from this lane; 14 is a data gap.

## Knobs

- **storeyHeightM: HOLD.** Keep the field in the data and make `storeyScaleOf` return 1 (or gate it behind a
  flag) until it is re-measured. The evidence:
  - The value is buurt-level, copied into every era. KE01, KM, EU03 and KD09 carry the same number for canal, c19
    and school, so it does not describe the era it is attached to.
  - It covers only 99 era entries, with a median of 3.45 m against a nominal 3.0–3.1 m. That is a systematic bias:
    most entries would sit on the +8 % cap, which is the eaves ÷ storeys denominator problem the lane flagged.
  - The tails are implausible: 2.45 m for all of KM, and 2.70 m for the Pijp at spot 8, which pulls those houses
    lower. Spot 5's 3.60 m makes already-tall fronts taller.

  Re-measure per era, with the ground floor counted explicitly (eaves ÷ (upper storeys + ground-floor factor)),
  and require n ≥ 20 per era.
- **shopfrontShare: SHIP.** The city-wide median is 0.035, and the centre (AD/AE 0.8–0.97) is plausible for the
  Wallen and Nieuwmarkt. It replaces absurd block-face `shopShare` values (Borgerbuurt 1.0 → 0.30,
  Kerkstraat wijk 1.0 → 0.49), and it is drawn only where the shopfront extract is absent. It is a share of pands,
  not of street frontage, so quiet streets in busy buurten read high (spots 2, 4, 9). Follow-up: measure it per
  street run or per grid cell, not per buurt.

## Hold at fallback

- **AC03 Felix Meritisbuurt**: hold at wijk AC. AC's canal era has n 60, which fixes spot 12 until era-level
  fallback lands.
- **NC02 Tuindorp Oostzaan-Oost**: drop its pre-1945 eras so they fall to the city default. Wijk NC is not a
  fix, because NC's canal/c19/school eras are the same 12 samples. Raise the pre-1945 era minimum for these
  garden villages to n ≥ 20, or require painted ≤ 0.3 where the BAG material is brick.
- Era-level fallback (next section) would make the AC03 hold unnecessary.

## Modern-only profiles: fall back per era, not per profile

Yes, fall back per era. A pand whose era is missing from its own profile should take the wijk's era before the
city default. Today `bayLook.ts:190` (`buurt?.eras[archetype]`) and `threeBuildingFeatures.ts:140` read only the
buurt's own eras.

The concrete change is at build time in `scripts/buurt-profiles/derive.ts`, so the runtime stays untouched:
1. After `pruneEras`, for each buurt-level profile and each era in canal/c19/school that it lacks (or dropped),
   copy the era from its wijk pool when the wijk era has n ≥ 20. Mark the copy `from: 'wijk'`; this needs a new
   optional `EraProfile.from?: 'wijk' | 'stadsdeel'`, validated in `validateProfileSet`.
2. When the wijk is also modern-only (MH, NB and FG on the sheet), fall back to a stadsdeel-level pre-1945 pool,
   keyed by the first letter of the gebied code and pooled in the same pass, before the city default.
3. Record each fill in the coverage JSON (`eraFills: [{era, from, n}]`). Add a unit test that a modern-only
   profile resolves canal to the wijk era, and that a profile whose eras are all present is byte-identical.

This fixes spots 12 and 13, and gives 14, 15 and 18 a Noord/Nieuw-West pre-1945 pool instead of the central-city
default.

## Overall

**Publish: yes, conditionally.** Ship the new profiles and `shopfrontShare` with three conditions:
- `storeyHeightM` stays inert (scale 1).
- AC03 is held at wijk AC.
- NC02's pre-1945 eras are dropped to the city default.

The era-level fallback above is the next change and should land before the T1 week. Saturation and the
grey-heavy painted swatches (spots 1, 9) belong to the palette lane.

## Follow-up applied (2026-11-10, same lane)

- storeyHeightM held: `storeyScaleOf` returns 1 (`STOREY_SCALE_ENABLED = false`, test pins it); data kept. Follow-up: re-measure per era with the ground floor counted and n >= 20.
- Pre-1945 era minimum raised to n >= 20 (modern stays 8).
- Era-level fallback in derive.ts: a missing canal/c19/school era is filled from the wijk era (n >= 20), else the stadsdeel pool (first letter of the gebied code); the era carries `from: 'wijk' | 'stadsdeel'` and each fill is recorded in the coverage JSON (`eraFills`).
- Coverage: 299 buurten with a measured era, 58 filled from wijk/stadsdeel only, 158 on their wijk profile, 3 city default (TG01-03) = 518.
- Re-check on the regenerated sheet `docs/images/look/profiles-citywide-18spot-20261110.jpg`: spot 12 Runstraat follows wijk AC canal era (n 60); spot 16 Tuindorp drops its 12-front era for the N stadsdeel pool (painted 33 %, not 58 %); spots 13, 14, 15 get an area pool (13 from wijk NQ, 14 and 15 from stadsdeel M and N); spot 17 Betondorp now takes the M stadsdeel pool instead of its 14-front own era; spot 18 stays city default (stadsdeel F has no pre-1945 pool of 20).
