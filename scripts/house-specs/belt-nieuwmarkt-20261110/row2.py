"""Batch 2 readings: the east side of the Nieuwmarkt (odd numbers, fronts facing bearing 286-293) and 4A on the north side.
Overcast or spring captures (2020-04-21, 2021-03-08, 2022-04-26), so the preview's photo wall reading is taken with a
10 % lightness lift only (lift()), not the low-sun cast correction of batch 1."""
import json, os, colorsys
here = os.path.dirname(os.path.abspath(__file__))
P = os.path.join(here, 'readings.json')
R = json.load(open(P))
def lift(hexs, k=1.1):
    r, g, b = (int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)); h, l, s = colorsys.rgb_to_hls(r, g, b)
    r, g, b = colorsys.hls_to_rgb(h, min(1, l * k), s); return '#%02x%02x%02x' % tuple(round(v * 255) for v in (r, g, b))
W = '#e6e2d8'; CREAM = '#e4dcc4'
def crop(p, d): return f"pand-crops/{p}/front.jpg ({d})"
def house(p, addr, date, fronts, roof, palette, why, limits=()):
    for f in fronts: f.setdefault('windowShare', 0.62); f.setdefault('windowHeights', 'diminishing')
    R[p] = {'address': addr, 'photo': crop(p, date), 'date': date, 'design': {'fronts': fronts, 'roof': roof, 'palette': palette}, 'why': why, 'limits': list(limits)}
F = lambda **k: {'id': 'front0', 'street': 'Nieuwmarkt', **k}
pal = lambda brick, **k: {'brick': brick, 'frame': 'white', 'door': '#2c3a33', 'stone': W, 'wallMaterial': 'brick', **k}
bag = {'material': 'black-tile'}
tile = {'material': 'black-tile', 'source': 'front', 'evidence': 'gable front: the roof follows the crown (house:crops crop)'}

house('0363100012182299', 'Nieuwmarkt 1', '2020-04-21', [F(
    gable='cornice', cornice='simple', storeys=5, bays=[2, 2, 2, 2, 3], doorBay=0, tallGround=True, basement='none', hoist=False,
    windows='casement-toplight', archedStoreys=[2], bands='painted', bandLines=['sill', 'head'],
    balconies={'storeys': [1, 2], 'bays': [0, 1]},
    shopfront={'colour': '#2a2a2a', 'fascia': True, 'entrance': 'left', 'stallriser': 'low', 'sign': {'text': 'SPAR', 'textColour': '#d8262e'},
               'evidence': 'dark supermarket front with a red sign (Spar), 2020-04-21'})],
    bag, pal(lift('#5a4136')),
    {'fronts/0/gable': 'flat brick parapet with a simple cornice between brick corner piers (c. 1890 front)',
     'fronts/0/storeys': 'shop storey and four window storeys', 'fronts/0/bays': 'two axes, three small lights on the top storey',
     'fronts/0/bands': 'white painted bands at the sill and head lines', 'fronts/0/archedStoreys': 'round-headed windows on the second storey',
     'fronts/0/balconies': 'iron balconies across the first- and second-storey windows', 'palette/brick': 'dark red-brown brick (estimated: the crop reading did not match the preview wall)'},
    [{'component': 'window head', 'what': 'white stone tympana over the round-headed second-storey windows'}])

house('0363100012182296', 'Nieuwmarkt 3', '2022-04-26', [F(
    gable='cornice', cornice='simple', storeys=4, bays=3, doorBay=1, tallGround=True, basement='none', hoist=False,
    windows='casement-toplight', windowHead={'kind': 'segmental', 'archRing': {'colour': 'stone', 'style': 'none', 'keystone': True}},
    shopfront={'colour': '#3a3a36', 'fascia': True, 'entrance': 'centre', 'stallriser': 'low', 'evidence': 'cafe front with a red awning rail, 2022-04-26'})],
    {'material': 'black-tile'}, pal(lift('#534c44'), cornice=W),
    {'fronts/0/gable': 'white cornice over a plain brick front', 'fronts/0/windowHead': 'segmental heads with a white keystone over every window',
     'palette/brick': 'dark brown brick, overcast crop reading #534c44 lifted 10 %'})

house('0363100012181817', 'Nieuwmarkt 7', '2021-03-08', [F(
    gable='cornice', cornice='simple', storeys=4, bays=3, doorBay=2, tallGround=True, basement='none', hoist=False,
    windows='cross', storeyHeights=[1.8, 1.0, 1.0, 0.95],
    shopfront={'colour': '#1e1e1e', 'fascia': False, 'glazing': 'transom', 'entrance': 'right', 'stallriser': 'none', 'displayWindows': 2,
               'evidence': 'black lower front (ATMs) under a white-framed entresol of four lights, door at the right, 2021-03-08'})],
    bag, pal(lift('#685246')),
    {'fronts/0/gable': 'plain brick parapet with a thin cornice', 'fronts/0/windows': 'cross windows, dark sashes in white frames',
     'fronts/0/storeyHeights': 'ground storey with its entresol about 5 m', 'palette/brick': 'dark brown brick, crop reading #685246 lifted 10 %'},
    [{'component': 'ground storey', 'what': 'the entresol row of four white-framed lights over the shop; iron wall anchors on every floor line'}])

house('0363100012182303', 'Nieuwmarkt 9', '2022-04-26', [F(
    gable='cornice', cornice='simple', storeys=4, bays=3, doorBay=0, tallGround=True, basement='none', hoist=False,
    windows='cross', storeyHeights=[1.6, 1.0, 1.0, 0.9],
    shopfront={'colour': W, 'fascia': False, 'glazing': 'transom', 'entrance': 'left', 'stallriser': 'low', 'displayWindows': 2,
               'evidence': 'white timber pui with an entresol of lights (glare on the crop), 2022-04-26'})],
    bag, pal(lift('#5b524e'), cornice=W),
    {'fronts/0/gable': 'white cornice (sun glare over the crown on the crop)', 'palette/brick': 'dark brown brick, crop reading #5b524e lifted 10 %'})

house('0363100012181818', 'Nieuwmarkt 11', '2020-04-21', [F(
    gable='cornice', cornice='frieze', storeys=4, bays=3, doorBay=1, tallGround=True, basement='none', hoist=True, dormers=1, dormerStyle='pediment',
    windows='cross', windowHead={'kind': 'relieving', 'archRing': {'colour': 'wall', 'style': 'solid'}},
    shopfront={'colour': '#7a1c1c', 'fascia': True, 'entrance': 'centre', 'stallriser': 'medium', 'displayWindows': 2,
               'sign': {'text': 'MASSAGE', 'textColour': '#d9b24a'}, 'evidence': 'red painted shop front with a gold sign, 2020-04-21'})],
    bag, pal(lift('#52493e'), frame=CREAM, cornice=CREAM),
    {'fronts/0/gable': 'deep cream frieze cornice', 'fronts/0/dormers': 'one hoist dormer with a pointed head over the cornice',
     'fronts/0/windowHead': 'brick relieving arches over every window', 'palette/frame': 'cream window frames and cornice',
     'palette/brick': 'brown brick, crop reading #52493e lifted 10 %'},
    [{'component': 'basement', 'what': 'two stone steps up to each shop door'}])

house('0363100012182302', 'Nieuwmarkt 13', '2020-04-21', [F(
    gable='cornice', cornice='simple', storeys=3, bays=3, doorBay=0, tallGround=True, basement='none', hoist=True, dormers=1, dormerStyle='pediment',
    windows='casement-toplight', windowHead={'kind': 'relieving', 'archRing': {'colour': 'wall', 'style': 'solid'}},
    storeyHeights=[1.7, 1.0, 1.0],
    shopfront={'colour': W, 'fascia': False, 'glazing': 'transom', 'entrance': 'left', 'stallriser': 'low', 'displayWindows': 2,
               'evidence': 'white timber pui with an entresol of five lights, 2020-04-21'})],
    bag, pal(lift('#413933'), cornice=CREAM),
    {'fronts/0/gable': 'cream cornice with a hoist dormer under a pointed head', 'fronts/0/windowHead': 'brick relieving arches over the windows',
     'palette/brick': 'dark brown brick, crop reading #413933 lifted 10 %'},
    [{'component': 'balcony', 'what': 'low white guard rails across the top-storey windows'}])

house('0363100012181808', 'Nieuwmarkt 17-23', '2025-01-08', [F(
    gable='neck', crownCap='rounded', atticWindows=1, storeys=5, bays=3, doorBay=1, tallGround=True, basement='none', cornice='none', hoist=False,
    windows='cross',
    shopfront={'colour': '#2a2a2a', 'fascia': False, 'entrance': 'centre', 'stallriser': 'low',
               'awning': {'style': 'fabric-straight', 'colour': '#a4532c'}, 'evidence': 'cafe terrace under an orange awning, 2025-01-08'})],
    tile, pal('#4f3a30'),
    {'fronts/0/gable': 'neck gable with large white sculpted scrolls and a rounded cap', 'fronts/0/storeys': 'cafe storey and four window storeys',
     'palette/brick': 'dark brown brick (the crop is in shade)'},
    [{'component': 'gable ornament', 'what': 'large white sculpted scrolls and vases beside the neck; a gable stone under the first-storey windows'}])

house('0363100012177902', 'Nieuwmarkt 4A', '2022-04-26', [{**F(
    gable='cornice', cornice='heavy', storeys=4, bays=5, doorBay=0, tallGround=True, basement='none', hoist=False, dormers=2,
    windows='two-light', windowHead={'kind': 'round', 'storeys': [1, 2]}, bands='speklagen', speklagen={'spacing': 4, 'courses': 3}, quoins='stone',
    shopfront={'colour': '#3c4247', 'fascia': True, 'entrance': 'left', 'stallriser': 'medium', 'displayWindows': 2,
               'sign': {'text': 'THE JOLLY JOKER', 'textColour': '#e8b830'}, 'evidence': 'grey painted shop front with colourful lettering, 2022-04-26'}), 'street': 'Nieuwmarkt'}],
    {'material': 'slate'}, pal('#9a4a3a', stone='#ece8dc', cornice=W),
    {'fronts/0/gable': 'heavy white cornice over a slate mansard with two dormers (neo-renaissance, c. 1890)',
     'fronts/0/bands': 'white stone banding through the red brick (alternate courses on the piers)', 'fronts/0/quoins': 'stone quoins at both ends',
     'fronts/0/windowHead': 'round-arched heads on the first and second storeys', 'palette/brick': 'red brick between white stone'},
    [{'component': 'wall', 'what': 'the piers between the windows are banded white/red in long blocks, not full-width speklagen'}])

HELD = {'0363100012182296': 'recipe compile: "Grouped frontage is not a straight surveyed wall" (facts.ts frontage of Nieuwmarkt 3)',
        '0363100012177902': 'facts.ts: "No footprint edge faces Nieuwmarkt" (4A faces the square at bearing 190; the routing street does not run along it)'}
R.setdefault('_held', {}).update({p: {'why': w, 'reading': R.pop(p)} for p, w in HELD.items() if p in R})
json.dump(R, open(P, 'w'), indent=1, ensure_ascii=False)
print('row 2', len([k for k in R if not k.startswith('_')]))
# ---- pass 3 (install gates) ----
R['0363100012181808']['design']['fronts'][0]['storeyHeights'] = [1.3, 1.0, 1.0, 1.0, 1.0]
R['0363100012181808']['why']['fronts/0/storeyHeights'] = 'cafe storey about 3.2 m, four upper storeys about 2.5 m'
for p in ('0363100012181818', '0363100012182302'):
    f = R[p]['design']['fronts'][0]; f.pop('dormers', None); f.pop('dormerStyle', None); f['hoist'] = False
    R[p]['why'].pop('fronts/0/dormers', None)
    R[p]['limits'].append({'component': 'dormer', 'what': 'the hoist dormer with a pointed head over the cornice (dropped: 4-7 m of open edge in the install gate)'})
json.dump(R, open(P, 'w'), indent=1, ensure_ascii=False)
# ---- pass 4: the shop sign leaves 3.3 m of open edge in install (kit bug, sign panel); drop it, record the limit ----
R['0363100012181818']['design']['fronts'][0]['shopfront'].pop('sign', None)
R['0363100012181818']['limits'].append({'component': 'shopfront sign', 'what': 'the gold MASSAGE lettering: a shopfront sign on this front leaves 21 open edges (3.3 m) in the install gate'})
json.dump(R, open(P, 'w'), indent=1, ensure_ascii=False)
