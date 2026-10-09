"""Stable floor datums and assembly anchors, independent of photographs."""
def solve_storeys(ground_top, eaves, count=None, heights=None):
    if heights is None:
        if count is None or count < 1 or eaves <= ground_top: raise ValueError('Invalid storey range')
        heights = [(eaves-ground_top)/count]*count
    if any(h <= 0 for h in heights): raise ValueError('Storey heights must be positive')
    if abs(sum(heights)+ground_top-eaves) > 1e-6: raise ValueError('Storeys must meet eaves')
    levels=[{'id':'ground','bottom':0,'top':ground_top}]
    z=ground_top
    for i,h in enumerate(heights):
        levels.append({'id':f'upper_{i+1}','bottom':z,'top':z+h}); z+=h
    return levels

def solve_bays(width, fractions):
    if any(not 0 < f < 1 for f in fractions): raise ValueError('Bay outside facade')
    return [width*f for f in fractions]

def align_assembly(width, fraction=.5):
    if not 0 <= fraction <= 1: raise ValueError('Invalid anchor')
    return width*fraction

# More negative is nearer street. All components consume this contract.
SURFACES={'shell_front':-.035,'shell_back':.24,'finish_front':-.065,
          'finish_back':-.03,'glass':-.075,'frame':-.13,'sign_front':-.195,
          'lettering':-.203,'roof_start':.24}

def validate_surfaces(s=SURFACES):
    if not s['lettering'] < s['sign_front'] < s['frame'] < s['glass'] < s['finish_front'] < s['shell_front']:
        raise ValueError('Facade layers intersect or reverse order')
    if s['finish_back'] <= s['finish_front']: raise ValueError('Finish must have thickness')
