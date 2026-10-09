"""Expand declarative building generators into the existing explicit recipe IR.

Authoring presets are never promoted to measured evidence. All functions are
portable and leave their input unchanged; Blender consumes the resolved recipe.
"""
from copy import deepcopy
import math
from .gables import profile,compound_profile
from .layout import solve_storeys


def resolve(recipe):
    result = deepcopy(recipe)
    roof = result['roof']
    if 'storeys' not in result and 'storeyLayout' in result:
        layout = result['storeyLayout']
        result['storeys'] = solve_storeys(layout['groundTop'], roof['eaves'],
                                          count=layout.get('upperCount'), heights=layout.get('upperHeights'))
    gable = result['gable']
    if 'profile' not in gable:
        gable['profile'] = profile(gable['family'], result['frontages'][0]['width'], roof['eaves'],
                                   gable.get('rise', 3), gable.get('raised', 0))
        gable.setdefault('provenance', {'basis': 'inferred', 'note': 'Parameterized silhouette; not measured knots'})
    floors = {floor['id']: floor for floor in result['storeys']}
    for front in result['frontages']:
        layout=front.pop('profileLayout',None)
        if layout is not None:
            eaves=layout['eaves'];top=layout['top'];raised=layout.get('raised',0)
            if not 0<eaves<=top:raise ValueError('Profile layout requires positive ordered eaves/top')
            if raised<0 or (raised and raised>=top-eaves):raise ValueError('Raised profile base must fit below its top')
            if layout['family']=='compound':
                front['profile']=compound_profile(front['width'],layout['parts'])
                if max(z for _,z in front['profile'])>top+1e-8:raise ValueError('Compound parts exceed profile top')
            else:
                front['profile']=profile(layout['family'],front['width'],eaves,max(top-eaves-raised,.001),raised)
            front['profileProvenance']=deepcopy(layout.get('provenance',{
                'status':'inferred','basis':'Photo-selected library form with illustrative proportions'}))
        openings = front.setdefault('openings', [])
        from .facade_patterns import opening_pattern
        for pattern in front.pop('openingPatterns',[]):
            openings.extend(opening_pattern(pattern,front,floors))
        for row in front.pop('openingRows', []):
            # Fractional layout keeps an authored facade pattern reusable at
            # another width. Explicit metre fields remain fully compatible.
            if ('storey' in row)==('storeys' in row):
                raise ValueError('Opening row needs storey or storeys, exclusively')
            storeys=row.get('storeys',[row.get('storey')])
            if not isinstance(storeys,list) or not storeys or len(set(storeys))!=len(storeys):
                raise ValueError('Opening row needs unique storeys')
            if ('centres' in row)==('centresFraction' in row):
                raise ValueError('Opening row needs centres or centresFraction, exclusively')
            positions = row.get('centres',row.get('centresFraction'))
            if not isinstance(positions, list) or not positions:
                raise ValueError('Opening row needs explicit centre positions')
            if any(isinstance(x, bool) or not isinstance(x, (int, float)) or not math.isfinite(x) for x in positions):
                raise ValueError('Opening row centres must be finite numbers')
            if 'centresFraction' in row:
                if any(not 0<x<1 for x in positions):raise ValueError('Opening centre fractions must be inside 0–1')
                positions=[x*front['width'] for x in positions]
            def dimension(name,scale,allow_zero=False):
                fraction=name+'Fraction'
                if (name in row)==(fraction in row):raise ValueError('Opening row needs '+name+' or '+fraction+', exclusively')
                value=row.get(name,row.get(fraction))
                if isinstance(value,bool) or not isinstance(value,(int,float)) or not math.isfinite(value):
                    raise ValueError('Opening row '+name+' must be finite')
                if value<0 or (value==0 and not allow_zero) or (fraction in row and value>1):
                    raise ValueError('Invalid opening row '+name)
                return value*scale if fraction in row else value
            if 'widthFractions' in row:
                if 'width' in row or 'widthFraction' in row:raise ValueError('Opening row widthFractions is exclusive with uniform width')
                fractions=row['widthFractions']
                if not isinstance(fractions,list) or len(fractions)!=len(positions) or any(isinstance(v,bool) or not isinstance(v,(int,float)) or not math.isfinite(v) or not 0<v<=1 for v in fractions):
                    raise ValueError('Opening row needs one positive width fraction per centre')
                widths=[v*front['width'] for v in fractions]
            else:widths=[dimension('width',front['width'])]*len(positions)
            for storey in storeys:
                if storey not in floors:raise ValueError('Unknown opening row storey: '+str(storey))
                floor=floors[storey];span=floor['top']-floor['bottom']
                height=dimension('height',span);sill=dimension('sill',span,True)
                identifier=row['id']+('-'+storey if 'storeys' in row else '')
                for index, x in enumerate(positions):
                    item = deepcopy(row.get('template', {}))
                    item.update(id=identifier + '-' + str(index + 1), storey=storey, x=x,
                                z=floor['bottom'] + sill + height / 2,width=widths[index],height=height)
                    item.setdefault('kind', 'window')
                    item.setdefault('head', 'rectangular')
                    item.setdefault('provenance', deepcopy(row.get('provenance', {
                        'basis': 'inferred', 'note': 'Authored repeated opening layout'})))
                    openings.append(item)
        from .balcony_plan import balcony_pattern
        for pattern in front.pop('componentPatterns',[]):
            front.setdefault('components',[]).extend(balcony_pattern(pattern,front,floors))
        identifiers = [o['id'] for o in openings]
        if len(identifiers) != len(set(identifiers)):
            raise ValueError('Duplicate opening id in frontage ' + front['id'])
    if 'height' not in result:
        result['height'] = max(roof['top'], max(p[1] for p in gable['profile']))
    return result
