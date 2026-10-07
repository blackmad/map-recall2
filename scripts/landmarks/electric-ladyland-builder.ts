import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism} from './house-geometry';
import source from './electric-ladyland-footprints.json';
/** Original native 1896 four-shop ensemble. Photo geometry is interpreted, never imported. */
export function buildElectricLadyland(_w:number,_d:number,b:BuildingTools){
 const {add,box}=b,front=4.835,eave=10.10,crest=12.88;
 const clip=(p:T.Vector2[],a:number,c:number,k:number)=>{const out:T.Vector2[]=[];for(let i=0;i<p.length;i++){const u=p[i],v=p[(i+1)%p.length],du=a*u.x+c*u.y-k,dv=a*v.x+c*v.y-k;if(du>=-1e-7)out.push(u);if((du>=0)!==(dv>=0))out.push(u.clone().lerp(v,du/(du-dv)));}return out;};
 // Native footprints are split at the main roof's rear eave. Rear fingers do not grow into a roof slab.
 for(const part of source.parts){const ring=part.ring.map(p=>new T.Vector2(p[0],p[1]));const main=clip(ring,0,1,-3.10);add(openTopPrism(new T.Shape(main),0,eave),'brick');
  // Main roof: surrounding slopes and a broad shallow crown, matching semantic roof families.
  const height=(p:T.Vector2)=>Math.min(crest,eave+Math.max(0,Math.min((p.x+5.71)*1.27,(13.70-p.x)*1.27,(p.y+3.10)*1.27,(front-p.y)*1.28)));
  const regions=[[[ -5.71,-3.10],[13.70,-3.10],[11.49,-.94],[-3.50,-.94]],[[13.70,-3.10],[13.70,front],[11.49,2.67],[11.49,-.94]],[[13.70,front],[-5.71,front],[-3.50,2.67],[11.49,2.67]],[[-5.71,front],[-5.71,-3.10],[-3.50,-.94],[-3.50,2.67]],[[-3.50,-.94],[11.49,-.94],[11.49,2.67],[-3.50,2.67]]];
  const pos:number[]=[];const tris=T.ShapeUtils.triangulateShape(main,[]);
  for(const t of tris)for(const region of regions){let p=t.map(i=>main[i]);for(let i=0;i<region.length;i++){const a=region[i],c=region[(i+1)%region.length],dx=c[0]-a[0],dz=c[1]-a[1];p=clip(p,-dz,dx,dx*a[1]-dz*a[0]);}for(let i=1;i<p.length-1;i++){const tri=[p[0],p[i],p[i+1]];const area=tri[1].clone().sub(tri[0]).cross(tri[2].clone().sub(tri[0]));if(Math.abs(area)<1e-8)continue;for(const q of area>0?[tri[0],tri[2],tri[1]]:tri)pos.push(q.x,height(q),q.y);}}
  const roof=new T.BufferGeometry();roof.setAttribute('position',new T.Float32BufferAttribute(pos,3));roof.computeVertexNormals();add(roof,'slate');
  // Partition triangles of the TRUE native rear polygon, not finger bounding intervals.
  // This retains the south-parent 0.45–0.51m rear strip and north edge slivers.
  const slices=part.id.endsWith('8653')?[[-100,-.86,10.08],[-.86,2.12,3.97],[2.12,100,10.05]]:[[-100,6.40,10.10],[6.40,11.48,10.10],[11.48,100,10.24]];
  for(const t of T.ShapeUtils.triangulateShape(ring,[]))for(const [lo,hi,h]of slices){let p=clip(clip(clip(t.map(i=>ring[i]),0,-1,3.10),1,0,lo),-1,0,-hi);p=p.filter((q,i)=>q.distanceTo(p[(i+1)%p.length])>1e-6);for(let j=0;j<p.length&&p.length>=3;){const u=p[(j+p.length-1)%p.length],v=p[j],w=p[(j+1)%p.length];if(Math.abs(v.clone().sub(u).cross(w.clone().sub(v)))<1e-7){p.splice(j,1);j=0;}else j++;}if(p.length<3||Math.abs(T.ShapeUtils.area(p))<1e-7)continue;
   const middleSouth=!part.id.endsWith('8653')&&lo===6.40;
   // Source south rear slope/eave family reaches approx10.0m at this boundary;
   // small transition stays near10.0m and joins the10.10m main rear eave, not the13m crown.
   const top=(q:T.Vector2)=>middleSouth?10.10+.14*(q.y+3.10):h;
   const walls:number[]=[],rp:number[]=[];const area=T.ShapeUtils.area(p);if(area<0)p.reverse();
   for(let i=0;i<p.length;i++){const u=p[i],v=p[(i+1)%p.length];walls.push(u.x,0,u.y,v.x,top(v),v.y,v.x,0,v.y,u.x,0,u.y,u.x,top(u),u.y,v.x,top(v),v.y);}
   for(let i=1;i<p.length-1;i++)for(const q of [p[0],p[i+1],p[i]])rp.push(q.x,top(q),q.y);
   for(const [positions,colour]of [[walls,'brick'],[rp,'slate']] as const){const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.computeVertexNormals();add(geo,colour);}
  }

 }
 const f=front+.065;
 function pane(x:number,y:number,z:number,w:number,h:number,frame:'white'|'dark'='white',split=true){
  add(new T.PlaneGeometry(w,h),'glass',x,y+h/2,z);
  for(const u of [-w/2,w/2])box(x+u,y,z+.045,.065,h,.09,frame);
  for(const v of [0,h])box(x,y+v-.032,z+.045,w,.065,.09,frame);
  box(x,y+h*.70,z+.055,w,.085,.10,'dark');if(split)box(x,y,z+.05,.042,h,.08,'dark');
 }
 // Two slightly projecting narrow-pair risalits alternate with four broad paired windows.
 const groups=[{x:-4.08,n:false},{x:-.97,n:true},{x:2.20,n:false},{x:5.49,n:false},{x:8.68,n:true},{x:11.89,n:false}];
 function brickHead(x:number,y:number,z:number,width:number){const arch=new T.Shape();arch.moveTo(-width/2-.11,0);arch.quadraticCurveTo(0,.19,width/2+.11,0);arch.lineTo(width/2+.11,.14);arch.quadraticCurveTo(0,.33,-width/2-.11,.14);arch.closePath();add(new T.ShapeGeometry(arch),'red',x,y,z);}
 for(const g of groups){if(g.n)box(g.x,4.05,front+.035,2.65,6.05,.085,'brick');for(const y of [4.47,7.52]){const h=y<5?2.52:2.12,w=g.n?.67:.97,gap=g.n?.51:.055,z=f+(g.n?.09:0);for(const s of [-1,1]){const x=g.x+s*(w/2+gap/2);pane(x,y,z,w,h,'white',false);box(x,y+h*.34,z+.06,w,.032,.065,'dark');box(x,y-.085,z+.075,w+.18,.10,.22,'stone');if(g.n)brickHead(x,y+h+.07,z-.02,w);}
 // Source17346/17347: the broad paired opening has ONE full-width segmental head;
 // separated narrow stair openings each have their own head.
 if(!g.n)brickHead(g.x,y+h+.07,z-.02,2*w+gap);
 }}
 for(const y of [4.05,7.18])box(3.995,y,f+.02,19.42,.105,.24,'stone');
 // Green glazed bands and intermittent vivid red blocks are architectural accents, not a texture.
 for(const y of [4.32,9.74]){box(3.995,y,f+.04,19.38,.095,.045,'green');for(let x=-5.4;x<13.4;x+=.36)box(x,y+.10,f+.048,.16,.095,.045,'red');}
 for(let x=-5.3;x<13.4;x+=.38){box(x,9.99,f+.08,.13,.12,.19,'stone');box(x,9.78,f+.035,.16,.14,.085,'brick');}
 for(const [y,h,d]of [[10.07,.17,.37],[10.23,.13,.49],[10.36,.075,.55]])box(3.995,y,front+.12,19.55,h,d,'white');
 // A full timber shopfront: four large display panes alternating with three paired entrances.
 const edges=[-5.70,-2.47,-.49,2.80,5.04,8.30,10.32,13.70];
 for(let i=0;i<7;i++){const lo=edges[i]+.19,hi=edges[i+1]-.19,x=(lo+hi)/2,w=hi-lo;
  if(i%2===0){pane(x,1.10,f+.055,w,2.53,'white',true);pane(x,.15,f+.07,w,.70,'dark',true);box(x,.96,f+.1,w+.12,.13,.23,'white');for(let u=lo+.13;u<hi;u+=.24)box(u,.08,f+.49,.028,.86,.028,'dark');for(const y of [.12,.83])box(x,y,f+.49,w,.045,.06,'dark');}
  else{for(const s of [-1,1]){const dx=x+s*w/4;const no7=i===5&&s===-1;box(dx,.25,f+.02,w/2-.07,2.28,.085,no7?'blue':'dark');pane(dx,no7?1.20:1.08,f+.10,w/2-.22,no7?1.28:1.40,'dark',false);if(no7){box(dx,.37,f+.13,w/2-.24,.66,.028,'blue');for(const sx of [-1,1])box(dx+sx*(w/4-.12),.37,f+.155,.025,.66,.025,'dark');for(const yy of [.37,1.01])box(dx,yy,f+.155,w/2-.24,.025,.025,'dark');}pane(dx,2.72,f+.10,w/2-.13,.72,'white',false);box(dx,.55,f+.16,w/2-.24,.09,.035,'stone');for(let yy=.65;!no7&&yy<2.4;yy+=.36)for(const sx of [-1,1]){const curve=new T.TorusGeometry(.11,.012,3,10,Math.PI*1.7);add(curve,'dark',dx+sx*.10,yy,f+.19,0);}box(dx,.19,f+.20,w/2,.18,.40,'stone');}box(x,.37,f+.04,.13,3.25,.13,'white');}
 }
 // Pilasters have recessed flutes, block bases and compact floral capitals.
 for(const x of edges){box(x,.05,f+.08,.36,.90,.25,'dark');box(x,.93,f+.10,.43,.14,.32,'white');box(x,1.07,f+.065,.23,2.42,.16,'white');for(const s of [-1,1])box(x+s*.067,1.28,f+.16,.025,1.78,.018,'stone');box(x,3.49,f+.095,.38,.22,.23,'white');for(const s of [-1,1]){add(new T.TorusGeometry(.065,.024,4,10),'white',x+s*.10,3.60,f+.24);add(new T.IcosahedronGeometry(.047,0),'white',x+s*.06,3.48,f+.22);}box(x,3.70,f+.11,.45,.11,.30,'white');}
 for(const [y,h,d]of [[3.79,.12,.32],[3.91,.27,.26],[4.18,.10,.38]])box(3.995,y,f+.12,19.43,h,d,'white');
 // Four small and two large attic dormers; opposite dated reference views support positions and hoists.
 for(const g of groups){const w=g.n?1.60:1.05,base=g.n?10.43:10.66,h=g.n?1.86:1.47,z=3.99;box(g.x,base,z,w,h,1.48,'stone');pane(g.x,base+.16,z+.765,w-.25,h-.32,'white',false);box(g.x,base+h,z,w+.22,.13,1.65,'white');box(g.x,base+h+.13,z,w+.09,.065,1.48,'slate');if(g.n){box(g.x,base+h-.11,z+1.27,.20,.24,1.45,'white');add(new T.TorusGeometry(.07,.016,4,10),'dark',g.x,base+h-.27,z+1.93);}}
 // Sparse iron wall anchors observed between window groups.
 for(const x of [-2.55,.63,3.81,7.05,10.34])for(const y of [6.81,9.44]){box(x,y,f+.055,.05,.37,.08,'dark');box(x,y+.14,f+.09,.20,.045,.04,'dark');}
}
