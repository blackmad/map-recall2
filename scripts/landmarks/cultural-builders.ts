import * as T from 'three';
type Colour='brick'|'stone'|'slate'|'white'|'gold'|'glass'|'dark'|'frame'|'red'|'blue'|'pink';
export interface BuildingTools {
 add(g:T.BufferGeometry,c:Colour,x?:number,y?:number,z?:number,angle?:number):void;
 box(x:number,y:number,z:number,w:number,h:number,d:number,c:Colour,angle?:number):void;
 prism(x:number,y:number,z:number,w:number,d:number,h:number,c:Colour):void;
 gableRoof(x:number,y:number,z:number,w:number,d:number,h:number,c:Colour):void;
 hip(x:number,y:number,z:number,w:number,d:number,h:number,c:Colour):void;
 window(x:number,y:number,z:number,w:number,h:number):void;
 clock(x:number,y:number,z:number,wind?:boolean):void;
 sign(text:string,x:number,y:number,z:number,pixel:number,c?:Colour):void;
}
/** Each model is authored against its measured footprint, not stretched after export. */
export function buildCulturalLandmark(id:string,w:number,d:number,b:BuildingTools){
 const {add,box,prism,gableRoof,hip,window,clock,sign}=b;
 function grid(x:number,y:number,z:number,width:number,height:number,depth:number,c:Colour='stone',step=4){
  box(x,y,z,width,height,depth,c);box(x,y+height,z,width+.4,.3,depth+.4,'slate');
  for(let v=y+1.2;v<y+height-1.3;v+=3.4){for(let u=-width/2+1.5;u<width/2-1;u+=step)for(let s of [-1,1])box(x+u,v,z+s*(depth/2+.05),step*.6,1.9,.12,'glass');for(let u=-depth/2+1.5;u<depth/2-1;u+=step)for(let s of [-1,1])box(x+s*(width/2+.05),v,z+u,.12,1.9,step*.6,'glass');}
 }
 function rail(x:number,y:number,z:number,width:number,depth:number){for(let s of [-1,1]){box(x,y,z+s*depth/2,width,.1,.12,'frame');box(x+s*width/2,y,z,.12,.1,depth,'frame');}for(let u=-width/2;u<=width/2;u+=3)for(let s of [-1,1])box(x+u,y-1,z+s*depth/2,.12,1,.12,'frame');}
 function ellipse(x:number,y:number,z:number,rx:number,rz:number,height:number,c:Colour){let g=new T.CylinderGeometry(1,1,height,24);g.scale(rx,1,rz);add(g,c,x,y+height/2,z);}
 function strut(a:T.Vector3,c:T.Vector3,r:number,colour:Colour){let delta=c.clone().sub(a),g=new T.CylinderGeometry(r,r,delta.length(),6);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize()));let mid=a.clone().add(c).multiplyScalar(.5);add(g,colour,mid.x,mid.y,mid.z);}
 if(id==='van-gogh-museum'){
  // Rietveld's stacked rectilinear block with glass stair bay; Kurokawa's ellipse.
  let rw=w*.46,rd=d*.77,cx=-w*.25;
  box(cx,0,0,rw,14,rd,'stone');box(cx,14,0,rw,1.3,rd,'white');box(cx+rw*.18,15.3,0,rw*.65,3.1,rd*.75,'stone');
  for(let y of [4.7,10.2]){box(cx,y,rd/2+.04,rw,.8,.1,'dark');box(cx,y,-rd/2-.04,rw,.8,.1,'dark');}box(cx-rw/2-.03,1,0,.2,15.5,rd*.31,'glass');for(let z=-rd*.15;z<=rd*.15;z+=1.7)box(cx-rw/2-.2,1,z,.15,15.5,.1,'frame');
  let ex=w*.27,rx=w*.23,rz=d*.36;ellipse(ex,0,0,rx,rz,6.5,'stone');let dome=new T.SphereGeometry(1,24,6,0,Math.PI*2,0,Math.PI/2);dome.scale(rx,3.7,rz);add(dome,'slate',ex,6.5,0);box(ex-w*.07,6.6,0,w*.2,5.4,d*.18,'stone',-.22);ellipse(ex,0,d*.25,rx*.92,rz*.49,4.2,'glass');
  for(let i=0;i<16;i++){let a=i*Math.PI*2/16;box(ex+rx*Math.cos(a),.4,rz*Math.sin(a),.15,5.8,.15,'frame');}sign('VAN GOGH',cx,12.4,rd/2+.15,.14,'dark');
 }else if(id==='stedelijk-museum'){
  // Weissman's brick museum remains visible behind the new Museumplein wing.
  grid(0,0,-d*.29,w*.87,15.2,d*.33,'brick',5.8);
  for(let x of [-w*.36,w*.36]){
   grid(x,0,-d*.005,w*.15,14.8,d*.39,'brick',4);
   gableRoof(x,14.8,-d*.005,w*.16,d*.41,4.8,'slate');
  }
  gableRoof(0,15.2,-d*.29,w*.88,d*.34,5,'slate');
  for(let x of [-w*.33,0,w*.33]){
   box(x,13.5,-d*.33,10,7.2,11,'brick');
   for(let y of [14,17.5,20.3])box(x,y,-d*.33,10.6,.3,11.6,'stone');
   hip(x,20.7,-d*.33,11,12,6,'slate');
   box(x,26.7,-d*.33,2.1,1.8,2.1,'stone');
   hip(x,28.5,-d*.33,2.7,2.7,1.4,'slate');
  }
  for(let y of [1.1,4.8,8.5,12.2,14.8])box(0,y,-d*.123,w*.88,.26,.26,'stone');
  // A tapered rounded rectangular shell: broad rim above a narrow underside.
  // The oversized canopy is at the TOP, its uninterrupted white edge defines
  // the building. The earlier block placed this canopy beneath the bathtub.
  const length=w*.71,depth=d*.37,z=d*.215;
  function outline(width:number,deep:number,r:number){
   const out:number[][]=[];
   for(const [cx,cz,start] of [[width/2-r,deep/2-r,0],[-width/2+r,deep/2-r,90],[-width/2+r,-deep/2+r,180],[width/2-r,-deep/2+r,270]])
    for(let i=0;i<=5;i++){let angle=(start+i*90/5)*Math.PI/180;out.push([cx+r*Math.cos(angle),cz+r*Math.sin(angle)]);}
   return out;
  }
  const levels=[{y:5.4,w:length*.82,d:depth*.67,r:4},{y:6.2,w:length*.87,d:depth*.75,r:5},{y:8.7,w:length*.95,d:depth*.9,r:6},{y:15.7,w:length,d:depth,r:6}];
  const rings=levels.map(l=>outline(l.w,l.d,l.r));const positions:number[]=[];
  function tri(a:number[],b:number[],c:number[]){positions.push(...a,...b,...c);}
  for(let j=0;j<rings.length-1;j++)for(let i=0;i<rings[j].length;i++){
   const n=(i+1)%rings[j].length,p=(k:number,l:number)=>[rings[k][l][0],levels[k].y,rings[k][l][1]+z];
   tri(p(j,i),p(j+1,i),p(j+1,n));tri(p(j,i),p(j+1,n),p(j,n));
  }
  for(const j of [0,rings.length-1])for(let i=0;i<rings[j].length;i++)tri([0,levels[j].y,z],[rings[j][i][0],levels[j].y,rings[j][i][1]+z],[rings[j][(i+1)%rings[j].length][0],levels[j].y,rings[j][(i+1)%rings[j].length][1]+z]);
  const shell=new T.BufferGeometry();shell.setAttribute('position',new T.Float32BufferAttribute(positions,3));shell.computeVertexNormals();add(shell,'white');
  box(0,15.7,z+.8,length*1.29,.65,depth*1.28,'white');
  box(0,16.35,z,length*.78,.12,depth*.73,'slate');
  for(let x of [-length*.23,length*.23])box(x,16.47,z,length*.24,.8,depth*.32,'glass');
  box(0,0,z,length*.73,5.4,depth*.68,'glass');
  for(let x=-length*.34;x<=length*.34;x+=4.6)box(x,0,z+depth*.35,.12,5.5,.18,'frame');
  for(let x of [-length*.56,length*.56])box(x,0,z+depth*.43,.35,15.7,.35,'frame');
  sign('STEDELIJK',0,3.5,z+depth*.36,.22,'white');
 }else if(id==='oba-oosterdok'){
  // Rotate authored façade to the short side of this north/south plot.
  grid(0,0,0,w*.92,31,d*.92,'stone',5);
  box(0,31,-d*.02,w,4.3,d*.97,'stone');box(0,32,d*.51,w*.88,2,.2,'glass');box(0,35.3,0,w,.5,d,'slate');
  for(let z=-d*.42;z<=d*.42;z+=5.3){box(w*.465,4,z,.15,25,3.4,'dark');box(w*.475,4,z,.25,25,.37,'stone');}
  // Waterfront entrance is on model +X (east/south in fitted orientation).
  box(w*.49,0,0,5,5.5,d*.68,'glass');box(w*.47,5.5,0,8,.65,d*.84,'stone');for(let z of [-d*.3,0,d*.3])box(w*.55,0,z,.9,5.5,.9,'white');sign('OBA',w*.24,6.4,d*.49,.28,'red');
 }else if(id==='adam-tower'){
  box(0,0,0,w*.98,5,d*.91,'dark');let side=d*.71;
  grid(0,5,0,side,61,side,'dark',3.1);for(let y=8;y<65;y+=3.2){for(let z of [-side/2-.1,side/2+.1])box(0,y,z,side,.18,.16,'white');for(let x of [-side/2-.1,side/2+.1])box(x,y,0,.16,.18,side,'white');}for(let x=-side/2;x<=side/2;x+=3.1)for(let z of [-side/2-.14,side/2+.14])box(x,5,z,.18,61,.15,'white');
  // Flared observation crown and roof terrace, with the rooftop swing.
  box(0,66,0,side+10,1.6,side+10,'white');box(0,67.6,0,side+8,7.2,side+8,'glass');box(0,74.8,0,side+11,1.2,side+11,'white');rail(0,77,0,side+10,side+10);box(-side*.24,76,-side*.25,6,3,6,'white');for(let z of [-side/2-3,side/2+3])box(0,76,z,9,3,.22,'red');box(0,78.7,side/2+3,9,.25,.25,'red');box(-side*.24,79,-side*.25,1,9,1,'white');for(let y of [80,82.5,85]){box(-side*.24,y,-side*.25+1.1,1.5,.2,.15,'dark',.65);box(-side*.24,y,-side*.25+1.2,1.5,.2,.15,'dark',-.65);}
 }else if(id==='pontsteiger'){
  // Raised low U, two slim tower legs and eight storeys in the skybridge.
  let leg=w*.19,span=w*.96,rear=-d*.29;
  for(let x of [-span/2+leg/2,span/2-leg/2]){grid(x,7,0,leg,21,d*.95,'stone',3.7);grid(x,28,rear,leg,61,d*.31,'stone',3.7);for(let z=-d*.4;z<=d*.4;z+=d*.2)box(x,0,z,1.6,7,1.6,'stone');}
  grid(0,7,d*.38,span,21,d*.18,'stone',3.7);grid(0,61,rear,span,28,d*.31,'stone',3.7);rail(0,89.4,rear,span,d*.31);
  for(let x of [-w*.2,w*.2])box(x,0,d*.28,12,3.8,8,'glass');
 }else if(id==='rem-eiland'){
  let width=w*.95,depth=d*.93;
  for(let x of [-width*.4,width*.4])for(let z of [-depth*.4,depth*.4]){box(x,0,z,.8,12,.8,'red');}
  for(let z of [-depth*.4,depth*.4])for(let s of [-1,1])strut(new T.Vector3(-width*.4,s<0?1:11,z),new T.Vector3(width*.4,s<0?11:1,z),.17,'red');
  box(0,12,0,width,1,depth,'white');box(0,13,0,width*.89,6.5,depth*.88,'red');for(let x=-width*.37;x<width*.4;x+=3)for(let z of [-depth*.447,depth*.447])box(x,14.5,z,2,2.5,.15,'glass');box(0,19.5,0,width+1,.6,depth+1,'white');rail(0,21.1,0,width+1,depth+1);box(width*.3,20,0,4,4.6,depth*.6,'red');box(width*.3,24.6,0,4.5,.6,depth*.7,'white');box(width*.3,25.2,0,.25,9,.25,'frame');
  add(new T.CylinderGeometry(depth*.58,depth*.58,.35,16),'slate',-width*.1,20.5,0);sign('H',-width*.1,20.9,depth*.25,.18,'white');sign('REM',0,17.5,depth*.45,.17);for(let j=0;j<13;j++)box(width*.48,12-j*.85,depth*.39+j*.28,2.2,.25,.55,'frame');
 }else if(id==='paradiso'){
  // Long church nave; entrance at the short northeast end.
  box(0,0,0,w*.97,11,d*.94,'brick');gableRoof(0,11,0,w*.97,d*.94,6,'slate');
  for(let x=-w*.38;x<w*.4;x+=4.5)for(let z of [-d*.48,d*.48])window(x,5.2,z,2,4.5);
  let fx=w*.44;box(fx,0,0,w*.1,13,d*.97,'brick');for(let y of [1,4.2,10.7,12.8])box(fx,y,0,w*.12,.38,d,'stone');prism(fx,13,0,w*.14,d*.98,4,'brick');
  // Portal and round-arched triplet on the actual short front (rotate a local elevation).
  for(let z of [-d*.29,0,d*.29]){box(w*.501,5.8,z,.25,4.5,2.1,'dark');box(w*.507,5.65,z,.4,.2,2.7,'stone');}
  box(w*.505,0,0,.35,3.8,3.8,'stone');box(w*.513,.4,0,.4,3,2.8,'dark');box(w*.515,12,0,.2,2,2,'white');sign('PARADISO',0,3.9,d*.5,.15,'white');
 }else if(id==='melkweg'){
  grid(0,0,0,w*.95,10,d*.9,'brick',4);prism(-w*.16,10,0,w*.48,d*.91,4.5,'slate');prism(w*.3,10,0,w*.24,d*.91,4.5,'slate');prism(-w*.16,10,d*.456,w*.49,.55,4.5,'brick');prism(w*.3,10,d*.456,w*.25,.55,4.5,'brick');
  box(-w*.16,0,d*.5,w*.44,3.5,3.4,'glass');box(-w*.16,3.5,d*.5,w*.49,.45,4,'dark');sign('MELKWEG',-w*.13,7.7,d*.46,.24,'white');for(let x of [-w*.34,w*.13,w*.37]){box(x,11.5,d*.48,.15,1.4,.15,'white');box(x,12.1,d*.48,1.2,.15,.15,'white');}box(w*.25,0,-d*.28,w*.46,16,d*.33,'dark');box(w*.25,16,-d*.28,w*.47,.3,d*.34,'slate');
 }else throw Error(`No builder for ${id}`);
}
