import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism,upwardRoofPlane} from './house-geometry';
import data from './houseboat-museum-footprints.json';
/** Woonbootmuseum, the 1914 barge Hendrika Maria on the Prinsengracht. The hull outline is the real
 * houseboat-extract way w174999382 (it contains the museum POI). Black hull with a bright waterline
 * stripe, cream upper band with windows and portholes, low dark hatch roof, stern name board and a
 * bow mast, read from a 2021 street-level panorama. Heights/openings are approximate. */
export function buildHouseboatMuseum(_w:number,_d:number,b:BuildingTools){
 const {add,box}=b,ring=data.ring[0].slice(0,-1);
 // Axis from the two farthest outline vertices (bow/stern), oriented north-to-south by +z.
 let best=[0,1,0];for(let i=0;i<ring.length;i++)for(let j=i+1;j<ring.length;j++){const d=Math.hypot(ring[i][0]-ring[j][0],ring[i][1]-ring[j][1]);if(d>best[2])best=[i,j,d]}
 let p=ring[best[0]],q=ring[best[1]];if(q[1]<p[1])[p,q]=[q,p];
 const L=best[2],ux=(q[0]-p[0])/L,uz=(q[1]-p[1])/L,cx=(p[0]+q[0])/2,cz=(p[1]+q[1])/2,ang=Math.atan2(ux,uz);
 const at=(s:number,t:number)=>[cx+ux*s+uz*t,cz+uz*s-ux*t];
 const place=(s:number,y:number,t:number,w:number,h:number,d:number,c:Parameters<typeof add>[1])=>{const [x,z]=at(s,t);box(x,y,z,w,h,d,c,ang)};
 const shape=new T.Shape(ring.map(r=>new T.Vector2(r[0],r[1])));
 // hull below and above the waterline, deck cap
 add(openTopPrism(shape,-.55,.9),'dark');
 add(upwardRoofPlane(shape,.9),'slate');
 // pale stripe just above the waterline
 const stripe=openTopPrism(shape,-.02,.14);const sp=stripe.getAttribute('position');
 for(let i=0;i<sp.count;i++){const x=sp.getX(i),z=sp.getZ(i);sp.setX(i,x+(x-cx)*.004);sp.setZ(i,z+(z-cz)*.004)}
 add(stripe,'green');
 // cream bulwark/cabin band with hatch roof
 const s0=-.36*L,s1=.31*L,len=s1-s0,mid=(s0+s1)/2,cw=3.3;
 place(mid,.9,0,cw,1.05,len,'white');
 place(mid,1.95,0,cw+.2,.14,len+.2,'slate');
 for(const k of [-.28,0,.28])place(mid+k*len,2.09,0,2.4,.28,len*.2,'slate');
 // windows: seven rectangular panes either side, two portholes toward the stern
 for(const side of [-1,1]){
  for(let i=0;i<7;i++){const s=s0+len*(.1+i*.13);place(s,1.25,side*(cw/2+.02),.04,.42,.78,'glass')}
  for(const s of [s1+.9,s1+1.8]){const [x,z]=at(s,side*1.5);const g=new T.CylinderGeometry(.16,.16,.1,10);g.rotateZ(Math.PI/2);add(g,'glass',x,.55,z,ang);}
 }
 // stern name board and bow mast
 place(s1+2.4,.9,0,3.0,.9,.12,"slate");place(s1+2.4,1.5,0,2.6,.18,.14,"white");
 place(s0-2.4,.9,0,.14,6.2,.14,"dark");
 place(s0+len*.25,2.2,.7,.25,1.0,.25,'dark');
}
