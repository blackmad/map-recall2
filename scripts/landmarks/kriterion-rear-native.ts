import * as T from 'three';
import type { BuildingTools } from './cultural-builders';
import { openTopPrism, upwardRoofPlane } from './house-geometry';
import survey from './kriterion-rear-roof-zones.json';
import specs from './retail-cinema-specs.json';
import lettering from './kriterion-vriendenkring-lettering.json';
type P = [number, number];
type Colour = Parameters<BuildingTools['add']>[1];
/** Whole current Pand1099, independently researched native original reconstruction.
 * Survey planes establish massing only. Municipal Dec2024/Jun2025 photos establish
 * the residential/meeting-house canal front. Adjacent black arched facade is NOT ours.
 * Root integrates this helper only after source/gallery/live review. */
export function buildKcriterionRearNative(b: BuildingTools) {
  const spec = specs.find(s => s.id === 'kriterion')!, anchor = spec.footprint.centre;
  const heading = (spec.footprint.headingDegrees + 180) * Math.PI / 180;
  function local([lng, lat]: number[]): P {
    const e = (lng - anchor[0]) * 111320 * Math.cos(anchor[1] * Math.PI / 180), n = (lat - anchor[1]) * 111320;
    return [e * Math.sin(heading) + n * Math.cos(heading), e * Math.cos(heading) - n * Math.sin(heading)];
  }
  const footprint = survey.footprint.coordinates[0].slice(0, -1).map(local);
  const area = (p: P[]) => p.reduce((n,a,i) => {const q=p[(i+1)%p.length]; return n+a[0]*q[1]-q[0]*a[1];},0);
  // Current PDOK parent is convex. Clip the AHN roof zones to its exact boundary;
  // 3DBAG and current BAG have small footprint revisions, not additional ownership.
  function clip(poly: P[]): P[] {
    let out=poly; const sign=area(footprint)>0?1:-1;
    for(let k=0;k<footprint.length;k++) {
      const a=footprint[k],q=footprint[(k+1)%footprint.length];
      const side=(p:P)=>sign*((q[0]-a[0])*(p[1]-a[1])-(q[1]-a[1])*(p[0]-a[0]));
      const input=out;out=[];
      for(let i=0;i<input.length;i++){const p=input[i],r=input[(i+1)%input.length],sp=side(p),sr=side(r);if(sp>=-1e-8)out.push(p);if((sp>=0)!==(sr>=0)){const t=sp/(sp-sr);out.push([p[0]+t*(r[0]-p[0]),p[1]+t*(r[1]-p[1])]);}}
    } return out;
  }
  for(const zone of survey.zones) {
    const samples=zone.ring.map(p=>[...local(p),p[2]-survey.groundNap]);
    const cx=samples.reduce((n,p)=>n+p[0],0)/samples.length,cz=samples.reduce((n,p)=>n+p[1],0)/samples.length,cy=samples.reduce((n,p)=>n+p[2],0)/samples.length;
    let xx=0,zz=0,xz=0,xy=0,zy=0;for(const p of samples){const x=p[0]-cx,z=p[1]-cz,y=p[2]-cy;xx+=x*x;zz+=z*z;xz+=x*z;xy+=x*y;zy+=z*y;}
    const det=xx*zz-xz*xz;if(Math.abs(det)<1e-7)throw new Error('Degenerate roof plane');
    const sx=(xy*zz-zy*xz)/det,sz=(zy*xx-xy*xz)/det,height=([x,z]:P)=>cy+sx*(x-cx)+sz*(z-cz);
    const poly=clip(samples.map(p=>[p[0],p[1]] as P));if(poly.length<3)continue;
    const shape=new T.Shape(poly.map(p=>new T.Vector2(...p))),bottom=Math.min(...poly.map(height));
    b.add(openTopPrism(shape,0,bottom),'brick');
    // Explicit plane owns the whole top, with perimeter skirts down to the shell.
    const roof=upwardRoofPlane(shape);const pos=roof.getAttribute('position');for(let i=0;i<pos.count;i++)pos.setY(i,height([pos.getX(i),pos.getZ(i)]));roof.computeVertexNormals();b.add(roof,'slate');
    const verts:number[]=[];for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],py=height(p),qy=height(q);verts.push(p[0],bottom,p[1],q[0],bottom,q[1],q[0],qy,q[1],p[0],bottom,p[1],q[0],qy,q[1],p[0],py,p[1]);}
    if(area(poly)>0)for(let i=0;i<verts.length;i+=9){for(let j=0;j<3;j++){const t=verts[i+3+j];verts[i+3+j]=verts[i+6+j];verts[i+6+j]=t;}}
    const skirt=new T.BufferGeometry();skirt.setAttribute('position',new T.Float32BufferAttribute(verts,3));skirt.computeVertexNormals();b.add(skirt,'brick');
  }
  // Exact canal-facing survey edge: east to west. Outward is toward the canal.
  const a=local(survey.footprint.coordinates[0][1]),q=local(survey.footprint.coordinates[0][3]),length=Math.hypot(q[0]-a[0],q[1]-a[1]);
  const ux=(q[0]-a[0])/length,uz=(q[1]-a[1])/length,nx=-uz,nz=ux,angle=-Math.atan2(uz,ux);
  function box(u:number,y:number,width:number,height:number,depth:number,colour:Colour,offset=.1){const g=new T.BoxGeometry(width,height,depth);g.rotateY(angle);g.translate(a[0]+ux*u+nx*offset,y+height/2,a[1]+uz*u+nz*offset);b.add(g,colour);}
  function window(u:number,y:number,width:number,height:number){box(u,y-.1,width+.2,height+.2,.12,'stone');box(u,y,width,height,.12,'glass',.2);box(u,y+height*.73,width,.075,.08,'white',.28);for(const s of[-1,1])box(u+s*width/2,y,.075,height,.08,'white',.28);box(u,y,width,.075,.08,'white',.28);}
  // Grey recessed modern bay occupies eastern approx42%; the two-window brick
  // bay carries real arched portals and surviving Vriendenkring tile panel.
  const grayWidth=length*.42,brickWidth=length-grayWidth,bc=grayWidth+brickWidth/2;
  box(grayWidth/2,0,grayWidth,15.5,.14,'stone',.12);
  for(const y of[4.6,7.9,11.2,14.4]){box(grayWidth/2,y,grayWidth*.68,2.45,.1,'dark',.21);window(grayWidth/2,y+.1,grayWidth*.5,2.2);box(grayWidth/2,y+.05,grayWidth*.67,.07,.08,'frame',.42);box(grayWidth/2,y+.65,grayWidth*.67,.07,.08,'frame',.42);for(let u=grayWidth*.18;u<grayWidth*.84;u+=.36)box(u,y+.05,.035,.64,.06,'frame',.42);box(grayWidth/2,y-.3,grayWidth,.23,.16,'stone',.3);}
  window(grayWidth/2,.3,grayWidth*.68,3.6);
  for(const y of[4.7,8.05,11.4])for(const u of[bc-brickWidth*.24,bc+brickWidth*.24])window(u,y,brickWidth*.3,2.5);
  // Two dark roof-level dormer apertures, observed2025; exact joinery approximate.
  for(const u of[bc-brickWidth*.23,bc+brickWidth*.23]){box(u,15.1,brickWidth*.38,2.75,.18,'slate',.15);window(u,15.3,brickWidth*.27,2.35);}
  box(bc,14.6,brickWidth,.25,.3,'stone',.28);box(bc,3.75,brickWidth*.83,.42,.12,'stone',.22);box(bc,3.83,brickWidth*.79,.26,.1,'dark',.3);
  // Recessed arched openings: observed broad hall portal and narrower right door.
  function arch(u:number,width:number,spring:number){box(u,0,width,spring,.12,'dark',.24);const shape=new T.Shape();shape.moveTo(-width/2,0);shape.absellipse(0,0,width/2,width*.19,Math.PI,0,true,0);shape.lineTo(width/2,0);shape.closePath();const g=new T.ShapeGeometry(shape);g.rotateY(angle);g.translate(a[0]+ux*u+nx*.25,spring,a[1]+uz*u+nz*.25);b.add(g,'dark');}
  arch(bc-brickWidth*.11,brickWidth*.56,2.55);arch(bc+brickWidth*.36,brickWidth*.18,2.65);
  for(const y of[.95,1.9])box(bc-brickWidth*.11,y,brickWidth*.54,.075,.08,'white',.32);
  // Source-supported surviving tile sign, outline geometry from licensed OFL
  // Cormorant Unicase Medium. Approximate historic serif letter family, fitted
  // inside the observed panel; exact tile typeface remains unknown.
  const letters=new T.ShapePath();
  for(const command of lettering.commands){const c=command as {type:string,x?:number,y?:number,x1?:number,y1?:number,x2?:number,y2?:number};
    if(c.type==='M')letters.moveTo(c.x!,-c.y!);else if(c.type==='L')letters.lineTo(c.x!,-c.y!);
    else if(c.type==='Q')letters.quadraticCurveTo(c.x1!,-c.y1!,c.x!,-c.y!);
    else if(c.type==='C')letters.bezierCurveTo(c.x1!,-c.y1!,c.x2!,-c.y2!,c.x!,-c.y!);
    else if(c.type==='Z')letters.currentPath!.closePath();
  }
  const letterGeometry=new T.ShapeGeometry(letters.toShapes(false),5);letterGeometry.computeBoundingBox();const bound=letterGeometry.boundingBox!;
  const size=bound.getSize(new T.Vector3());letterGeometry.translate(-(bound.min.x+bound.max.x)/2,-bound.min.y,0);
  letterGeometry.scale(brickWidth*.75/size.x,.215/size.y,1);letterGeometry.rotateY(angle);
  letterGeometry.translate(a[0]+ux*bc+nx*.37,3.865,a[1]+uz*bc+nz*.37);b.add(letterGeometry,'gold');
}
