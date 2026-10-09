"""Signs and awnings live in a parent storefront coordinate frame."""
from .geometry import box,text,mesh
from .layout import SURFACES

def build(storefront,material,lettering):
    for sign in storefront.get('signs',[]):
      x=storefront.get('anchor',sign['x']) if sign.get('anchor')=='storefront' else sign['x']
      z,w,h=sign['z'],sign['width'],sign['height'];m=material('iron',sign.get('colour','#263d32'))
      if sign.get('substrate',True):
        box('Storefront / '+sign['id']+' substrate',x,SURFACES['sign_front']+.05,z,w,.1,h,m)
      ink=material('ivorytimber',sign['letteringColour']) if sign.get('letteringColour') else lettering
      text('Storefront / '+sign['id']+' lettering',sign['text'],x,z,w*.93,ink,y=sign.get('letteringDepth',SURFACES['lettering']),height=h*.8,font_size=sign.get('fontSize',.22))
    for awning in storefront.get('awnings',[]):
      x,z,w,h=awning['x'],awning['z'],awning['width'],awning['height'];y=-awning['projection'];m=material('ivorytimber',awning['colour'])
      mesh('Storefront / sloping canopy',[(x-w/2,-.12,z+h/2),(x+w/2,-.12,z+h/2),(x+w/2,y,z-h/2),(x-w/2,y,z-h/2)],[(0,3,2,1)],m)
      box('Storefront / canvas valance',x,y,z-h/2-.09,w,.04,.18,m)
      text('Storefront / awning lettering',awning.get('text',''),x,z-h/2-.09,w*.93,lettering,y=y-.025)
