"""Blind A/B sheets for round-2 sculptures (lane sculpture-r2-20261122): photo | A | B, today and the new model on shuffled
sides (seeded RNG), the key in a separate file the judge never sees.

    python3 scripts/sculptures/r2-sheets.py <sheets.json> <out dir> [--seed=20261122]

sheets.json: [{id, kind: statue|relief, photos: [jpg...], today: glb, new: glb, facing: deg, crop: "x0,y0,z0,x1,y1,z1",
              insitu: {eyeY, dist, az} (statue: a ride pose at bike eye height) or {view: pano view json, target: [lng, lat],
              up: m, model: landmark id} (relief: the panorama pose)}]
Each model row: gallery front | gallery 35 deg left | in situ. Panels 400x480 (gallery-card size). Writes <out>/<n>.jpg,
<out>-key.json, beside the sheet dir ({sheet: {A: today|new, B: ...}}) and <out>/sheets.json (what the judge may read: ids only).
Renders in Node (scripts/sculptures/r2-views.ts, scripts/image-to-3d/place-render.ts); no browser.
"""
import json, os, random, subprocess, sys
from PIL import Image, ImageDraw, ImageFont

spec = json.load(open(sys.argv[1])); out = sys.argv[2]
seed = int(next((a.split('=')[1] for a in sys.argv if a.startswith('--seed=')), 20261122))
rng = random.Random(seed)
os.makedirs(f'{out}/panels', exist_ok=True)
PW, PH = 400, 480
try:
    font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 28)
    small = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 16)
except OSError:
    font = small = ImageFont.load_default()

def node(args):
    r = subprocess.run(['node', '--import', 'tsx'] + args, capture_output=True, text=True)
    if r.returncode: raise SystemExit(r.stderr[-1500:])
    return json.loads(r.stdout.strip().split('\n')[-1])

def renders(s, which, dist=None):
    glb, p = s[which], f'{out}/panels/{s["id"]}-{which}'
    a = ['scripts/sculptures/r2-views.ts', f'--glb={glb}', f'--facing={s["facing"]}', f'--crop={s["crop"]}', f'--size={PW}x{PH}', '--az=0,-35', '--pitch=6']
    d = node(a + [f'--out={p}-gallery.png'] + ([f'--dist={dist}'] if dist else []))['dist']
    ins = s['insitu']
    if 'view' in ins:
        v = json.load(open(ins['view']))
        node(['scripts/image-to-3d/place-render.ts', f'--landmark={ins["model"]}', f'--model-glb={glb}', f'--view={ins["view"]}', f'--target={ins["target"][0]},{ins["target"][1]}',
              f'--up={ins["up"]}', f'--box=0,0,{v["size"][0]},{v["size"][1]}', f'--out={p}-insitu.png'])
    else:
        node(['scripts/sculptures/r2-views.ts', f'--glb={glb}', f'--facing={s["facing"]}', f'--crop={s["crop"]}', f'--size={PW}x{PH}', f'--az={ins.get("az", -20)}',
              f'--eye-y={ins.get("eyeY", 1.6)}', f'--dist={ins.get("dist", 12)}', f'--fov={ins.get("fov", 40)}', f'--out={p}-insitu.png'])
    g = Image.open(f'{p}-gallery.png').convert('RGB')
    i = Image.open(f'{p}-insitu.png').convert('RGB')
    i = i.resize((round(i.width * PH / i.height), PH)) if i.height != PH else i
    if i.width > PW * 1.5: i = i.crop(((i.width - round(PW * 1.5)) // 2, 0, (i.width + round(PW * 1.5)) // 2, PH))
    row = Image.new('RGB', (g.width + i.width + 10, PH), 'white'); row.paste(g, (0, 0)); row.paste(i, (g.width + 10, 0))
    return row, d

key, listing = {}, []
for n, s in enumerate(spec, 1):
    sheet = f'{n:02d}'
    today, d = renders(s, 'today')
    new, _ = renders(s, 'new', d)
    a_is_new = rng.random() < 0.5
    rows = [('A', new if a_is_new else today), ('B', today if a_is_new else new)]
    key[sheet] = {'id': s['id'], 'A': 'new' if a_is_new else 'today', 'B': 'today' if a_is_new else 'new', 'newLabel': s.get('label')}
    photos = [Image.open(p).convert('RGB') for p in s['photos']]
    photos = [ph.resize((round(ph.width * PH / ph.height), PH)) for ph in photos]
    W = max(sum(ph.width for ph in photos) + 10 * (len(photos) - 1), max(r.width for _, r in rows)) + 60
    H = 40 + PH + sum(PH + 20 for _ in rows) + 20
    img = Image.new('RGB', (W, H), 'white'); dr = ImageDraw.Draw(img)
    dr.text((10, 8), f'Sheet {sheet}: {s.get("title", s["id"])}. Photo, then A and B (gallery front | 35° | in situ)', fill='black', font=small)
    x = 60
    for ph in photos: img.paste(ph, (x, 40)); x += ph.width + 10
    dr.text((10, 40 + PH // 2), 'Photo', fill='black', font=small)
    y = 40 + PH + 20
    for lab, r in rows:
        dr.text((18, y + PH // 2 - 14), lab, fill='black', font=font); img.paste(r, (60, y)); y += PH + 20
    img.save(f'{out}/{sheet}.jpg', quality=85)
    listing.append({'sheet': sheet, 'title': s.get('title', s['id']), 'what': s.get('what', '')})
    print(sheet, s['id'], flush=True)
json.dump(key, open(f'{out.rstrip("/")}-key.json', 'w'), indent=1)  # outside the sheet dir: the judge reads only the sheet dir
json.dump(listing, open(f'{out}/sheets.json', 'w'), indent=1)
