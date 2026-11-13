"""RETIRED 2026-11-12 (integrator ruling, correctness first): it turned the Nieuwmarkt row orange-terracotta against
dark-brown overcast photos. Wall colours now come from wall-vote.ts (leaf-off wallFit vote). Kept for the record only.

The cast correction this lane applies to a house:crops wall reading taken in the 2025-01-08 low winter sun (warm cast):
hue 9 degrees back toward red, saturation x0.88, lightness x0.80 (HSL). Calibrated on Nieuwmarkt 38 (182850), whose
corrected colour #b06a45 passed the preview against the crop (dL -0.09) and matches the overcast 2023-02-20 panorama."""
import colorsys, sys
def cast(hexs):
    r, g, b = (int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5))
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    h = (h - 9 / 360) % 1; s *= 0.88; l *= 0.80
    r, g, b = colorsys.hls_to_rgb(h, l, s)
    return '#%02x%02x%02x' % tuple(round(v * 255) for v in (r, g, b))
if __name__ == '__main__':
    for x in sys.argv[1:]: print(x, cast(x))
