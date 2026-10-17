import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import source from './westerkerk-footprints.json';
import {openTopPrism,upwardRoofPlane} from './house-geometry';
import {renaissanceWindow,type RenaissanceWindowSpec} from './renaissance-window';
type Colour=Parameters<BuildingTools['add']>[1];
/** Original Renaissance church: exact double-cross roofs and stepped bell tower. */
export function buildWesterkerk(_w:number,_d:number,b:BuildingTools){
 const {add,box}=b;
 function shape(rings:number[][][]){const s=new T.Shape(rings[0].map(p=>new T.Vector2(p[0],p[1])));for(const r of rings.slice(1))s.holes.push(new T.Path(r.map(p=>new T.Vector2(p[0],p[1]))));return s;}
 function body(polygons:number[][][][],base:number,height:number,c:Colour){for(const r of polygons)add(openTopPrism(shape(r),base,base+height),c);}
 function mesh(v:number[],c:Colour){if(!v.length)return;const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.computeVertexNormals();add(g,c);}
 function segment(a:number[],q:number[],y:number,h:number,d:number,c:Colour){const dx=q[0]-a[0],dz=q[1]-a[1];box((a[0]+q[0])/2,y,(a[1]+q[1])/2,Math.hypot(dx,dz),h,d,c,-Math.atan2(dz,dx));}
 function arch(x:number,y:number,z:number,w:number,h:number,a:number,c:Colour,depth=.12){const s=new T.Shape();s.moveTo(-w/2,0);s.lineTo(w/2,0);s.lineTo(w/2,h-w/2);s.absarc(0,h-w/2,w/2,0,Math.PI,false);s.closePath();add(new T.ExtrudeGeometry(s,{depth,bevelEnabled:false,curveSegments:6}),c,x,y,z,a);}
 function window(x:number,y:number,z:number,w:number,h:number,a:number,open=false){
  const nx=Math.sin(a),nz=Math.cos(a);arch(x,y,z,w+.35,h+.3,a,'stone');arch(x+nx*.14,y+.14,z+nz*.14,w,h,a,open?'dark':'glass');
  const px=x+nx*.36,pz=z+nz*.36;box(px,y+.2,pz,.13,h-w*.42,.11,'white',a);
 }
 /** Kit Renaissance window (renaissance-window.ts) with its sill centre at (x, y, z) on the wall face, facing `a`. */
 function renWindow(x:number,y:number,z:number,a:number,spec:RenaissanceWindowSpec){for(const part of renaissanceWindow(spec))add(part.g,part.c,x,y,z,a);}
 const inRing=(x:number,z:number,r:number[][])=>{let c=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],q=r[j];if((a[1]>z)!==(q[1]>z)&&x<(q[0]-a[0])*(z-a[1])/(q[1]-a[1])+a[0])c=!c;}return c;};
 /** A wall point 0.6 m outward sits inside another mapped part that rises above it: the nave or an aisle hides that wall there (openingsWithinWalls, 2026-10-16: tower lights through the nave roof). */
 function hidden(x:number,z:number,y:number,own:string){
  for(const p of source.parts){if(p.osmId===own||p.osmId==='w749287964')continue;const t=p.properties as Record<string,string>;if(Number(t.height)<=y+1)continue;
   for(const rings of p.localPolygons)if(inRing(x,z,rings[0]))return true;}
  return false;
 }
 // Aisle (w749268115): the four corner bays between the transepts carry lean-to slate roofs from the aisle cornice up to the
 // clerestory lunettes on the nave wall (panoramas 2025: slate with small dormers, the lunettes directly under the nave cornice).
 const aislePart=source.parts.find(p=>p.osmId==='w749268115')!,navePart=source.parts.find(p=>p.osmId==='w749268118')!;
 const transepts=source.parts.filter(p=>p.osmId==='w749268116'||p.osmId==='w749268117');
 const AISLE_EAVES=12.5,LEAN_TOP=19,naveSouth=navePart.bounds[3],naveNorth=navePart.bounds[1],aisleRing=aislePart.localPolygons[0][0];
 /** Aisle outer wall line (z) at x on the south (+1) or north (-1) side. */
 function aisleEdge(x:number,side:1|-1){let best=side>0?-Infinity:Infinity;for(let i=0;i<aisleRing.length-1;i++){const a=aisleRing[i],q=aisleRing[i+1];if(Math.abs(q[0]-a[0])<1)continue;const t=(x-a[0])/(q[0]-a[0]);if(t<-.01||t>1.01)continue;const z=a[1]+(q[1]-a[1])*t;best=side>0?Math.max(best,z):Math.min(best,z);}return best;}
 function leanTo(x:number,z:number){const side:1|-1=z>(naveSouth+naveNorth)/2?1:-1,edge=aisleEdge(x,side),wall=side>0?naveSouth:naveNorth;return AISLE_EAVES+(LEAN_TOP-AISLE_EAVES)*Math.max(0,Math.min(1,(edge-z)/(edge-wall)));}
 // Buttress piers: the comb teeth of the residual parent outline (1-3 m wide, standing 1-2 m out of the aisle wall). The rest of the
 // residual (a 0.9 m brick fin at the tower's south-west foot, zero-area spikes north of the tower, a sliver 5 m out in the north
 // courtyard) was Boolean debris, drawn 12 m tall with slate lids (2026-10-17 review: "a thin brick fin stands proud").
 function wallDistance(x:number,z:number){return Math.min(...aisleRing.slice(0,-1).map((a,i)=>{const q=aisleRing[i+1],dx=q[0]-a[0],dz=q[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz);}));}
 function nearestOnWall(x:number,z:number):number[]{let best=[x,z],d=Infinity;for(let i=0;i<aisleRing.length-1;i++){const a=aisleRing[i],q=aisleRing[i+1],dx=q[0]-a[0],dz=q[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz))),px=a[0]+t*dx,pz=a[1]+t*dz,dd=Math.hypot(x-px,z-pz);if(dd<d){d=dd;best=[px,pz];}}return best;}
 const piers:number[][][]=[];
 for(const rings of source.residualParentPolygons){const r=rings[0];for(let i=0;i<r.length-1;i++){const a=r[i],q=r[i+1],len=Math.hypot(q[0]-a[0],q[1]-a[1]);
  if(len<.8||len>3.2||wallDistance(a[0],a[1])<1||wallDistance(q[0],q[1])<1||inRing((a[0]+q[0])/2,(a[1]+q[1])/2,aisleRing))continue;
  piers.push([a,q,nearestOnWall(q[0],q[1]),nearestOnWall(a[0],a[1])]);}}
 /** Height of whatever stands at (x, z) other than `own`: another part's roof, a pier, the lean-to, a low annex roof (0 = open ground). */
 function coverAt(x:number,z:number,own:string){
  let h=0;
  for(const p of source.parts){if(p.osmId===own||p.osmId==='w749287964')continue;const t=p.properties as Record<string,string>;
   if(!p.localPolygons.some(rings=>inRing(x,z,rings[0])))continue;
   h=Math.max(h,p===aislePart?leanTo(x,z):Number(t.height));}
  for(const q of piers)if(inRing(x,z,[...q,q[0]]))h=Math.max(h,AISLE_EAVES+.4);
  for(const plane of source.annexRepair.lowChurchRoofPlanes)if(inRing(x,z,plane.vertices.map(v=>[v[0],v[2]])))h=Math.max(h,4.5);
  return h;
 }
 function facade(ring:number[][],base:number,eaves:number,kind:'aisle'|'nave'|'tower'|'upper',own=''){
  const winding=Math.sign(ring.slice(0,-1).reduce((s,a,i)=>{const q=ring[i+1];return s+a[0]*q[1]-q[0]*a[1];},0))||1;
  for(let i=0;i<ring.length-1;i++){
   const a=ring[i],q=ring[i+1],dx=q[0]-a[0],dz=q[1]-a[1],len=Math.hypot(dx,dz);if(len<2.5)continue;
   const angle=-Math.atan2(dz,dx)+(winding>0?Math.PI:0),nx=Math.sin(angle),nz=Math.cos(angle),tower=kind==='tower',upper=kind==='upper',ux=dx/len,uz=dz/len;
   const at=(u:number,out=.5)=>[a[0]+ux*u+nx*out,a[1]+uz*u+nz*out];
   if(tower||upper)for(const y of tower?[1.3,10,23,eaves-.55]:[base+.25,eaves-.4])segment(a,q,y,.35,.45,'stone');
   else for(const [y,h,d] of [[base+.3,.35,.45],[eaves-.35,.45,.8]]){
    // Bands run only where the wall is exposed at their height and stop flush at a re-entrant corner, so the nave and transept
    // cornices no longer cross into a stone "+" where the two walls meet (2026-10-17 review).
    let open=-1;const step=.25;
    for(let u=0;u<=len+1e-6;u+=step){const [x,z]=at(Math.min(u,len),d/2+.05),ok=coverAt(x,z,own)<y;
     if(ok&&open<0)open=u;
     if((!ok||u+step>len)&&open>=0){const u1=ok?len:Math.max(open,u-step);if(u1-open>.4){const e0=open<=1e-6?0:-d/2,e1=u1>=len-1e-6?0:d/2;segment(at(open+e0,0),at(Math.min(len,u1)+e1,0),y,h,d,'stone');}open=-1;}}
   }
   const clear=(u0:number,u1:number)=>{let h=0;for(let u=u0;u<=u1+1e-6;u+=Math.max(.2,(u1-u0)/12)){const [x,z]=at(u);h=Math.max(h,coverAt(x,z,own));}return h;};
   if(tower||upper){
    const count=Math.max(1,Math.floor(len/(tower?4.1:5))),step=len/count;
    for(let k=0;k<count;k++){
     const t=(k+.5)/count,x=a[0]+dx*t+nx*.15,z=a[1]+dz*t+nz*.15,hx=a[0]+dx*t+nx*.6,hz=a[1]+dz*t+nz*.6;
     if(tower){for(const [y,w,h] of [[3,Math.min(2,step*.55),4.5],[13,Math.min(1.25,step*.4),7],[27,Math.min(1.35,step*.42),10.2]])if(!hidden(hx,hz,y,own)&&!hidden(hx,hz,y+h,own))window(x,y,z,w,h,angle,true);}
     else if(eaves-base>=6)window(x,base+1.7,z,Math.min(2.15,step*.56),eaves-base-3.1,angle,true);
    }
   }else{
    // Windows only on exposed spans, one per pier bay (aisle) or per 7.5 m (nave, transepts), never round a corner.
    const cuts=[0,len];
    if(kind==='aisle')for(const p of piers){const cx=(p[2][0]+p[3][0])/2,cz=(p[2][1]+p[3][1])/2,u=(cx-a[0])*ux+(cz-a[1])*uz,off=Math.abs((cx-a[0])*uz-(cz-a[1])*ux);if(off<.5&&u>0&&u<len)cuts.push(u);}
    cuts.sort((m,n)=>m-n);
    const spans:number[][]=[];
    for(let c=0;c<cuts.length-1;c++){
     // Split each bay further where another part covers the wall to its full height (a transept or the nave through this wall).
     let open=-1;for(let u=cuts[c]+.1;u<=cuts[c+1]-.1+1e-6;u+=.25){const [x,z]=at(u),ok=coverAt(x,z,own)<eaves-4;if(ok&&open<0)open=u;if((!ok||u+.25>cuts[c+1]-.1)&&open>=0){spans.push([open,ok?u:u-.25]);open=-1;}}
    }
    for(const [u0,u1] of spans){
     const room=u1-u0;if(room<2.6)continue;
     const count=kind==='aisle'?1:Math.max(1,Math.floor(room/7.5)),step=room/count;
     for(let k=0;k<count;k++){
      const u=u0+step*(k+.5),[x,z]=at(u,0);
      if(kind==='aisle'){
       const w=Math.min(3.6,step-1.8),s=.38;if(w<1.4)continue;
       const sill=Math.max(3.1,clear(u-w/2-s,u+w/2+s)+.6),top=eaves-1.2;if(top-sill<4)continue;
       renWindow(x,sill,z,angle,{w,h:top-sill,lights:w>2.4?2:1,surround:s});
      }else{
       const w=Math.min(4.6,step-1.8),s=.4;if(w<1.6)continue;
       const low=clear(u-w/2-s,u+w/2+s);
       if(low<1){
        // Exposed from the ground (the east front, transept fronts below the aisle line): a tall aisle-zone window too.
        renWindow(x,3.1,z,angle,{w:Math.min(w,3.8),h:8.2,lights:2,surround:s});
        renWindow(x,13.6,z,angle,{w,h:eaves-13.6-2.4,lights:2,surround:s,pediment:true});
       }else{
        const sill=low+.7,top=eaves-1.1;
        if(top-sill>=w*1.5)renWindow(x,sill,z,angle,{w,h:top-sill-(top-sill>7?1.3:0),lights:2,surround:s,pediment:top-sill>7});
        else if(top-sill>=w*.55+.4)renWindow(x,sill,z,angle,{w,h:top-sill,lights:1,fan:true,surround:s,blocked:false});
       }
      }
     }
    }
   }
   for(const t of [0,1]){const x=a[0]+dx*t+nx*.05,z=a[1]+dz*t+nz*.05;box(x,base+.4,z,upper?.38:.55,eaves-base-.8,upper?.38:.55,'stone');if(!tower&&!upper){box(x,eaves,z,1.2,.6,1.2,'stone');b.hip(x,eaves+.6,z,1.1,1.1,.5,'stone');}}
  }
 }
 /** Lean-to slate roofs over the aisle bays, a hidden plateau under the nave, and brick infill on the aisle's east and west end walls up to the slope. */
 function leanToRoofs(){
  const xs=aisleRing.map(p=>p[0]),xw=Math.min(...xs),xe=Math.max(...xs);
  for(const side of [1,-1] as const){
   const wall=side>0?naveSouth:naveNorth,outer=aisleRing.slice(0,-1).filter(p=>(p[1]-wall)*side>1).sort((m,n)=>m[0]-n[0]).filter((p,k,all)=>k===0||Math.hypot(p[0]-all[k-1][0],p[1]-all[k-1][1])>.3);// a 10 cm survey jog made a 49 m sliver that drew as a black line
   // One closed slate-and-brick wedge per bay between the transepts (2026-10-17): a slope left running inside a transept's shell
   // bled through its wall from a distance, and loose sheets left 13 open boundary loops; each wedge is watertight, its ends are the
   // brick infill of the aisle's end walls, and it stands 5 cm on the aisle's closed lid.
   const cuts=transepts.map(t=>[t.bounds[0]+.1,t.bounds[2]-.1]).sort((m,n)=>m[0]-n[0]);
   const bays:number[][]=[];let from=outer[0][0];for(const [c0,c1] of cuts){bays.push([from,c0]);from=c1;}bays.push([from,outer[outer.length-1][0]]);
   // The outer ends overhang the end walls by 8 cm and the top edge runs 15 cm into the nave, so no wedge face is coplanar with the
   // tower's or the nave's wall (they z-fought as dark diagonal streaks at gallery distance).
   bays[0][0]-=.08;bays[bays.length-1][1]+=.08;const inWall=wall-side*.15;
   const slope:number[]=[],sides:number[]=[],E=AISLE_EAVES+.05;
   /** Push a quad/triangle wound so its normal points along `dir`. */
   const face=(out:number[],pts:number[][],dir:number[])=>{const [a,q,c]=pts,u=[q[0]-a[0],q[1]-a[1],q[2]-a[2]],w=[c[0]-a[0],c[1]-a[1],c[2]-a[2]],n=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]],ok=n[0]*dir[0]+n[1]*dir[1]+n[2]*dir[2]>=0,o=ok?pts:[...pts].reverse();
    for(let i=1;i<o.length-1;i++)out.push(...o[0],...o[i],...o[i+1]);};
   for(const [x0,x1] of bays){const edgeAt=(x:number)=>aisleEdge(Math.min(Math.max(x,xw+.05),xe-.05),side),A=[x0,E,edgeAt(x0)],B=[x1,E,edgeAt(x1)],Cb=[x1,E,inWall],Db=[x0,E,inWall],C=[x1,LEAN_TOP+.15*(LEAN_TOP-AISLE_EAVES)/Math.max(1,Math.abs(edgeAt(x0)-wall)),inWall],D=[x0,C[1],inWall];
    // Each face points away from the wedge's centroid (the slope's normal is nearly diagonal, so a fixed hint is ambiguous).
    const all=[A,B,Cb,Db,C,D],o=[0,1,2].map(i=>all.reduce((t,p)=>t+p[i],0)/all.length),away=(f:number[][])=>[0,1,2].map(i=>f.reduce((t,p)=>t+p[i],0)/f.length-o[i]);
    // The wedge's underside is slate too: it lies 5 cm over the slate lid and a double-sided view showed it as a red band.
    for(const [out,f] of [[slope,[A,B,C,D]],[slope,[A,B,Cb,Db]],[sides,[Db,Cb,C,D]],[sides,[A,Db,D]],[sides,[B,Cb,C]]] as [number[],number[][]][])face(out,f,away(f));}
   mesh(slope,"slate");mesh(sides,"brick");
  }
  // The aisle shell is closed at its eaves by a flat slate lid (the gutter strip at the foot of the lean-tos, and the plateau west of
  // the nave beside the tower); the nave, transepts and wedges stand on it.
  add(upwardRoofPlane(shape([aisleRing]),AISLE_EAVES),'slate');
  // Small slate dormers on the lean-tos, one per exposed bay (panoramas 2025).
  for(const side of [1,-1] as const){const wall=side>0?naveSouth:naveNorth;
   for(const [u0,u1] of [[xw+.5,-11.9],[-1.5,12.1],[22.4,xe-.5]]){const x=(u0+u1)/2,edge=aisleEdge(x,side),z=(edge+wall)/2,y=leanTo(x,z),a=side>0?0:Math.PI;
    if(coverAt(x,z,'w749268115')>y+.1)continue;
    box(x,y-.4,z,1.3,1.5,1.4,'slate',a);add(new T.BoxGeometry(.8,.85,.06).translate(0,.45,.72),'dark',x,y,z,a);
    const g=new T.BufferGeometry(),w=.8,d=.8,h=.55,P=[[-w,0,-d],[w,0,-d],[w,0,d],[-w,0,d],[0,h,-d],[0,h,d]];g.setAttribute('position',new T.Float32BufferAttribute([0,5,4,0,3,5,1,5,2,1,4,5,0,4,1,3,2,5].flatMap(i=>P[i]),3));g.computeVertexNormals();add(g,'slate',x,y+1.1,z,a);}}
 }
 for(const part of source.parts){
  // The mapped5m part sweeps an open terrace and separately owned neighbor.
  if(part.osmId==='w749287964')continue;
  const tags=part.properties as Record<string,string>,top=Number(tags.height),base=Number(tags.min_height||0),[x0,z0,x1,z1]=part.bounds,cx=(x0+x1)/2,cz=(z0+z1)/2;
  const tower=part.osmId.startsWith('w751083'),gable=tags['roof:shape']==='gabled',pyramid=tags['roof:shape']==='pyramidal';
  const rise=Number(tags['roof:height']||0),aisle=part.osmId==='w749268115',eaves=aisle?12.5:top-rise;
  const colour:Colour=tower?(base===0?'brick':base===40?'stone':'white'):'brick';
  body(part.localPolygons,base,eaves-base,colour);
  if(top>5)for(const rings of part.localPolygons)facade(rings[0],base,eaves,tower?(base===0?'tower':'upper'):aisle?'aisle':top>15?'nave':'aisle',part.osmId);
  const height=(x:number,z:number)=>{if(gable){const v=part.roofAxis==='x'?x:z,m=part.roofAxis==='x'?cx:cz,r=part.roofAxis==='x'?(x1-x0)/2:(z1-z0)/2;return eaves+rise*Math.max(0,1-Math.abs(v-m)/r);}if(aisle)return eaves+(top-eaves)*Math.max(0,1-Math.abs(z-cz)/((z1-z0)/2));return top;};
  if(pyramid){const v:number[]=[];for(const rings of part.localPolygons){const r=rings[0];for(let i=0;i<r.length-1;i++)v.push(r[i][0],eaves,r[i][1],r[i+1][0],eaves,r[i+1][1],cx,top,cz);}mesh(v,'slate');}
  else if(aisle)leanToRoofs();
  else{
   for(const rings of part.roofPolygons){const g=new T.ShapeGeometry(shape(rings)),p=g.getAttribute('position');for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getY(i);p.setXYZ(i,x,height(x,z),z);}const ix=g.index!;for(let i=0;i<ix.count;i+=3){const q=ix.getX(i+1);ix.setX(i+1,ix.getX(i+2));ix.setX(i+2,q);}g.computeVertexNormals();add(g,tower?'slate':top===5?'frame':'slate');}
   if(gable){const v:number[]=[];
    for(const rings of part.localPolygons)for(const r of rings)for(let i=0;i<r.length-1;i++){
     const a=r[i],q=r[i+1],points=[a],axis=part.roofAxis,k=axis==='x'?0:1,m=k===0?cx:cz,t=(m-a[k])/(q[k]-a[k]);if(t>0&&t<1)points.push([a[0]+(q[0]-a[0])*t,a[1]+(q[1]-a[1])*t]);points.push(q);
     for(let j=0;j<points.length-1;j++){const a=points[j],q=points[j+1],h0=height(a[0],a[1]),h1=height(q[0],q[1]);if(h1>eaves+.01)v.push(a[0],eaves,a[1],q[0],eaves,q[1],q[0],h1,q[1]);if(h0>eaves+.01)v.push(a[0],eaves,a[1],q[0],h1,q[1],a[0],h0,a[1]);}
    }mesh(v,'brick');
   }
  }
  if(gable){
   // Renaissance gable cornices follow the surveyed ridge end, with restrained scrolls.
   const alongX=part.roofAxis==='z',ends=alongX?[x0,x1]:[z0,z1],half=alongX?(z1-z0)/2:(x1-x0)/2;
   for(const end of ends){const centre=alongX?[end,cz]:[cx,end],a=alongX?[end,cz-half]:[cx-half,end],q=alongX?[end,cz+half]:[cx+half,end];
    segment(a,q,eaves,.4,.55,'stone');box(centre[0],top-.6,centre[1],2.4,.45,1.2,'stone');b.hip(centre[0],top-.15,centre[1],2.5,1.3,.5,'stone');
    const v:number[]=[],line=(p:number[],c:number[])=>{const d=.19;v.push(p[0],p[1]-d,p[2],c[0],c[1]-d,c[2],c[0],c[1]+d,c[2],p[0],p[1]-d,p[2],c[0],c[1]+d,c[2],p[0],p[1]+d,p[2]);};line([a[0],eaves,a[1]],[centre[0],top,centre[1]]);line([centre[0],top,centre[1]],[q[0],eaves,q[1]]);mesh(v,'stone');
   }
  }
  if(tower&&base>0&&top<82){
   // Real projecting cornices/balustrades, not the old imported stray scaffolding.
   for(const rings of part.localPolygons)for(let i=0;i<rings[0].length-1;i++){
    const a=rings[0][i],q=rings[0][i+1];if(Math.hypot(a[0]-q[0],a[1]-q[1])<2.5)continue;segment(a,q,top-.6,.55,.8,'stone');segment(a,q,top+.8,.12,.26,'stone');
    const n=Math.floor(Math.hypot(a[0]-q[0],a[1]-q[1])/.8);for(let j=0;j<=n;j++){const t=j/(n||1);box(a[0]+(q[0]-a[0])*t,top-.1,a[1]+(q[1]-a[1])*t,.12,.95,.12,'stone');}
   }
  }
 }
 // Buttress piers to the aisle cornice, capped in stone under a low weathering.
 for(const q of piers){const ring=[...q,q[0]],xs=ring.map(p=>p[0]),zs=ring.map(p=>p[1]),px=(Math.min(...xs)+Math.max(...xs))/2,pz=(Math.min(...zs)+Math.max(...zs))/2;
  body([[ring]],0,AISLE_EAVES-.45,'brick');body([[ring]],AISLE_EAVES-.45,.5,'stone');add(upwardRoofPlane(shape([ring]),AISLE_EAVES+.05),'stone');
  b.hip(px,AISLE_EAVES+.05,pz,Math.max(...xs)-Math.min(...xs),Math.max(...zs)-Math.min(...zs),.35,'stone');}
 // Exact surveyed low church RoofSurfaces; the north terrace stays open.
 for(const plane of source.annexRepair.lowChurchRoofPlanes){
  const ring=plane.vertices.map(v=>[v[0],v[2]]);ring.push(ring[0]);
  const low=Math.min(...plane.vertices.map(v=>v[1]));body([[ring]],0,low,'brick');
  const skirt:number[]=[];for(let i=0;i<plane.vertices.length;i++){const a=plane.vertices[i],q=plane.vertices[(i+1)%plane.vertices.length];skirt.push(a[0],low,a[2],q[0],low,q[2],q[0],q[1],q[2],a[0],low,a[2],q[0],q[1],q[2],a[0],a[1],a[2]);}mesh(skirt,'brick');
  const roof=upwardRoofPlane(shape([ring]));const p=roof.getAttribute('position');
  for(let i=0;i<p.count;i++){const v=plane.vertices.reduce((a,b)=>Math.hypot(b[0]-p.getX(i),b[2]-p.getZ(i))<Math.hypot(a[0]-p.getX(i),a[2]-p.getZ(i))?b:a);p.setY(i,v[1]);}roof.computeVertexNormals();add(roof,'slate');
 }
 const lower=source.parts.find(p=>p.osmId==='w751083598')!,[x0,z0,x1,z1]=lower.bounds,cx=(x0+x1)/2,cz=(z0+z1)/2;
 for(const [x,z,angle] of [[cx,z0-.18,Math.PI],[cx,z1+.18,0],[x0-.18,cz,-Math.PI/2],[x1+.18,cz,Math.PI/2]]){
  const nx=Math.sin(angle),nz=Math.cos(angle),y=52.3;box(x,y-2.4,z,5.3,4.8,.22,'stone',angle);box(x+nx*.17,y-2.15,z+nz*.17,4.8,4.35,.2,'red',angle);
  const disk=(r:number,d:number,c:Colour,offset:number)=>add(new T.CylinderGeometry(r,r,d,20).rotateX(Math.PI/2),c,x+nx*offset,y,z+nz*offset,angle);
  disk(2.05,.16,'gold',.33);disk(1.83,.18,'red',.44);
  for(let i=0;i<12;i++){const a=i*Math.PI/6,u=1.55*Math.sin(a),v=1.55*Math.cos(a);box(x+nx*.59+Math.cos(angle)*u,y+v-.1,z+nz*.59-Math.sin(angle)*u,.12,.22,.07,'gold',angle);}
  box(x+nx*.65,y-.12,z+nz*.65,.13,1.3,.09,'gold',angle);box(x+nx*.68+Math.cos(angle)*.42,y-.08,z+nz*.68-Math.sin(angle)*.42,1,.13,.09,'gold',angle);
 }
 // Blue imperial crown and gold arches, independently authored in the shared palette.
 const cap=source.parts.find(p=>p.osmId==='w751083595')!,[a,c,d,e]=cap.bounds,tx=(a+d)/2,tz=(c+e)/2;
 add(new T.CylinderGeometry(1.35,1.15,.35,12),'gold',tx,82.15,tz);const dome=new T.SphereGeometry(1,12,6,0,Math.PI*2,0,Math.PI/2);dome.scale(1.3,2,1.3);add(dome,'blue',tx,82.3,tz);
 for(let i=0;i<8;i++){const angle=i*Math.PI/4;for(let j=0;j<5;j++){const t=j*Math.PI/10;const r=1.35*Math.cos(t);add(new T.SphereGeometry(.11,5,3),'gold',tx+r*Math.sin(angle),82.3+2.05*Math.sin(t),tz+r*Math.cos(angle));}}
 add(new T.SphereGeometry(.32,8,4),'gold',tx,84.5,tz);box(tx,84.75,tz,.11,.45,.11,'gold');box(tx,85,tz,.52,.09,.11,'gold');box(tx,85.25,tz,.08,1.4,.08,'gold');
 // Small planar weathercock silhouette reaches the church's documented87m.
 mesh([tx-.65,86.15,tz,tx+.35,86.2,tz,tx+.43,86.65,tz,tx-.65,86.15,tz,tx+.43,86.65,tz,tx-.15,86.95,tz,tx-.15,86.95,tz,tx+.43,86.65,tz,tx+.65,87,tz],'gold');
}
