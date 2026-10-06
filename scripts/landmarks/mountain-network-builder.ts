import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import data from './mountain-network-footprints.json';
import {openTopPrism, upwardRoofPlane} from './house-geometry';
/** Original texture-free interpretation of the De Tribune survey rings.
 * The whole BAG host is retained because the climbing centre has no separate Pand.
 * Surface loops are survey dimensions; all triangulation/facade assemblies are original.
 */
export function buildMountainNetwork(_w:number,_d:number,{add,box}:BuildingTools){
 for(const [surfaceIndex,s] of data.surfaces.entries()){
  if(s.type==='GroundSurface')continue;
  const ring=s.rings[0];
  if(s.type==='RoofSurface'){
   const sh=new T.Shape(ring.map(p=>new T.Vector2(p[0],p[2])));for(const hole of s.rings.slice(1))sh.holes.push(new T.Path(hole.map(p=>new T.Vector2(p[0],p[2]))));
   const g=upwardRoofPlane(sh);g.translate(0,ring[0][1],0);add(g,'slate');
  }else{
   // Survey walls are vertical polygons, sometimes with stepped lower boundaries.
   const a=ring[0],b=ring.find(p=>Math.hypot(p[0]-a[0],p[2]-a[2])>.05)!;if(!b)continue;
   const tangent=new T.Vector2(b[0]-a[0],b[2]-a[2]).normalize();const local=s.rings.map(r=>r.map(p=>new T.Vector2((p[0]-a[0])*tangent.x+(p[2]-a[2])*tangent.y,p[1])));
   const sh=new T.Shape(local[0]);for(const hole of local.slice(1))sh.holes.push(new T.Path(hole));
   // City-side2025 photograph proves the northern housing bridge is open below.
   // LoD1.3 fills it; remove the bounded photographed passage in both wall faces.
   if([99,134].includes(surfaceIndex)){
    for(const[worldLo,worldHi]of[[-13.2,-8.2],[-6.2,-1.8]]){
     const lo=(worldLo-a[0])/tangent.x,hi=(worldHi-a[0])/tangent.x;
     const xl=Math.min(lo,hi),xr=Math.max(lo,hi);
     sh.holes.push(new T.Path([new T.Vector2(xl,.01),new T.Vector2(xl,7.0),new T.Vector2(xr,7.0),new T.Vector2(xr,.01)]));
    }
   }
   const g=new T.ShapeGeometry(sh);const pos=g.getAttribute('position');for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i);pos.setXYZ(i,a[0]+tangent.x*x,y,a[2]+tangent.y*x);}g.computeVertexNormals();
   // Orient wall normals using the native polygon winding rather than ShapeGeometry's local default.
   let nx=0,nz=0;for(let i=0;i<ring.length;i++){const p=ring[i],q=ring[(i+1)%ring.length];nx+=(p[1]-q[1])*(p[2]+q[2]);nz+=(p[0]-q[0])*(p[1]+q[1]);}const outward=new T.Vector2(nx,nz).normalize();
   const n=g.getAttribute('normal');if(n.getX(0)*outward.x+n.getZ(0)*outward.y<0){const idx=g.index!;for(let i=0;i<idx.count;i+=3){const a=idx.getX(i);idx.setX(i,idx.getX(i+2));idx.setX(i+2,a);}g.computeVertexNormals();}
   const minY=Math.min(...ring.map(p=>p[1])),maxY=Math.max(...ring.map(p=>p[1]));
   const tower=ring.every(p=>p[0]>12&&p[2]<-65)&&maxY<36;
   add(g,tower?'white':outward.x>.65?'slate':'stone');
   const xs=local[0].map(p=>p.x),left=Math.min(...xs),right=Math.max(...xs),length=right-left;
   function plane(l:number,r:number,y:number,h:number,c:Parameters<BuildingTools['add']>[1],offset=.09){const m=(l+r)/2;const geo=new T.PlaneGeometry(r-l,h);const angle=Math.atan2(outward.x,outward.y);add(geo,c,a[0]+tangent.x*m+outward.x*offset,y+h/2,a[2]+tangent.y*m+outward.y*offset,angle);}
   // Fractional panel ranges come from the actual wall polygon at each height.
   function spans(y:number){const hits:number[]=[];const p=local[0];for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];if((a.y<=y&&b.y>y)||(b.y<=y&&a.y>y))hits.push(a.x+(b.x-a.x)*(y-a.y)/(b.y-a.y));}hits.sort((a,b)=>a-b);return Array.from({length:Math.floor(hits.length/2)},(_,i)=>[hits[i*2],hits[i*2+1]]);}
   if(tower&&length>3){
    // Source2022/2025: brick plinth under cantilevered pale translucent climbing tower.
    const base=Math.max(minY,.05),bh=Math.min(7,maxY)-base;if(bh>0)for(const[l,r]of spans(base+bh/2))plane(l,r,base,bh,'stone',.1);
    if(outward.y<-.5){
    }else{for(let y=8;y<maxY;y+=1.45)for(const[l,r]of spans(y))plane(l,r,y,.035,'frame',.1);}
   }else if(length>3.2){
    if([108,79,86].includes(surfaceIndex)){
     const mid=(left+right)/2,width=Math.min(8,length-1.2);
     for(let y=9;y<maxY-1;y+=3.05){const cx=a[0]+tangent.x*mid+outward.x*.72,cz=a[2]+tangent.y*mid+outward.y*.72;add(new T.BoxGeometry(width,.18,1.5),'stone',cx,y,cz,Math.atan2(-tangent.y,tangent.x));plane(mid-width/2,mid+width/2,y+.22,.72,'frame',1.5);}
    }
    // The city photograph shows a tall climbing hall under the first housing
    // slab, beside the broad low opaque hall across surfaces107/145. Surface27 is
    // the exposed corner; only the first6m of108 continues this glass hall.
    // Three pane tiers and slender vertical joints follow the visible curtain
    // wall. Dimensions/division counts are bounded photo interpretations.
    if([27,108].includes(surfaceIndex)){
     const hallLeft=left+.15,hallRight=surfaceIndex===27?right-.15:left+6;
     const count=surfaceIndex===27?8:3;
     plane(hallLeft,hallRight,.18,8.65,'glass',.17);
     for(let i=0;i<=count;i++){const x=hallLeft+(hallRight-hallLeft)*i/count;plane(x-.035,x+.035,.18,8.65,'frame',.22);}
     for(const y of[.18,3.0,5.8,8.76])plane(hallLeft,hallRight,y,.07,'frame',.23);
     // Stronger middle stile and lower entrance frame are visible in the
     // main hall; leave the tall panes readable rather than adding name text.
     if(surfaceIndex===27){const x=hallLeft+(hallRight-hallLeft)*.5;plane(x-.07,x+.07,.18,8.65,'concrete',.25);}
     if(surfaceIndex===108)for(const[l,r]of spans(1.3))if(r>hallRight+.15)plane(hallRight+.15,r-.15,.12,2.6,'glass',.17);
    }

    // The archived city panorama shows the broad lower hall as masonry over
    // a continuous shopfront ribbon. Surface107 was incorrectly treated as
    // ordinary apartments;145 alone only covered its narrow continuation.
    if([107,145].includes(surfaceIndex)){
     for(const[l,r]of spans(1.4)){
      plane(l+.08,r-.08,.12,2.6,'glass',.17);
      const count=Math.max(1,Math.ceil((r-l)/2.7));
      for(let i=0;i<=count;i++){const x=l+(r-l)*i/count;plane(x-.035,x+.035,.12,2.6,'frame',.23);}
      plane(l,r,2.72,.08,'frame',.24);
     }
    }
    if(outward.x>.65){
     // Motorway sound-screen face: uninterrupted blue horizontal glazing ribbons,
     // dark projecting rails, and the stepped source roofline.
     for(let y=4.8;y<maxY-1.5;y+=3.05)for(const[l,r]of spans(y+.45)){plane(l+.08,r-.08,y,.92,'glass');plane(l,r,y-.19,.19,'slate',.18);}
    }else{
     // City face: paired white-framed housing windows, exposed lower hall ribbons.
     for(let y=Math.max(3,minY+.4);y<maxY-1.4;y+=3.05)for(const[l,r]of spans(y+.9)){
      if(([99,134].includes(surfaceIndex)&&y<7)||[27,107,145,113,164].includes(surfaceIndex))continue;const count=Math.floor((r-l)/3.35);for(let i=0;i<count;i++){const c=l+(i+.5)*(r-l)/count;if(surfaceIndex===99&&a[0]+tangent.x*c>11&&y>7)continue;if(surfaceIndex===108&&y<8.9&&c-1.34<left+6.15)continue;plane(c-1.28,c+1.28,y,1.95,'white');plane(c-1.16,c+1.16,y+.12,1.71,'glass',.14);plane(c-.035,c+.035,y+.08,1.8,'white',.18);plane(c-1.34,c+1.34,y-.09,.1,'white',.2);}
     }
    }
   }
  }
 }
 // Projected climbing envelope: four broad pale translucent bays on the
 // photographed northern/front face, opaque side returns. The1.35m
 // overhang is photograph-guided; surveyed native roof remains behind the band.
 function wallPanel(a:T.Vector2,b:T.Vector2,y:number,h:number,c:Parameters<BuildingTools['add']>[1]){const d=b.clone().sub(a),mid=a.clone().add(b).multiplyScalar(.5);add(new T.PlaneGeometry(d.length(),h),c,mid.x,y+h/2,mid.y,Math.atan2(-d.y,d.x));}
 const towerA=new T.Vector2(33,-82.7),towerB=new T.Vector2(17.2,-86.8),towerDir=towerB.clone().sub(towerA).normalize(),towerNormal=new T.Vector2(-towerDir.y,towerDir.x),project=1.35;
 const projectedA=towerA.clone().addScaledVector(towerNormal,project),projectedB=towerB.clone().addScaledVector(towerNormal,project),towerWidth=towerA.distanceTo(towerB);
 wallPanel(projectedA,projectedB,7,28.1,'concrete');
 for(let i=0;i<4;i++){
  const a=projectedA.clone().lerp(projectedB,i/4).addScaledVector(towerDir,.16),b=projectedA.clone().lerp(projectedB,(i+1)/4).addScaledVector(towerDir,-.16);
  wallPanel(a.clone().addScaledVector(towerNormal,.025),b.clone().addScaledVector(towerNormal,.025),7.16,27.78,'frame');
  for(let y=7.3;y<35;y+=1.02)wallPanel(a.clone().addScaledVector(towerNormal,.065),b.clone().addScaledVector(towerNormal,.065),y,.095,'white');
 }
 for(let i=0;i<=4;i++){const c=projectedA.clone().lerp(projectedB,i/4);wallPanel(c.clone().addScaledVector(towerDir,-.105).addScaledVector(towerNormal,.08),c.clone().addScaledVector(towerDir,.105).addScaledVector(towerNormal,.08),7,28.1,'white');}
 wallPanel(towerA,projectedA,7,28.1,'white');wallPanel(projectedB,towerB,7,28.1,'white');wallPanel(new T.Vector2(17.2,-86.8),new T.Vector2(13.1,-70.5),7,28.1,'white');
 const overhang=new T.Shape([towerA,projectedA,projectedB,towerB]);const cap=upwardRoofPlane(overhang);cap.translate(0,35.1,0);add(cap,'white');const soffit=upwardRoofPlane(overhang);soffit.scale(1,-1,1);soffit.translate(0,7,0);add(soffit,'slate');
 // Recessed front entrance in the photographed brick base; the projection is
 // above it, so panes/threshold remain visible beneath the dark soffit.
 const entryA=towerA.clone().addScaledVector(towerDir,2),entryB=towerB.clone().addScaledVector(towerDir,-2);wallPanel(entryA.clone().addScaledVector(towerNormal,.9),entryB.clone().addScaledVector(towerNormal,.9),.12,2.7,'glass');
 for(let i=0;i<=6;i++){const c=entryA.clone().lerp(entryB,i/6).addScaledVector(towerNormal,.95);wallPanel(c.clone().addScaledVector(towerDir,-.045),c.clone().addScaledVector(towerDir,.045),.12,2.7,'white');}
 // Continuous convex city-side balcony fronts over the hall. Native backing
 // chains retain the stepped/rounded corner; nine photo-guided floor bands
 // bulge3m outward rather than becoming isolated straight window strips.
 const backing=[new T.Vector2(4.1,-38.1),new T.Vector2(2.3,-31.1),new T.Vector2(4,-29.9),new T.Vector2(.2,-16.1)];
 const front:T.Vector2[]=[];for(let i=0;i<=20;i++){const t=i/20,z=-38.1+22*t,x=4.1-3.9*t-.6-3.2*Math.sin(Math.PI*t);front.push(new T.Vector2(x,z));}
 const balconyShape=new T.Shape([...backing,...front.slice().reverse()]);
 for(let y=8.95;y<37;y+=3.05){
  add(openTopPrism(balconyShape,y,y+.23),'stone');const top=upwardRoofPlane(balconyShape);top.translate(0,y+.23,0);add(top,'stone');
  const bottom=upwardRoofPlane(balconyShape);bottom.scale(1,-1,1);bottom.translate(0,y,0);add(bottom,'concrete');
  for(let i=0;i<front.length-1;i++){wallPanel(front[i],front[i+1],y+.23,.43,'stone');wallPanel(front[i],front[i+1],y+.98,.035,'frame');if(i%2===0){const d=front[i+1].clone().sub(front[i]).normalize(),c=front[i];wallPanel(c.clone().addScaledVector(d,-.018),c.clone().addScaledVector(d,.018),y+.66,.35,'frame');}}
  for(let i=0;i<backing.length-1;i++){const a=backing[i],b=backing[i+1],d=b.clone().sub(a).normalize(),n=new T.Vector2(-d.y,d.x);wallPanel(a.clone().addScaledVector(d,.45).addScaledVector(n,.7),b.clone().addScaledVector(d,-.45).addScaledVector(n,.7),y+.35,2.4,'glass');}
 }

}
