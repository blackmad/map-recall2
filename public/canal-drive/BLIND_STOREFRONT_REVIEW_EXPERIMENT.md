# Independent image-first storefront review — 9 September 2026

Ten previously unreviewed frontages were inspected without first reading their addresses or model answers. Six were sampled from baseline shopfront-positive records and four from uncertain records, with deterministic SHA256 ordering, one frontage per building. Every previously reviewed building and every authored anchor building was excluded. This is a small stratified machine-review experiment, **not an accuracy evaluation or human ground truth**.

## Findings

All six baseline-positive storefront calls were visually supported. All four uncertain examples looked residential in their available images. Thus this sample provides no evidence of false-positive storefront density; it does expose awning-type ambiguity.

| Source frontage, revealed after decisions | Direct observation | Baseline difference |
| --- | --- | --- |
| Nassaukade 141, Da Costakade 21/45, Nassaukade 137 | Domestic doors/windows, no commercial display/sign | Four shopfront unknown → no; four awning unknown → no |
| Da Costakade 51 | DORUS on window glass and two yellow/cream striped deployed fabric awnings | Agreement; November 2024 sign differs from older January 2023 full view |
| De Clercqstraat 25 | Toms on the target glass; neighbouring cafe text excluded | Awning no → unknown: newer crop cuts off upper fascia |
| De Clercqstraat 19 | Chai kitchen; retracted rounded awning cassette and side hardware | Awning no → yes **installed/retracted, not deployed** |
| Da Costastraat 6 | IWKA on commercial/service frontage; fixed tiled little eaves | Awning yes → no under the fabric-awning definition |
| De Clercqstraat 2 | Restaurant frontage with burgundy fabric shades | Agreement; shop name withheld behind a temporary yellow traffic sign |
| De Clercqstraat 13 | Wasserette; WASH PRATIC | Only OCR punctuation differs; awning no → unknown because horizontal housing type is unresolved |

Four of ten shopfront labels differ, all uncertainty resolutions rather than positive/negative reversals. Eight of ten awning labels differ if abstentions count: four unknown→no, two definite yes/no reversals, two no→unknown. Exact sign strings differ once, solely due to a separator; there is no substantive sign-name disagreement in this sample. These are disagreements between agents, not measured correctness.

## Scope and implications

- Keep `awningType` alongside the existing binary field: deployed fabric, retracted hardware, rigid architectural canopy and uncertain housing should not all produce the same mesh. In particular, do not render a deployed canopy at Chai kitchen from this review.
- Preserve historical source dates per field. Full/context/roof and ground images span January 2023–July 2025; a current extraction is not a claim that a shop is trading today. DORUS is a concrete mixed-date case.
- Only the sampled physical wall supports the text. No transfer around corners, no neighbouring cafe/optician name, and no road-sign text as a business identity.
- A blank sign may mean confidently absent or deliberately unreadable; eligibility distinguishes them. The obscured restaurant name remains withheld rather than guessed.
- Visible facade-top shape is not roof volume. Four straight tops and one stepped front were recorded; remaining subtypes and all ten whole-roof shapes were withheld. This pass is not a roof-geometry replacement.
- `buildingMatch=yes` means visible agreement between the supplied full/context and detail crops; this is not independent geolocation or exact registration. All observations remain agent proposals, `humanReviewed=false`, `metricEligible=false`, and `needsReview=true`.

## Reproducibility and artifacts

Directory: `.cache/da-costa-neighbourhood/blind-storefront-2026-09-09/`.

`frozen-packets.json` pins the active manifest/publication hashes and all forty exact crop images. Numbered JPEG contact sheets show only image kind and capture date; the numbered native crop copies retain their original SHA256. All ten contact sheets were visually inspected; native ground images were additionally inspected for 04, 05, 07, 08, 09 and 10. No contextual panorama expansion was needed to support the limited asserted fields. No synthetic images, web identity search, paid calls or human-label writes were used.

`frozen-blind-decisions.json` was persisted before the program opened `sealed-baseline-mapping.json`. The latter contains source identities and model responses; `baseline-comparison.json` was generated only afterward. `findings.json` contains the source-bound publication candidates. The scripts refuse to overwrite the frozen sample/decisions, and pin pixels, packet and identity mapping to prevent rerunning old judgments on changed sources.

Packet SHA256: `3df76f6433d094c4fa71a99111776895d429c77d958f0a6adf27259578a89615`.

Decision SHA256: `fb174ea28cf46b5d5003fd054582b3d116bfd3f1de19d6ef485e92c47e711c50`.

Commands used:

```sh
rtk proxy node scripts/da-costa-block/prepare-blind-storefront-sample.mjs
rtk proxy node scripts/da-costa-block/record-blind-storefront-review.mjs
rtk proxy node scripts/check-blind-storefront-review.mjs
```

Only new experiment scripts/artifacts/report were added. This experiment did not edit the active manifest, publisher, renderer or review decisions; publication is a separate integration step.

Post-freeze follow-up: `awning-observations-v1.json` adds source-bound structured presence, kind and observed deployment annotations, generated by `rtk proxy node scripts/da-costa-block/annotate-blind-awning-state.mjs`. It explicitly declares that model answers and identities had already been revealed; it does not change the frozen decisions. Only DORUS and the obscured-name restaurant support deployed fabric geometry. Chai kitchen is retracted; IWKA is a fixed rigid canopy, with fabric-awning presence no. The sidecar includes exact source image hashes/dates and preserves all human gates. This makes the old yes/no field safe to interpret without inventing an open awning from retracted hardware.
