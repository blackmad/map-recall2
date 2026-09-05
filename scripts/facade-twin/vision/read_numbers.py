"""Read house numbers off the door-band tiles.

EasyOCR (Apache-2.0), not an Ultralytics model. Two reasons. Ultralytics is
AGPL-3.0, which this project's own licensing rule makes awkward for anything
that ships; and YOLO detects boxes, so a house-number pipeline built on it still
needs a separate recognition model. EasyOCR is detection plus recognition, and it
was already in the vision environment.

The recogniser is never told what number to expect. It is given a digit
allowlist, which constrains the character set and not the answer, and every
reading it returns is kept — including the ones that turn out to belong to the
neighbour, because those are the measurement.

Two settings matter and both were established by trying them:

  * `mag_ratio` and `canvas_size`. The detector rescales its input to a working
    canvas, and at the default 2560 a 5.5 m tile at 200 px/m is downscaled until
    a 13 cm digit is under 15 px and disappears. Tiles are small enough to be
    magnified rather than shrunk.
  * Contrast. A number carved in sandstone is pale paint on pale stone, with no
    colour difference at all. Autocontrast on the luminance channel is run as a
    second pass and its readings are merged, because it helps the carved ones
    and hurts the enamel plates, which are already high contrast.

Usage:
  .venv-vision/bin/python scripts/facade-twin/vision/read_numbers.py \
      --bands .cache/facade-twin/number-bands \
      --out   .cache/facade-twin/number-bands/readings.json
"""
import argparse, hashlib, json, os, sys, time

import numpy as np
from PIL import Image, ImageOps


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--bands', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--min-confidence', type=float, default=0.10)
    args = ap.parse_args()

    manifest_path = os.path.join(args.bands, 'manifest.json')
    with open(manifest_path) as fh:
        manifest = json.load(fh)

    import easyocr
    reader = easyocr.Reader(['en'], gpu=False, verbose=False)

    def read(array, **kw):
        # Tiles are sampled at the source's own rate, so a 13 cm digit arrives
        # around 15 px tall. The detector wants roughly 30, so magnify - this is
        # the one place enlargement helps, because it feeds a network trained at
        # a scale, not because it adds information.
        return reader.readtext(array, allowlist='0123456789', canvas_size=4096, mag_ratio=3.0,
                               text_threshold=0.4, low_text=0.2, link_threshold=0.2, **kw)

    out_bands = []
    t0 = time.time()
    for i, band in enumerate(manifest['bands'], 1):
        readings = []
        for tile in band['tiles']:
            path = os.path.join(args.bands, tile['file'])
            try:
                image = Image.open(path).convert('RGB')
            except OSError:
                continue
            plain = np.array(image)
            boosted = np.array(ImageOps.autocontrast(image.convert('L'), cutoff=1).convert('RGB'))
            seen = {}
            for pass_name, array in (('plain', plain), ('autocontrast', boosted)):
                for box, text, confidence in read(array):
                    if confidence < args.min_confidence or not text.isdigit():
                        continue
                    xs = [p[0] for p in box]
                    ys = [p[1] for p in box]
                    # Where the reading sits along the band, in metres.
                    along = tile['startM'] + (sum(xs) / 4) / tile['width'] * tile['lengthM']
                    key = (text, round(along, 1))
                    if key in seen and seen[key]['confidence'] >= confidence:
                        continue
                    seen[key] = {
                        'text': text,
                        'confidence': round(float(confidence), 3),
                        'alongM': round(float(along), 2),
                        'heightPx': round(float(max(ys) - min(ys)), 1),
                        'heightM': round(float(max(ys) - min(ys)) / tile['pixelsPerMetre'], 3),
                        'tile': tile['file'],
                        'pass': pass_name,
                    }
            readings.extend(seen.values())
        readings.sort(key=lambda r: -r['confidence'])
        out_bands.append({'pandId': band['pandId'], 'panoramaId': band['panoramaId'], 'readings': readings})
        print(f'\r  {i}/{len(manifest["bands"])} bands, {sum(len(b["readings"]) for b in out_bands)} readings',
              end='', file=sys.stderr, flush=True)
    print(file=sys.stderr)

    with open(manifest_path, 'rb') as fh:
        manifest_hash = hashlib.sha256(fh.read()).hexdigest()[:16]
    with open(args.out, 'w') as fh:
        json.dump({
            'metadata': {
                'generator': 'scripts/facade-twin/vision/read_numbers.py',
                'engine': f'easyocr {getattr(__import__("easyocr"), "__version__", "?")}',
                'licence': 'Apache-2.0',
                'manifestSha256': manifest_hash,
                'minConfidence': args.min_confidence,
                'seconds': round(time.time() - t0, 1),
                'note': 'The recogniser was not told what number to expect. Every digit reading is '
                        'kept, including ones belonging to a neighbour: those are the measurement.',
            },
            'bands': out_bands,
        }, fh, indent=1)
    print(f'{sum(len(b["readings"]) for b in out_bands)} readings from {len(out_bands)} bands '
          f'in {time.time() - t0:.0f}s → {args.out}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
