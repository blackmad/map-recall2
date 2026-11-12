"""Batch 3 readings: Geldersekade 57-132, the Nieuwmarkt end of the quay (both sides, a contiguous run by ride priority:
the quay riders take from the Waag to the IJ). Crops from house:crops (AE01, AE03, AF02, AF05; street wall). The wall
colour is filled from the preview's crop reading by fill-colours.py (2025-01-08 low sun: wallcast.cast; otherwise a 10 %
lightness lift for the overcast/across-the-canal captures), so `palette.brick` here is only the first-pass estimate."""
import json, os
here = os.path.dirname(os.path.abspath(__file__))
P = os.path.join(here, 'readings.json')
R = json.load(open(P))
W = '#e6e2d8'; CREAM = '#e4dcc4'
D = json.load(open(os.path.join(here, 'b3-dates.json')))   # pand -> crop missionDate
def house(n, p, fronts, roof, palette, why, limits=(), addr=None):
    p = '0363100012' + p
    for f in fronts: f.setdefault('windowShare', 0.62); f.setdefault('windowHeights', 'diminishing')
    R[p] = {'address': addr or f'Geldersekade {n}', 'photo': f"pand-crops/{p}/front.jpg ({D[p]})", 'date': D[p], 'batch': 3,
            'design': {'fronts': fronts, 'roof': roof, 'palette': palette}, 'why': why, 'limits': list(limits)}
def hold(n, p, why): R.setdefault('_held', {})['0363100012' + p] = {'address': f'Geldersekade {n}', 'why': why, 'batch': 3}
F = lambda **k: {'id': 'front0', 'street': 'Geldersekade', 'basement': 'none', 'hoist': False, **k}
pal = lambda brick, **k: {'brick': brick, 'frame': 'white', 'door': '#2c3a33', 'stone': W, 'wallMaterial': 'brick', **k}
bag = {'material': 'black-tile'}
seg = {'kind': 'segmental', 'archRing': {'colour': 'wall', 'style': 'solid'}}
segK = {'kind': 'segmental', 'archRing': {'colour': 'stone', 'style': 'none', 'keystone': True}}
rel = {'kind': 'relieving', 'archRing': {'colour': 'wall', 'style': 'solid'}}

# ---- even side, Geldersekade 60-132 (west quay, AE01 / AE03) ----
house(60, '165690', [F(gable='cornice', cornice='bracketed', storeys=4, bays=6, doorBay=2, tallGround=False, windows='casement-toplight',
      dormers=2, dormerStyle='pediment', storeyHeights=[1.1, 1.0, 1.0, 1.0])], bag, pal('#6a3426'),
      {'fronts/0/gable': 'deep overhanging eaves on brackets over a flat brick front (c. 1920)', 'fronts/0/bays': 'six lights a storey in two groups of three',
       'fronts/0/dormers': 'two dormers with white pediment heads in the roof', 'fronts/0/windows': 'white casements with a toplight'},
      [{'component': 'ground storey', 'what': 'two dark timber double doors with toplights at either end and a single door in the middle'}], addr='Geldersekade 60-62')
house(64, '182371', [F(gable='cornice', cornice='simple', storeys=4, bays=2, doorBay=0, tallGround=True, windows='casement-toplight',
      windowHead=segK, bands='painted', bandLines=['sill'],
      shopfront={'colour': '#2b2b2b', 'fascia': False, 'glazing': 'transom', 'entrance': 'left', 'stallriser': 'low', 'displayWindows': 1,
                 'evidence': 'dark timber pui with a wide window and a transom row, 2021-01-25'})], bag, pal('#4a3a30'),
      {'fronts/0/windowHead': 'segmental heads with a white keystone block over each window', 'fronts/0/bands': 'white sill band over the ground storey'})
house(66, '182372', [F(gable='cornice', cornice='simple', storeys=4, bays=2, doorBay=1, tallGround=True, windows='casement-toplight',
      balconies={'storeys': [1], 'bays': [0]},
      shopfront={'colour': '#8a1f1f', 'fascia': True, 'entrance': 'right', 'stallriser': 'low', 'displayWindows': 1,
                 'evidence': 'red painted pui with red curtains and a red door, 2023-03-27'})], bag,
      pal('#e8e4da', wallMaterial='painted-brick', frame='#9a2a22'),
      {'fronts/0/windows': 'red-framed windows in a white painted front', 'fronts/0/balconies': 'a small white balcony on the first storey left',
       'palette/wallMaterial': 'white painted front'})
house(68, '182370', [F(gable='cornice', cornice='simple', storeys=4, bays=2, doorBay=1, tallGround=True, windows='casement-toplight',
      shopfront={'colour': W, 'fascia': False, 'glazing': 'transom', 'entrance': 'right', 'stallriser': 'low', 'displayWindows': 1,
                 'evidence': 'white timber pui with a tall window, 2023-03-27'})], bag, pal('#5a4436'),
      {'fronts/0/bays': 'two wide windows a storey (narrow strip crop: low confidence)'})
hold(70, '182369', 'strip crop (2017-07-06) narrow, foliage and a van over the lower storeys: no reading')
hold(72, '182365', 'strip crop (2017-07-06) narrow and washed out, a van over the ground storey: no reading')
house(74, '182364', [F(gable='cornice', cornice='simple', storeys=5, bays=2, doorBay=0, tallGround=True, windows='casement-toplight',
      shopfront={'colour': W, 'fascia': False, 'glazing': 'transom', 'entrance': 'left', 'stallriser': 'low', 'displayWindows': 1,
                 'evidence': 'white timber pui with a gridded window, 2021-01-25'})], bag, pal('#4a3b33'),
      {'fronts/0/storeys': 'five window rows over the quay (narrow strip crop: low confidence)'})
house(78, '182379', [F(gable='cornice', cornice='simple', storeys=5, bays=3, doorBay=2, tallGround=True, windows='casement-toplight',
      shopfront={'colour': W, 'fascia': False, 'glazing': 'transom', 'entrance': 'right', 'stallriser': 'low', 'displayWindows': 2,
                 'evidence': 'white pui with a lamp bracket, 2021-01-25'})], bag, pal('#5a4436'),
      {'fronts/0/bays': 'three axes, the middle window wider', 'fronts/0/storeys': 'ground and four window storeys'},
      [{'component': 'window', 'what': 'the middle axis windows are wider than the outer ones'}])
house(80, '182375', [F(gable='cornice', cornice='heavy', storeys=3, bays=4, doorBay=2, tallGround=False, windows='sash-small-panes',
      storeyHeights=[1.0, 1.0, 1.0])], bag, pal('#3f3530', cornice=W),
      {'fronts/0/gable': 'white entablature with an attic balustrade (18th-c. front)', 'fronts/0/windows': 'tall small-pane sashes, four axes',
       'fronts/0/storeys': 'raised ground storey and two upper storeys'},
      [{'component': 'crown', 'what': 'the white attic balustrade with balusters over the cornice'},
       {'component': 'door', 'what': 'a carved white door surround in the second axis'}])
house(90, '170938', [F(gable='cornice', cornice='simple', storeys=5, bays=6, doorBay=2, tallGround=False, windows='casement-toplight',
      windowHead=rel, stoop={'flights': 'double'} if False else None)], bag, pal('#4c3a32'),
      {'fronts/0/bays': 'six axes across the double front', 'fronts/0/windowHead': 'brick relieving arches over every window'},
      [{'component': 'stoop', 'what': 'a stone stoop with iron rails to the raised door, and a round-arched door in the right half'}])
R['0363100012170938']['design']['fronts'][0].pop('stoop')
house(94, '171324', [F(gable='cornice', cornice='simple', storeys=6, bays=2, doorBay=1, tallGround=True, windows='casement-toplight',
      windowHead=rel, shopfront={'colour': '#2b2b2b', 'fascia': False, 'glazing': 'transom', 'entrance': 'right', 'stallriser': 'low', 'displayWindows': 1,
                 'evidence': 'dark gallery window and a black door up two steps, 2023-03-20'})], bag, pal('#4a3e38'),
      {'fronts/0/windowHead': 'brick relieving arches with stone blocks over the windows', 'fronts/0/storeys': 'tall narrow front of six storeys'})
house(98, '182472', [F(gable='cornice', cornice='bracketed', storeys=5, bays=3, doorBay=0, tallGround=True, windows='casement-toplight',
      windowHead=segK, dormers=1, dormerStyle='pediment', archedStoreys=[0])], bag, pal('#7a4a3a', cornice=CREAM),
      {'fronts/0/gable': 'cream bracketed cornice with a dormer', 'fronts/0/windowHead': 'segmental heads with white keystones',
       'fronts/0/archedStoreys': 'round-arched ground-storey windows'})
house(104, '182304', [F(gable='cornice', cornice='bracketed', storeys=5, bays=3, doorBay=0, tallGround=True, windows='casement-toplight',
      dormers=1, dormerStyle='pediment', shopfront={'colour': '#2b2b2b', 'fascia': True, 'entrance': 'left', 'stallriser': 'low', 'displayWindows': 2,
                 'evidence': 'shop with a yellow fascia sign, 2021-01-25'})], bag, pal('#7a3a2c', cornice=CREAM),
      {'fronts/0/gable': 'cream cornice and a dormer', 'palette/brick': 'red brick'},
      [{'component': 'shopfront sign', 'what': 'the yellow sign board over the shop (signs leave open edges in install)'}])
house(108, '182400', [F(gable='cornice', cornice='simple', storeys=5, bays=2, doorBay=1, tallGround=True, windows='casement-toplight',
      shopfront={'colour': W, 'fascia': False, 'glazing': 'transom', 'entrance': 'right', 'stallriser': 'low', 'displayWindows': 1,
                 'evidence': 'white pui, 2021-01-25'})], bag, pal('#4a3a32'), {'fronts/0/bays': 'two white-framed windows a storey'})
house(110, '182399', [F(gable='neck', cornice='none', storeys=3, bays=3, doorBay=1, tallGround=True, windows='casement-toplight', atticWindows=1,
      shopfront={'colour': '#3a3a36', 'fascia': False, 'glazing': 'transom', 'entrance': 'centre', 'stallriser': 'low', 'displayWindows': 2,
                 'evidence': 'dark pui, 2021-01-25'})], {'material': 'black-tile', 'source': 'front', 'evidence': 'neck gable'},
      pal('#2f2a28', wallMaterial='painted-brick', stone=W),
      {'fronts/0/gable': 'neck gable with white trim, painted dark', 'fronts/0/atticWindows': 'a triple light in the neck'},
      [{'component': 'gable light', 'what': 'the neck holds a wide three-part window'}])
house(112, '182309', [F(gable='cornice', cornice='simple', storeys=4, bays=2, doorBay=1, tallGround=True, windows='casement-toplight',
      shopfront={'colour': '#2b2b2b', 'fascia': False, 'glazing': 'transom', 'entrance': 'right', 'stallriser': 'low', 'displayWindows': 1,
                 'evidence': 'dark gridded pui, 2021-01-25'})], bag, pal('#e6e2da', wallMaterial='painted-brick'),
      {'palette/wallMaterial': 'white painted front', 'fronts/0/bays': 'two windows a storey, a four-light window at the top'})
house(114, '182308', [F(gable='bell', cornice='none', storeys=3, bays=3, doorBay=1, tallGround=True, windows='cross', atticWindows=1,
      shopfront={'colour': '#2b2b2b', 'fascia': False, 'glazing': 'transom', 'entrance': 'centre', 'stallriser': 'low', 'displayWindows': 2,
                 'evidence': 'dark pui, 2021-01-25'})], {'material': 'black-tile', 'source': 'front', 'evidence': 'bell gable'},
      pal('#7a2a22', wallMaterial='painted-brick'),
      {'fronts/0/gable': 'bell gable over a front painted ox-blood red', 'fronts/0/windows': 'cross windows in white frames'},
      [{'component': 'gevelsteen', 'what': 'a carved stone tablet between the first-storey windows'}])
house(118, '170933', [F(gable='cornice', cornice='simple', storeys=4, bays=2, doorBay=1, tallGround=True, windows='casement-toplight',
      bayWindows={'bays': {'from': 0, 'to': 1}, 'storeys': [1, 2], 'cap': 'flat'},
      shopfront={'colour': W, 'fascia': False, 'glazing': 'transom', 'entrance': 'centre', 'stallriser': 'low', 'displayWindows': 2,
                 'evidence': 'white pui, 2021-01-25'})], bag, pal('#4a3b33'),
      {'fronts/0/bayWindows': 'a three-sided brick bay over the first and second storeys'})
house(120, '170932', [F(gable='cornice', cornice='simple', storeys=4, bays=2, doorBay=1, tallGround=True, windows='casement-toplight',
      shopfront={'colour': W, 'fascia': True, 'entrance': 'centre', 'stallriser': 'low', 'displayWindows': 2,
                 'evidence': 'white snack-bar front with red lettering (Grill House), 2021-01-25'})], bag, pal('#43362f'),
      {'fronts/0/bays': 'two windows a storey, white frames'},
      [{'component': 'shopfront', 'what': 'diamond-pattern stallriser panels and the red lettering'}])
hold(126, '172008', 'crop 43 deg oblique behind a tree and vans (2022-04-26): neither the gable nor the storey count can be read')
house(132, '171858', [F(gable='cornice', cornice='bracketed', storeys=5, bays=2, doorBay=0, tallGround=True, windows='casement-toplight',
      bands='painted', bandLines=['sill', 'head'],
      shopfront={'colour': '#2b2b2b', 'fascia': True, 'entrance': 'left', 'stallriser': 'low', 'displayWindows': 2,
                 'evidence': 'cafe Zon with a dark front, 2016-06-09'})], bag, pal('#e2ddd0', wallMaterial='stucco', frame=W),
      {'palette/wallMaterial': 'white stucco front with moulded window surrounds (c. 1890)', 'fronts/0/bands': 'moulded string courses'},
      [{'component': 'window surround', 'what': 'pedimented stucco surrounds and pilasters round the windows'}], addr='Geldersekade 132 / Nieuwmarkt 2')

# ---- odd side, Geldersekade 57-123 (east quay, AF02 / AF05) ----
house(57, '171919', [F(gable='cornice', cornice='frieze', storeys=4, bays=3, doorBay=0, tallGround=True, windows='cross', atticWindows=3,
      shopfront={'colour': W, 'fascia': False, 'glazing': 'transom', 'entrance': 'left', 'stallriser': 'medium', 'displayWindows': 2,
                 'evidence': 'white ground storey with an oak door up two steps, 2025-01-08'})], bag, pal('#3a302c', cornice=W),
      {'fronts/0/gable': 'white frieze cornice with three oval attic lights', 'fronts/0/windows': 'tall cross windows in white frames'},
      [{'component': 'frieze', 'what': 'the three oculi in the frieze are oval with white surrounds'}])
house(59, '171921', [F(gable='cornice', cornice='bracketed', storeys=4, bays=2, doorBay=1, tallGround=True, windows='casement-toplight',
      windowHead=segK, dormers=1, dormerStyle='pediment',
      shopfront={'colour': W, 'fascia': False, 'glazing': 'transom', 'entrance': 'right', 'stallriser': 'medium', 'displayWindows': 1,
                 'evidence': 'white pui, 2025-01-08'})], bag, pal('#3e3029', cornice=W),
      {'fronts/0/gable': 'white bracketed cornice and a carved dormer', 'fronts/0/windowHead': 'segmental heads with white keystones'})
house(61, '171915', [F(gable='cornice', cornice='simple', storeys=5, bays=3, doorBay=0, tallGround=False, windows='casement-toplight')],
      bag, pal('#4a3438'),
      {'fronts/0/storeys': 'raised ground storey over a basement, four upper storeys', 'palette/brick': 'plum-brown brick'},
      [{'component': 'door', 'what': 'a round-arched door with a fanlight at the left, up a stone stoop'}])
house(65, '182248', [F(gable='neck', cornice='none', storeys=4, bays=3, doorBay=0, tallGround=True, windows='casement-toplight', atticWindows=1,
      crownCap='pediment')], {'material': 'black-tile', 'source': 'front', 'evidence': 'neck gable'}, pal('#45403c', stone=W),
      {'fronts/0/gable': 'neck gable with carved white claw pieces', 'fronts/0/crownCap': 'pediment over the neck'},
      [{'component': 'gable', 'what': 'two oval oculi with white frames in the gable shoulders and carved claw pieces'}])
hold(67, '181773', 'a late-20th-century office block (ribbon windows, flat roof, yellow brick plinth): not a canal-house front; the kit has no ribbon-glazed office front')
hold(75, '182249', 'a modern glazed office (curtain wall); crop blocked and 51 deg oblique')
house(85, '171696', [F(gable='point', cornice='none', storeys=3, bays=3, doorBay=0, tallGround=True, windows='casement-gridded-toplight', atticWindows=1,
      shopfront={'colour': W, 'fascia': False, 'glazing': 'transom', 'entrance': 'left', 'stallriser': 'medium', 'displayWindows': 2,
                 'evidence': 'white gridded warehouse ground storey with a black door, 2025-01-08'})],
      {'material': 'black-tile', 'source': 'front', 'evidence': 'point gable'}, pal('#3c3a3a', stone=W),
      {'fronts/0/gable': 'plain point (warehouse) gable with white verges', 'fronts/0/windows': 'wide gridded windows over the two upper storeys',
       'fronts/0/atticWindows': 'one small hoist hatch in the gable'})
house(89, '171491', [F(gable='bell', cornice='none', storeys=4, bays=3, doorBay=0, tallGround=True, windows='casement-toplight', atticWindows=1,
      shopfront={'colour': '#b02020', 'fascia': False, 'glazing': 'transom', 'entrance': 'left', 'stallriser': 'low', 'displayWindows': 1,
                 'evidence': 'red pui and door, 2022-04-26'})], {'material': 'black-tile', 'source': 'front', 'evidence': 'bell gable'},
      pal('#3e2a26', frame='#a8281e'),
      {'fronts/0/gable': 'tall bell gable with a white cap', 'fronts/0/windows': 'red-framed windows', 'palette/frame': 'red frames'})
house(91, '171761', [F(gable='cornice', cornice='bracketed', storeys=5, bays=3, doorBay=1, tallGround=True, windows='casement-toplight',
      dormers=1, dormerStyle='pediment', bands='painted', bandLines=['sill'],
      shopfront={'colour': '#2b2b2b', 'fascia': True, 'entrance': 'centre', 'stallriser': 'low', 'displayWindows': 2,
                 'evidence': 'bike-rental shop with a gold sign, 2025-01-08'})], bag, pal('#ddd6c4', wallMaterial='stucco', frame=W),
      {'palette/wallMaterial': 'cream stucco front with a moulded frieze', 'fronts/0/gable': 'cornice and a dormer with a pediment'})
house(93, '171697', [F(gable='cornice', cornice='simple', storeys=4, bays=5, doorBay=4, tallGround=True, windows='casement-toplight',
      shopfront={'colour': '#7a1c1c', 'fascia': True, 'entrance': 'right', 'stallriser': 'low', 'displayWindows': 3,
                 'evidence': 'restaurant with a red awning, 2022-04-26'})], bag, pal('#7a4a3a'),
      {'fronts/0/bays': 'five white-framed windows a storey (distant crop, 22 deg)'})
hold(95, '171490', 'crop 50 deg oblique and half blocked by the nearer corner building: the front cannot be read')
house(107, '182473', [F(gable='cornice', cornice='none', storeys=4, bays=3, doorBay=1, tallGround=True, windows='sash-small-panes')],
      {'material': 'red-tile'}, pal('#9a7a50', frame=W),
      {'fronts/0/gable': 'plain eaves under a red pantile roof', 'palette/brick': 'yellow-brown brick', 'roof/material': 'red pantiles'})
house(109, '182401', [F(gable='cornice', cornice='simple', storeys=5, bays=4, doorBay=3, tallGround=True, windows='casement-toplight',
      bands='speklagen', speklagen={'spacing': 10, 'courses': 1},
      shopfront={'colour': W, 'fascia': False, 'glazing': 'transom', 'entrance': 'right', 'stallriser': 'medium', 'displayWindows': 2,
                 'evidence': 'white shop window at the right, 2020-04-21'})], bag, pal('#6a3a2e'),
      {'fronts/0/bands': 'light stone bands across the brick (c. 1880)', 'fronts/0/bays': 'four axes'})
house(111, '182403', [F(gable='cornice', cornice='bracketed', storeys=5, bays=3, doorBay=0, tallGround=True, windows='casement-toplight',
      windowHead=segK, bands='painted', bandLines=['sill', 'head'], dormers=1, dormerStyle='pediment',
      shopfront={'colour': '#2b2b2b', 'fascia': True, 'entrance': 'left', 'stallriser': 'low', 'displayWindows': 2,
                 'evidence': 'dark shop with a red sign, 2025-01-08'})], bag, pal('#5a3428', cornice=W),
      {'fronts/0/bands': 'white stone bands at sill and head', 'fronts/0/windowHead': 'segmental heads with white keystones',
       'fronts/0/gable': 'white bracketed cornice with a dormer'})
house(117, '171479', [F(gable='cornice', cornice='simple', storeys=4, bays=3, doorBay=0, tallGround=True, windows='casement-toplight',
      bayWindows={'bay': 1, 'storeys': [1], 'cap': 'flat'}, balconies={'storeys': [2], 'bays': [1]},
      shopfront={'colour': W, 'fascia': True, 'entrance': 'left', 'stallriser': 'low', 'displayWindows': 1,
                 'evidence': 'white restaurant front with red Chinese lettering, 2025-01-08'})], bag, pal('#6a3e30'),
      {'fronts/0/bayWindows': 'a white timber bay on the first storey, middle axis', 'fronts/0/balconies': 'a white balcony on top of it'},
      [{'component': 'crown', 'what': 'a round-arched balcony door in the parapet over the middle axis'}])
hold(123, '181807', 'crop blocked by a traffic-light gantry and sign (2022-04-26): the front cannot be read')
json.dump(R, open(P, 'w'), indent=1, ensure_ascii=False)
print('row 3', sum(1 for k, v in R.items() if isinstance(v, dict) and v.get("batch") == 3 and "design" in v), 'held', sum(1 for v in R.get('_held', {}).values() if v.get('batch') == 3))
# ---- pass 2: wall colours from the crop reading (fill-colours.py) ----
CP = os.path.join(here, 'b3-colours.json')
if os.path.exists(CP):
    for p, c in json.load(open(CP)).items():
        if p in R and 'design' in R[p]:
            R[p]['design']['palette']['brick'] = c['brick']
            R[p]['why']['palette/brick'] = (R[p]['why'].get('palette/brick', '') + f"; crop reading {c['read']}, {c['rule']}").lstrip('; ')
    json.dump(R, open(P, 'w'), indent=1, ensure_ascii=False)
# ---- pass 3: install gates (gate-check rehearsal, install.ts --dry) ----
def fr(p): return R['0363100012' + p]['design']['fronts'][0]
def lim(p, c, w): R['0363100012' + p]['limits'].append({'component': c, 'what': w})
# storey-height: the 3DBAG eaves leave the upper storeys under 2.3 m at the counted storeys; one storey fewer, uniform uppers
for p, n in {'170933': 3, '171915': 3, '171919': 3, '182309': 3, '182364': 3, '182370': 3, '182379': 4, '182399': 2}.items():
    f = fr(p)
    if f['storeys'] != n:
        lim(p, 'storeys', f"{f['storeys']} storeys read on the crop; {n} fit the 3DBAG eaves at >= 2.3 m a storey (crop read across the canal, top storey unsure)")
        f['storeys'] = n; R['0363100012' + p]['why']['fronts/0/storeys'] = f'{n} storeys under the 3DBAG eaves'
for p in ('171761', '182372'):
    f = fr(p); f['storeyHeights'] = [1.3] + [1.0] * (f['storeys'] - 1); f.pop('windowHeights', None)
    R['0363100012' + p]['why']['fronts/0/storeyHeights'] = 'uniform upper storeys under the 3DBAG eaves'
# open-edges: a pediment dormer over a cornice front leaves 3.8 m of open edge a dormer in install (kit bug, reported)
for p in ('165690', '171761', '171921', '182304', '182403', '182472'):
    f = fr(p); k = f.pop('dormers', None); f.pop('dormerStyle', None); R['0363100012' + p]['why'].pop('fronts/0/dormers', None)
    if k: lim(p, 'dormer', f'{k} dormer(s) with a pediment head over the cornice: dropped, a pediment dormer leaves 3.8 m of open edge in the install gate')
# triangle budget
f = fr('170938'); f.pop('windowHead', None); R['0363100012170938']['why'].pop('fronts/0/windowHead', None)
lim('170938', 'window head', 'brick relieving arches over the windows (dropped: 3049 triangles > 3000 with them)')
# 182472: windowHead and archedStoreys cannot go together
fr('182472').pop('archedStoreys', None); R['0363100012182472']['why'].pop('fronts/0/archedStoreys', None)
lim('182472', 'window', 'round-arched ground-storey windows (windowHead and archedStoreys cannot be combined on one front)')
json.dump(R, open(P, 'w'), indent=1, ensure_ascii=False)
# ---- pass 4: the last storey-height misses ----
f = fr('171919'); f['storeyHeights'] = [1.3, 1.0, 1.0]; f.pop('windowHeights', None)
f = fr('182472'); lim('182472', 'storeys', '5 storeys read on the crop; 4 fit the 3DBAG eaves (9.7 m) at >= 2.3 m a storey')
f['storeys'] = 4; f['storeyHeights'] = [1.15, 1.0, 1.0, 1.0]; f.pop('windowHeights', None)
R['0363100012182309']['design'].pop('roof')
lim('182309', 'roof', 'recipe route held: the 3DBAG eaves (6.8 m) leave under 2.3 m a storey for the three upper storeys on the crop; staged as a generic spec')
json.dump(R, open(P, 'w'), indent=1, ensure_ascii=False)
