from .geometry import box,line

def balcony(x,z,w,stone,iron):
    box('Detail / balcony slab',x,-.38,z,w+.4,.7,.10,stone)
    for j in range(7):
      bx=x-(w+.25)/2+(w+.25)*j/6;line('Detail / baluster',(bx,-.68,z),(bx,-.68,z+.65),.014,iron)
    line('Detail / handrail',(x-(w+.3)/2,-.68,z+.65),(x+(w+.3)/2,-.68,z+.65),.025,iron)

def bicycle_sign(x,z,cream,iron):
    import bpy,math
    for wx in (x-.3,x+.3):
      bpy.ops.mesh.primitive_torus_add(major_segments=20,minor_segments=6,location=(wx,-.43,z),major_radius=.25,minor_radius=.014,rotation=(math.pi/2,0,0));bpy.context.object.name='Detail / hanging bicycle wheel';bpy.context.object.data.materials.append(cream)
    for p,q in [((-.3,0),(0,.24)),((0,.24),(.3,0)),((-.3,0),(.04,0)),((.04,0),(0,.24)),((.04,0),(.3,0))]:line('Detail / hanging bicycle frame',(x+p[0],-.43,z+p[1]),(x+q[0],-.43,z+q[1]),.018,cream)
    line('Detail / bicycle bracket',(x,0,z+.55),(x,-.45,z+.55),.025,iron)
    line('Detail / bicycle suspension',(x,-.43,z+.24),(x,-.43,z+.55),.014,iron)
