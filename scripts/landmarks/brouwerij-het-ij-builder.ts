import * as T from 'three';
import {readFileSync} from 'node:fs';
import opentype from 'opentype.js';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism,upwardRoofPlane} from './house-geometry';
import data from './brouwerij-het-ij-footprints.json';
type Colour=Parameters<BuildingTools['add']>[1];
/** Original surveyed bathhouse, texture-free. Public historical SketchUp is a
 * visual reference only: no imported vertices, textures, or copied photo pixels. */
export function buildBrouwerijHetIj(_w:number,_d:number,{add}:BuildingTools){
 const outline=data.outline[0].slice(0,-1).map(p=>new T.Vector2(p[0],p[1])),footprint=new T.Shape(outline);
 const A=outline[12],B=outline[13],t=B.clone().sub(A).normalize(),n=new T.Vector2(-t.y,t.x),length=A.distanceTo(B),yaw=Math.atan2(-t.y,t.x);
 const at=(u:number,v:number)=>A.clone().addScaledVector(t,u).addScaledVector(n,v);
 const named=(g:T.BufferGeometry,assembly:string,c:Colour)=>{g.userData.assembly=assembly;add(g,c)};
 const panel=(u:number,width:number,y:number,h:number,v:number,c:Colour,assembly:string)=>{const p=at(u,v),g=new T.PlaneGeometry(width,h);g.rotateY(yaw);g.translate(p.x,y+h/2,p.y);named(g,assembly,c)};
 const rect=(u:number,width:number,depth:number)=>new T.Shape([at(u,0),at(u+width,0),at(u+width,-depth),at(u,-depth)]);
 // Open-top exact parent shell; low-wing roof only covers low parts, preserving
 // the terrace/notches and the independent mill outside the parent footprint.
 named(openTopPrism(footprint,0,3.94),'native-low-bathhouse-shell','brick');
 named(upwardRoofPlane(footprint,3.96),'native-low-wing-roof','slate');
 for(const r of data.surveyRoofRegions.filter(r=>r.index===83||r.index===79)){
  const shape=new T.Shape(r.rings[0].map(p=>new T.Vector2(p[0],p[2])));
  const y=r.index===89?3.96:r.index===83?4.42:6.16;
  if(r.index!==89)named(openTopPrism(shape,3.94,y),`minor-survey-shell-${r.index}`,'brick');
  named(upwardRoofPlane(shape,y),`minor-roof-${r.index}`,'slate');
 }
 // The main bathhouse strip has two small pitched end pavilions, never a
 // whole-parent18.2m extrusion. Middle roof sits below its sign/parapet.
 const main=rect(0,length,5.12);
 named(openTopPrism(main,3.94,7.55),'principal-upper-shell','brick');
 named(upwardRoofPlane(main,7.55),'principal-central-roof','slate');
 const pw=3.45,depth=5.12;
 for(const u of[0,length-pw]){
  const s=rect(u,pw,depth);named(openTopPrism(s,7.55,8.67),'pavilion-wall','brick');
  // Explicit pyramid surfaces own every top; no overlapping pale wall cap.
  const corners=[at(u-.13,.13),at(u+pw+.13,.13),at(u+pw+.13,-depth-.13),at(u-.13,-depth-.13)],peak=at(u+pw/2,-depth/2),positions:number[]=[];
  for(let i=0;i<4;i++){const a=corners[i],b=corners[(i+1)%4];positions.push(a.x,8.72,a.y,b.x,8.72,b.y,peak.x,10.51,peak.y)}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  const p=g.getAttribute('position');for(let i=0;i<p.count;i+=3){const a=new T.Vector3().fromBufferAttribute(p,i),b=new T.Vector3().fromBufferAttribute(p,i+1),c=new T.Vector3().fromBufferAttribute(p,i+2);if(b.sub(a).cross(c.sub(a)).y<0){const x=[p.getX(i+1),p.getY(i+1),p.getZ(i+1)];p.setXYZ(i+1,p.getX(i+2),p.getY(i+2),p.getZ(i+2));p.setXYZ(i+2,...x as [number,number,number]);}}g.computeVertexNormals();named(g,'pavilion-pitched-roof','slate');
  // Deep pale cornices and the source-supported small corbels.
  for(let side=0;side<4;side++){const a=corners[side],b=corners[(side+1)%4],d=b.clone().sub(a),mid=a.clone().add(b).multiplyScalar(.5),angle=Math.atan2(-d.y,d.x),g=new T.BoxGeometry(d.length(),.19,.25);g.rotateY(angle);g.translate(mid.x,8.64,mid.y);named(g,'pavilion-cornice','white');
   for(let f=.13;f<.95;f+=.22){const p=a.clone().lerp(b,f),br=new T.BoxGeometry(.12,.24,.27);br.rotateY(angle);br.translate(p.x,8.41,p.y);named(br,'cornice-corbel','white');}
  }
  const finial=new T.CylinderGeometry(.055,.09,.53,8);finial.translate(peak.x,10.76,peak.y);named(finial,'pavilion-finial','white');const tip=new T.SphereGeometry(.07,8,5);tip.translate(peak.x,11.05,peak.y);named(tip,'pavilion-finial','white');
 }
 // Source roof86 gives the actual dark stepped 2006 upper annex and its
 // boundary. Its shallow roof is separate from the original brick bathhouse.
 const wing=data.surveyRoofRegions.find(r=>r.index===86)!;
 const wingShape=new T.Shape(wing.rings[0].map(p=>new T.Vector2(p[0],p[2])));
 named(openTopPrism(wingShape,3.94,7.06),'dark-upper-annex-shell','dark');
 named(upwardRoofPlane(wingShape,7.08),'dark-upper-annex-roof','slate');
 const total=length+B.distanceTo(outline[15]);
 for(let y=4.08;y<7.02;y+=.22)panel((length+total)/2,total-length,y,.035,.036,'slate','annex-horizontal-cladding');
 // Nine individual pale stone surrounds with black-green frames, plus one
 // upper transom each; count and rhythm are directly visible in current photo.
 const centers=[.8,2.15,3.7,5.03,6.36,7.69,9.02,10.55,11.9];
 for(const u of centers){
  panel(u,1.08,4.68,2.53,.055,'stone','upper-window-surround');
  panel(u,.93,4.79,2.32,.071,'bronze','upper-window-frame');
  panel(u,.79,4.87,2.16,.082,'glass','upper-window-glass');
  panel(u,.93,6.22,.075,.097,'bronze','upper-window-transom');
  panel(u,1.17,4.59,.11,.14,'stone','upper-window-sill');
 }
 // Five pale-framed lights in the dark street-side upper ribbon.
 panel(length+4.4,4.65,5.15,1.15,.077,'stone','annex-ribbon-surround');
 panel(length+4.4,4.44,5.24,.97,.089,'glass','annex-ribbon-glass');
 for(let i=1;i<5;i++)panel(length+2.075+i*.93,.075,5.24,.97,.11,'white','annex-ribbon-mullion');
 // Parapet tile band, current red real sign, and smooth heavy sans letters.
 // The exact lettering face is unknown; Archivo Black approximates its weight
 // and proportions. Do not call the project's generic pixel sign primitive.
 panel(length/2,length-2*pw,7.55,.84,.01,'brick','central-parapet');
 panel(length/2,length-2*pw+.08,7.61,.74,.07,'copper','sign-tile-fascia');
 panel(length/2,length-2*pw-.32,7.69,.58,.085,'red','real-sign-panel');
 for(let u=pw+.06;u<length-pw-.04;u+=.29){panel(u,.095,7.61,.075,.09,'dark','fascia-tile-border');panel(u+.09,.095,8.285,.065,.09,'dark','fascia-tile-border');}
 const bytes=readFileSync(new URL('../../public/canal-drive/fonts/ArchivoBlack-Regular.ttf',import.meta.url)),font=opentype.parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)),path=font.getPath("Brouwerij ’t IJ",0,0,100,{kerning:true}),sp=new T.ShapePath();
 for(const c of path.commands){if(c.type==='M')sp.moveTo(c.x,-c.y);else if(c.type==='L')sp.lineTo(c.x,-c.y);else if(c.type==='Q')sp.quadraticCurveTo(c.x1,-c.y1,c.x,-c.y);else if(c.type==='C')sp.bezierCurveTo(c.x1,-c.y1,c.x2,-c.y2,c.x,-c.y);else if(c.type==='Z')sp.currentPath?.closePath();}
 const text=new T.ShapeGeometry(sp.toShapes(),6);text.computeBoundingBox();const bb=text.boundingBox!,size=bb.getSize(new T.Vector3()),scale=(length-2*pw-.32)*.63/size.x;text.translate(-(bb.min.x+bb.max.x)/2,-bb.min.y,0);text.scale(scale,scale,1);text.rotateY(yaw);const sign=at(length/2,.104);text.translate(sign.x,7.69+.58/2-size.y*scale/2,sign.y);text.userData.fontApproximation='Archivo Black';named(text,'source-supported-real-sign-lettering','white');
 // Current ground tier is largely shaded by the awning. The visible dark-green
 // utility door, glazed paired doors and side lights are retained without
 // claiming exact current arch profiles hidden by fabric and visitors.
 panel(.75,1.01,.1,3.2,.055,'stone','left-utility-door-surround');panel(.75,.86,.15,3.08,.073,'bronze','left-utility-door');panel(.75,.71,2.05,.95,.085,'glass','left-utility-door-toplight');panel(.75,.71,1.99,.055,.098,'white','door-transom');
 for(const [u,w,door]of[[2.5,1.1,false],[4.15,1.35,true],[5.85,1.1,false],[7.45,1.35,true],[9.1,1.1,false],[10.75,1.35,true],[12.45,1.1,false],[14.05,1.1,false],[15.7,1.35,true],[17.35,1.1,false],[19.05,1.1,false],[20.55,.7,false]] as [number,number,boolean][]){
  panel(u,w,.18,2.94,.063,'bronze','ground-opening-frame');panel(u,w-.14,.29,2.73,.086,'glass',door?'ground-door-glass':'ground-window-glass');
  if(door)panel(u,.075,.29,2.73,.112,'bronze','double-door-mullion');
  if(!door)panel(u,w-.13,.22,.65,.105,'bronze','ground-window-spandrel');
 }
 // Awning is open below: an original inclined fabric sheet, thin valance and
 // struts only. It cannot occlude whole terrace with a opaque parcel extrusion.
 const a=at(1.5,.09),b=at(total-.06,.09),c=at(total-.06,2.13),d=at(1.5,2.13),ag=new T.BufferGeometry();ag.setAttribute('position',new T.Float32BufferAttribute([a.x,3.66,a.y,b.x,3.66,b.y,c.x,2.97,c.y,a.x,3.66,a.y,c.x,2.97,c.y,d.x,2.97,d.y],3));ag.computeVertexNormals();named(ag,'principal-pale-fabric-awning','white');panel((1.5+total-.06)/2,total-1.56,2.72,.25,2.13,'red','awning-orange-red-valance');
 // Side and rear details attach to the actual source boundary; no floating
 // fixed-axis panes on diagonal walls and no windows on mill-neighbor mesh.
 function side(a:T.Vector2,b:T.Vector2,upper:boolean){const tang=b.clone().sub(a).normalize(),normal=new T.Vector2(-tang.y,tang.x),len=a.distanceTo(b),angle=Math.atan2(-tang.y,tang.x);const f=(u:number,w:number,y:number,h:number,c:Colour,offset:number,assembly:string)=>{const p=a.clone().addScaledVector(tang,u).addScaledVector(normal,offset),g=new T.PlaneGeometry(w,h);g.rotateY(angle);g.translate(p.x,y+h/2,p.y);named(g,assembly,c)};
  if(upper){for(let y=4.1;y<7;y+=.22)f(len/2,len,y,.03,'slate',.04,'annex-side-cladding');f(len/2,Math.min(4.5,len-1),5.1,1.12,'stone',.065,'annex-side-window-border');f(len/2,Math.min(4.3,len-1.2),5.2,.92,'glass',.082,'annex-side-window-glass');for(let u=len/2-1.35;u<len/2+1.7;u+=.9)f(u,.07,5.2,.92,'white',.098,'annex-side-window-mullion');}
  else{for(let u=1.4;u<len-.8;u+=2.4){f(u,1.34,.25,2.65,'bronze',.055,'low-wing-door-frame');f(u,1.16,.42,2.32,'glass',.072,'low-wing-door-glass');f(u,.07,.42,2.32,'bronze',.09,'low-wing-door-mullion');}}
 }
 const wingEdgeA=new T.Vector2(wing.rings[0][8][0],wing.rings[0][8][2]),wingEdgeB=new T.Vector2(wing.rings[0][9][0],wing.rings[0][9][2]);
 side(wingEdgeA,wingEdgeB,true);side(outline[1],outline[2],false);side(outline[7],outline[8],false);
 // Northwest terrace entrance occupies an actual stepped boundary segment.
 // Three source-photographed green glazed portals, including paired leaves.
 const ea=outline[3],eb=outline[5],et=eb.clone().sub(ea).normalize(),en=new T.Vector2(-et.y,et.x),el=ea.distanceTo(eb),eyaw=Math.atan2(-et.y,et.x);
 const eAt=(u:number,v:number)=>ea.clone().addScaledVector(et,u).addScaledVector(en,v);
 const ep=(u:number,w:number,y:number,h:number,c:Colour,v:number,assembly:string)=>{const p=eAt(u,v),g=new T.PlaneGeometry(w,h);g.rotateY(eyaw);g.translate(p.x,y+h/2,p.y);named(g,assembly,c)};
 for(let i=0;i<3;i++){const u=el*(i+.5)/3,w=el/3-.13;ep(u,w,.12,2.87,'stone',.055,'terrace-door-surround');ep(u,w-.13,.22,2.67,'bronze',.071,'terrace-green-door-frame');ep(u,w-.25,.92,1.91,'glass',.085,'terrace-door-glass');ep(u,w-.16,2.48,.07,'bronze',.11,'terrace-door-transom');if(i<2)ep(u,.055,.25,2.55,'bronze',.112,'terrace-paired-leaf-mullion');}
 const ac=[eAt(.08,.05),eAt(el-.08,.05),eAt(el-.08,1.7),eAt(.08,1.7)],cg=new T.BufferGeometry();cg.setAttribute('position',new T.Float32BufferAttribute([ac[0].x,3.53,ac[0].y,ac[1].x,3.53,ac[1].y,ac[2].x,2.94,ac[2].y,ac[0].x,3.53,ac[0].y,ac[2].x,2.94,ac[2].y,ac[3].x,2.94,ac[3].y],3));cg.computeVertexNormals();named(cg,'terrace-pale-fabric-awning','white');ep(el/2,el-.16,2.72,.22,'red',1.7,'terrace-orange-red-valance');
 // Left end is a real plain gabled brick profile behind the hip roof, not
 // another mill. Restrained first-hit side window/door assemblies.
 const leftA=at(0,-5.12),leftB=at(0,0);side(leftA,leftB,false);
}
