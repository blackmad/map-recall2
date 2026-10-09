import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism,upwardRoofPlane} from './house-geometry';
import source from './collectie-six-footprints.json';
import {reconcileCollectieSixBoundary} from './collectie-six-boundary';
/** Original Amstel218 exterior. Native source planes own roofs; no wall-colored roof cap. */
export function buildCollectieSix(_w:number,_d:number,b:BuildingTools){
 const {add}=b;
 // Roof families and stepped rear masses come from explicit dated survey surfaces,
 // never from one equipment maximum extruded over the whole property.
 for(const s of reconcileCollectieSixBoundary(source.surfaces,source.bagPolygons)){
  if(s.type==='GroundSurface')continue;
  const ring=s.rings[0].map(p=>new T.Vector3(...p as [number,number,number]));
  let normal=new T.Vector3();for(let i=1;i<ring.length-1;i++){normal=ring[i].clone().sub(ring[0]).cross(ring[i+1].clone().sub(ring[0]));if(normal.lengthSq()>1e-10)break;}
  const axis=s.type==='RoofSurface'?1:Math.abs(normal.x)>Math.abs(normal.z)?0:2;
  const flat=(p:number[])=>axis===1?new T.Vector2(p[0],p[2]):axis===0?new T.Vector2(p[2],p[1]):new T.Vector2(p[0],p[1]);
  const points=s.rings.flat(),triangles=T.ShapeUtils.triangulateShape(s.rings[0].map(flat),s.rings.slice(1).map(r=>r.map(flat))),positions:number[]=[];
  for(const tri of triangles){const p=tri.map(i=>new T.Vector3(...points[i] as [number,number,number]));const n=p[1].clone().sub(p[0]).cross(p[2].clone().sub(p[0]));if(n.lengthSq()<1e-12)continue;if(s.type==='RoofSurface'&&n.y<0)[p[1],p[2]]=[p[2],p[1]];positions.push(...p.flatMap(v=>v.toArray()));}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.computeVertexNormals();
  const top=Math.max(...points.map(p=>p[1])),chimney=top>21.5;
  add(geo,chimney?'stone':s.type==='RoofSurface'?'slate':'brick');
 }
 const nativeShape=new T.Shape(source.bagPolygons[0].slice(0,-1).map(p=>new T.Vector2(p[0],p[1])));
 for(const h of source.bagPolygons.slice(1))nativeShape.holes.push(new T.Path(h.slice(0,-1).map(p=>new T.Vector2(p[0],p[1]))));
 add(openTopPrism(nativeShape,0,.08),'stone');
 // Principal surveyed public Amstel frontage runs BAG vertex18→3, towards north.
 const a=source.bagPolygons[0][18],c=source.bagPolygons[0][3],length=Math.hypot(c[0]-a[0],c[1]-a[1]),ux=(c[0]-a[0])/length,uz=(c[1]-a[1])/length,nx=-uz,nz=ux,angle=Math.atan2(nx,nz),cx=(a[0]+c[0])/2,cz=(a[1]+c[1])/2;
 const pos=(x:number,y:number,d:number)=>[cx+ux*x+nx*d,y,cz+uz*x+nz*d] as const;
 const box=(x:number,y:number,d:number,w:number,h:number,depth:number,color:Parameters<typeof add>[1])=>{const p=pos(x,y+h/2,d);add(new T.BoxGeometry(w,h,depth),color,...p,angle);};
 const plane=(x:number,y:number,d:number,w:number,h:number,color:Parameters<typeof add>[1])=>add(new T.PlaneGeometry(w,h),color,...pos(x,y+h/2,d),angle);
 const pane=(x:number,y:number,w:number,h:number,split:boolean=true)=>{plane(x,y,.14,w,h,'glass');for(const u of [-w/2-.07,w/2+.07])box(x+u,y-.08,.18,.11,h+.16,.12,'white');for(const v of [-.08,h+.04])box(x,y+v,.18,w+.25,.11,.12,'white');for(const u of [-w/2,w/2])box(x+u,y,.19,.085,h,.11,'dark');for(const v of [0,h])box(x,y+v-.04,.19,w+.06,.085,.11,'dark');for(const fraction of h>2?[.25,.50,.74]:[.58])box(x,y+h*fraction,.20,w,.055,.11,'dark');if(split)box(x,y,.20,.065,h,.11,'dark');box(x,y-.10,.19,w+.18,.12,.31,'stone');};
 const bays=[-5.82,-2.91,0,2.91,5.82];
 for(const x of bays){if(x!==0)pane(x,3.38,1.85,3.27);pane(x,8.0,x===0?1.96:1.82,3.22);pane(x,12.9,1.63,1.34,true);}
 // Pale ground basement ashlar and the continuous source-supported cornice.
 box(0,.08,.035,length,2.02,.14,'stone');for(const x of [-5.82,-2.91,2.91,5.82]){pane(x,.48,1.25,1.16,false);for(const z of [-.34,0,.34])box(x+z,.49,.26,.025,1.12,.04,'dark');}
 for(const [y,h,depth]of [[2.18,.14,.32],[14.68,.14,.33],[14.91,.22,.42],[15.15,.15,.59]])box(0,y,.14,length+.16,h,depth,'white');
 for(let x=-length/2+.3;x<length/2;x+=.67)box(x,14.62,.15,.17,.24,.39,'white');
 // Original central door, rounded fanlight, raised landing and two opposed stoops.
 box(0,3.38,.135,1.84,2.71,.10,'dark');for(const x of [-.45,.45]){box(x,3.60,.23,.74,1.31,.035,'dark');box(x,5.09,.23,.74,.68,.035,'dark');}box(0,3.35,.245,.045,2.78,.05,'dark');
 const fan=new T.Shape();fan.moveTo(-.95,0);fan.absellipse(0,0,.95,.58,Math.PI,0,true,0);fan.lineTo(-.95,0);add(new T.ShapeGeometry(fan),'glass',...pos(0,6.14,.16),angle);
 const arc=new T.TorusGeometry(1,.105,4,24,Math.PI);arc.scale(1,.61,1);add(arc,'stone',...pos(0,6.16,.24),angle);
 for(const x of [-1.16,1.16])box(x,3.18,.20,.22,3.04,.34,'white');box(0,6.1,.19,2.45,.18,.43,'white');
 for(const [y,w]of [[6.92,2.68],[7.16,2.3]])box(0,y,.20,w,.12,.46,'white');
 for(const y of [6.98,11.65]){for(const x of [-.97,.97]){add(new T.TorusGeometry(.19,.075,4,12),'white',...pos(x,y,.30),angle);add(new T.IcosahedronGeometry(.12,0),'white',...pos(x*.85,y+.18,.31));}add(new T.IcosahedronGeometry(.18,0),'white',...pos(0,y+.23,.31));}
 for(const x of [-1.13,1.13])box(x,7.83,.17,.19,3.47,.29,'white');box(0,11.38,.16,2.55,.16,.39,'white');
 // Eight bottle-shaped stone balusters; real monumental stoop is not a nameplate.
 box(0,2.90,.86,4.50,.23,1.82,'stone');
 for(const side of [-1,1]){for(let i=0;i<10;i++){const x=side*(2.30+i*.30),height=(10-i)*.30;box(x,0,.80,.36,height,1.68,'stone');}
  for(let i=0;i<4;i++){const x=side*(.60+i*.49),profile=[new T.Vector2(.065,0),new T.Vector2(.10,.10),new T.Vector2(.075,.27),new T.Vector2(.14,.44),new T.Vector2(.085,.63),new T.Vector2(.07,.83)];add(new T.LatheGeometry(profile,8),'dark',...pos(x,3.13,1.52));}
  box(side*1.17,3.92,1.52,2.34,.075,.09,'dark');
  const railA=new T.Vector3(...pos(side*2.27,3.94,1.52)),railB=new T.Vector3(...pos(side*5.13,1.10,1.52)),vector=railB.clone().sub(railA),rail=new T.CylinderGeometry(.032,.032,vector.length(),8);rail.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),vector.clone().normalize()));rail.translate(...railA.clone().add(railB).multiplyScalar(.5).toArray());add(rail,'dark');
  box(side*5.13,.12,1.52,.075,.96,.075,'dark');}
 // Current2024/2025 front dormers are level-capped, over second/fourth bays.
 // Metricheight is approximate near sourcefitted17.92m; the fitted slope is not a photographed cap.
 for(const x of [-2.91,2.91]){
  const outline=new T.Shape([new T.Vector2(-1.04,-1.72),new T.Vector2(1.04,-1.72),new T.Vector2(1.04,.04),new T.Vector2(-1.04,.04)]);
  add(openTopPrism(outline,15.18,17.92),'white',...pos(x,0,0),angle);
  add(upwardRoofPlane(outline,17.95),'slate',...pos(x,0,0),angle);
  plane(x,15.62,.14,1.50,1.62,'glass');
  for(const u of [-.75,.75])box(x+u,15.56,.21,.09,1.78,.13,'dark');
  box(x,15.56,.21,1.58,.09,.13,'dark');box(x,17.27,.21,1.58,.09,.13,'dark');box(x,15.62,.22,.07,1.62,.10,'dark');
  box(x,17.40,-.84,2.18,.15,1.82,'white');
  box(x,17.82,-.84,2.20,.10,1.91,'white');
 }
 box(0,.08,.20,1.45,1.91,.12,'dark');plane(0,.55,.285,1.15,1.02,'glass');
}
