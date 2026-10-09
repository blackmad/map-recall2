"""Translate retained plan/shell geometry for source-massing reauthoring.

Facade-local components stay local as their facade origins move. Callers reauthor
the primary facade/gable/roof as needed; this is not a general roof-asset mover.
"""
import copy
import math

def rebase_plan(recipe, origin):
    result=copy.deepcopy(recipe)
    if any(result.get('roof',{}).get(key) for key in ('dormers','chimneys','attachments')):
        raise ValueError('Roof attachments require an explicit coordinate-aware reframe')
    def point(p):return [p[0]-origin[0],p[1]-origin[1],*p[2:]]
    result['footprint']=[point(p) for p in result['footprint']]
    if 'footprintHoles' in result:
        result['footprintHoles']=[[point(p) for p in ring] for ring in result['footprintHoles']]
    for surface in result.get('sourceShell',{}).get('surfaces',[]):
        surface['rings']=[[point(p) for p in ring] for ring in surface['rings']]
    for facade in result['frontages']:
        facade['origin']=point(facade.get('origin',[0,0]))
    result['planReframe']={'previousNormalizedOrigin':origin,'status':'retained plan/source shell translated; local facade components unchanged; caller must recompute placement and reauthor roof/gable for new frontage scope'}
    # Assert every retained source vertex exactly preserves old coordinates.
    for old,new in zip(recipe.get('sourceShell',{}).get('surfaces',[]),result.get('sourceShell',{}).get('surfaces',[])):
        for oldring,newring in zip(old['rings'],new['rings']):
            for a,b in zip(oldring,newring):
                assert math.dist(a,[b[0]+origin[0],b[1]+origin[1],b[2]])<1e-10
    return result

def pixel_x_in_frame(pixel, width, plane, source_origin, frame):
    t=pixel/width
    rd=[plane['start'][key]+t*(plane['end'][key]-plane['start'][key]) for key in ('x','y')]
    return frame.local([rd[0]-source_origin['x'],source_origin['y']-rd[1]])[0]
