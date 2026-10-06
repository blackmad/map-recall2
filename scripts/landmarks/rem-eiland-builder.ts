import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
/** Bounded stair and helipad-marking repair; historical massing is retained. */
export function buildRemEiland(w:number,d:number,b:BuildingTools){
 const {add,box,sign}=b;
 function strut(a:T.Vector3,c:T.Vector3,r:number,colour:Parameters<BuildingTools['add']>[1]){const delta=c.clone().sub(a),g=new T.CylinderGeometry(r,r,delta.length(),6);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize()));const mid=a.clone().add(c).multiplyScalar(.5);add(g,colour,mid.x,mid.y,mid.z);}

  let width=w*.95,depth=d*.93;
  for(let x of [-width*.4,width*.4])for(let z of [-depth*.4,depth*.4]){box(x,0,z,.8,12,.8,'red');}
  for(let z of [-depth*.4,depth*.4])for(let s of [-1,1])strut(new T.Vector3(-width*.4,s<0?1:11,z),new T.Vector3(width*.4,s<0?11:1,z),.17,'red');
  box(0,12,0,width,1,depth,'white');box(0,13,0,width*.89,6.5,depth*.88,'red');for(let x=-width*.37;x<width*.4;x+=3)for(let z of [-depth*.447,depth*.447])box(x,14.5,z,2,2.5,.15,'glass');box(0,19.5,0,width+1,.6,depth+1,'white');
  // Keep the existing historical helipad massing for this bounded repair.
  // Roof access must pass through a gap in the perimeter railing.
  const stairWidth=1.6,nearX=(width+1)/2+.9,farX=nearX+stairWidth;
  const nearZ=-depth*.36,farZ=depth*.36;
  for(const z of [-(depth+1)/2,(depth+1)/2]){
   box(0,21.1,z,width+1,.1,.12,'frame');
   for(let x=-(width+1)/2;x<=(width+1)/2;x+=3)box(x,20.1,z,.12,1,.12,'frame');
  }
  box(-(width+1)/2,21.1,0,.12,.1,depth+1,'frame');
  for(let z=-(depth+1)/2;z<=(depth+1)/2;z+=2)box(-(width+1)/2,20.1,z,.12,1,.12,'frame');
  const edgeX=(width+1)/2,gapStart=farZ-1,gapEnd=farZ+1;
  for(const [start,end] of [[-(depth+1)/2,gapStart],[gapEnd,(depth+1)/2]])if(end>start){
   box(edgeX,21.1,(start+end)/2,.12,.1,end-start,'frame');
   for(let z=start;z<=end;z+=2)box(edgeX,20.1,z,.12,1,.12,'frame');
  }
  box(width*.3,20,0,4,4.6,depth*.6,'red');box(width*.3,24.6,0,4.5,.6,depth*.7,'white');box(width*.3,25.2,0,.25,9,.25,'frame');
  add(new T.CylinderGeometry(depth*.58,depth*.58,.35,16),'slate',-width*.1,20.5,0);
  // Three shallow strips in the XZ plane: the generic sign primitive is vertical.
  for(const x of [-width*.1-.9,-width*.1+.9])box(x,20.68,0,.35,.025,3,'white');
  box(-width*.1,20.68,0,2.15,.025,.35,'white');sign('REM',0,17.5,depth*.45,.17);
  // Architect's description establishes a winding exterior route connecting
  // decks and roof; routing/widths are approximate, not surveyed tread counts.
  // Replace the detached, steep thirteen-step fragment with continuous flights,
  // switchback landings, exposed stringers and handrails outside the wall shell.
  function stairFlight(x:number,z0:number,z1:number,y0:number,y1:number){
   const count=Math.ceil((y1-y0)/.24),run=(z1-z0)/count,rise=(y1-y0)/count;
   for(let j=0;j<count;j++)box(x,y0+(j+1)*rise-.1,z0+(j+.5)*run,stairWidth,.1,Math.abs(run)+.025,'frame');
   for(const side of [-1,1]){
    const sx=x+side*(stairWidth/2-.07);
    strut(new T.Vector3(sx,y0-.08,z0),new T.Vector3(sx,y1-.08,z1),.07,'frame');
    strut(new T.Vector3(sx,y0+1,z0),new T.Vector3(sx,y1+1,z1),.045,'frame');
    for(let j=0;j<=count;j+=3)box(sx,y0+j*rise,z0+j*run,.07,1,.07,'frame');
   }
  }
  function stairLanding(y:number,z:number,connectDeck=false){
   const left=connectDeck?width*(y<15?.46:.43):nearX-stairWidth/2,right=farX+stairWidth/2;
   box((left+right)/2,y-.12,z,right-left,.12,2,'frame');
   const outerZ=z+(z>0?1:-1);
   box((left+right)/2,y+1,outerZ,right-left,.08,.08,'frame');
   for(let x=left;x<=right;x+=1)box(x,y,outerZ,.07,1,.07,'frame');
   box(right,y+1,z,.08,.08,2,'frame');box(right,y,z,.07,1,.07,'frame');
  }
  // Source photographs show the first stair joined to a raised steel footbridge,
  // not a stair down into the water. Keep a narrow approach through the undercroft;
  // its 1 m datum and the connection beyond the native edge remain approximate.
  const approachX=nearX-stairWidth/2-.6,bridgeStart=-width/2,bridgeZ=0,approachZ=nearZ-.65;
  box((bridgeStart+approachX)/2,.88,bridgeZ,approachX-bridgeStart,.12,1.2,'frame');
  box(approachX,.88,approachZ/2,1.2,.12,-approachZ+1.2,'frame');
  box(approachX+.6,.88,approachZ,1.2,.12,1.2,'frame');
  for(const side of [-1,1]){
   const railEnd=approachX+(side>0?.6:-.6);
   box((bridgeStart+railEnd)/2,2,bridgeZ+side*.6,railEnd-bridgeStart,.08,.08,'frame');
   for(let x=bridgeStart;x<=approachX-.6;x+=2)box(x,1,bridgeZ+side*.6,.07,1,.07,'frame');
  }
  // The negative-Z bridge rail stops before the elbow; the negative-X return
  // guards the exposed outer edge without barring passage onto the landing.
  box(approachX-.6,2,approachZ/2,.08,.08,-approachZ,'frame');
  for(let z=approachZ;z<=0;z+=1.5)box(approachX-.6,1,z,.07,1,.07,'frame');
  box(approachX,2,approachZ-.6,1.2,.08,.08,'frame');
  stairLanding(1,nearZ);
  stairFlight(nearX,nearZ,farZ,1,5);stairLanding(5,farZ);
  stairFlight(farX,farZ,nearZ,5,9);stairLanding(9,nearZ);
  stairFlight(nearX,nearZ,farZ,9,13);stairLanding(13,farZ,true);
  stairFlight(farX,farZ,nearZ,13,16.55);stairLanding(16.55,nearZ);
  stairFlight(nearX,nearZ,farZ,16.55,20.1);stairLanding(20.1,farZ,true);

}
