"""Material and component samples from the same library as buildings."""
def build(cache):
    import bpy
    from .geometry import box,text
    from .materials import entries
    from .materials.blender import material
    from .openings import opening
    from . import signage,walls,roofs
    for obj in list(bpy.context.scene.objects):bpy.data.objects.remove(obj,do_unlink=True)
    for collection in list(bpy.data.collections):
      if collection.name.startswith('SOURCE /'):bpy.data.collections.remove(collection)
    catalog=entries();ink=material('iron',cache)
    for i,spec in enumerate(catalog):
      x=(i%6)*3+1;y=(i//6)*3
      box('Material / '+spec['id'],x,y,1.2,2,.15,2,material(spec['id'],cache))
      text('Label / '+spec['id'],spec['label'],x,.06,2.5,ink,y=y-.14)
      for n in range(5):box('Ruler / 0.5m',x-1+n*.5,y-.12,.12,.025,.05,.10,ink)
    offset=19
    walls.finish(4,3,material('creamrender',cache));opening('Component / recessed opening panel',1,1.6,1.2,2,material('ivorytimber',cache),material('glass',cache),True,False,brass=material('brass',cache))
    # Components translated beyond swatches, retaining their local dimensions.
    componentObjects=[o for o in bpy.context.scene.objects if o.name.startswith(('Ground /','Component /'))]
    for obj in componentObjects:obj.location.x+=offset
    sign={'signs':[{'id':'gallery fascia','x':2,'z':2.7,'width':3.5,'height':.25,'colour':'#314c42','text':'STOREFRONT'}],'awnings':[]}
    before=set(bpy.context.scene.objects);signage.build(sign,lambda id,colour=None:material(id,cache,colour),material('ivorytimber',cache))
    for obj in set(bpy.context.scene.objects)-before:obj.location.x+=offset
    return [o for o in bpy.context.scene.objects if o.type=='MESH' and not o.get('sourceOnly')]
