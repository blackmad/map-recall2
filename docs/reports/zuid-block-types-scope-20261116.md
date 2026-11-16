# Zuid block types: scope (2026-11-16)

**Question:** do Plan Zuid perimeter blocks repeat enough that a few "ordinary building" block types, built as large recipes and stamped onto matching blocks, would beat drawing them house by house?

**Answer:** massing repeats, but facade design does not repeat across buurten. Lane R's kit already draws most of Rivieren, Apollo and Stadion. The gap is Hoofddorppleinbuurt (0 % drawn). Pilot one type there, as a kit district family, not as large recipes.

## Method

BAG pands (`bag-tiles/14`: year, 3DBAG eaves/ridge) in wijken KA, KB, KH, KJ, KK, KL, KM: 12,855 pands. Blocks are connected footprints (shared vertices or edges within 0.6 m) with at least 4 pands from 1915–40, eaves of 7 m or more and a long side of 30 m or more: **209 blocks, 7,523 pands**. Street faces are outer edges facing a named street within 30 m. Ride-weighted km counts primary and secondary streets ×3, tertiary ×2 and residential ×1; it is a proxy, because `ride-visibility.ts` was not run. The monument register has no architect or complex field and covers 36 of these pands, so it cannot separate designs.

## Ranked designs

| # | Data signature | Blocks | Pands | Face km | Ride-weighted km | Kit-drawn today | Wijken |
|---|---|---|---|---|---|---|---|
| D1 | 4 storeys, pitched/mansard behind cornice, eaves 12.6–13.0 m, 1924–40 | 66 | 2,382 | 28.7 | 36.0 | 58 % | KK 20, KA 15, KH 15, KJ 15 |
| D2 | 3 storeys + roof storey, eaves 9.6–10.3 m | 53 | 1,890 | 22.3 | 26.3 | 45 % | KA 15, KJ 14, KK 13, KH 11 |
| D5 | 4 storeys, mixed roofs (raised corners) | 21 | 796 | 10.3 | 15.7 | 36 % | KH 6, KA 5, KK 3 |
| D3 | early 4 storeys, flat, 1920–26 | 17 | 612 | 7.9 | 9.6 | 75 % | KL 11, KM 5 |
| D6 | 5 storeys | 14 | 466 | 4.8 | 6.1 | 71 % | KH 5, KK 4, KL 4 |
| D4 | 3 storeys, flat, narrow fronts (6.7 m) | 14 | 585 | 4.5 | 4.8 | 57 % | KM 9, KL 5 |

**Kit coverage by wijk** (`buurtKit` records):

| Wijk | Blocks | Pands | Kit-drawn | Ride-weighted km |
|---|---|---|---|---|
| KA Hoofddorppleinbuurt | 36 | 1,735 | **0 %** | 24.2 |
| KB Schinkelbuurt | 3 | 189 | **0 %** | 2.8 |
| KH Stadionbuurt | 40 | 1,255 | 80 % | 20.4 |
| KK Scheldebuurt | 40 | 1,473 | 77 % | 21.5 |
| KL / KM Rivierenbuurt | 50 | 1,881 | 67–76 % | 22.6 |
| KJ Apollobuurt | 40 | 990 | 64 % | 19.0 |

None has a large recipe or landmark.

## Representative blocks and the panorama check (4 looks)

| Design | Block (sample pand) | Streets | Panorama read |
|---|---|---|---|
| D1 | KK01 `0363100012106956` (65 pands) | Deurloostraat, Scheldestraat | plain brick, flat cornice, roof stair-head |
| D1 | KA05 `0363100012073914` (59 pands) | Aalsmeerweg, Sassenheimstraat | canted erkers, chequer frieze, overhang, attic strip |
| D2 | KK01 `0363100012091479` (60 pands) | Volkerakstraat, Wielingenstraat | hipped tile roof, dentil gutter, corner erker tower |
| D2 | KA03 `0363100012095655` (84 pands) | Hoofddorpweg, Sloterkade | same as KA05 |

The two D1 blocks differ, while the two KA blocks match across massing classes. **The repeating unit is the buurt vocabulary, not the block geometry.** A kit family captures exactly that.

## Reusable parts and system fit

| Part | Kit (lane R) | Large recipe |
|---|---|---|
| Canted erker stacks | `erkers` | `bayWindows` |
| Corner towers, stepped wings | `raised` | `addCornerTowers` |
| Stair axes | yes | partly (`stairLight`) |
| Attic window strip | `attic` | `ribbonStoreys` |
| Overhanging eaves | `eaves.overhangM` | `eavesOverhang` |
| Chequer-brick frieze | **missing** | `brickStripes`, `tileAccents` |
| Gateway arch spanning pands | missing | unverified |

A large intent covers one pand and has no coordinates (`largeIntent.ts`). Stamping a block therefore means fitting one intent per pand, which is about 1,700 intents with their own gates in KA alone. The kit already treats a row as a series with members.

## Pilot recommendation

- **Design:** the KA vocabulary (D1, D2 and D5 in Hoofddorppleinbuurt): overhanging eaves, chequer frieze, attic strip, canted erkers, raised corners.
- **Vehicle:** a `hoofddorpplein` district library for the buurt generator (KA01–06), plus one typed kit component, the chequer frieze, byte-identical when absent.
- **Coverage:** 35 blocks, about 1,700 pands, 16.8 face km (24.2 ride-weighted). This is the largest undrawn 1915–40 stock in Zuid.
- **Cost (estimate):** one opus lane, 1–1.5 days, about 1.5–3 M tokens. Per-pand large-recipe stamping would cost several times more.
- **Blind test** (`npm run house:row-sheet`, judged per `blind-review.md` by a non-builder):
  - On three KA rows (Aalsmeerweg 073914, Hoofddorpweg 095655, Heemstedestraat 082836), compare the family with today's generic fill. The family must win at least 2 of 3.
  - As a control, add the frieze to Deurloostraat 106956 and compare with lane R's current kit. It must not be worse. If it wins, port the frieze to the Rivieren and Apollo families.
- **Not now:** large-recipe block types for Rivieren, Apollo or Stadion, where the kit already draws 64–80 % of block pands.
- **Open:** Schinkelbuurt (3 blocks), and a real `ride-visibility.ts` ranking before round 2.
