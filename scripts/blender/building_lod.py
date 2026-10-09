"""Conservative LOD selection from reviewed editable scenes.

Unknown geometry is retained. Native/derived structural meshes, true aperture
walls, glazing, caps, chimneys, bays, open frames and recessed returns retain
exact vertices, normals and transforms. Only identified fine dressing is omitted.
"""
import re
LEVELS=('detail','facade','massing')
def object_role(name,feature_id='',component_id=''):
    name=re.sub(r'\.\d{3}$','',name)
    for prefix in (feature_id,component_id):
        if prefix and name.startswith(prefix):return name[len(prefix):].strip(' /')
    return name

def keep_object(name,level,component_kind='',feature_id='',component_id=''):
    if level not in LEVELS:raise ValueError('Unknown building LOD')
    if level=='detail':return True
    role=object_role(name,feature_id,component_id)
    # Name tails are stable builder roles, never building IDs or photo guesses.
    fine=(r'(?:recessed mullion|recessed sash division|curved sash division|upper light|upper horizontal light|upper sash light|door handle|brass handle|lower panel louvre)(?: \d+)?$')
    if re.search(fine,role):return False
    if role.startswith('Storefront / ') and role.endswith('lettering'):return False
    if component_kind=='mailboxes' and re.search(r'(?:slot|label) \d+-\d+$',role):return False
    if level=='facade':return True
    if re.search(r'(?:outer trim|jamb profile|sill|threshold|horizontal frame|jamb)$',role):return False
    if component_kind in ('lintel','sill','dressing','quoins','corbel'):return False
    if component_kind=='balcony' and 'baluster' in role:return False
    if component_kind=='mailboxes':return False
    # Projecting bay masonry, terrace deck/rails, dormer cheeks/caps/fascia,
    # gable coping and every unknown object remain structural evidence.
    return True
