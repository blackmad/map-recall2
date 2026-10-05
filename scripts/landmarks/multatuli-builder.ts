import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism} from './house-geometry';
import source from './multatuli-footprints.json';
type Colour=Parameters<BuildingTools['add']>[1];
/** Original native-scale house. RCE3133's bell gable is confirmed by 2022 photos;
 * AHN5 determines coherent roof zones, never rendered as fragmented scan geometry. */
export function buildMultatuli(_width:number,_depth:number,b:BuildingTools){
 const {add,box}=b,ring=source.localRing.map(p=>new T.Vector2(p[0],p[1]));
 const F=source.frontZ,cx=source.facadeCenterX,W=source.facadeWidth;
 const clip=(p:T.Vector2[],value:number,axis:'x'|'y',less:boolean)=>{const out:T.Vector2[]=[];for(let i=0;i<p.length;i++){const a=p[i],c=p[(i+1)%p.length],inside=less?a[axis]<=value:a[axis]>=value,other=less?c[axis]<=value:c[axis]>=value;if(inside)out.push(a.clone());if(inside!==other)out.push(a.clone().lerp(c,(value-a[axis])/(c[axis]-a[axis])));}return out;};
 const surface=(p:T.Vector2[],height:(p:T.Vector2)=>number,colour:Colour)=>{const values:number[]=[];for(const ids of T.ShapeUtils.triangulateShape(p,[])){const ps=ids.map(i=>new T.Vector3(p[i].x,height(p[i]),p[i].y));const normal=ps[1].clone().sub(ps[0]).cross(ps[2].clone().sub(ps[0]));if(normal.lengthSq()<1e-12)continue;if(normal.y<0)[ps[1],ps[2]]=[ps[2],ps[1]];for(const q of ps)values.push(q.x,q.y,q.z);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(values,3));g.computeVertexNormals();g.userData.roofSurface=true;add(g,colour);};
 const shell=(p:T.Vector2[],top:number)=>add(openTopPrism(new T.Shape(p),0,top),'greyBrick');
 const main=clip(ring,-3.75,'y',false),rear=clip(ring,-3.75,'y',true);
 shell(main,9.3);
 // Two dominant surveyed roof planes, continuous clipped ridge. Low rear returns
 // are visibly separate; no fabricated roof-height wall over the entire parcel.
 const ridgeX=-.04;
 const roofHeight=(p:T.Vector2)=>13.73-3.75*Math.abs(p.x-ridgeX)/(p.x<ridgeX?2.26:2.62);
 for(const left of [true,false])surface(clip(main,ridgeX,'x',left),roofHeight,'red');
 // Follow every actual sloping perimeter: side walls meet the roof even where
 // the native Pand tapers. No unsupported eave gaps or wall-colored roof caps.
 const walls:number[]=[];
 for(let i=0;i<main.length;i++){
  const a=main[i],c=main[(i+1)%main.length],points=[a];
  if((a.x-ridgeX)*(c.x-ridgeX)<0)points.push(a.clone().lerp(c,(ridgeX-a.x)/(c.x-a.x)));
  points.push(c);
  for(let j=0;j<points.length-1;j++){
   const p=points[j],q=points[j+1],A=[p.x,9.3,p.y],B=[q.x,9.3,q.y],C=[q.x,roofHeight(q),q.y],D=[p.x,roofHeight(p),p.y];
   walls.push(...A,...B,...C,...A,...C,...D);
  }
 }
 const wg=new T.BufferGeometry();wg.setAttribute('position',new T.Float32BufferAttribute(walls,3));wg.computeVertexNormals();add(wg,'greyBrick');
 for(const left of [true,false]){const part=clip(rear,ridgeX,'x',left),height=left?5.5:4.0;shell(part,height);surface(part,p=>height+.05+(p.y+5.9)*.045,'slate');}
 // Main brick bell facade: shoulders curl inward to a broad rounded crown.
 // The facade owns its thin front volume, above the side-wall eave.
 const L=cx-W/2,R=cx+W/2,top=14.12;
 const gable=new T.Shape();gable.moveTo(L,9.90);gable.lineTo(R,9.90);gable.lineTo(R,10.89);gable.lineTo(R-.11,11.1);gable.bezierCurveTo(R-1.0,11.08,cx+1.0,12.0,cx+.81,13.6);gable.lineTo(cx+.81,13.91);gable.lineTo(cx+.57,13.91);gable.quadraticCurveTo(cx,14.38,cx-.57,13.91);gable.lineTo(cx-.81,13.91);gable.lineTo(cx-.81,13.6);gable.bezierCurveTo(cx-1.0,12.0,L+1.0,11.08,L+.11,11.1);gable.lineTo(L,10.89);gable.closePath();
 const gg=new T.ExtrudeGeometry(gable,{depth:.22,bevelEnabled:false,curveSegments:14});add(gg,'greyBrick',0,0,F-.20);
 const segment=(a:T.Vector3,c:T.Vector3,width:number,colour:Colour)=>{const d=c.clone().sub(a),g=new T.CylinderGeometry(width/2,width/2,d.length(),6);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.normalize()));const m=a.clone().add(c).multiplyScalar(.5);add(g,colour,m.x,m.y,m.z);};
 // Continuous stone coping traces curved shoulders, rather than a stepped gable.
 const shoulders=[new T.CubicBezierCurve3(new T.Vector3(L+.11,11.12,F+.09),new T.Vector3(L+1,11.10,F+.09),new T.Vector3(cx-1,12.02,F+.09),new T.Vector3(cx-.81,13.62,F+.09)),new T.CubicBezierCurve3(new T.Vector3(R-.11,11.12,F+.09),new T.Vector3(R-1,11.10,F+.09),new T.Vector3(cx+1,12.02,F+.09),new T.Vector3(cx+.81,13.62,F+.09))];
 for(const curve of shoulders){const ps=curve.getPoints(16);for(let i=0;i<ps.length-1;i++)segment(ps[i],ps[i+1],.13,'stone');}
 for(const side of [-1,1]){box(cx+side*.70,13.83,F+.06,.28,.12,.25,'stone');box(cx+side*(W/2-.16),10.92,F+.07,.44,.16,.27,'stone');add(new T.TorusGeometry(.15,.045,5,16).scale(1,.65,1),'stone',cx+side*(W/2-.23),11.18,F+.12);}
 for(let i=0;i<14;i++){const a=i*Math.PI/14,c=(i+1)*Math.PI/14;segment(new T.Vector3(cx+.58*Math.cos(a),13.89+.24*Math.sin(a),F+.08),new T.Vector3(cx+.58*Math.cos(c),13.89+.24*Math.sin(c),F+.08),.12,'stone');}
 const pane=(x:number,y:number,z:number,w:number,h:number,cols=2,rows=2,angle=0,frame:Colour='white')=>{const nx=Math.sin(angle),nz=Math.cos(angle),tx=Math.cos(angle),tz=-Math.sin(angle);add(new T.PlaneGeometry(w+.18,h+.18),frame,x,y+h/2,z,angle);add(new T.PlaneGeometry(w,h),'glass',x+nx*.09,y+h/2,z+nz*.09,angle);for(let i=0;i<=cols;i++){const u=-w/2+i*w/cols;box(x+u*tx+nx*.13,y-.045,z+u*tz+nz*.13,.055,h+.09,.08,i===0||i===cols?frame:'dark',angle);}for(let i=0;i<=rows;i++)box(x+nx*.14,y-.03+i*h/rows,z+nz*.14,w+.08,.06,.08,i===0||i===rows?frame:'dark',angle);};
 // Exactly two tall front bays; exactly two short attic bays and one top opening.
 for(const x of [cx-1.07,cx+1.07]){pane(x,6.74,F+.06,1.57,2.57,3,3);box(x,6.58,F+.18,1.86,.12,.26,'white');box(x,9.39,F+.05,1.76,.13,.12,'brick');}
 for(const x of [cx-.55,cx+.55])pane(x,10.06,F+.065,.88,1.39,2,2);
 box(cx,9.93,F+.20,2.20,.12,.25,'white');pane(cx,12.22,F+.065,.85,.68,1,1);box(cx,12.11,F+.19,1.08,.10,.26,'white');
 // Real facade anchors: restrained black iron straps, not gratuitous wall text.
 for(const [x,y]of [[L+.23,7.35],[R-.23,7.35],[cx,9.50],[L+.34,10.2],[R-.34,10.2]]){box(x,y,F+.13,.08,.30,.09,'dark');box(x,y+.06,F+.15,.13,.045,.08,'dark');}
 // Cream timber pui contains four upper clerestories over door/display bays.
 box(cx,1.28,F+.12,W,.30,.18,'stone');
 const bays=[cx-1.65,cx-.55,cx+.55,cx+1.65];
 for(const x of bays){pane(x,4.29,F+.12,.90,1.65,1,1);}
 // Lower left two bays are matching dark doors, right two unlettered displays.
 for(let i=0;i<4;i++){const x=bays[i];if(i<2){box(x,1.70,F+.16,.88,2.13,.12,'dark');pane(x,2.36,F+.245,.62,1.10,1,1,0,'dark');for(const y of [1.86,2.10]){box(x,y,F+.25,.70,.07,.045,'stone');}box(x+.26,2.45,F+.30,.045,.26,.08,'gold');}else{pane(x,1.72,F+.18,.88,2.14,1,1);box(x,1.42,F+.24,1.02,.26,.20,'white');}box(x,3.99,F+.24,1.03,.19,.18,'white');
 for(let j=0;j<5;j++){const g=new T.ConeGeometry(.067,.07,4).rotateX(Math.PI/2).rotateZ(Math.PI/4);add(g,'stone',x-.34+j*.17,4.10,F+.30);}}
 for(let i=0;i<=4;i++){const x=cx-W/2+.11+i*(W-.22)/4;box(x,1.48,F+.24,.16,4.65,.19,'white');box(x,3.89,F+.28,.24,.16,.23,'white');box(x,5.98,F+.30,.29,.18,.31,'white');for(const u of [-.052,.052])box(x+u,4.32,F+.36,.025,1.51,.025,'stone');}
 for(const [y,h,d]of [[6.09,.16,.37],[6.25,.15,.48],[6.43,.11,.54]])box(cx,y,F+.18,W+.16,h,d,'white');
 // Small source-supported memorial cartouche: oval relief with scroll-like sides.
 // Fine original inscription omitted; never paint an invented museum-name label.
 add(new T.CircleGeometry(.22,20).scale(1.75,.64,1),'stone',cx,6.95,F+.16);add(new T.TorusGeometry(.22,.045,5,20).scale(1.75,.64,1),'white',cx,6.95,F+.19);
 for(const side of [-1,1]){add(new T.TorusGeometry(.11,.033,5,12).scale(.7,1,1),'stone',cx+side*.38,6.94,F+.19);add(new T.SphereGeometry(.056,6,4),'stone',cx+side*.38,7.12,F+.18);}box(cx,6.70,F+.13,.19,.08,.12,'stone');
 // Rectangular projecting wooden hoist beam follows actual wall normal.
 box(cx,13.72,F+.33,.21,.22,1.30,'white');box(cx,13.68,F+.95,.29,.08,.17,'stone');
 // Native frontage stoop: raised left door platform and side flight at right.
 box(cx-.67,0,F+.54,3.26,1.61,1.05,'stone');box(cx-.70,1.57,F+.60,3.40,.13,1.21,'stone');
 box(cx-.61,.15,F+1.085,1.10,1.22,.06,'dark');
 for(let i=0;i<6;i++){const z=F+.30+i*.32;box(cx+1.64,0,z,.65,1.58-i*.24,.34,'stone');}
 for(const x of [cx-2.1,cx-1.07,cx+.04,cx+.95]){box(x,1.68,F+1.04,.075,.91,.075,'dark');add(new T.SphereGeometry(.062,6,4),'dark',x,2.60,F+1.04);}
 for(const y of [1.99,2.55])box(cx-.57,y,F+1.04,3.08,.045,.045,'dark');
 segment(new T.Vector3(cx+.98,2.53,F+.37),new T.Vector3(cx+1.94,.87,F+2.08),.06,'dark');
 // Rear openings are an explicit restrained inference, kept below annex roofs.
 for(const x of [-1.37,1.05])pane(x,1.10,-5.94,.76,1.45,2,2,Math.PI);
}
