import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism} from './house-geometry';
import source from './kesbeke-footprints.json';
type Colour=Parameters<BuildingTools['add']>[1];
type V=readonly[number,number];
function shape(rings:number[][][]){const s=new T.Shape(rings[0].map(p=>new T.Vector2(p[0],p[2])));for(const ring of rings.slice(1))s.holes.push(new T.Path(ring.map(p=>new T.Vector2(p[0],p[2]))));return s;}
function roofPlane(rings:number[][][]){
 const pts=rings.flat(),mean=pts.reduce((s,p)=>s.map((v,i)=>v+p[i]),[0,0,0]).map(v=>v/pts.length);
 let xx=0,xz=0,zz=0,xy=0,zy=0;for(const p of pts){const x=p[0]-mean[0],z=p[2]-mean[2],y=p[1]-mean[1];xx+=x*x;xz+=x*z;zz+=z*z;xy+=x*y;zy+=z*y;}
 const det=xx*zz-xz*xz;if(det<1e-10)throw Error('Kesbeke degenerate roof');
 const a=(xy*zz-zy*xz)/det,c=(zy*xx-xy*xz)/det,height=(x:number,z:number)=>mean[1]+a*(x-mean[0])+c*(z-mean[2]);
 const residual=Math.max(...pts.map(p=>Math.abs(p[1]-height(p[0],p[2]))));if(residual>.015)throw Error(`Kesbeke nonplanar roof ${residual}`);return{height,residual};
}
function nativeEnvelope(part:typeof source.parts.factory,b:BuildingTools){
 for(const region of part.roofRegions){const s=shape(region.rings),{height,residual}=roofPlane(region.rings),base=Math.min(...region.rings.flat().map(p=>p[1]));
  const wall=openTopPrism(s,0,base);wall.userData={role:'native-shell',roofRegion:region.index};b.add(wall,'brick');
  const top=new T.ShapeGeometry(s),p=top.getAttribute('position');for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getY(i);p.setXYZ(i,x,height(x,z),z);}
  const ix=top.index!;for(let i=0;i<ix.count;i+=3){const a=new T.Vector3().fromBufferAttribute(p,ix.getX(i)),c=new T.Vector3().fromBufferAttribute(p,ix.getX(i+1)),d=new T.Vector3().fromBufferAttribute(p,ix.getX(i+2));if(c.sub(a).cross(d.sub(a)).y<0){const k=ix.getX(i+1);ix.setX(i+1,ix.getX(i+2));ix.setX(i+2,k);}}
  top.computeVertexNormals();top.userData={role:'survey-roof',roofRegion:region.index,residual};b.add(top,'slate');
  const values:number[]=[];for(const ring of region.rings)for(let i=0;i<ring.length;i++){const a=ring[i],c=ring[(i+1)%ring.length];values.push(a[0],base,a[2],c[0],base,c[2],c[0],height(c[0],c[2]),c[2],a[0],base,a[2],c[0],height(c[0],c[2]),c[2],a[0],height(a[0],a[2]),a[2]);}
  const skirt=new T.BufferGeometry();skirt.setAttribute('position',new T.Float32BufferAttribute(values,3));skirt.computeVertexNormals();skirt.userData.role='roof-step-closure';b.add(skirt,'brick');
 }
}
function facade(a:V,c:V,b:BuildingTools){const t=new T.Vector2(c[0]-a[0],c[1]-a[1]),length=t.length();t.normalize();const n=new T.Vector2(-t.y,t.x),mid=new T.Vector2((a[0]+c[0])/2,(a[1]+c[1])/2);
 function add(g:T.BufferGeometry,colour:Colour,x=0,y=0,z=.10){const p=g.getAttribute('position');for(let i=0;i<p.count;i++){const u=x+p.getX(i),v=z+p.getZ(i);p.setXYZ(i,mid.x+t.x*u+n.x*v,y+p.getY(i),mid.y+t.y*u+n.y*v);}g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();g.userData={role:'source-facade',normal:[n.x,n.y]};b.add(g,colour);}
 function box(x:number,y:number,w:number,h:number,colour:Colour,z=.1,d=.06){add(new T.BoxGeometry(w,h,d),colour,x,y+h/2,z);}
 function pane(x:number,y:number,w:number,h:number){box(x,y-.06,w+.13,h+.12,'white',.10,.07);box(x,y,w,h,'glass',.155,.055);box(x,y+h*.72,w,.045,'white',.192,.035);box(x,y-.11,w+.20,.085,'stone',.16,.16);}
 function word(x:number,y:number,w:number,vertical=false,key:keyof typeof source.signage.words='kesbeke',depth=.22,maxHeight=Infinity,surface:'raised'|'printed'='raised'){const path=new T.ShapePath();for(const command of source.signage.words[key].commands){const q=command as{type:string;x?:number;y?:number;x1?:number;y1?:number;x2?:number;y2?:number};const yy=(v:number)=>-v;
  if(q.type==='M')path.moveTo(q.x!,yy(q.y!));else if(q.type==='L')path.lineTo(q.x!,yy(q.y!));else if(q.type==='Q')path.quadraticCurveTo(q.x1!,yy(q.y1!),q.x!,yy(q.y!));else if(q.type==='C')path.bezierCurveTo(q.x1!,yy(q.y1!),q.x2!,yy(q.y2!),q.x!,yy(q.y!));else if(q.type==='Z')path.currentPath!.closePath();
 }const g=surface==='printed'?new T.ShapeGeometry(path.toShapes(),6):new T.ExtrudeGeometry(path.toShapes(),{depth:.035,bevelEnabled:false,curveSegments:6});g.computeBoundingBox();const bb=g.boundingBox!,scale=Math.min(w/(bb.max.x-bb.min.x),maxHeight/(bb.max.y-bb.min.y));g.translate(-(bb.max.x+bb.min.x)/2,-bb.min.y,0);g.scale(scale,scale,1);if(vertical)g.rotateZ(Math.PI/2);g.computeBoundingBox();const fitBounds=g.boundingBox!.clone();add(g,'gold',x,y,depth);g.userData.signage={surface,text:source.signage.words[key].text,maxWidth:w,maxHeight:Number.isFinite(maxHeight)?maxHeight:null,localBounds:{left:x+fitBounds.min.x,right:x+fitBounds.max.x,bottom:y+fitBounds.min.y,top:y+fitBounds.max.y},vertical};return g;}
 function emblem(x:number,y:number,h:number){
  // Original flat vector shapes approximate the real yellow teardrop label,
  // green ribbon, vegetables and city shield; no photographic texture.
  box(x,y-.12,h*.25,h*1.15,'green',.20,.07);
  const s=new T.Shape();s.moveTo(0,h*.94);s.bezierCurveTo(-h*.13,h*.94,-h*.27,h*.32,-h*.32,h*.16);s.bezierCurveTo(-h*.38,-h*.18,h*.38,-h*.18,h*.32,h*.16);s.bezierCurveTo(h*.27,h*.32,h*.13,h*.94,0,h*.94);
  add(new T.ExtrudeGeometry(s,{depth:.025,bevelEnabled:false,curveSegments:12}),'dark',x,y,.245);
  const inner=s.clone();const g=new T.ShapeGeometry(inner);g.scale(.94,.94,1);add(g,'gold',x,y+.013,.280);
  box(x,y+h*.61,h*.14,h*.20,'red',.302,.015);for(const yy of [.65,.70,.75])for(const side of [-1,1]){const cross=new T.BoxGeometry(h*.015,h*.055,.012);cross.rotateZ(side*Math.PI/4);add(cross,'white',x,y+h*yy,.315);}
  for(const [u,v,r] of [[-.10,.49,.085],[.02,.48,.08],[.12,.49,.065]]){const g=new T.SphereGeometry(h*r,8,5);g.scale(1,.8,.08);add(g,'green',x+h*u,y+h*v,.305);}
  word(x,y+h*.19,h*.47,false,'kesbeke',.33);return;
 }
 function shopMascot(x:number,y:number,r:number){
  add(new T.CircleGeometry(r,32),'gold',x,y,.405);
  // Original stylized redraw of the source's paired green pickle characters,
  // with the orange band/arms/legs retained as a source-supported motif.
  box(x,y-r*.25,r*1.85,r*.32,'ochre',.414,.014);
  for(const [offset,lean] of [[-.15,-.18],[.13,.14]]){const s=new T.Shape();s.moveTo(-r*.13,-r*.38);s.bezierCurveTo(-r*.22,-r*.08,-r*.16,r*.36,-r*.06,r*.45);s.bezierCurveTo(r*.06,r*.59,r*.17,r*.32,r*.13,-r*.33);s.quadraticCurveTo(0,-r*.47,-r*.13,-r*.38);const g=new T.ShapeGeometry(s);g.rotateZ(lean);add(g,'green',x+r*offset,y+r*.03,.432);for(const side of [-1,1]){const leg=new T.BoxGeometry(r*.045,r*.28,.014);leg.rotateZ(side*.4);add(leg,'green',x+r*(offset+side*.07),y-r*.57,.435);const arm=new T.BoxGeometry(r*.24,r*.045,.014);arm.rotateZ(side*.45);add(arm,'green',x+r*(offset+side*.20),y+r*.04,.435);}}
 }
 return{length,box,pane,word,emblem,add,shopMascot};
}
/** Factory and office share one exact BAG parent; nineteen survey roof zones retain their distinct levels. */
export function buildKesbeke(_w:number,_d:number,b:BuildingTools){const p=source.parts.factory;nativeEnvelope(p,b);
 const rd=(x:number,y:number):V=>[x-p.anchorRd[0],p.anchorRd[1]-y];
 const west=facade(rd(118916.293,488467.727),rd(118916.519,488456.889),b),south=facade(rd(118916.519,488456.889),rd(118927.780,488457.108),b);
 // Current dated office photographs show a small white flue with dark cap
 // near the corner; restrained dimensions are photo-guided, not AHNmax.
 const flue=rd(118917.05,488457.55);b.add(new T.CylinderGeometry(.115,.13,.67,12),'white',flue[0],12.19,flue[1]);b.add(new T.CylinderGeometry(.19,.19,.075,12),'dark',flue[0],12.55,flue[1]);b.add(new T.CylinderGeometry(.105,.105,.10,12),'dark',flue[0],12.64,flue[1]);
 for(const f of [west,south]){
  for(const y of [.85,4.75,8.23]){const axes=f===west?[-2.22,-.72,.78,2.28]:[-3.60,-2.14,-.68,.78,2.24,3.70];for(const x of axes)f.pane(x,y,1.04,y<1?2.90:2.04);f.box((axes[0]+axes.at(-1)!)/2,y+(y<1?2.94:2.10),axes.at(-1)!-axes[0]+1.35,.12,'stone',.13,.11);}
  f.box(0,11.76,f.length+.15,.20,'stone',.12,.32);
  // Photo-documented pale brick cross pattern below each principal window.
  for(const y of [4.04,7.16])for(let x=-3.9;x<4.2;x+=1.45){f.box(x,y,.13,.40,'stone',.075,.024);f.box(x,y+.15,.39,.10,'stone',.08,.022);}
 }
 west.pane(-4.2,4.75,.55,1.25);west.pane(-4.2,8.23,.55,1.25);west.word(4.13,3.65,6.8,true);south.word(.75,7.35,6.65);south.emblem(-4.72,4.1,2.15);
 // Small curved office entrance canopy, placed on the actual west perimeter.
 west.box(-4.18,.13,1.08,2.15,'white',.13,.12);west.box(-4.18,.23,.86,1.99,'glass',.22,.05);west.box(-4.18,1.15,.055,1.07,'white',.26,.06);west.box(-4.18,2.30,1.72,.15,'stone',.38,.68);
 const hall=facade(rd(118915.220,488521.160),rd(118916.293,488467.727),b);
 const moduleCount=26;for(let i=0;i<moduleCount;i++){const x=(i+.5)*hall.length/moduleCount-hall.length/2;hall.box(x,1.99,hall.length/moduleCount-.13,3.70,'glass',.14,.07);hall.box(x,3.89,hall.length/moduleCount,.055,'white',.22,.045);hall.box(x-hall.length/moduleCount/2,0,.11,5.93,'white',.19,.10);}
 hall.box(0,5.89,hall.length,.17,'white',.14,.42);hall.box(0,.03,hall.length,.10,'white',.13,.17);
 for(const fraction of [.16,.52,.86]){const x=(fraction-.5)*hall.length;hall.box(x,.12,2.28,3.97,'white',.255,.07);hall.box(x,.18,2.05,3.75,'green',.31,.06);hall.box(x,1.5,1.67,.62,'stone',.35,.05);hall.box(x,1.57,1.51,.47,'glass',.385,.04);hall.box(x,.18,.06,3.70,'white',.40,.02);hall.emblem(x,4.4,1.28);}
 for(let i=0;i<moduleCount;i++){const x=(i+.5)*hall.length/moduleCount-hall.length/2;for(const y of [.68,1.2]){hall.box(x,y,.085,.26,'stone',.083,.026);hall.box(x,y+.085,.24,.08,'stone',.087,.024);}}
}
/** Whole native residential parent retained: ground storefront only receives the requested real window graphics. */
export function buildKesbekeShop(_w:number,_d:number,b:BuildingTools){const p=source.parts.shop;nativeEnvelope(p,b);
 // Exact surveyed east street boundary, facade normal east.
 const ring=p.outline[0],east=[...ring].sort((a,c)=>c[0]-a[0]).slice(0,2).sort((a,c)=>c[1]-a[1]);const f=facade([east[0][0],east[0][1]],[east[1][0],east[1][1]],b);
 //2024-11-21 source freezes three upper residential tiers, four axes,
 // and shallow open rails spanning the two right-hand openings.
 for(const y of [6.65,9.55,12.45]){
  for(const x of [-3.6,-1.2,1.2,3.6]){f.pane(x,y,1.70,1.93);f.box(x,y, .045,1.38,'white',.205,.030);}
  f.box(2.4,y-.11,4.25,.10,'stone',.32,.35);
  for(const h of [.25,.88])f.box(2.4,y+h,4.25,.035,'frame',.52,.035);
  for(let x=.37;x<=4.45;x+=.51)f.box(x,y-.04,.025,.96,'frame',.52,.025);
 }
 // Broad white first-floor glazing belongs to the shop, not another row
 // of stock residential windows. The real oval board overlays this group.
 f.box(.1,3.50,10.15,2.62,'white',.15,.08);
 for(const x of [-3.65,-1.15,1.35,3.85]){f.box(x,3.64,2.29,2.34,'glass',.22,.05);f.box(x,5.08,2.29,.055,'white',.265,.035);}
 f.box(.1,3.32,10.50,.18,'white',.22,.26);
 const board=new T.Shape();const w=6.90,h=2.30,r=.84;
 board.moveTo(-w/2+r,0);board.lineTo(w/2-r,0);board.quadraticCurveTo(w/2,0,w/2,r);board.lineTo(w/2,h-r);board.quadraticCurveTo(w/2,h,w/2-r,h);board.lineTo(-w/2+r,h);board.quadraticCurveTo(-w/2,h,-w/2,h-r);board.lineTo(-w/2,r);board.quadraticCurveTo(-w/2,0,-w/2+r,0);
 f.add(new T.ExtrudeGeometry(board,{depth:.08,bevelEnabled:false,curveSegments:10}),'dark',.12,3.66,.32);
 f.shopMascot(-2.13,4.81,.85);
 // These words belong to the actual signboard. They also occur as stickers
 // on the glazing below; neither is an invented building-name caption.
 f.word(1.28,5.18,2.54,false,'kesbeke',.404,.36,'printed');
 f.word(1.28,4.39,3.85,false,'sweetSour',.404,.62,'printed');
 f.word(1.28,4.01,3.85,false,'motherNature',.404,.25,'printed');
 // White entrance frame/corner support and dark storefront doors remain
 // inside this native parent's east facade; adjoining houses are retained.
 f.box(-.35,.10,9.80,2.90,'white',.12,.08);
 f.box(-.35,.20,9.57,2.64,'glass',.20,.06);
 f.box(5.15,.17,1.10,2.72,'dark',.20,.09);
 for(const x of [-5.65,4.71])f.box(x,.01,.31,3.15,'white',.37,.43);
 f.word(-.5,2.34,2.05,false,'kesbeke',.234,.25,'printed');f.word(-.5,1.63,4.55,false,'sweetSour',.234,.45,'printed');f.word(-.5,1.30,4.55,false,'motherNature',.234,.21,'printed');
 const awning=new T.BufferGeometry();awning.setAttribute('position',new T.Float32BufferAttribute([-4.95,3.22,.27,4.95,3.22,.27,4.95,2.93,1.42,-4.95,2.93,1.42],3));awning.setIndex([0,2,1,0,3,2]);awning.computeVertexNormals();f.add(awning,'slate',-.35,0,0);f.box(-.35,2.78,9.9,.16,'slate',1.42,.06);
 f.box(0,15.10,f.length+.20,.16,'stone',.14,.42);
}
