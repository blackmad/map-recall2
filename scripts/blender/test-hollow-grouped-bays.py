import copy,json,math,unittest
from pathlib import Path
from collections import Counter
from building_lib.ir import resolve
from building_lib.grouped_bays import bay_plan
from building_lib.grouped_bay_shell import shell_parts

FIXTURE=Path(__file__).parent/'building_lib/fixtures/grouped-bays/stacked-return-windows.json'

def ray_triangle(origin,direction,a,b,c):
 def sub(a,b):return [a[i]-b[i] for i in range(3)]
 def dot(a,b):return sum(x*y for x,y in zip(a,b))
 def cross(a,b):return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
 e1,e2=sub(b,a),sub(c,a);q=cross(direction,e2);det=dot(e1,q)
 if abs(det)<1e-9:return False
 t=sub(origin,a);u=dot(t,q)/det;p=cross(t,e1);v=dot(direction,p)/det;dist=dot(e2,p)/det
 return 0<=u<=1 and 0<=v and u+v<=1 and dist>1e-7

def hit(obj,origin,direction):
 vs=obj['vertices']
 return any(ray_triangle(origin,direction,vs[f[0]],vs[f[i]],vs[f[i+1]]) for f in obj['faces'] for i in range(1,len(f)-1))

class HollowBays(unittest.TestCase):
 def test_closed_panels_and_visible_panes_across_variants(self):
  for inset,projection,sides in [(0,.55,True),(.14,.6,True),(.1,.8,False)]:
   r=resolve(json.loads(FIXTURE.read_text()));f=r['frontages'][0];raw=f['groupedBays'][0];raw.update(construction='hollow',returnInset=inset,projection=projection,sideWindows=sides);p=bay_plan(raw,f,9);before=copy.deepcopy(p);parts=shell_parts(p,'#bbbbaa','#ccccbb','#445544');self.assertEqual(p,before)
   for obj in parts:
    faces=obj['faces'];edges=Counter((a,b) for face in faces for a,b in zip(face,face[1:]+face[:1]));self.assertTrue(all(v==1 and edges[b,a]==1 for (a,b),v in edges.items()),obj['name'])
    vs=obj['vertices'];volume=0
    for face in faces:
     for i in range(1,len(face)-1):
      a,b,c=[vs[k] for k in (face[0],face[i],face[i+1])];volume+=sum(a[j]*(b[(j+1)%3]*c[(j+2)%3]-b[(j+2)%3]*c[(j+1)%3]) for j in range(3))/6
    self.assertGreater(volume,0,obj['name'])
   panes=[o for o in parts if 'recessed glazing' in o['name']];self.assertEqual(len(panes),2*(3 if sides else 1));self.assertEqual({o['featureId'] for o in panes},set(p['openingIds']))
   for o in p['openings']:
    origin=(o['x'],-2,o['z']);direction=(0,1,0);frontwall=next(x for x in parts if 'pierced front masonry' in x['name']);pane=next(x for x in panes if x['featureId']==o['id'] and x['bayFace']=='front');self.assertFalse(hit(frontwall,origin,direction));self.assertTrue(hit(pane,origin,direction))
   if sides:
    for label,a,b in [('left',(p['left'],-.035),(p['left']+inset,-projection)),('right',(p['right']-inset,-projection),(p['right'],-.035))]:
     angle=math.atan2(b[1]-a[1],b[0]-a[0]);normal=(math.sin(angle),-math.cos(angle),0)
     for o in p['openings']:
      center=((a[0]+b[0])/2,(a[1]+b[1])/2,o['z']);origin=tuple(center[i]+normal[i] for i in range(3));direction=tuple(-x for x in normal);wall=next(x for x in parts if 'pierced '+label+' masonry' in x['name']);pane=next(x for x in panes if x['featureId']==o['id'] and x['bayFace']==label);self.assertFalse(hit(wall,origin,direction));self.assertTrue(hit(pane,origin,direction))
 def test_unsupported_construction_and_embedment_reject(self):
  r=resolve(json.loads(FIXTURE.read_text()));f=r['frontages'][0]
  for edit in [{'construction':'unknown'},{'construction':'hollow','baseRise':.2},{'construction':'hollow','shellThickness':.1},{'construction':'hollow','projection':.2,'shellThickness':.2}]:
   with self.assertRaises(ValueError):bay_plan(dict(f['groupedBays'][0],**edit),f,9)
  with self.assertRaises(ValueError):shell_parts(bay_plan(f['groupedBays'][0],f,9),'wall','frame','glass')

if __name__=='__main__':unittest.main()
