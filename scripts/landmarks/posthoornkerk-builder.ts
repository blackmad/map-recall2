import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism,upwardRoofPlane} from './house-geometry';
import source from './posthoornkerk-footprints.json';
type Colour=Parameters<BuildingTools['add']>[1];
/** Original native-metre reconstruction. +z is the surveyed Haarlemmerstraat front;
 * all geometry is baked to east/south axes. Never stretch by catalogue dimensions. */
export function buildPosthoornkerk(_w:number,_d:number,b:BuildingTools){
 const turn=source.localRotationDegrees*Math.PI/180;
 const add=(g:T.BufferGeometry,c:Colour,x=0,y=0,z=0,a=0)=>{g.rotateY(a);g.translate(x,y,z);g.rotateY(turn);b.add(g,c);};
 const box=(x:number,y:number,z:number,w:number,h:number,d:number,c:Colour,a=0)=>add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,a);
 const shape=(v:number[][])=>new T.Shape(v.map(q=>new T.Vector2(q[0],q[1])));
 const rectangle=(x0:number,x1:number,z0:number,z1:number)=>shape([[x0,z0],[x1,z0],[x1,z1],[x0,z1]]);
 function face(v:number[][],c:Colour,up=false){if(up){const p=v.map(q=>new T.Vector3(...q));if(p[1].clone().sub(p[0]).cross(p[2].clone().sub(p[0])).y<0)v=[...v].reverse();}const values:number[]=[];for(let i=1;i<v.length-1;i++)values.push(...v[0],...v[i],...v[i+1]);const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(values,3));g.computeVertexNormals();add(g,c);}
 function shell(x0:number,x1:number,z0:number,z1:number,e:number){add(openTopPrism(rectangle(x0,x1,z0,z1),0,e),'brick');}
 function gable(x0:number,x1:number,z0:number,z1:number,e:number,r:number){const cx=(x0+x1)/2;shell(x0,x1,z0,z1,e);for(const x of [x0,x1])face([[x,e,z0],[x,e,z1],[cx,r,z1],[cx,r,z0]],'slate',true);for(const z of [z0,z1])face([[x0,e,z],[x1,e,z],[cx,r,z]],'brick');}
 const move=(x:number,z:number,a:number,d=0,u=0)=>[x+Math.sin(a)*d+Math.cos(a)*u,z+Math.cos(a)*d-Math.sin(a)*u];
 function pointed(x:number,y:number,z:number,w:number,h:number,a:number,c:Colour){const q=new T.Shape();q.moveTo(-w/2,0);q.lineTo(w/2,0);q.lineTo(w/2,h-w*.76);q.quadraticCurveTo(w*.42,h-w*.33,0,h);q.quadraticCurveTo(-w*.42,h-w*.33,-w/2,h-w*.76);q.closePath();add(new T.ShapeGeometry(q,4),c,x,y,z,a);}
 function round(x:number,y:number,z:number,w:number,h:number,a:number,c:Colour){const q=new T.Shape();q.moveTo(-w/2,0);q.lineTo(w/2,0);q.lineTo(w/2,h-w/2);q.absarc(0,h-w/2,w/2,0,Math.PI,false);q.closePath();add(new T.ShapeGeometry(q,4),c,x,y,z,a);}
 function window(x:number,y:number,z:number,w:number,h:number,a:number,c:Colour='glass',gothic=true){
  const arch=gothic?pointed:round;arch(x,y,z,w+.24,h+.2,a,'stone');let q=move(x,z,a,.055);arch(q[0],y+.1,q[1],w+.07,h-.03,a,'dark');q=move(x,z,a,.1);arch(q[0],y+.16,q[1],w,h-.15,a,c);
  const m=move(x,z,a,.15);if(c==='glass'){for(let v=1.2;v<h-w*.8;v+=1.35)box(m[0],y+v,m[1],w,.065,.06,'frame',a);box(m[0],y+.12,m[1],w+.4,.16,.18,'stone',a);}else{for(let v=.5;v<h-w*.7;v+=.43)box(m[0],y+v,m[1],w,.075,.07,'greyBrick',a);}}
 function band(x:number,z:number,a:number,len:number,y:number){box(x,y,z,len,.16,.14,'stone',a);for(let u=-len/2+.23;u<len/2;u+=.48){const q=move(x,z,a,.03,u);box(q[0],y+.2,q[1],.26,.13,.06,'stone',a);}}
 function arcade(x:number,z:number,a:number,len:number,y:number){band(x,z,a,len,y);for(let u=-len/2+.35;u<len/2-.1;u+=.59){let q=move(x,z,a,.09,u);round(q[0],y-.65,q[1],.47,.62,a,'stone');q=move(q[0],q[1],a,.04);round(q[0],y-.57,q[1],.31,.43,a,'brick');}}
 function cross(x:number,y:number,z:number,h=1.8){box(x,y,z,.075,h,.075,'dark');box(x,y+h*.64,z,h*.46,.075,.075,'dark');}
 function polygonRoof(cx:number,cz:number,ring:number[][],e:number,r:number){for(let i=0;i<ring.length;i++)face([[ring[i][0],e,ring[i][1]],[ring[(i+1)%ring.length][0],e,ring[(i+1)%ring.length][1]],[cx,r,cz]],'slate',true);}
 function apse(cx:number,cz:number,rx:number,e:number,crest:number,rz=rx){
  const v:number[][]=[[cx-rx,cz],[cx+rx,cz]];for(let i=1;i<5;i++){const a=i*Math.PI/5;v.push([cx+rx*Math.cos(a),cz-rz*Math.sin(a)]);}add(openTopPrism(shape(v),0,e),'brick');
  // Five-sided chancel/chapel endings, as in the surveyed chain and current aerial.
  for(let i=1;i<v.length;i++)face([[v[i][0],e,v[i][1]],[v[(i+1)%v.length][0],e,v[(i+1)%v.length][1]],[cx,crest,cz]],'slate',true);
  face([[v[0][0],e,cz],[v[1][0],e,cz],[cx,crest,cz]],'brick');
  for(let i=1;i<v.length;i++){const a=v[i],q=v[(i+1)%v.length],xx=(a[0]+q[0])/2,zz=(a[1]+q[1])/2,f=Math.atan2(-(q[1]-a[1]),q[0]-a[0]),n=move(xx,zz,f,.04);window(n[0],e>15?7.6:2.5,n[1],e>15?1.15:.8,e>15?8.4:4.4,f,'glass',false);arcade(n[0],n[1],f,e>15?2.4:1.15,e-.12);}
 }

 // A low surveyed shell owns little annexes and buttress feet. All upper roofs
 // are separate and supported; no wall-colored cap can cover explicit glazing/roof.
 const outline=shape(source.parts[0].localRing.slice(0,-1));add(openTopPrism(outline,0,2.0),'brick');
 const groundRoof=upwardRoofPlane(outline,2.0),flat=groundRoof.toNonIndexed(),rp=flat.getAttribute('position'),clean:number[]=[];
 // The source ring contains nearly collinear centimetre-scale arc vertices.
 // Remove only numerical top-plane remnants that can invert at GLB quantization;
 // exact surveyed wall vertices remain intact. Failed decoded export is retained.
 for(let i=0;i<rp.count;i+=3){const a=new T.Vector3().fromBufferAttribute(rp,i),q=new T.Vector3().fromBufferAttribute(rp,i+1),c=new T.Vector3().fromBufferAttribute(rp,i+2);if(q.clone().sub(a).cross(c.clone().sub(a)).length()/2<.003)continue;clean.push(...a.toArray(),...q.toArray(),...c.toArray());}
 const safeRoof=new T.BufferGeometry();safeRoof.setAttribute('position',new T.Float32BufferAttribute(clean,3));safeRoof.computeVertexNormals();add(safeRoof,'slate');groundRoof.dispose();flat.dispose();
 gable(-6.4,2.5,-16.5,19.7,20.1,27.2);
 // Lower side aisles: steeper high clerestory and separate lean-to roofs.
 const aisleX=(s:number,z:number)=>s<0?-11.062+z*.031:10.973+z*.015;
 for(const [s,xi] of [[-1,-6.4],[1,2.5]]){const z0=-8.3,z1=4.8,x0=aisleX(s,z0),x1=aisleX(s,z1);add(openTopPrism(shape([[x0,z0],[x1,z1],[xi,z1],[xi,z0]]),0,13.5),'brick');face([[x0,13.5,z0],[x1,13.5,z1],[xi,16.65,z1],[xi,16.65,z0]],'slate',true);}
 // Original east transept and later lower west transept are different levels.
 shell(-14.8,10.8,-16.5,-8.1,20.1);for(const z of [-16.5,-8.1])face([[-14.8,20.1,z],[10.8,20.1,z],[10.8,27.2,-12.3],[-14.8,27.2,-12.3]],'slate',true);for(const x of [-14.8,10.8])face([[x,20.1,-16.5],[x,20.1,-8.1],[x,27.2,-12.3]],'brick');
 const lowX=(s:number,z:number)=>s<0?-15.239+z*.0425:10.763+z*.012;
 add(openTopPrism(shape([[lowX(-1,4.8),4.8],[lowX(-1,12.6),12.6],[lowX(1,12.6),12.6],[lowX(1,4.8),4.8]]),0,13.5),'brick');for(const z of [4.8,12.6])face([[-14.8,13.5,z],[10.8,13.5,z],[10.8,16.7,8.7],[-14.8,16.7,8.7]],'slate',true);for(const x of [-14.8,10.8])face([[x,13.5,4.8],[x,13.5,12.6],[x,16.7,8.7]],'brick');
 // Trefoil rear end follows separate lobes, avoiding a rectangular rear slab.
 apse(-2.4,-16.5,4.7,20.1,27.1,8.2);
 gable(-10.40,-6.84,-20.6,-16.5,11.1,13.7);apse(-8.62,-20.6,1.78,11.1,13.7,2.35);
 gable(1.55,7.15,-20.4,-16.5,10.8,13.7);apse(4.35,-20.4,2.8,10.8,13.7);
 // Low rear utility annex is surveyed separately from the small chapel roofs.
 const annex=shape([[7.2,-20.73],[10.48,-20.73],[10.69,-16.5],[7.2,-16.5]]);add(openTopPrism(annex,0,8.8),'brick');add(upwardRoofPlane(annex,8.8),'slate');
 // Rhythmic side bays, pointed windows and original flying buttress silhouette.
 for(const s of [-1,1]){const a=s<0?-Math.PI/2:Math.PI/2,x=s<0?-10.94:10.84,inner=s<0?-6.44:2.54;
  for(const z of [-3.8,.4,4.1,11.5]){if(z<4.8)window(aisleX(s,z)+s*.10,3.7,z,1.5,7.2,a);window(inner,17.1,z,1.3,2.6,a);}
  arcade(x,-1.75,a,13.0,13.35);arcade(inner,4.0,a,25.7,20.0);
  for(const z of [-7.3,-2.8,2.0,7.0,12.1]){const bx=aisleX(s,z)+s*.05;box(bx,0,z,.8,14.5,.65,'brick');box(bx,14.4,z,1.0,.18,.92,'stone');
   // Slender sloping masonry supports clear the aisle roofs, not solid wedges.
   for(let j=0;j<5;j++){const t=j/5,u=(j+1)/5,xa=bx+(inner-bx)*t,xb=bx+(inner-bx)*u,ya=15.5+3.7*t+.4*Math.sin(t*Math.PI),yb=15.5+3.7*u+.4*Math.sin(u*Math.PI),la=ya-.55-.55*Math.sin(t*Math.PI),lb=yb-.55-.55*Math.sin(u*Math.PI);for(const dz of [-.18,.18])face([[xa,la,z+dz],[xa,ya,z+dz],[xb,yb,z+dz],[xb,lb,z+dz]],'stone');face([[xa,ya,z-.18],[xa,ya,z+.18],[xb,yb,z+.18],[xb,yb,z-.18]],'stone',true);}}
  // Tall rear transept, lower front transept: first-hit windows on real outer plane.
  for(const z of [-15.0,-12.3,-9.6])window(s<0?-14.84:10.97,6.6,z,1.45,11.5,a);
  window(s<0?-14.84:10.97,21.3,-12.3,1.0,3.6,a);arcade(s<0?-14.84:10.97,-12.3,a,8.3,20.02);
  for(const z of [5.9,10.5])window(lowX(s,z)+s*.045,3.4,z,1.3,7.1,s<0?-Math.PI/2+.0425:Math.PI/2+.012);window(s<0?-14.84:10.97,13.8,8.7,.72,1.6,a);cross(s<0?-14.8:10.8,16.7,8.7,.8);
  // Photo-supported small red dormers on both long main roof slopes.
  for(const z of [-4.1,1.6,7.1,12.5]){const xx=s<0?-5.18:1.28,yy=22.04;box(xx,yy,z,.2,1.05,.95,'red');const q=move(xx,z,a,.13);pointed(q[0],yy+.1,q[1],.52,.80,a,'dark');face([[xx,yy+1.12,z-.62],[xx,yy+1.12,z+.62],[s<0?xx+1.2:xx-1.2,yy+2.12,z]],'slate',true);}
 }
 // Front extension at surveyed transverse width, with the central portal projecting 1.1m.
 shell(-10.25,6.3,13.0,25.86,20.2); // below the front nave roof: later travees
 for(const x of [-10.25,6.3])face([[x,20.2,13],[x,20.2,25.86],[-1.975,27.2,25.86],[-1.975,27.2,13]],'slate',true);
 const front=25.90,cx=-1.77;
 // Middle facade triangular attic: five niches and ornamental pale-brick panels.
 face([[-5.23,20.2,front],[1.7,20.2,front],[cx,27.15,front]],'brick');
 for(const [u,y,w,h] of [[-2.4,21.0,.55,1.8],[-1.2,22.6,.7,1.9],[0,24.1,.65,1.65],[1.2,22.6,.7,1.9],[2.4,21.0,.55,1.8]]){round(cx+u,y,front+.07,w+.16,h+.15,0,'stone');round(cx+u,y+.07,front+.13,w,h,0,'dark');box(cx+u,y+.1,front+.20,w*.55,h*.42,.10,'stone');add(new T.SphereGeometry(w*.2,7,5),'stone',cx+u,y+h*.49,front+.21);}
 cross(cx,27.15,front,1.15);
 for(const x of [-7.71,3.92]){const w=4.8,z=22.66,d=6.4;box(x,0,z,w,33.2,d,'brick');
  for(const a of [0,Math.PI/2,Math.PI,-Math.PI/2]){const half=(a===0||a===Math.PI)?d/2:w/2,len=(a===0||a===Math.PI)?w:d,q=move(x,z,a,half+.045);for(const y of [5.15,9.1,20.05,27.0,33.03])band(q[0],q[1],a,len+.12,y);window(q[0],9.65,q[1],1.55,9.8,a);window(q[0],21.0,q[1],1.30,5.3,a);for(const u of [-1.20,0,1.20]){const p=move(q[0],q[1],a,0,u);window(p[0],28.1,p[1],.8,4.3,a,'dark',false);}arcade(q[0],q[1],a,len,27.75);arcade(q[0],q[1],a,len,33.1);
   // Gabled spire shoulders: front-left and its outer faces carry real clocks.
   const v1=move(x,z,a,half,-len/2),v2=move(x,z,a,half,len/2),vp=move(x,z,a,half);
   face([[v1[0],33.2,v1[1]],[v2[0],33.2,v2[1]],[vp[0],39.1,vp[1]]],'brick');
   const t1=move(x,z,a,half+.08,-len/2),t2=move(x,z,a,half+.08,len/2),tp=move(x,z,a,half+.08);face([[t1[0],33.2,t1[1]],[tp[0],39.12,tp[1]],[tp[0],38.76,tp[1]],[t1[0]+(tp[0]-t1[0])*.06,33.35,t1[1]+(tp[1]-t1[1])*.06]],'stone');face([[t2[0],33.2,t2[1]],[tp[0],39.12,tp[1]],[tp[0],38.76,tp[1]],[t2[0]+(tp[0]-t2[0])*.06,33.35,t2[1]+(tp[1]-t2[1])*.06]],'stone');
   if(x<0){const v=move(x,z,a,half+.14);box(v[0],34.0,v[1],2.75,2.6,.07,'gold',a);const cc=move(v[0],v[1],a,.055);add(new T.CircleGeometry(1.15,28),'dark',cc[0],35.29,cc[1],a);add(new T.TorusGeometry(1.04,.045,4,28),'gold',cc[0],35.29,cc[1]+(a===0?.035:0),a);for(let i=0;i<12;i++){const t=i*Math.PI/6,p=move(cc[0],cc[1],a,.055,Math.sin(t)*.86);box(p[0],35.29+Math.cos(t)*.86-.05,p[1],.06,.12,.035,'gold',a);}const h=move(cc[0],cc[1],a,.08,.30);box(cc[0],35.29,cc[1],.055,.70,.06,'gold',a);box(h[0],35.26,h[1],.62,.06,.06,'gold',a);
   }else{for(const [u,hh] of [[-1.0,2.05],[0,3.35],[1.0,2.05]]){const p=move(x,z,a,half+.09,u);round(p[0],34,p[1],.55,hh,a,'stone');const f=move(p[0],p[1],a,.05);round(f[0],34.09,f[1],.37,hh-.18,a,'brick');}}
  }
  // Broken two-stage slate spire, real open crown/rail, then needle and iron cross.
  const bottom=[[x-w/2,33.2,z-d/2],[x+w/2,33.2,z-d/2],[x+w/2,33.2,z+d/2],[x-w/2,33.2,z+d/2]],top=[[x-1.15,49.8,z-1.15],[x+1.15,49.8,z-1.15],[x+1.15,49.8,z+1.15],[x-1.15,49.8,z+1.15]];
  for(let i=0;i<4;i++)face([bottom[i],bottom[(i+1)%4],top[(i+1)%4],top[i]],'slate',true);
  add(new T.CylinderGeometry(1.57,1.57,.2,8),'stone',x,49.92,z);
  const crownBeam=(p:number[],q:number[])=>{const a=new T.Vector3(...p),v=new T.Vector3(...q).sub(a),g=new T.BoxGeometry(.11,.11,v.length());g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),v.clone().normalize()));const m=a.addScaledVector(v,.5);add(g,'stone',m.x,m.y,m.z);};
  if(x<0){
   // Clock tower: open octagonal crown with pointed arch/rib shoulders.
   // Undated operator elevation and dated2014 silhouette both show these
   // rising around the needle, rather than another flat straight-post cage.
   const ring=Array.from({length:8},(_,i)=>[x+Math.sin(i*Math.PI/4)*1.31,z+Math.cos(i*Math.PI/4)*1.31]);
   for(let i=0;i<8;i++){const p=ring[i],q=ring[(i+1)%8],peak=[(p[0]+q[0])/2,54.9,(p[1]+q[1])/2];box(p[0],50.02,p[1],.11,2.18,.11,'stone');crownBeam([p[0],52.2,p[1]],peak);crownBeam(peak,[q[0],52.2,q[1]]);}
  }else{
   add(new T.CylinderGeometry(1.43,1.43,.16,8),'stone',x,52.12,z);
   // Non-clock tower: four separately peaked gable shoulders framing its
   // upper needle. The small dark slits are decorative source-visible fields.
   for(const a of [0,Math.PI/2,Math.PI,-Math.PI/2]){const p=move(x,z,a,1.00,-.96),q=move(x,z,a,1.00,.96),peak=move(x,z,a,1.00);
    for(const end of [p,q])box(end[0],50.02,end[1],.11,2.18,.11,'stone');
    face([[p[0],52.20,p[1]],[q[0],52.20,q[1]],[peak[0],55.35,peak[1]]],'slate');
    crownBeam([p[0],52.20,p[1]],[peak[0],55.35,peak[1]]);crownBeam([peak[0],55.35,peak[1]],[q[0],52.20,q[1]]);
    const inset=move(peak[0],peak[1],a,.055);pointed(inset[0],52.35,inset[1],.52,1.52,a,'dark');
   }
  }
  // Drawing non-clock shoulder/ledge width ratio ~.61;2014 needle base
  // is ~.60 of ledge width. Approximate crown widths, unchanged stage heights.
  const needleRadius=x<0?1.27:.95;
  // Non-clock source shoulder is solid to its lower ledge, unlike the clock's
  // open pointed crown. Short slate transition joins the existing needle;
  // its taper is photo-guided, while all authored stage heights stay fixed.
  if(x>=0){const foot=Array.from({length:8},(_,i)=>[x+Math.sin(i*Math.PI/4)*1.30,50.02,z+Math.cos(i*Math.PI/4)*1.30]),head=Array.from({length:8},(_,i)=>[x+Math.sin(i*Math.PI/4)*needleRadius,52.20,z+Math.cos(i*Math.PI/4)*needleRadius]);for(let i=0;i<8;i++)face([foot[i],foot[(i+1)%8],head[(i+1)%8],head[i]],'slate',true);}
  const crown=Array.from({length:8},(_,i)=>[x+Math.sin(i*Math.PI/4)*needleRadius,z+Math.cos(i*Math.PI/4)*needleRadius]);polygonRoof(x,z,crown,52.20,61.6);cross(x,61.6,z,2.4);
  // Lower tower facade: one actual central opening, flanking patterned blind lancets.
  window(x,5.5,front+.08,1.05,3.15,0);for(const u of [-1.34,1.34]){pointed(x+u,5.5,front+.08,.92,3.15,0,'ochre');pointed(x+u,5.62,front+.12,.77,2.90,0,'brick');for(let dy=0;dy<2.4;dy+=.35)for(const dx of [-.22,.12])box(x+u+dx+(Math.round(dy/.35)%2?.10:0),5.7+dy,front+.16,.14,.14,.025,'stone');}
  pointed(x,0.2,front+.10,1.9,4.4,0,'stone');pointed(x,.32,front+.17,1.64,4.06,0,'dark');box(x,.35,front+.24,1.48,2.5,.10,'ochre');box(x,.35,front+.31,.07,2.5,.04,'dark');
 }
 // Three very tall front lights; central is higher, as in current municipal photos.
 for(const [x,y,h] of [[cx-1.75,9.3,8.35],[cx,9.3,10.3],[cx+1.75,9.3,8.35]])window(x,y,front+.08,1.18,h,0);
 for(const y of [5.12,9.13,20.15])band(cx,front+.1,0,6.65,y);
 for(const x of [cx-2.3,cx+2.3])for(let i=0;i<8;i++){const t=i*Math.PI/4,xx=x+Math.sin(t)*.53,yy=18.8+Math.cos(t)*.62;box(xx,yy,front+.18,.16,.16,.04,'stone');}
 // Projecting Gothic portal, stone nested archivolts and paired timber doors.
 const portal=26.99;box(cx,0,26.42,6.55,5.4,1.1,'brick');pointed(cx,.10,portal+.02,5.70,7.30,0,'stone');pointed(cx,.20,portal+.08,5.32,6.98,0,'brick');pointed(cx,.30,portal+.14,4.94,6.66,0,'stone');pointed(cx,.40,portal+.20,4.57,6.33,0,'brick');pointed(cx,.48,portal+.27,4.19,5.94,0,'dark');
 for(const x of [cx-1.01,cx+1.01]){pointed(x,.53,portal+.34,1.88,3.8,0,'stone');pointed(x,.64,portal+.41,1.65,3.54,0,'dark');box(x,.64,portal+.49,1.52,2.52,.10,'ochre');for(const u of [-.50,0,.50])box(x+u,.72,portal+.55,.045,2.32,.035,'dark');add(new T.CircleGeometry(.52,16),'glass',x,3.44,portal+.48);add(new T.TorusGeometry(.47,.06,4,16),'stone',x,3.44,portal+.56);}
 box(cx,.55,portal+.61,.23,3.50,.18,'stone');
 // Small figurative stone relief interpreted geometrically, never photo-textured.
 box(cx,4.0,portal+.39,.65,1.15,.19,'stone');add(new T.SphereGeometry(.26,8,6),'stone',cx,5.37,portal+.42);
 face([[cx-3.45,5.25,portal+.02],[cx+3.45,5.25,portal+.02],[cx,10.6,portal+.02]],'brick');face([[cx-3.45,5.25,portal+.05],[cx,10.6,portal+.05],[cx,10.31,portal+.05],[cx-3.16,5.25,portal+.05]],'stone');face([[cx+3.45,5.25,portal+.05],[cx,10.6,portal+.05],[cx,10.31,portal+.05],[cx+3.16,5.25,portal+.05]],'stone');add(new T.CircleGeometry(.66,24),'stone',cx,8.63,portal+.10);add(new T.CircleGeometry(.52,24),'dark',cx,8.63,portal+.15);box(cx,8.27,portal+.22,.32,.56,.13,'stone');add(new T.SphereGeometry(.19,8,6),'stone',cx,8.93,portal+.22);cross(cx,10.6,portal,.95);
 // Octagonal crossing tower: rose windows, small upper arcades, tall continuous spire.
 const tx=-2.0,tz=-12.6,r=4.6,base=26.9,shoulder=36.7,ring=Array.from({length:8},(_,i)=>[tx+Math.sin(Math.PI/8+i*Math.PI/4)*r,tz+Math.cos(Math.PI/8+i*Math.PI/4)*r]);add(openTopPrism(shape(ring),base,shoulder),'brick');
 for(let i=0;i<8;i++){const p=ring[i],q=ring[(i+1)%8],xx=(p[0]+q[0])/2,zz=(p[1]+q[1])/2,a=Math.atan2(xx-tx,zz-tz),len=Math.hypot(q[0]-p[0],q[1]-p[1]);const f=move(xx,zz,a,.06);add(new T.CircleGeometry(1.15,28),'stone',f[0],30.34,f[1],a);const v=move(f[0],f[1],a,.06);add(new T.CircleGeometry(.98,28),'glass',v[0],30.34,v[1],a);for(let j=0;j<8;j++){const t=j*Math.PI/4,p=move(v[0],v[1],a,.05,Math.sin(t)*.60);add(new T.CircleGeometry(.14,8),'stone',p[0],30.34+Math.cos(t)*.60,p[1],a);}for(const u of [-1.1,-.37,.37,1.1]){const p=move(f[0],f[1],a,0,u);window(p[0],34.15,p[1],.47,1.35,a,'dark',false);}arcade(f[0],f[1],a,len,33.3);band(f[0],f[1],a,len,36.6);}
 polygonRoof(tx,tz,ring,shoulder,55.4);cross(tx,55.4,tz,2.2);
 // Source-supported forecourt rail: no solid courtyard slab, no invented name sign.
 const fenceZ=36.65;for(const [x,w] of [[-6.96,5.65],[3.43,5.65]]){box(x,0,fenceZ,w,.70,.35,'stone');for(let u=-w/2;u<=w/2;u+=.36){box(x+u,.7,fenceZ,.045,2.8,.045,'dark');add(new T.ConeGeometry(.08,.22,4),'dark',x+u,3.55,fenceZ);}for(const y of [1.35,2.85,3.1])box(x,y,fenceZ,w,.055,.07,'dark');}
 for(const x of [cx-2.05,cx+2.05]){box(x,0,fenceZ,.69,3.4,.70,'stone');face([[x-.39,3.4,fenceZ+.39],[x+.39,3.4,fenceZ+.39],[x,4.03,fenceZ+.39]],'stone');}
 for(let x=cx-1.7;x<cx+1.8;x+=.23)box(x,0,fenceZ,.04,3.5,.04,'dark');for(const y of [.3,1.45,2.55,3.12])box(cx,y,fenceZ,3.6,.055,.06,'dark');
}
