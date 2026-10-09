"""Shared Blender mesh primitives. No scene work at import."""
import bpy, math
from mathutils import Vector
def mesh(name, verts, faces, material):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces); data.update()
    o = bpy.data.objects.new(name, data); bpy.context.collection.objects.link(o)
    o.data.materials.append(material)
    uv = data.uv_layers.new(name='Metre UV')
    tile=material.get('tileMetres',[1,1])
    for poly in data.polygons:
        # Project each face in metres; UV density stays fixed across buildings.
        normal = poly.normal
        for li in poly.loop_indices:
            v = data.vertices[data.loops[li].vertex_index].co
            if abs(normal.z) > .6: coords=(v.x/tile[0],v.y/tile[1])
            elif abs(normal.y)>abs(normal.x): coords=(v.x/tile[0],v.z/tile[1])
            else: coords=(v.y/tile[0],v.z/tile[1])
            uv.data[li].uv=coords
    return o

def box(name, x,y,z,w,d,h, material):
    return mesh(name,[(x+sx*w/2,y+sy*d/2,z+sz*h/2) for sz in (-1,1) for sy in (-1,1) for sx in (-1,1)],
                [(0,2,3,1),(4,5,7,6),(0,1,5,4),(2,6,7,3),(0,4,6,2),(1,3,7,5)],material)

def line(name, a,b,r, material):
    direction=Vector(b)-Vector(a)
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=r, depth=direction.length, location=(Vector(a)+Vector(b))/2)
    o=bpy.context.object;o.name=name
    o.rotation_euler=direction.to_track_quat('Z','Y').to_euler();o.data.materials.append(material)
    return o

def text(name, words, x,z,width, material, y=-.20, height=None, font_size=.22):
    if not words: return
    curve=bpy.data.curves.new(name,'FONT');curve.body=words;curve.align_x='CENTER';curve.align_y='CENTER'
    curve.size=font_size;curve.extrude=.002;curve.resolution_u=3
    curve.materials.append(material)
    o=bpy.data.objects.new(name,curve);bpy.context.collection.objects.link(o)
    o.location=(x,y,z);o.rotation_euler=(math.pi/2,0,0)
    bpy.context.view_layer.update()
    bounds=[o.matrix_world @ Vector(point) for point in o.bound_box]
    scale=min(1,width/max(max(p.x for p in bounds)-min(p.x for p in bounds),.001))
    if height is not None:scale=min(scale,height/max(max(p.z for p in bounds)-min(p.z for p in bounds),.001))
    o.scale=(scale,scale,scale)
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active=o;o.select_set(True)
    bpy.ops.object.convert(target='MESH');o.select_set(False)


def beam(name,a,b,width,depth,material):
    direction=Vector(b)-Vector(a)
    o=box(name,0,0,0,width,depth,direction.length,material)
    o.location=(Vector(a)+Vector(b))/2
    o.rotation_euler=direction.to_track_quat('Z','Y').to_euler()
    return o
