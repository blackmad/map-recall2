"""Small authored silhouette families for explicitly synthetic architecture.

These profiles describe a facade, independently of the roof behind it. Real
building recipes may select a photo-observed form for a quick simplified pass;
preset ratios remain inferred. Use explicit knots only when the form needs them.
"""
import math


def profile(family, width, eaves, rise=3, raised=0):
    aliases={'trap':'stepped','tuit':'spout','punt':'triangular','hals':'neck','klok':'bell','cornice':'straight'}
    family=aliases.get(family,family)
    if not all(math.isfinite(v) for v in (width,eaves,rise,raised)) or raised<0:
        raise ValueError('Gable dimensions must be finite; raised height nonnegative')
    if raised and family not in ('neck','bell'):
        raise ValueError('Raised height is supported for neck and bell profiles')
    if min(width,eaves,rise)<=0:raise ValueError('Gable dimensions must be positive')
    if family=='straight':return [(0,eaves),(width,eaves)]
    if family=='triangular':return [(0,eaves),(width/2,eaves+rise),(width,eaves)]
    if family=='spout':
        # Two plain raking shoulders terminate in an explicitly narrow crest.
        return [(0,eaves),(width*.43,eaves+rise*.86),(width*.43,eaves+rise),
                (width*.57,eaves+rise),(width*.57,eaves+rise*.86),(width,eaves)]
    if family=='gambrel':
        return [(0,eaves),(width*.18,eaves+rise*.72),(width/2,eaves+rise),
                (width*.82,eaves+rise*.72),(width,eaves)]
    if family=='pediment':
        # Broad level cap with a shallow round central crown; rise is authored.
        points=[(0,eaves)]
        for i in range(13):
            theta=math.pi-i*math.pi/12
            points.append((width*(.5+.27*math.cos(theta)),eaves+rise*math.sin(theta)))
        return points+[(width,eaves)]
    if family=='stepped':
        left=[(0,0),(.08,0),(.08,.18),(.18,.18),(.18,.38),(.28,.38),
              (.28,.60),(.38,.60),(.38,.83),(.46,.83),(.46,1)]
        return [(x*width,eaves+z*rise) for x,z in left+[(1-x,z) for x,z in reversed(left)]]
    if family=='neck':
        # A distinct neck above curved shoulders, finished by a small bowed
        # pediment rather than a castellated staircase. Raised variants add a
        # complete parapet below this silhouette, preserving its proportions.
        left=[(0,0),(.12,0),(.12,.08),(.22,.08),(.28,.17),(.33,.29),
              (.35,.34),(.35,.80),(.32,.80),(.32,.86),(.35,.86),
              (.39,.94),(.44,.985),(.5,1)]
        points=left+[(1-x,z) for x,z in reversed(left[:-1])]
    elif family=='bell':
        # Broad rounded crown and concave shoulders. A raised base does not
        # stretch the bell into a narrow cone or change the curve's ratios.
        left=[(0,0),(.08,0),(.13,.07),(.19,.14),(.25,.27),(.30,.47),
              (.34,.70),(.37,.84),(.41,.94),(.455,.985),(.5,1)]
        points=left+[(1-x,z) for x,z in reversed(left[:-1])]
    else:raise ValueError('Unsupported gable family: '+family)
    result=[(x*width,eaves+raised+z*rise) for x,z in points]
    if raised:result=[(0,eaves)]+result+[(width,eaves)]
    return result


def compound_profile(width, parts):
    """Adjacent stock silhouettes with fractional widths and independent tops.

    Equal-eaves neighbours share a valley. Different eaves create an explicit
    vertical junction, useful for a central tower between lower wings.
    """
    if not math.isfinite(width) or width<=0 or not isinstance(parts,list) or not parts:
        raise ValueError('Compound front needs a positive width and parts')
    fractions=[part['fraction'] for part in parts]
    if any(isinstance(v,bool) or not isinstance(v,(int,float)) or not math.isfinite(v) or v<=0 for v in fractions):
        raise ValueError('Compound widths must be finite positive fractions')
    if abs(sum(fractions)-1)>1e-8:raise ValueError('Compound width fractions must sum to one')
    result=[];offset=0
    for part in parts:
        span=width*part['fraction'];eaves=part['eaves'];top=part['top'];raised=part.get('raised',0)
        if not all(math.isfinite(v) for v in (eaves,top,raised)) or not 0<eaves<=top or raised<0 or (raised and raised>=top-eaves):
            raise ValueError('Compound part requires ordered eaves/top and a valid raised base')
        if top==eaves and part['family']!='straight':raise ValueError('Raised compound form needs a rise')
        for x,z in profile(part['family'],span,eaves,max(top-eaves-raised,.001),raised):
            point=(offset+x,z)
            if not result or abs(point[0]-result[-1][0])>1e-8 or abs(point[1]-result[-1][1])>1e-8:
                result.append(point)
        offset+=span
    result[-1]=(width,result[-1][1])
    return result


def coping_mesh(points,width=.11,depth=.34,y=-.03,inset_top=False):
    """One closed mitered masonry band, with shared vertices at every join.

    Separate butt-ended beams leave cracks at bell curves and star-shaped
    overlaps at peaks. The street-facing strip is continuous through both.
    """
    if len(points)<2 or not all(math.isfinite(v) for p in points for v in p):
        raise ValueError('Coping requires at least two finite profile points')
    if not all(math.isfinite(v) for v in (width,depth,y)) or min(width,depth)<=0:
        raise ValueError('Coping dimensions must be finite and positive')
    normals=[]
    for a,b in zip(points,points[1:]):
        dx,dz=b[0]-a[0],b[1]-a[1];length=math.hypot(dx,dz)
        if length<=1e-8:raise ValueError('Coping profile has duplicate consecutive points')
        normals.append((-dz/length,dx/length))
    verts=[]
    for i,(x,z) in enumerate(points):
        before=normals[max(0,i-1)];after=normals[min(i,len(normals)-1)]
        mx,mz=before[0]+after[0],before[1]+after[1]
        denominator=mx*after[0]+mz*after[1]
        if denominator<=1e-8:raise ValueError('Coping profile reverses direction')
        # Bound the miter at a very sharp peak while retaining one connected
        # strip. These synthetic presets stay comfortably inside this bound.
        scale=min(1/denominator,2.5/math.hypot(mx,mz))
        mx,mz=mx*scale,mz*scale
        for yy in (y-depth/2,y+depth/2):
            verts.extend([(x-mx*width*.32,yy,z-mz*width*.32),
                          (x+mx*width*.68,yy,z+mz*width*.68)])
    faces=[]
    for i in range(len(points)-1):
        a,b=i*4,(i+1)*4
        faces.extend([(a,a+1,b+1,b),(a+2,b+2,b+3,a+3),
                      (a+1,a+3,b+3,b+1),(a,b,b+2,a+2)])
    faces.extend([(0,2,3,1),((len(points)-1)*4,(len(points)-1)*4+1,
                           (len(points)-1)*4+3,(len(points)-1)*4+2)])
    if inset_top:
        drop=max(0,max(p[2] for p in verts)-max(p[1] for p in points))+.005
        verts=[(x,yy,z-drop) for x,yy,z in verts]
    return verts,[tuple(reversed(face)) for face in faces]


def coping(points,material,width=.11,depth=.34,y=-.03):
    from .geometry import mesh
    verts,faces=coping_mesh(points,width,depth,y)
    obj=mesh('Gable / continuous mitered coping',verts,faces,material)
    import bmesh
    bm=bmesh.new();bm.from_mesh(obj.data)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    bm.to_mesh(obj.data);bm.free();obj.data.update()
    return obj
