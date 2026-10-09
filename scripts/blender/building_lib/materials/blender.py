"""Blender adapter. Cached portable image maps, with explicit colour spaces."""
from . import entries,maps,linear
MATERIALS={}
STATS={'hits':0,'generated':0}

def rendered_state_key(identifier,spec,style):
    """Simple opaque shader identity; textured maps retain catalog identity.

    All simple shaders use the same untouched Principled defaults. Only colour
    and brass metallic differ; alpha, emission and roughness are fixed below.
    No caller mutates these shaders after construction.
    """
    if style=='textured':return (identifier,spec['baseColour'],style)
    metallic=.5 if spec['family']=='metal' and identifier=='brass' else 0
    return ('simple',tuple(linear(spec['baseColour'])),.86,metallic,
            'opaque',1.0,'emission-default','principled-defaults')

def material(identifier,cache,colour=None,style='textured'):
    import bpy
    if style not in ('simple','textured'):raise ValueError('Unsupported material style: '+str(style))
    catalog={e['id']:e for e in entries()}
    spec=dict(catalog[identifier]);spec['baseColour']=colour or ('#91a6a3' if style=='simple' and spec['family']=='glass' else spec['baseColour'])
    key=rendered_state_key(identifier,spec,style)
    if key in MATERIALS and MATERIALS[key].name in bpy.data.materials:return MATERIALS[key]
    m=bpy.data.materials.new(style+' / '+identifier+' '+spec['baseColour']);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=linear(spec['baseColour']);bs.inputs['Roughness'].default_value=.86 if style=='simple' else spec['roughness'];bs.inputs['Metallic'].default_value=.5 if spec['family']=='metal' and identifier=='brass' else 0
    # Explicit opaque glass fallback avoids exposing an empty interior.
    if style=='textured' and spec['family']!='glass':
      paths,hash,hit=maps(spec,cache);STATS['hits' if hit else 'generated']+=1
      for kind,filepath in paths.items():
       image=bpy.data.images.load(str(filepath),check_existing=True);image.colorspace_settings.name='sRGB' if kind=='colour' else 'Non-Color';image.pack()
       tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image;tex.extension='REPEAT'
       if kind=='normal':
        normal=m.node_tree.nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=1.0;m.node_tree.links.new(tex.outputs['Color'],normal.inputs['Color']);m.node_tree.links.new(normal.outputs['Normal'],bs.inputs['Normal'])
       else:m.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color' if kind=='colour' else 'Roughness'])
      m['textureCacheHash']=hash
    m['materialId']=identifier;m['materialStyle']=style;m['tileMetres']=spec['tileMetres'];m['source']='Original '+style+' '+spec['family'];m['opaqueMobileFallback']=spec['family']=='glass';MATERIALS[key]=m
    return m
