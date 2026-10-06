import * as T from 'three';
import type { BuildingTools } from './cultural-builders';
import { openTopPrism, upwardRoofPlane } from './house-geometry';
import { canalhouseCrownProfile } from './canalhouse-crown-profile';
import data from './pulitzer-amsterdam-footprints.json';
type Colour = Parameters<BuildingTools['add']>[1];
export interface PulitzerPane { id:string; centre:[number,number,number]; tangent:[number,number]; normal:[number,number]; width:number; height:number; }
export const pulitzerPanes:PulitzerPane[]=[];
/** Original authored shells from surveyed planar regions, not an imported mesh.
 * Current BAG owns exterior limits; four AHN4 courtyard holes remain unfilled.
 * House openings, joinery, plinths and crowns are authored from current photos. */
export function buildPulitzerAmsterdam(_width:number,_depth:number,b:BuildingTools){
 pulitzerPanes.length=0;
 const {add}=b;
 const shape=(rings:number[][][])=>{const s=new T.Shape(rings[0].map(v=>new T.Vector2(v[0],v[1])));for(const r of rings.slice(1))s.holes.push(new T.Path(r.map(v=>new T.Vector2(v[0],v[1]))));return s;};
 for(const [index,r]of data.roofRegions.entries()){
  const s=shape(r.rings),[a,c,d]=r.plane,top=(x:number,z:number)=>a*x+c*z+d;
  const bottom=Math.max(.1,r.minHeight);
  const shell=openTopPrism(s,0,bottom);shell.name=`pulitzer-shell:${index}`;add(shell,'brick');
  const skirt:number[]=[];
  for(const ring of r.rings)for(let i=0;i<ring.length;i++){
   const p=ring[i],q=ring[(i+1)%ring.length],py=top(p[0],p[1]),qy=top(q[0],q[1]);
   skirt.push(p[0],bottom,p[1],q[0],bottom,q[1],q[0],qy,q[1],p[0],bottom,p[1],q[0],qy,q[1],p[0],py,p[1]);
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(skirt,3));g.computeVertexNormals();g.name=`pulitzer-roof-support:${index}`;add(g,'brick');
  const roof=upwardRoofPlane(s);const p=roof.getAttribute('position');for(let i=0;i<p.count;i++)p.setY(i,top(p.getX(i),p.getZ(i)));roof.computeVertexNormals();roof.name=`pulitzer-roof:${index}`;
  // Orange tile family on the eastern historic row; western warehouse roofs
  // are charcoal. Very low connector roofs retain their quiet slate finish.
  const cx=r.rings[0].reduce((sum,p)=>sum+p[0],0)/r.rings[0].length;
  add(roof,cx>15&&r.minHeight>11?'red':'slate');
 }
 function facade(f:typeof data.facades[number]){
  const A=new T.Vector2(...f.a as [number,number]),B=new T.Vector2(...f.b as [number,number]),delta=B.clone().sub(A),w=delta.length(),t=delta.normalize(),n=new T.Vector2(-t.y,t.x),angle=Math.atan2(n.x,n.y),centre=A.clone().add(B).multiplyScalar(.5);
  const point=(u:number,v:number,offset:number)=>{const p=new T.Vector3(centre.x+t.x*u+n.x*offset,v,centre.y+t.y*u+n.y*offset); if(f.id==='jansz-corner-keizersgracht'&&v<2.45&&p.z>22.49&&p.z<28.42)p.addScaledVector(new T.Vector3(n.x,0,n.y),1.30); return p;};
  const at=(g:T.BufferGeometry,c:Colour,u:number,y:number,offset:number,name?:string)=>{if(name)g.name=name;const p=point(u,y,offset);add(g,c,p.x,p.y,p.z,angle);};
  const box=(u:number,y:number,width:number,height:number,depth:number,c:Colour,offset=.20)=>{const p=point(u,y,offset);b.box(p.x,p.y,p.z,width,height,depth,c,angle);};
  const rect=(u:number,y:number,width:number,height:number,c:Colour,offset=.055)=>at(new T.PlaneGeometry(width,height),c,u,y+height/2,offset);
  const masonry=(f.id.includes('323')||(['prinsengracht-317','prinsengracht-325','prinsengracht-327','prinsengracht-331'].includes(f.id)))?'dark':f.color as Colour;
  let crown:[number,number][];
  if(f.family==='attic'||f.family==='list')crown=[[0,f.eave],[w,f.eave]];
  else if(f.family==='tuit')crown=[[0,f.eave],[w*.41,f.top-1.1],[w*.41,f.top],[w*.59,f.top],[w*.59,f.top-1.1],[w,f.eave]];
  else crown=canalhouseCrownProfile(f.family==='hals'?'hals':f.family==='clock'?'klok':'punt',w,f.eave,f.top,w*.34,f.eave+(f.top-f.eave)*.40,0);
  const profile=new T.Shape([new T.Vector2(-w/2,0),new T.Vector2(w/2,0),...crown.slice().reverse().map(p=>new T.Vector2(p[0]-w/2,p[1]))]);
  const skin=new T.ShapeGeometry(profile);skin.name=`pulitzer-facade:${f.id}`;add(skin,masonry,centre.x+n.x*.04,0,centre.y+n.y*.04,angle);
  // Crown relief uses the shared canal-house profile. Subordinate carved
  // scrolls/urns are original approximations of the observed silhouette.
  if(f.family==='list'||f.family==='attic'){
   box(0,f.eave-.20,w,.18,.24,'white',.13);box(0,f.eave-.48,w,.16,.18,'stone',.10);
   for(let u=-w/2+.22;u<w/2;u+=.57)box(u,f.eave-.72,.14,.26,.20,'white',.16);
  }else{
   for(let i=0;i<crown.length-1;i++){
    const p=crown[i],q=crown[i+1],L=Math.hypot(q[0]-p[0],q[1]-p[1]);if(L<.02)continue;
    const rim=new T.BoxGeometry(L,f.id==='prinsengracht-323'?.035:.13,.13);rim.rotateZ(Math.atan2(q[1]-p[1],q[0]-p[0]));at(rim,f.id==='prinsengracht-323'?masonry:'white',(p[0]+q[0])/2-w/2,(p[1]+q[1])/2,.15);
   }
   if(f.family==='hals'||f.family==='clock'){
    for(const u of [-w*.32,w*.32]){at(new T.TorusGeometry(.31,.075,4,10,Math.PI*1.75),'stone',u,f.eave+.37,.22);at(new T.SphereGeometry(.17,5,3).scale(1,1.3,.5),'stone',u,f.eave+.92,.23);}
    at(new T.TorusGeometry(w*.17,.08,4,12,Math.PI),'stone',0,f.top-.08,.22);at(new T.SphereGeometry(.24,6,4).scale(1,1.3,.6),'stone',0,f.top+.18,.22);
   }
   if(f.family==='tuit'){box(0,f.top-.10,w*.24,.17,.3,'stone',.19);box(0,f.top-2.65,.12,.15,.60,'stone',.35);}
  }
  const openings:{u:number;y:number;w:number;h:number}[]=[];
  const pane=(name:string,u:number,y:number,pw:number,ph:number,bars=true,frame:Colour='white',horizontal=.63)=>{
   const flatJoinery=f.side==='south'||['prinsengracht-313','keizersgracht-222'].includes(f.id);const trim=.085;rect(u,y-trim,pw+trim*2,ph+trim*2,frame,.11);const glass=new T.PlaneGeometry(pw,ph);at(glass,'glass',u,y+ph/2,.165,`pulitzer-pane:${f.id}:${name}`);
   // Frames are perimeter strokes, glazing owns their open centre.
   for(const du of (flatJoinery?[]:[-pw/2-trim/2,pw/2+trim/2]))box(u+du,y-trim,trim,ph+2*trim,.08,frame,.18);
   for(const v of (flatJoinery?[]:[y-trim/2,y+ph+trim/2]))box(u,v,pw+2*trim,trim,.08,frame,.18);
   if(bars){if(flatJoinery){rect(u,y,.043,ph,frame,.23);for(const h of [ph*.34,ph*horizontal])rect(u,y+h,pw,.04,frame,.23);}else{box(u,y,.043,ph,.04,frame,.23);for(const h of [ph*.34,ph*horizontal])box(u,y+h,pw,.04,.04,frame,.23);}}
   const pc=point(u,y+ph/2,.165);pulitzerPanes.push({id:`${f.id}:${name}`,centre:[pc.x,pc.y,pc.z],tangent:[t.x,t.y],normal:[n.x,n.y],width:pw,height:ph});openings.push({u,y,w:pw+.17,h:ph+.17});
  };
  if(f.side==='south'){
   const pw=w/(f.bays+1)*.72;for(let i=0;i<f.bays;i++){const u=-w/2+w*(i+1)/(f.bays+1);pane(`shopfront-${i}`,u,.2,pw,2.75,true,'stone');for(const y of [3.55,6.8,10.0])if(y+1.9<f.eave-.25)pane(`upper-${i}-${y}`,u,y,pw,2.1,true,'stone');}
   if(f.family==='clock')pane('crown-opening',0,f.eave+.35,w*.27,1.15,false,'stone');
  }else if(f.id==='jansz-corner-keizersgracht'){
   for(let i=0;i<5;i++){const u=-w/2+w*(i+.5)/5;pane(`corner-lower-${i}`,u,.25,1.20,1.85,true,'white');for(const y of [3.2,6.5])pane(`corner-upper-${i}-${y}`,u,y,1.22,2.1,true,'stone');}
  }else if(f.id==='prinsengracht-323'){
   // Both current reference photos show paired narrow, undivided upper lights,
   // rather than one broad central opening. Heights are photo approximations;
   // surveyed shell/roof geometry remains the dimensional authority.
   pane('public-entrance',0,.08,w*.73,4.25,false,'dark');
   for(const u of [-w*.73*.25,w*.73*.25])box(u,.08,.045,4.25,.04,'dark',.23);
   for(const fraction of [.64,.79])box(0,.08+4.25*fraction,w*.73,.045,.04,'dark',.23);
   for(const [row,[y,ph]]of [[6.3,2.40],[9.45,2.18],[12.9,1.95]].entries())for(const [column,u]of [-w*.235,w*.235].entries())pane(`modern-window-${row}-${column}`,u,y,w*.205,ph,false,'dark');
  }else if(f.id==='prinsengracht-317'||f.id==='prinsengracht-327'||f.id==='prinsengracht-331'){
   // Warehouse centre loading openings flanked by small vertical lights;
   // 317/331 retain the characteristic blue-grey external shutter leaves.
   for(const [i,y]of [2.7,5.8,8.9,12.0].entries()){
    if(y+2.3>f.eave+1)continue;pane(`loading-${i}`,0,y,w*.30,2.25,true,'stone');
    for(const u of [-w*.36,w*.36])pane(`side-${i}-${u}`,u,y+.35,w*.09,1.15,false,'stone');
    box(0,y-.19,w*.39,.16,.34,'stone',.26);
    if(f.id!=='prinsengracht-327')for(const sign of [-1,1])box(sign*w*.22,y,w*.10,2.1,.07,'frame',.22);
   }
   pane('ground-central',0,.22,w*.32,1.55,true);for(const u of [-w*.32,w*.32])pane(`ground-side-${u}`,u,.30,w*.17,1.2,true);
  }else if(f.id==='prinsengracht-325'){
   for(const [i,y]of [3.8,6.9,10.0,13.0].entries()){
    pane(`centre-${i}`,0,y,w*.28,2.12,true,'stone');
    for(const sign of [-1,1])pane(`small-${i}-${sign}`,sign*w*.34,y+.32,w*.10,1.13,false,'stone');
    box(0,y-.19,w*.29,.28,.20,'stone',.25);
   }
   pane('entry',w*.32,.16,.75,2.46,false,'stone');pane('lower-window',0,.42,w*.25,1.86,true,'white');pane('basement',-w*.34,.28,w*.13,.75,false,'stone');
  }else{
   const pw=w/(f.bays+1)*.57,centres=Array.from({length:f.bays},(_,i)=>-w/2+w*(i+1)/(f.bays+1));
   const tall=f.id==='keizersgracht-224',arched=f.id==='keizersgracht-234',doorColumn=tall?2:arched?f.bays-1:0,ys=tall?[1.15,4.9,8.2,11.45]:f.eave>=16?[1.7,5.2,8.55,11.9]:[1.75,5.15,8.35,11.35];
   for(const [row,y]of ys.entries())for(const [column,u]of centres.entries()){
    if(y+(row===3?1.8:2.4)>f.eave-.75)continue;
    // The raised main doorway occupies one bay of the lower tier.
    if(row===0&&column===doorColumn)continue;
    pane(`${row}-${column}`,u,y,pw,row===3?1.8:2.40,true,tall?'white':'stone');
   }
   const du=centres[doorColumn],dy=tall?.7:f.side==='east'?.68:.5;
   pane('raised-door',du,dy,pw*.86,2.7,false,tall?'stone':'white');rect(du,dy,pw*.82,arched?1.65:2.1,'dark',.18);
   if(arched){
    // Current individual facade photo puts this round-headed doorway in the
    // northern/rightmost bay, beneath the tall rectangular transom opening.
    const radius=pw*.41,arch=new T.Shape();arch.moveTo(-radius,0);arch.absarc(0,0,radius,Math.PI,0,true);arch.closePath();at(new T.ShapeGeometry(arch,12),'dark',du,dy+1.65,.18);
    at(new T.TorusGeometry(radius+.03,.055,3,12,Math.PI),'stone',du,dy+1.65,.25);
   }
   for(const u of centres.filter(v=>v!==du))pane(`souterrain-${u}`,u,.25,pw*.8,.76,true,'stone');
   box(du,dy-.17,pw+ .4,.17,.65,'stone',.38);box(du,0,pw+.50,.12,1.05,'stone',.63);
   for(const sign of [-1,1]){box(du+sign*(pw/2+.15),dy+.08,.035,.76,.40,'frame',.40);box(du+sign*(pw/2+.15),dy+.84,.07,.055,.45,'frame',.4);}
   if(f.family!=='list'&&f.family!=='attic')pane('attic',0,f.eave+.55,w*.22,Math.min(1.4,f.top-f.eave-1.2),false,'stone');
   if(f.id==='keizersgracht-232')for(const y of [3.1,6.4]){box(0,y,w*.45,.12,.8,'stone',.5);for(let u=-w*.21;u<=w*.21;u+=.24)box(u,y+.12,.035,.63,.035,'frame',.84);box(0,y+.74,w*.46,.065,.055,'frame',.84);}
  }
  // Aperture-aware pale bases reuse the disjoint-pier/lintel subtraction from
  // canalhouseRecipes. No opaque stone strip hides the souterrain panes.
  if(!f.id.endsWith('-323')){
   let cells=[{u:-w/2,y:0,w,h:f.id==='prinsengracht-317'?3.0:1.43}];
   for(const o of openings)cells=cells.flatMap(c=>{const l=Math.max(c.u,o.u-o.w/2-.03),r=Math.min(c.u+c.w,o.u+o.w/2+.03),lo=Math.max(c.y,o.y-.13),hi=Math.min(c.y+c.h,o.y+o.h+.05);if(r<=l||hi<=lo)return[c];return[{u:c.u,y:c.y,w:l-c.u,h:c.h},{u:r,y:c.y,w:c.u+c.w-r,h:c.h},{u:l,y:c.y,w:r-l,h:lo-c.y},{u:l,y:hi,w:r-l,h:c.y+c.h-hi}].filter(c=>c.w>.01&&c.h>.01);});
   for(const c of cells)rect(c.u+c.w/2,c.y,c.w,c.h,f.id==='keizersgracht-226'?'dark':'stone',.08);
  }
  if(f.id==='keizersgracht-224'){
   const y=f.eave+.06;box(0,y,w,.14,.32,'stone',.25);box(0,y+1.0,w,.12,.22,'stone',.23);
   for(let u=-w/2+.20;u<w/2;u+=.30)box(u,y+.16,.075,.76,.14,'stone',.24);
   for(const u of [-w*.40,-w*.18,w*.18,w*.4]){box(u,y+1.07,.25,.15,.26,'stone',.25);at(new T.SphereGeometry(.19,5,3).scale(.7,1.35,.7),'stone',u,y+1.51,.25);}
   const crest=new T.Shape([new T.Vector2(-w*.15,0),new T.Vector2(w*.15,0),new T.Vector2(w*.1,.7),new T.Vector2(0,1.5),new T.Vector2(-w*.1,.7)]);at(new T.ShapeGeometry(crest),'stone',0,y+.32,.27);
   // Four-column facade and carved central doorway surround, no painted name.
   for(const u of [w*.1,w*.3])box(u,1.0,.12,3.3,.17,'stone',.27);
  }
 }
 for(const f of data.facades)facade(f);
 // Exposed garden/court edges have quiet original joinery, kept entirely on
 // source boundaries. Adjacent retained houses are never decorated or hidden.
 for(const [bi,building]of data.buildings.entries())for(const [ri,ring]of building.localRings.entries()){
  for(let i=0;i<ring.length;i++){
   const a=ring[i],c=ring[(i+1)%ring.length],dx=c[0]-a[0],dz=c[1]-a[1],L=Math.hypot(dx,dz);if(L<3)continue;
   // This observed conservatory has its own broad assembly below.
   const conservatory=data.gardenConservatory;
   if(building.id===conservatory.bagPand&&((Math.hypot(a[0]-conservatory.a[0],a[1]-conservatory.a[1])<.02&&Math.hypot(c[0]-conservatory.b[0],c[1]-conservatory.b[1])<.02)||(Math.hypot(c[0]-conservatory.a[0],c[1]-conservatory.a[1])<.02&&Math.hypot(a[0]-conservatory.b[0],a[1]-conservatory.b[1])<.02)))continue;
   const mx=(a[0]+c[0])/2,mz=(a[1]+c[1])/2;
   if(ri===0&&(mx<-38||mx>41||mz>30))continue;
   // Internal boundaries facing unmapped gardens receive two or three bays,
   // limited to the height of the actual adjoining surveyed roof.
   const normal=new T.Vector2(dz,-dx).normalize();let area=0;for(let k=0;k<ring.length;k++)area+=ring[k][0]*ring[(k+1)%ring.length][1]-ring[(k+1)%ring.length][0]*ring[k][1];if(area<0)normal.negate();if(ri>0)normal.negate();
   const angle=Math.atan2(normal.x,normal.y),count=Math.floor(L/3.2);
   for(let k=0;k<count;k++){
    const frac=(k+.5)/count,x=a[0]+dx*frac,z=a[1]+dz*frac;
    // A courtyard wall rises only as high as its nearby roof plane.
    const heights=data.roofRegions.filter(r=>r.rings[0].some(p=>Math.hypot(p[0]-x,p[1]-z)<5)).map(r=>r.plane[0]*x+r.plane[1]*z+r.plane[2]);const roof=Math.min(14,Math.max(3,...heights));
    for(let y=1.1;y+1.7<roof;y+=3.1){const frame=new T.PlaneGeometry(1.21,1.94);add(frame,'stone',x+normal.x*.10,y+.9,z+normal.y*.10,angle);const pane=new T.PlaneGeometry(.98,1.67);pane.name=`pulitzer-court-pane:${bi}:${ri}:${i}:${k}:${y}`;add(pane,'glass',x+normal.x*.145,y+.9,z+normal.y*.145,angle);}
   }
  }
 }
 // Current operator photos show broad black-framed glass against white walls,
 // not the small stone-framed windows used for unresolved surrounding courts.
 // The operator plan localizes this west conservatory to the existing surveyed
 // boundary. Heights and seven simplified bays are photo-guided approximations;
 // the source roof owns its silhouette and no extra garden footprint is filled.
 const garden=data.gardenConservatory,ga=new T.Vector2(...garden.a as [number,number]),gb=new T.Vector2(...garden.b as [number,number]);
 const gd=gb.clone().sub(ga),length=gd.length(),gt=gd.clone().normalize(),gn=new T.Vector2(gt.y,-gt.x),gangle=Math.atan2(gn.x,gn.y);
 const gp=(u:number,y:number,offset:number)=>new T.Vector3(ga.x+gt.x*u+gn.x*offset,y,ga.y+gt.y*u+gn.y*offset);
 const gadd=(geometry:T.BufferGeometry,colour:Colour,u:number,y:number,offset:number)=>{const p=gp(u,y,offset);add(geometry,colour,p.x,p.y,p.z,gangle);};
 const gbox=(u:number,y:number,w:number,h:number,colour:Colour)=>{const p=gp(u,y,.24);b.box(p.x,p.y,p.z,w,h,.07,colour,gangle);};
 const [ra,rz,rd]=data.roofRegions[garden.roofRegion].plane;
 const wallTop=(p:T.Vector2)=>ra*p.x+rz*p.y+rd;
 const whiteWall=new T.Shape([new T.Vector2(0,0),new T.Vector2(-length,0),new T.Vector2(-length,wallTop(gb)),new T.Vector2(0,wallTop(ga))]);
 const whiteSkin=new T.ShapeGeometry(whiteWall);whiteSkin.name='pulitzer-conservatory:white-wall';gadd(whiteSkin,'white',0,0,.17);
 const inset=.13,bay=(length-2*inset)/garden.approximateBayCount,ph=garden.glassTop-garden.glassBottom;
 for(let i=0;i<garden.approximateBayCount;i++){
  const u=inset+bay*(i+.5),pw=bay-.075,glass=new T.PlaneGeometry(pw,ph);const id=`garden-conservatory:${i}`;glass.name=`pulitzer-pane:${id}`;gadd(glass,'glass',u,garden.glassBottom+ph/2,.215);
  const pc=gp(u,garden.glassBottom+ph/2,.215);pulitzerPanes.push({id,centre:pc.toArray() as [number,number,number],tangent:[gt.x,gt.y],normal:[gn.x,gn.y],width:pw,height:ph});
 }
 for(let i=0;i<=garden.approximateBayCount;i++)gbox(inset+bay*i,garden.glassBottom,.075,ph,'dark');
 for(const y of [garden.glassBottom,garden.glassBottom+ph*.38,garden.glassTop])gbox(length/2,y-.035,length-2*inset,.07,'dark');

}
