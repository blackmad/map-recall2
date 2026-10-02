# Canal Recall storefront evidence

Reference material behind the hand-tuned storefronts in `src/canalRecall/storefrontSpecs.ts`
on `main`. Kept on this orphan branch so `main` does not carry the images.

- `refs/<slug>.jpg|json` — rectified panorama crop of the business's wall (Gemeente Amsterdam
  panoramas, built by `scripts/pano-facades/build-pano-facade.ts --near=<pin> --top=7 --ppm=40`),
  with its metadata: wall ends, length, pixels per metre, pin position along the wall (`nearAlongM`).
- `candidates.tsv` — the 400 businesses picked by `scripts/storefronts/candidates.ts`.
- `decisions.tsv` — per business: status (`measured` from a full-size crop with a metre ruler,
  `first-pass` from a thumbnail, `null` when the crop shows no usable shopfront, `no-reference`
  when no panorama faces the wall) and the reason or registration note.
- `register.json`, `wallside.json`, `bury.json` — wall-vs-footprint checks: facade extent along
  each wall, outward side, and how far the footprint stands proud of the panorama wall (`outM`).
- `web/<slug>.md` — web evidence for businesses whose panorama was not enough.

To work on a storefront: copy `refs/` to `tmp/storefronts/refs/` on `main`, then
`node scripts/storefronts/measure-sheet.mjs out.jpg <slug>...` (2x crop, metre ruler, pin, likely
building edges) and `node scripts/storefronts/review.mjs out.jpg <slug>...` (model beside photo,
dev server on :4388). Registration: when a building's own edge shows inside the crop, set `shift`.
