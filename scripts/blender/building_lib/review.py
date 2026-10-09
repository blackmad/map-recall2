"""Fixed facade-centric review cameras."""
from pathlib import Path
import math

def render(recipe,art,views=('front','oblique','roof','ground')):
    import bpy
    from mathutils import Vector
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=12
    scene.render.resolution_x=720;scene.render.resolution_y=900;scene.render.resolution_percentage=100
    scene.world.use_nodes=True
    background=scene.world.node_tree.nodes.get('Background')
    background.inputs[0].default_value=(.72,.77,.81,1)
    background.inputs[1].default_value=.65
    scene.view_settings.view_transform='AgX'
    w=recipe['frontages'][0]['width'];d=max(p[1] for p in recipe['footprint']);h=recipe['height']
    bpy.ops.object.light_add(type='AREA',location=(w*.2,-8,h+4));bpy.context.object.data.energy=1800;bpy.context.object.data.size=8
    bpy.ops.object.light_add(type='AREA',location=(w+5,d*.4,h+1));bpy.context.object.data.energy=1100;bpy.context.object.data.size=8
    bpy.ops.object.camera_add();camera=bpy.context.object;camera.data.type='ORTHO';scene.camera=camera
    settings={'front':((w/2,-30,h*.5),(w/2,0,h*.5),max(h*1.15,w*1.4)), 'oblique':((w*2.5,-d*.9,h*.75),(w*.5,d*.22,h*.47),max(h*1.2,d*.8+w)*1.2), 'roof':((w*1.8,-d*.15,h*2),(w*.5,d*.4,h*.75),max(d*1.3,w*2,h)*1.35), 'ground':((w/2,-20,recipe['storeys'][0]['top']/2),(w/2,0,recipe['storeys'][0]['top']/2),max(w*1.4,recipe['storeys'][0]['top']*1.3))}
    if len(recipe['frontages'])>1:
      # Look towards the authored street planes, including a corner on either
      # side of the primary frontage, rather than always showing a blank right.
      nx=sum(math.sin(f.get('rotation',0)) for f in recipe['frontages'])
      ny=-sum(math.cos(f.get('rotation',0)) for f in recipe['frontages'])
      length=math.hypot(nx,ny)
      if length>1e-6:
        target=(w*.5,d*.22,h*.47);distance=math.hypot(w*2,d)
        settings['oblique']=((target[0]+nx/length*distance,target[1]+ny/length*distance,h*.75),target,settings['oblique'][2])
    for view in views:
      pos,target,scale=settings[view];camera.location=pos;camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.ortho_scale=scale
      if view in ('front','oblique','roof') or len(recipe['frontages'])>1:
        # Fit the complete exported geometry in camera space, including deep rear
        # volumes. Orthographic scale is vertical, not horizontal image width.
        bpy.context.view_layer.update()
        points=[obj.matrix_world@Vector(p) for obj in scene.objects if obj.type=='MESH' and not obj.get('sourceOnly') for p in obj.bound_box]
        inverse=camera.matrix_world.inverted();projected=[inverse@p for p in points]
        if projected:
          xmin,xmax=min(p.x for p in projected),max(p.x for p in projected)
          ymin,ymax=min(p.y for p in projected),max(p.y for p in projected)
          # Ground review retains its street-height target; multi-front owners
          # widen horizontally so a secondary physical frontage is not clipped.
          fit_vertical=view!='ground'
          shift=camera.rotation_euler.to_matrix()@Vector(((xmin+xmax)/2,(ymin+ymax)/2 if fit_vertical else 0,0))
          camera.location+=shift
          aspect=scene.render.resolution_x/scene.render.resolution_y
          camera.data.ortho_scale=(max(ymax-ymin,(xmax-xmin)/aspect)*1.12 if fit_vertical else
                                  max(camera.data.ortho_scale,(xmax-xmin)/aspect*1.12))
      scene.render.filepath=str(Path(art)/(recipe['id']+'-'+view+'.png'));bpy.ops.render.render(write_still=True)
