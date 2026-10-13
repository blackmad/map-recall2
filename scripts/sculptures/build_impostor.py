"""Bake a multi-view sculpture impostor atlas from hand-picked photos.

    uv run --no-project --python 3.12 --with "rembg[cpu]==2.0.67" --with pillow \
      python -I scripts/sculptures/build_impostor.py scripts/sculptures/<id>/impostor-views.json <images dir> <out dir>

impostor-views.json lists one photo per azimuth slot (camera azimuth about
the statue, degrees, 0 = in front of the figure, positive toward the
figure's own left hand) with a rough crop box that contains the figure and
the top of its plinth. For each view:

1. U^2-Net (rembg) cuts the statue out of the crop;
2. the plinth top is the first row below the figure's upper third where the
   mask suddenly widens (a block, not legs), or `plinthTopY` when given;
3. the figure (head to plinth top) is scaled to a fixed height, its feet
   centred, and written to one tile of the atlas;
4. colour photos and 1950s-80s monochrome scans are put on one footing: the
   luminance is histogram-equalised inside the mask and tinted bronze, so the
   views do not flicker between sepia, grey and green as the rider circles.

Output: <out>/<id>-impostor.png (RGBA atlas), <out>/<id>-impostor.json (layout), and
<out>/review/ (per-view mask overlays for inspection).
"""
import json, os, sys
import numpy as np
from PIL import Image, ImageFilter
from rembg import new_session, remove

spec_path, img_dir, out = sys.argv[1:4]
spec = json.load(open(spec_path))
os.makedirs(os.path.join(out, 'review'), exist_ok=True)
TW, TH = spec.get('tilePx', [256, 512])
FIG_FRAC = 0.94  # figure height / tile height; feet at the bottom margin
BOTTOM = 0.985
LO, HI = spec.get('tone', [0.07, 0.62])
TINT = np.array(spec.get('tint', [1.0, 0.92, 0.78]))
sessions = {}
def session_for(name):
    if name not in sessions: sessions[name] = new_session(name)
    return sessions[name]


def largest_component(mask):
    """Keep the 4-connected component with the most pixels (iterative flood fill)."""
    h, w = mask.shape
    labels = np.zeros((h, w), np.int32)
    best, best_n, cur = 0, 0, 0
    for y0, x0 in zip(*np.nonzero(mask)):
        if labels[y0, x0]: continue
        cur += 1
        stack = [(y0, x0)]; labels[y0, x0] = cur; n = 0
        while stack:
            y, x = stack.pop(); n += 1
            for yy, xx in ((y+1, x), (y-1, x), (y, x+1), (y, x-1)):
                if 0 <= yy < h and 0 <= xx < w and mask[yy, xx] and not labels[yy, xx]:
                    labels[yy, xx] = cur; stack.append((yy, xx))
        if n > best_n: best, best_n = cur, n
    return labels == best


def plinth_top(mask):
    """First row (from the top) below the figure's middle where the mask becomes a wide block."""
    rows = mask.sum(1)
    ys = np.nonzero(rows)[0]
    top, bot = ys[0], ys[-1]
    mid = top + (bot - top) // 3
    fig_w = np.median(rows[top + (bot - top) // 6: mid + 1])
    for y in range(mid, bot + 1):
        if rows[y:y + 6].min() > 1.7 * fig_w:
            return y
    return bot


views_out = []
atlas_cols = spec.get('cols', 4)
n = len(spec['views'])
rows_n = (n + atlas_cols - 1) // atlas_cols
atlas = np.zeros((rows_n * TH, atlas_cols * TW, 4), np.uint8)
for i, v in enumerate(spec['views']):
    im = Image.open(os.path.join(img_dir, v['photo'])).convert('RGB')
    x0, y0, x1, y1 = v['box']
    crop = im.crop((x0, y0, x1, y1))
    a = np.array(remove(crop, session=session_for(v.get('model', spec.get('model', 'u2net'))), only_mask=True, post_process_mask=True), dtype=np.float32) / 255.0
    m = largest_component(a > 0.5)
    py = v.get('plinthTopY')
    py = (py - y0) if py is not None else plinth_top(m)
    m[py:, :] = False
    a = a * m
    ys, xs = np.nonzero(m)
    top = ys.min(); feet = py
    fig_h = feet - top
    # Feet centre: the mask's mean column over the lowest 8% of the figure.
    low = m[feet - max(3, int(0.08 * fig_h)):feet]
    cx = np.nonzero(low)[1].mean() if low.any() else xs.mean()
    if 'centreX' in v: cx = v['centreX'] - x0
    s = (FIG_FRAC * TH) / fig_h
    # Luminance, percentile-matched inside the mask, tinted bronze.
    rgb = np.array(crop, dtype=np.float32) / 255.0
    L = rgb @ np.array([0.2126, 0.7152, 0.0722])
    # Rank-based (histogram-equalised) tone inside the mask: every view gets
    # the same luminance distribution whatever film, print or sensor it came
    # from; `gamma` darkens it towards patinated bronze.
    inside = np.sort(L[m])
    rank = np.searchsorted(inside, L) / max(1, len(inside) - 1)
    Ln = LO + (HI - LO) * np.clip(rank, 0, 1) ** spec.get('gamma', 1.3)
    out_rgb = np.clip(Ln[..., None] * TINT[None, None, :], 0, 1)
    rgba = np.dstack([out_rgb * 255, a * 255]).astype(np.uint8)
    tile_img = Image.fromarray(rgba, 'RGBA')
    nw, nh = max(1, int(round(crop.width * s))), max(1, int(round(crop.height * s)))
    tile_img = tile_img.resize((nw, nh), Image.LANCZOS)
    # Place: feet row at BOTTOM*TH, feet centre at TW/2.
    ox = int(round(TW / 2 - cx * s)); oy = int(round(BOTTOM * TH - feet * s))
    tile = Image.new('RGBA', (TW, TH), (0, 0, 0, 0))
    tile.paste(tile_img, (ox, oy), tile_img)
    t = np.array(tile)
    # Premultiply-friendly edge: bleed colour into transparent texels so mip/linear filtering does not halo.
    alpha = t[..., 3:4].astype(np.float32) / 255.0
    blur = np.array(tile.filter(ImageFilter.GaussianBlur(3))).astype(np.float32)
    bw = blur[..., 3:4] / 255.0
    fill = np.where(bw > 1e-3, blur[..., :3] / np.maximum(bw, 1e-3), t[..., :3])
    t[..., :3] = np.where(alpha > 0.02, t[..., :3], np.clip(fill, 0, 255)).astype(np.uint8)
    r, c = divmod(i, atlas_cols)
    atlas[r * TH:(r + 1) * TH, c * TW:(c + 1) * TW] = t
    widest = (m.sum(1).max()) * s / (FIG_FRAC * TH)
    views_out.append(dict(azimuthDeg=v['azimuthDeg'], tile=i, photo=v['photo'], figurePx=int(fig_h), widthOverHeight=round(float(widest), 3)))
    # Review overlay: mask in red over the crop, plinth line in yellow.
    rev = np.array(crop).copy()
    rev[m] = (0.5 * rev[m] + [127, 0, 0]).astype(np.uint8)
    rev[max(0, py - 1):py + 1, :] = [255, 220, 0]
    Image.fromarray(rev).save(os.path.join(out, 'review', f"{i:02d}-{v['azimuthDeg']}-{os.path.splitext(v['photo'])[0]}.jpg"))
    print(v['photo'], 'az', v['azimuthDeg'], 'figure px', fig_h, 'scale', round(s, 3), flush=True)

name = spec['id']
Image.fromarray(atlas, 'RGBA').save(os.path.join(out, f'{name}-impostor.png'), optimize=True)
meta = dict(version=1, id=name, cols=atlas_cols, rows=rows_n, tilePx=[TW, TH], figureHeightM=spec['figureHeightM'],
            tileHeightM=round(spec['figureHeightM'] / FIG_FRAC, 4), tileWidthM=round(spec['figureHeightM'] / FIG_FRAC * TW / TH, 4),
            feetFromBottom=round(1 - BOTTOM, 4), views=sorted(views_out, key=lambda x: x['azimuthDeg']))
json.dump(meta, open(os.path.join(out, f'{name}-impostor.json'), 'w'), indent=1)
print('atlas', atlas.shape)
