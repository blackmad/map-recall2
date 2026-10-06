import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import source from './the-rock-footprints.json';
import {openTopPrism,upwardRoofPlane} from './house-geometry';
type P=[number,number,number];type C=Parameters<BuildingTools['add']>[1];
/** Original scale-one footprint construction. Survey roof polygons are dimensional references, not imported meshes. */
export function buildTheRock(_w:number,_d:number,b:BuildingTools):void{
 function face(p:P[],c:C,role:string,outward?:P){const values:number[]=[];for(let j=1;j<p.length-1;j++){const a=new T.Vector3(...p[0]),q=new T.Vector3(...p[j]),v=new T.Vector3(...p[j+1]),normal=q.clone().sub(a).cross(v.clone().sub(a)),mid=a.clone().add(q).add(v).multiplyScalar(1/3);const dot=outward?normal.dot(new T.Vector3(...outward)):role==='crown-top'?normal.y:role==='crown-soffit'?-normal.y:normal.x*mid.x+normal.z*mid.z;values.push(...p[0],...(dot<0?p[j+1]:p[j]),...(dot<0?p[j]:p[j+1]));}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(values,3));g.computeVertexNormals();g.userData.role=role;b.add(g,c)}
 function beam(a:P,q:P,w:number,c:C,role:string){const v=new T.Vector3(...q).sub(new T.Vector3(...a)),g=new T.BoxGeometry(w,v.length(),w);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),v.normalize()));g.userData.role=role;const mid=new T.Vector3(...a).add(new T.Vector3(...q)).multiplyScalar(.5);b.add(g,c,mid.x,mid.y,mid.z)}
 const ring=(index:number):[number,number][]=>source.roofPlanes.find(p=>p.index===index)!.ring.map(p=>[p[0],p[1]]);
 const shape=(r:[number,number][])=>new T.Shape(r.map(p=>new T.Vector2(...p)));
 // Source-rounded almost-collinear roof vertices create long sub-millimetre slivers,
 // which change winding at GLB quantization. Only the roof triangulation removes
 // redundant vertices within 2mm of the adjacent segment; surveyed wall rings stay intact.
 function roofShape(r:[number,number][]):T.Shape{const clean=r.map(p=>[...p] as [number,number]);let changed=true;while(changed&&clean.length>3){changed=false;for(let i=0;i<clean.length;i++){const a=clean[(i+clean.length-1)%clean.length],p=clean[i],q=clean[(i+1)%clean.length],dx=q[0]-a[0],dz=q[1]-a[1],length=Math.hypot(dx,dz);if(length<1e-8)continue;const t=((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(length*length),distance=Math.abs(dx*(p[1]-a[1])-dz*(p[0]-a[0]))/length;if(t>=0&&t<=1&&distance<.002){clean.splice(i,1);changed=true;break}}}return shape(clean)}
 const base=source.localRing.slice(0,-1) as [number,number][];
 // Native indented perimeter. The internal atrium is enclosed glazing, not an invented exterior courtyard.
 function roof(index:number,height:number){const g=upwardRoofPlane(roofShape(ring(index)),height);g.userData.role='supported-roof';b.add(g,'slate')}
 roof(170,30.06);
 function perimeter(r:[number,number][],bottom:number,top:number,crown:boolean){
  const shell=openTopPrism(shape(crown?[[-11,-17],[12,-17],[12,2],[-11,2]] as [number,number][]:r),bottom,top);shell.userData.role='transition-glass-shell';b.add(shell,'glass');
  const area=r.reduce((s,a,i)=>{const q=r[(i+1)%r.length];return s+a[0]*q[1]-q[0]*a[1]},0);
  for(let i=0;i<r.length;i++){
   const a=r[i],q=r[(i+1)%r.length],dx=q[0]-a[0],dz=q[1]-a[1],length=Math.hypot(dx,dz);if(length<.7)continue;
   const previous=r[(i+r.length-1)%r.length],next=r[(i+2)%r.length];
   const collinear=(x:[number,number],a:[number,number],q:[number,number])=>{const ux=a[0]-x[0],uz=a[1]-x[1],vx=q[0]-a[0],vz=q[1]-a[1];return (ux*vx+uz*vz)/Math.hypot(ux,uz)/Math.hypot(vx,vz)>.985};
   const continuousStart=collinear(previous,a,q),continuousEnd=collinear(a,q,next);
   function cornerClearance(forward:boolean):number{let traveled=0,edge=i;for(let k=0;k<r.length;k++){
    const l=r[edge],u=r[(edge+1)%r.length],v=r[(edge+2)%r.length],prev=r[(edge+r.length-1)%r.length];
    if(!(forward?collinear(l,u,v):collinear(prev,l,u)))break;
    edge=(edge+(forward?1:r.length-1))%r.length;const x=r[edge],z=r[(edge+1)%r.length];traveled+=Math.hypot(z[0]-x[0],z[1]-x[1]);if(traveled>.75)break;
   }return Math.max(.15,.75-traveled)/length}
   const leftCornerClearance=cornerClearance(false),rightCornerClearance=cornerClearance(true);
   const nx=(area>0?dz:-dz)/length,nz=(area>0?-dx:dx)/length;
   const point=(f:number,y:number,o=.055):P=>[a[0]+dx*f+nx*o,y,a[1]+dz*f+nz*o];
   const n=Math.max(1,Math.round(length/1.36));
   for(let j=0;j<n;j++){
    const f=j/n,u=(j+1)/n;
    beam(point(f,bottom),point(f,crown?48.6:top),.07,'dark','vertical-mullion');

    // The printed glass/aluminium transition reads as long, uneven pale strips.
    if(j%5!==1){const offset=(j*7+i*3)%5,h=bottom===0?14.4+(j%4)*3.6:21.6+(j%4)*3.6,y=bottom===0?1.2+offset*1.8:bottom+offset*1.8;
     if(y<top-4)face([point(f+.09/n,y,.095),point(u-.09/n,y,.095),point(u-.09/n,Math.min(crown?48.6:top,y+h),.095),point(f+.09/n,Math.min(crown?48.6:top,y+h),.095)],j%3===0?'white':'frame','printed-glass-strip');
    }
   }
   for(let y=bottom+3.5;y<(crown?48.6:top);y+=3.6)beam(point(0,y),point(1,y),.065,'dark','horizontal-mullion');
   if(!crown)continue;

   // Source-visible stone frames surround a deep, oblique glass fissure. Coordinates
   // describe original photo-guided assemblies; surveyed outer roof/wall rings remain the envelope.
   const north=(a[1]+q[1])/2<-17,west=(a[0]+q[0])/2<-12,south=(a[1]+q[1])/2>4;
   const axis=(f:number)=>{const p=point(f,0,0);return north?(p[0]+17)/39:west?(p[2]+23)/38:south?(p[0]+18)/39:(p[2]+25)/40};
   const centre=(y:number)=>north?(y>=76?.25+(87.55-y)*.022:.505+(76-y)*.0015):west?(y>=74?.68-(87.55-y)*.012:.517):south?(y>=75?.38+(87.55-y)*.015:.568):.38+(87.55-y)*.005;
   const halfGap=(y:number)=>y<65?.068:.037;
   const cells=Math.max(1,Math.round(length/3.2));
   type Q=[number,number];
   function clip(poly:Q[],signed:(p:Q)=>number):Q[]{const out:Q[]=[];for(let j=0;j<poly.length;j++){const a=poly[j],q=poly[(j+1)%poly.length],av=signed(a),qv=signed(q);if(av>=0)out.push(a);if((av>=0)!==(qv>=0)){const t=av/(av-qv);out.push([a[0]+(q[0]-a[0])*t,a[1]+(q[1]-a[1])*t])}}return out}
   const crownBottom=(t:number)=>north?(t<.43?52.2:59.4):west?(t<.34?48.6:t>.74?57.6:61.2):south?(t<.48?66.0:62.6):48.6+(t>.5?3.6:0);
   const depth=(t:number,y:number)=>west&&t>.30&&t<.79&&y>66.6&&y<82.2?-1.30:north&&t>.57&&y<76?-.55:south&&t>.34&&t<.78&&y>69&&y<83?-1.05:.18;
   const frameBands=(t:number):[number,number][]=>west&&t>.30&&t<.79?[[65.8,67.4],[82.2,83.5]]:south&&t>.34&&t<.78?[[68.2,69.8],[83,84.3]]:[];
   function patch(l:number,u:number,y:number,h:number,c:C,o:number,role:string){
    let poly:Q[]=[[l,y],[u,y],[u,h],[l,h]];
    // Each floor piece is split at the measured-picture profile elbows, then kept
    // on either side of the channel. The channel never becomes a shallow painted line.
    for(const [lo,hi]of [[y,Math.min(h,74)],[Math.max(y,74),Math.min(h,76)],[Math.max(y,76),h]]){
     if(hi-lo<.001)continue;const band=clip(clip(poly,p=>p[1]-lo),p=>hi-p[1]);
     for(const side of [-1,1]){const bounded=clip(band,p=>side*(axis(p[0])-centre(p[1]))-halfGap(p[1]));if(bounded.length<3)continue;face(bounded.map(([f,v])=>point(f,v,o)),c,role,[nx,0,nz]);}
    }
   }
   const inverseForWindow=(v:number)=>(v-axis(0))/(axis(1)-axis(0));
   for(let j=0;j<cells;j++){
    const f=j/cells,u=(j+1)/cells,t=axis((f+u)/2),start=crownBottom(t);
    face([point(f,bottom,0),point(u,bottom,0),point(u,start,0),point(f,start,0)],'glass','outer-transition-glass',[nx,0,nz]);
    // Carry the curtain assembly into each tall notch right up to its own stone
    // bottom. The previous draft stopped every mullion at 48.6m and left a teal belt.
    if(start>48.7){
     const cols=Math.max(2,Math.round(length/cells/1.2));
     for(let c=0;c<cols;c++){
      const l=f+(u-f)*c/cols,r=f+(u-f)*(c+1)/cols;
      beam(point(l,48.6),point(l,start-.08),.07,'dark','upper-curtain-mullion');
      // Separate narrow pale fields and wider exposed glass; no photo pixels.
      const split=l+(r-l)*((j+c)%3===0?.18:.42);
      face([point(l+.025/length,48.6,.095),point(split,48.6,.095),point(split,start-.10,.095),point(l+.025/length,start-.10,.095)],(j+c)%3===0?'white':'frame','upper-curtain-panel',[nx,0,nz]);
      const clearL=Math.max(split+.10/length,leftCornerClearance),clearR=Math.min(r-.10/length,1-rightCornerClearance);
      if(clearR-clearL>.25/length)face([point(clearL,48.68,.02),point(clearR,48.68,.02),point(clearR,start-.18,.02),point(clearL,start-.18,.02)],'glass','upper-curtain-glazing',[nx,0,nz]);
     }
     for(let y=49.85;y<start-.15;y+=3.6)beam(point(f,y),point(u,y),.065,'dark','upper-curtain-transom');
    }
    for(let y=start,k=0;y<top-.05;y+=3.6,k++){
     const end=Math.min(top,y+3.6),h=end-y,o=depth(t,(y+end)/2);
     // Dense clusters include broad panes and horizontal slits, with photo-guided
     // asymmetric stone strata. Each aperture is fitted beside the actual channel,
     // instead of discarding an entire bay when one corner approaches the fissure.
     let low=y+(k===0?1.83:.45+(j%3)*.13),high=Math.min(end-.38,low+((j+k+i)%5===0?.78:1.85+((j+k)%3)*.18));
     for(const [lo,hi]of frameBands(t))if(high>lo&&low<hi){if(low<lo)high=Math.min(high,lo-.15);else low=Math.max(low,hi+.15)}
     if(length<2||h<1.4||high-low<.45){patch(f,u,y,end,'greyBrick',o,'sculpted-stone-frame');continue}
     const gap0=inverseForWindow(centre(low)-halfGap(low)-.009),gap1=inverseForWindow(centre(high)-halfGap(high)-.009),gap2=inverseForWindow(centre(low)+halfGap(low)+.009),gap3=inverseForWindow(centre(high)+halfGap(high)+.009);
     const gapL=Math.min(gap0,gap1,gap2,gap3),gapR=Math.max(gap0,gap1,gap2,gap3);
     const inset=.10/cells,leftCorner=leftCornerClearance,rightCorner=rightCornerClearance;
     const l=Math.max(f+inset,leftCorner),r=Math.min(u-inset,1-rightCorner);
     const ranges:[[number,number],[number,number]]=[[l,Math.min(r,gapL)],[Math.max(l,gapR),r]];
     const apertures=ranges.filter(([l,r])=>r-l>.45/length);
     patch(f,u,y,low,'greyBrick',o,'sculpted-stone-frame');patch(f,u,high,end,'greyBrick',o,'sculpted-stone-frame');
     let cursor=f;
     for(const [l,r]of apertures){
      patch(cursor,l,low,high,'greyBrick',o,'sculpted-stone-frame');cursor=r;
      face([point(l,low,o-.25),point(r,low,o-.25),point(r,high,o-.25),point(l,high,o-.25)],'glass',(Math.min(l,1-r)*length<2.8?'outer-crown-glazing':'crown-glazing'),[nx,0,nz]);
      for(const yy of [low,high])face([point(l,yy,o),point(r,yy,o),point(r,yy,o-.25),point(l,yy,o-.25)],'dark','aperture-reveal');
      for(const ff of [l,r])face([point(ff,low,o-.25),point(ff,low,o),point(ff,high,o),point(ff,high,o-.25)],'dark','aperture-reveal');
      // A thin centre division makes broad paired openings distinct from slit rows.
      if((r-l)*length>2.3&&k%3!==0)beam(point(l+(r-l)*.34,low,o-.20),point(l+(r-l)*.34,high,o-.20),.055,'dark','crown-pane-mullion');
     }
     patch(cursor,u,low,high,'greyBrick',o,'sculpted-stone-frame');
     // Raised horizontal stone strata have their own underside/return depth;
     // they sit in the masonry above apertures, rather than flattening the screen.
     if(k%3===1&&end<top-.4){
      patch(f,u,end-.28,end,'greyBrick',o+.22,'layered-stone-stratum');
      const gl=inverseForWindow(centre(end-.28)-halfGap(end-.28)),gr=inverseForWindow(centre(end-.28)+halfGap(end-.28));
      for(const [l,r]of [[f,Math.min(u,gl,gr)],[Math.max(f,gl,gr),u]])if(r>l)face([point(l,end-.28,o),point(r,end-.28,o),point(r,end-.28,o+.22),point(l,end-.28,o+.22)],'dark','stone-stratum-soffit');
     }
    }
    // Two large source-guided horizontal frame members bound each principal inset,
    // with a real underside returning to the recessed screen. Narrow corner returns
    // stay solid; broad outer faces retain their aperture fields.
    for(const [lo,hi]of frameBands(t)){
     patch(f,u,lo,hi,'greyBrick',.18,'major-horizontal-frame');
     const gl=inverseForWindow(centre(lo)-halfGap(lo)),gr=inverseForWindow(centre(lo)+halfGap(lo));
     for(const [l,r]of [[f,Math.min(u,gl,gr)],[Math.max(f,gl,gr),u]])if(r>l)face([point(l,lo,.18),point(r,lo,.18),point(r,lo,west?-1.30:-1.05),point(l,lo,west?-1.30:-1.05)],'dark','major-frame-soffit',[0,-1,0]);
    }
    // Heavy unequal bottom beams return several metres to the recessed crown core.
    const d=depth(t,start+1);
    patch(f,u,start,start+1.70,'greyBrick',.22,'heavy-cantilever-beam');
    face([point(f,start,-2.4),point(u,start,-2.4),point(u,start,.22),point(f,start,.22)],'dark','crown-soffit');
    if(j===0&&!continuousStart)face([point(f,start,d),point(f,top,d),point(f,top,d-.30),point(f,start,d-.30)],'greyBrick','crown-return');
    if(j===cells-1&&!continuousEnd)face([point(u,start,d-.30),point(u,top,d-.30),point(u,top,d),point(u,start,d)],'greyBrick','crown-return');
    face([point(f,top,-2.4),point(f,top,.18),point(u,top,.18),point(u,top,-2.4)],'greyBrick','crown-top');
   }
   // Fully recessed glazing and two deep stone reveals follow every source-guided
   // zigzag elbow; channel geometry belongs to the broad principal faces only.
   const ax0=axis(0),ax1=axis(1),inverse=(v:number)=>(v-ax0)/(ax1-ax0);
   // Macro reveals belong to the photographed large inset frame, not every window bay.
   if(west||south){const lo=west?.30:.34,hi=west?.79:.78,y0=west?66.6:69,y1=west?82.2:83,d=west?-1.30:-1.05;
    const endpoints=[inverse(lo),inverse(hi)].sort((a,q)=>a-q),f=Math.max(0,endpoints[0]),u=Math.min(1,endpoints[1]);
    if(u>f){for(const y of [y0,y1])face([point(f,y,.18),point(u,y,.18),point(u,y,d),point(f,y,d)],'greyBrick','macro-frame-reveal');for(const ff of endpoints)if(ff>=0&&ff<=1)face([point(ff,y0,.18),point(ff,y1,.18),point(ff,y1,d),point(ff,y0,d)],'greyBrick','macro-frame-reveal');}
   }
   if(Math.abs(ax1-ax0)>.08)for(const [y0,y1]of [[55.8,65],[65,74],[74,76],[76,87.55]]){
    const l0=inverse(centre(y0)-halfGap(y0)),r0=inverse(centre(y0)+halfGap(y0)),l1=inverse(centre(y1)-halfGap(y1)),r1=inverse(centre(y1)+halfGap(y1));
    if(Math.min(l0,r0,l1,r1)<0||Math.max(l0,r0,l1,r1)>1)continue;
    face([point(l0,y0,-2.4),point(r0,y0,-2.4),point(r1,y1,-2.4),point(l1,y1,-2.4)],'glass','deep-zigzag-glass',[nx,0,nz]);
    for(const [f0,f1]of [[l0,l1],[r0,r1]])face([point(f0,y0,.18),point(f1,y1,.18),point(f1,y1,-2.4),point(f0,y0,-2.4)],'dark','deep-zigzag-reveal');
   }
  }
 }
 perimeter(base,0,30.06,false);
 perimeter(ring(173),30.06,87.55,true);roof(173,87.55);
 perimeter(ring(172),30.06,62.43,false);roof(172,62.43);
 // Small bounded higher crown/plant volumes; the survey maximum is never assigned to the full footprint.
 for(const [index,height]of [[174,89.05],[177,90.12]]as const){const s=shape(ring(index));const g=openTopPrism(s,87.55,height);g.userData.role='bounded-roof-volume';b.add(g,'dark');const top=upwardRoofPlane(roofShape(ring(index)),height);top.userData.role='supported-roof';b.add(top,'slate')}
 // Owner brochure (2025-04-09), page8: two circular entrance symbols at the
 // eastern facade near its north/south ends. Position is scaled from that plan;
 // the simple flat-color door frame does not assert a surveyed revolving-door mechanism.
 const a=base[2],q=base[3],dx=q[0]-a[0],dz=q[1]-a[1],len=Math.hypot(dx,dz),nx=-dz/len,nz=dx/len;
 for(const z of [16.0,-20.6]){
  const edge=z<q[1]?base[3]:a,end=z<q[1]?base[4]:q,vx=end[0]-edge[0],vz=end[1]-edge[1],length=Math.hypot(vx,vz),normalX=-vz/length,normalZ=vx/length;
  const t=(z-edge[1])/vz,cx=edge[0]+vx*t,cz=z;
  const pp=(u:number,y:number,o=.12):P=>[cx+vx/length*u+normalX*o,y,cz+vz/length*u+normalZ*o];
  face([pp(-1.5,0),pp(1.5,0),pp(1.5,3.2),pp(-1.5,3.2)],'glass','plan-located-entrance',[normalX,0,normalZ]);
  for(const u of [-1.5,0,1.5])beam(pp(u,0,.20),pp(u,3.2,.20),.12,'dark','entrance-frame');
  beam(pp(-1.5,3.2,.20),pp(1.5,3.2,.20),.14,'frame','entrance-head');
 }
}
