"""Shared pier mesh keeps blind recesses closed and retains material volume."""
import copy,sys,unittest
from pathlib import Path
from collections import Counter
sys.path.insert(0,str(Path(__file__).parent))
from building_lib.pilaster_plan import pilaster_mesh,pilaster_blocks
from building_lib.component_catalog import resolve
class Piers(unittest.TestCase):
 def test_closed_plain_and_varied_blind_recesses(self):
  for panels in ([],[{'bottom':.4,'top':1.3,'margin':.08,'inset':.06}],[{'bottom':.4,'top':1.3,'margin':.08,'inset':.06},{'bottom':1.3,'top':2.4,'margin':.10,'inset':.10}]):
   with self.subTest(panels=panels):
    spec=resolve({'id':'pier','kind':'pilaster','x':1,'bottom':0,'top':3,'width':.4,'projection':.18,'panels':panels},{'width':3,'openings':[]},6)
    before=copy.deepcopy(spec);verts,faces=pilaster_mesh(spec,-.035);edges=Counter();volume=0
    for face in faces:
     for a,b in zip(face,face[1:]+face[:1]):edges[a,b]+=1
     a=verts[face[0]]
     for i in range(1,len(face)-1):
      b,c=verts[face[i]],verts[face[i+1]];cross=(b[1]*c[2]-b[2]*c[1],b[2]*c[0]-b[0]*c[2],b[0]*c[1]-b[1]*c[0]);volume+=sum(a[k]*cross[k] for k in range(3))/6
    self.assertTrue(all(count==1 and edges[b,a]==1 for (a,b),count in edges.items()))
    expected=.4*3*.18-sum((.4-2*p['margin'])*(p['top']-p['bottom'])*p['inset'] for p in panels)
    self.assertAlmostEqual(volume,expected,places=8);self.assertEqual(len(pilaster_blocks(spec,-.035)),2);self.assertEqual(before,spec)
if __name__=='__main__':unittest.main()
