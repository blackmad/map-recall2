"""Batch 1 readings: the Nieuwmarkt 6-38 row (west side of the square, fronts facing bearing 113-116). Run to (re)write
readings.json entries for these pands; then make-specs.py. Colours: wallcast.cast() of the preview's photo wall reading."""
import json, os
from wallcast import cast
here = os.path.dirname(os.path.abspath(__file__))
P = os.path.join(here, 'readings.json')
R = json.load(open(P)) if os.path.exists(P) else {}
D = '2025-01-08'
def crop(p, pano): return f"pand-crops/{p}/front.jpg (pano {pano}, {D})"
W = '#e6e2d8'  # white paint (SWATCHES white-painted)
def house(p, addr, pano, fronts, roof, palette, why, limits=(), date=D, photo=None):
    R[p] = {'address': addr, 'photo': photo or crop(p, pano), 'date': date,
            'design': {'fronts': fronts, 'roof': roof, 'palette': palette}, 'why': why, 'limits': list(limits)}
F = lambda **k: {'id': 'front0', 'street': 'Nieuwmarkt', **k}
tile = {'material': 'black-tile', 'source': 'front', 'evidence': 'gable front: the roof follows the crown (house:crops crop)'}
bag = lambda m='black-tile': {'material': m}
pal = lambda brick, **k: {'brick': brick, 'frame': 'white', 'door': '#2c3a33', 'stone': W, 'wallMaterial': 'brick', **k}

house('0363100012171851', 'Nieuwmarkt 6', 'b_20250108_1041_Track23', [F(
    gable='step', crownSteps=5, crownFinial=True, crownRise=1.0, storeys=2, bays=2, atticWindows=2, doorBay=0, tallGround=True,
    basement='none', cornice='none', hoist=False, windows='sash',
    windowHead={'kind': 'relieving', 'archRing': {'colour': 'band', 'style': 'solid', 'widthCourses': 3}},
    shopfront={'colour': '#3a3a3a', 'fascia': False, 'entrance': 'centre', 'stallriser': 'low',
               'awning': {'style': 'fabric-straight', 'colour': '#b8312f'}, 'evidence': 'red fabric awning (dammie) over the shop, 2025-01-08'})],
    tile, pal('#9a5a3e', band='#6e4231'),
    {'fronts/0/gable': 'step gable, five steps a side with white stone caps and a top block (confirms register 3849)',
     'fronts/0/storeys': 'shop storey and one window storey under the gable foot (STOREYS_DEFINITION)',
     'fronts/0/atticWindows': 'two windows in the gable over one top light',
     'fronts/0/windowHead': 'brick relieving arches over the first-storey and gable windows',
     'palette/brick': 'bare orange-red brick; crop reading #b18453 partly in shade, drawn as the row'},
    [{'component': 'gable', 'what': 'the step caps are white stone slabs; the top light sits stacked over the two gable windows'}])

house('0363100012171854', 'Nieuwmarkt 8-10', None, [F(
    gable='cornice', storeys=4, bays=3, doorBay=2, tallGround=True, basement='none', cornice='heavy', hoist=False,
    windows='t-window', windowHead={'kind': 'segmental'}, windowSurround='sill',
    shopfront={'colour': '#2a2d30', 'fascia': True, 'entrance': 'right', 'stallriser': 'low', 'displayWindows': 2,
               'evidence': 'dark grey restaurant front with a dark fascia, white door at the right, 2022-04-26'})],
    bag(), pal('#46494b', wallMaterial='painted-brick'),
    {'fronts/0/gable': 'straight white cornice on consoles; the register bell (3850) does not match this BAG wall (H7)',
     'fronts/0/windows': 'segmental-headed windows with a transom light over a pair: T-windows',
     'palette/brick': 'dark grey painted brick, white frames and cornice'},
    photo='pand-crops/0363100012171854/front.jpg (2022-04-26, H7 --prefer-bearing 114)', date='2022-04-26')

house('0363100012182849', 'Nieuwmarkt 12', None, [F(
    gable='cornice', cornice='bracketed', crownCap='rounded', crownCapSpan='narrow', atticWindows=1, storeys=3, bays=2,
    doorBay=1, tallGround=True, basement='none', hoist=False, windows='cross', windowSurround='sill',
    shopfront={'colour': '#2b2b2b', 'fascia': True, 'fasciaColour': W, 'entrance': 'right', 'stallriser': 'low',
               'evidence': 'dark shop glazing under a deep white entablature (ROCKIT), 2025-01-08'})],
    bag(), pal('#a15b3c', cornice=W),
    {'fronts/0/gable': 'white bracketed cornice with a raised centre dormer under a rounded cap (register 3851/3852 cornice)',
     'fronts/0/atticWindows': 'one round-headed light in the centre dormer',
     'fronts/0/windows': 'two casements under a top light, white frames (cross: the casement-toplight bars do not fit the short lights)',
     'palette/brick': f'orange brick, crop reading #c7854e cast-corrected'},
    [{'component': 'gable ornament', 'what': 'the dormer is flanked by white console scrolls and carries a pole; its light is round-headed'}])

house('0363100012182848', 'Nieuwmarkt 14', None, [F(
    gable='bell', crownCap='rounded', crownShoulder='ogee', atticWindows=1, storeys=3, bays=2, doorBay=0, tallGround=True,
    basement='none', cornice='none', hoist=True, windows='sash-small-panes', windowSurround='sill',
    shopfront={'colour': W, 'fascia': True, 'entrance': 'left', 'stallriser': 'low', 'displayWindows': 3,
               'awning': {'style': 'fabric-straight', 'colour': '#222222'}, 'evidence': 'white pui with pilasters, entresol lights, black awning (coffeeshop), 2025-01-08'})],
    tile, pal('#9c5a3b'),
    {'fronts/0/gable': 'bell gable with white scroll pieces (confirms register 3853, 1662)',
     'fronts/0/windows': 'small-paned sashes, white frames', 'fronts/0/hoist': 'hoist beam over the gable light',
     'palette/brick': 'orange brick as the row (the preview read the dark glass as wall here)'},
    [{'component': 'gable ornament', 'what': 'white sandstone scroll pieces (klauwstukken) beside the bell'},
     {'component': 'ground storey', 'what': 'an entresol row of three lights over the shop glass'}])

house('0363100012182847', 'Nieuwmarkt 16', None, [F(
    gable='neck', crownCap='flat', atticWindows=1, storeys=3, bays=3, doorBay=1, tallGround=True, basement='none',
    cornice='none', hoist=True, windows='cross', windowSurround='sill',
    shopfront={'colour': '#2f4a35', 'fascia': False, 'entrance': 'centre', 'stallriser': 'low',
               'awning': {'style': 'fabric-straight', 'colour': '#2e5a3c'}, 'evidence': 'green awning (Gewaeght cafe), 2025-01-08'})],
    tile, pal('#ac643d'),
    {'fronts/0/gable': 'neck gable with white claw pieces and a hoist beam (confirms register 3854)',
     'fronts/0/bays': 'three axes on both window storeys, one light in the neck', 'fronts/0/windows': 'cross windows, white frames',
     'palette/brick': 'orange brick, crop reading #cd9257 cast-corrected'},
    [{'component': 'gable ornament', 'what': 'white carved claw pieces up both flanks of the neck'}])

house('0363100012182858', 'Nieuwmarkt 18', None, [F(
    gable='bell', crownCap='rounded', crownShoulder='convex', atticWindows=1, storeys=3, bays=3, doorBay=2, tallGround=True,
    basement='none', cornice='none', hoist=True, windows='sash-small-panes', windowSurround='sill',
    shopfront={'colour': W, 'fascia': True, 'entrance': 'right', 'stallriser': 'low', 'displayWindows': 1,
               'sign': {'text': 'ALBERT HEIJN', 'textColour': '#2aa7c9'}, 'evidence': 'white supermarket front with the sign in teal, door at the right, 2025-01-08'})],
    tile, pal('#93573d'),
    {'fronts/0/gable': 'broad bell gable with convex flanks and white scroll feet; the register says plain (3855), the photo wins',
     'fronts/0/atticWindows': 'one hoist door with green shutters in the bell',
     'fronts/0/windows': 'small-paned sashes, white frames', 'palette/brick': 'orange-red brick, crop reading #bd7c47 cast-corrected'},
    [{'component': 'gable ornament', 'what': 'white scroll pieces at the bell feet; green shutters on the bell light'}])

house('0363100012182857', 'Nieuwmarkt 20-22', None, [F(
    gable='step', crownSteps=4, storeys=2, bays=5, atticWindows=3, doorBay=1, tallGround=True, basement='none', cornice='none',
    hoist=False, windows='sash-small-panes', bands='speklagen', speklagen={'spacing': 8, 'courses': 2},
    windowHead={'kind': 'relieving', 'archRing': {'colour': 'stone', 'style': 'blocks', 'widthCourses': 4}},
    shopfront={'colour': W, 'fascia': False, 'glazing': 'transom', 'entrance': 'left', 'stallriser': 'medium', 'displayWindows': 4,
               'evidence': 'tall white pui with small-paned transom lights and two doors, 2025-01-08'})],
    tile, pal('#8c4a3a', stone='#ece6cf'),
    {'fronts/0/gable': 'two step gables side by side (register 3856: tweeling, 1605); drawn as one crown (kit gap)',
     'fronts/0/bays': 'five axes on the first storey', 'fronts/0/bands': 'white speklagen through the whole front and gables',
     'fronts/0/windowHead': 'white block arches (five blocks) over every window', 'palette/brick': 'red brick between cream-white bands'},
    [{'component': 'gable', 'what': 'two step gables over one 12 m front with a window in the valley between them'}])

house('0363100012182856', 'Nieuwmarkt 24', None, [F(
    gable='cornice', storeys=4, bays=3, doorBay=0, tallGround=True, basement='none', cornice='heavy', hoist=False,
    windows='t-window', windowSurround='sill', storeyHeights=[1.5, 1.25, 1.05, 0.85], windowHeights=[0.7, 0.8, 0.8, 0.7],
    shopfront={'colour': '#2a2a2a', 'fascia': True, 'entrance': 'left', 'stallriser': 'low',
               'sign': {'text': 'POCO LOCO', 'textColour': '#d9b24a'}, 'evidence': 'dark cafe front with gold lettering (Poco Loco), 2025-01-08'})],
    bag(), pal('#9f5e3d', cornice=W),
    {'fronts/0/gable': 'deep white bracketed cornice over a frieze with consoles', 'fronts/0/storeys': 'cafe storey and three window storeys',
     'fronts/0/windows': 'tall windows with a top light over a pair: T-windows', 'fronts/0/storeyHeights': 'storeys 4.5, 3.6, 3.1, 2.5 m on the crop',
     'palette/brick': 'red-brown brick, crop reading #c5884e cast-corrected'},
    [{'component': 'balcony', 'what': 'a low iron railing across the foot of every upper window'}])

house('0363100012182855', 'Nieuwmarkt 26', None, [F(
    gable='cornice', storeys=4, bays=[2, 2, 2, 1], doorBay=0, tallGround=True, basement='none', cornice='simple', hoist=False,
    windows='cross', windowSurround='sill',
    shopfront={'colour': '#5a1a1a', 'fascia': False, 'entrance': 'left', 'stallriser': 'low',
               'awning': {'style': 'fabric-straight', 'colour': '#9a2222'}, 'evidence': 'red awning over the restaurant, 2025-01-08'})],
    bag(), pal('#a2573a', cornice=W),
    {'fronts/0/gable': 'plain white cornice with a raised centre block', 'fronts/0/bays': 'two axes, one centred light in the top storey',
     'palette/brick': 'red brick, crop reading #d6894e cast-corrected and taken a step toward the row'})

house('0363100012182854', 'Nieuwmarkt 28', None, [F(
    gable='cornice', storeys=4, bays=3, doorBay=2, tallGround=True, basement='none', cornice='heavy', hoist=False,
    windows='t-window', windowSurround='sill',
    shopfront={'colour': '#2a2a2a', 'fascia': True, 'entrance': 'right', 'stallriser': 'low', 'evidence': 'shop storey behind a parasol (blurred), 2025-01-08'})],
    bag(), pal('#835640', cornice=W),
    {'fronts/0/gable': 'deep white cornice on consoles (register 3857/3858: consoles, XIXd)',
     'fronts/0/windows': 'T-windows with stained-glass top lights on the first storey', 'palette/brick': 'brown brick, crop reading #aa784a cast-corrected'},
    [{'component': 'balcony', 'what': 'white low balconettes on the top-storey windows'},
     {'component': 'window head', 'what': 'dark green painted heads over the first-storey windows'}])

house('0363100012182853', 'Nieuwmarkt 30', None, [F(
    gable='neck', crownCap='pediment', atticWindows=1, storeys=3, bays=2, doorBay=0, tallGround=True, basement='none',
    cornice='none', hoist=False, windows='sash', windowSurround='sill',
    shopfront={'colour': '#2a2a2a', 'fascia': True, 'entrance': 'left', 'stallriser': 'low',
               'sign': {'text': 'CHEAT DAY', 'textColour': '#f2c14e'}, 'evidence': 'shop with a lit sign (Cheat Day), 2025-01-08 strip'})],
    tile, pal('#9b573c'),
    {'fronts/0/gable': 'narrow neck gable with a pointed top (strip crop, top cut; 2021-03-08 panorama)',
     'palette/brick': 'red-brown brick, strip reading #c37f4a cast-corrected'},
    photo='pand-crops/0363100012182853/front.jpg (strip route, 40 px/m, 2025-01-08)')

seg = {'kind': 'segmental', 'rise': 0.06, 'archRing': {'colour': 'stone', 'style': 'springers', 'keystone': True}}
house('0363100012182852', 'Nieuwmarkt 32-34', None, [
    F(share=0.5, gable='neck', crownCap='rounded', atticWindows=1, storeys=4, bays=[2, 2, 2, 3], doorBay=0, tallGround=True,
      basement='none', cornice='none', hoist=False, windows='cross', windowSurround='sill',
      shopfront={'colour': '#3a2f28', 'fascia': False, 'entrance': 'left', 'stallriser': 'low', 'evidence': 'cafe front behind a terrace, 2025-01-08'}),
    {**F(share=0.5, gable='neck', crownCap='pediment', atticWindows=1, storeys=4, bays=2, doorBay=1, tallGround=True,
      basement='none', cornice='none', hoist=False, windows='cross', windowSurround='sill', windowHead=seg,
      shopfront={'colour': '#3a2f28', 'fascia': False, 'entrance': 'right', 'stallriser': 'low', 'evidence': 'cafe front behind a terrace, 2025-01-08'}), 'id': 'front1'}],
    tile, pal('#a65e3a'),
    {'fronts/0/gable': 'left house: neck gable with white scrolls; the register says cornice (3859/3860), the photo shows two necks',
     'fronts/1/gable': 'right house: neck gable under a pointed cap, white scroll feet',
     'fronts/1/windowHead': 'white springer blocks and keystones over every window of the right house',
     'palette/brick': 'red-brown brick, crop reading #cb8a4e cast-corrected'},
    [{'component': 'gable ornament', 'what': 'white carved scrolls up both necks'}])

house('0363100012182851', 'Nieuwmarkt 36', None, [F(
    gable='neck', crownCap='flat', atticWindows=1, storeys=4, bays=[3, 2, 2, 3], doorBay=2, tallGround=True, basement='none',
    cornice='none', hoist=True, windows='sash-6-over-6', windowSurround='sill',
    shopfront={'colour': W, 'fascia': False, 'glazing': 'transom', 'entrance': 'right', 'stallriser': 'medium', 'displayWindows': 2,
               'evidence': 'white painted timber ground front with entresol lights and the door at the right, 2025-01-08'})],
    tile, pal('#8a6450'),
    {'fronts/0/gable': 'neck gable with white carved claw pieces (register 3861: neck, gebeeldhouwd)',
     'fronts/0/bays': 'two axes on the first and second storeys, three on the top storey',
     'fronts/0/windows': 'small-paned 6-over-6 sashes, white frames',
     'palette/brick': 'pale brown brick, crop reading #a18264 cast-corrected and lifted to the 2025-07-03 panorama'},
    [{'component': 'gable ornament', 'what': 'white carved claw pieces and sculpture beside the neck'}])

R['0363100012182850']['design']['fronts'][0]['windowShare'] = 0.56
json.dump(R, open(P, 'w'), indent=1, ensure_ascii=False)
print(len([k for k in R if not k.startswith('_')]), 'readings')

# ---- pass 2 (compare sheets, 2026-11-10 night): proportions read off the crops ----
flat = {'material': 'bitumen', 'source': 'front', 'form': 'flat', 'evidence': 'no roof shows over the cornice on the crop; the 3DBAG roof drew a pyramid over it'}
def fr(p, i=0): return R[p]['design']['fronts'][i]
def tune(p, why=None, roof=None, i=0, **k):
    fr(p, i).update(k)
    if roof: R[p]['design']['roof'] = roof
    for key, w in (why or {}).items(): R[p]['why'][key] = w
for p in R:
    if p.startswith('_'): continue
    for f in R[p]['design']['fronts']:
        f.setdefault('windowShare', 0.62); f.setdefault('windowHeights', 'diminishing')
for p in ('0363100012182856', '0363100012182854', '0363100012171854', '0363100012182855'):
    tune(p, {'fronts/0/cornice': 'deep white entablature (frieze under a cornice on consoles): drawn as the frieze cornice'}, roof=flat, cornice='frieze')
tune('0363100012182856', storeyHeights=[1.45, 1.2, 1.0, 0.75], windowShare=0.6)
tune('0363100012182848', {'fronts/0/storeyHeights': 'ground storey 5.5 m with its entresol, uppers 2.6 m'}, storeyHeights=[2.0, 1.0, 1.0])
tune('0363100012182847', {'fronts/0/crownShoulderRise': 'the claw pieces end near the eaves: the neck stands almost from the foot'}, crownShoulderRise=0.2, windowShare=0.66)
tune('0363100012182853', {'fronts/0/crownRise': 'the neck rises about one storey over the eaves (2021-03-08 panorama)'}, crownRise=1.0)
tune('0363100012182851', windowShare=0.66)
for i in (0, 1): tune('0363100012182852', i=i, windowShare=0.66)
f = fr('0363100012182849'); f.pop('atticWindows', None)
R['0363100012182849']['why'].pop('fronts/0/atticWindows', None)
R['0363100012182849']['limits'].append({'component': 'gable ornament', 'what': 'the centre dormer light: a round-headed light in the narrow cap escapes the cap wall in the compile, so it is not drawn'})
json.dump(R, open(P, 'w'), indent=1, ensure_ascii=False)
print('pass 2')
sh = fr('0363100012182849')['shopfront']; sh['fascia'] = False; sh.pop('fasciaColour', None)
R['0363100012182849']['limits'].append({'component': 'shopfront', 'what': 'the deep white entablature over the shop: a fascia on this 4.2 m front makes an opening escape its wall in the compile'})
json.dump(R, open(P, 'w'), indent=1, ensure_ascii=False)
# 182849: generic route. 3DBAG gives the pand a roof plane from 3.3 m (facts eaves 3.43 m), so the recipe compile draws a
# 3 m house under a 14 m wedge; a hand eaves pin in facts.json did not reach the compile. Generic spec: gable, storeys,
# bays, wall colour only (no roof: toRecipe returns null).
R['0363100012182849']['design'].pop('roof')
R['0363100012182849']['limits'].append({'component': 'roof', 'what': 'recipe route held: 3DBAG roof plane from 3.3 m over the street front (facts eaves 3.43 m against the 12.0 m cornice on the crop); staged as a generic spec'})
json.dump(R, open(P, 'w'), indent=1, ensure_ascii=False)
# 182857: the double step gable is expressible: crownGroups (two crowns of the front's gable over axes 0-1 and 3-4).
tune('0363100012182857', {'fronts/0/crownGroups': 'two step gables over axes 0-1 and 3-4 (gable feet at 0-0.39 and 0.53-0.98 of the front on the crop); the valley between them over axis 2'},
     crownGroups=[{'from': 0, 'to': 1}, {'from': 3, 'to': 4}], atticWindows=2, crownSteps=4, windowShare=0.6)
R['0363100012182857']['why']['fronts/0/gable'] = 'two step gables side by side (register 3856: tweeling, 1605)'
R['0363100012182857']['limits'] = [{'component': 'gable', 'what': 'the light in the valley between the two gables (over axis 2) and the stacked top lights of each gable'}]
json.dump(R, open(P, 'w'), indent=1, ensure_ascii=False)

# ---- pass 3 (install gates, local rehearsal of house:publish step 3) ----
tune('0363100012182850', {'fronts/0/storeyHeights': 'ground storey 4.5 m with its transom row (the install gate holds the top storey >= 2.3 m under the 3DBAG eaves)'}, storeyHeights=[1.75, 1.0, 1.0, 1.0])
tune('0363100012182855', {'fronts/0/storeys': 'three storeys under the cornice: the 3DBAG eaves (9.45 m) leave no room for the small top-storey light as a storey'}, storeys=3, bays=2)
R['0363100012182855']['limits'].append({'component': 'storeys', 'what': 'a low fourth storey with one centred light under the cornice; 3DBAG eaves 9.45 m against about 11 m on the crop'})
f = fr('0363100012182852', 1); f.pop('windowHead', None); R['0363100012182852']['why'].pop('fronts/1/windowHead', None)
R['0363100012182852']['limits'].append({'component': 'window head', 'what': 'white springer blocks and keystones over the right house windows (dropped: the two fronts exceed the 3000-triangle budget with them)'})
tune('0363100012182857', speklagen={'spacing': 12, 'courses': 2})
R['0363100012182857']['limits'].append({'component': 'palette', 'what': 'the speklagen are closer (about every 8 courses) than drawn (12): the triangle budget'})
# 171854: 3DBAG eaves under 6 m for a 13 m front (storey heights 1.1-1.6 m in the compile): generic spec, like 182849.
R['0363100012171854']['design'].pop('roof')
R['0363100012171854']['limits'].append({'component': 'roof', 'what': 'recipe route held: the compile reads 3DBAG eaves under 6 m for a four-storey 13 m front; staged as a generic spec'})
json.dump(R, open(P, 'w'), indent=1, ensure_ascii=False)
