import {bridgeLngLat,bridgeLocalPoint,bridgeProfileAt,insideBridgeOutline,type BridgeSurface} from './bridgeSurface.js';
export type InstalledBridge = BridgeSurface & {waterFootprint?:any;approachTriangles:number[][][];mesh:{url:string;batches:any[];sha256:string};review:{triangles:number;geometryBytes:number}};
/** Barycentric plane: gameplay samples the exact baked road ribbon. */
export function approachHeight(triangle:number[][],p:readonly[number,number]):number|null {
 const [a,b,c]=triangle,d=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(d)<1e-8)return null;
 const u=((b[1]-c[1])*(p[0]-c[0])+(c[0]-b[0])*(p[1]-c[1]))/d;
 const v=((c[1]-a[1])*(p[0]-c[0])+(a[0]-c[0])*(p[1]-c[1]))/d,w=1-u-v;
 return u>=-1e-6&&v>=-1e-6&&w>=-1e-6?u*a[2]+v*b[2]+w*c[2]:null;
}
export function measuredBridgeHeight(bridge:InstalledBridge,ll:readonly[number,number]):number|null {
 const point=bridgeLocalPoint(bridge,[...ll]);
 if(insideBridgeOutline(point,bridge.outline))return bridgeProfileAt(bridge,24+point[0]*bridge.deckAxis[0]+point[1]*bridge.deckAxis[1]).heightM;
 for(const triangle of bridge.approachTriangles){const value=approachHeight(triangle,point);if(value!==null)return value;}
 return null;
}
/** A bounded local index: pose queries never scan the city catalogue. */
export class BridgeSpatialIndex {
 private cells=new Map<string,InstalledBridge[]>();
 constructor(bridges:InstalledBridge[]) {
  for(const bridge of bridges) {const ll=[...bridge.outline,...bridge.samples.map(s=>s.point)].map(p=>bridgeLngLat(bridge,p));
   const minx=Math.floor((Math.min(...ll.map(p=>p[0]))-.00015)*1000),maxx=Math.floor((Math.max(...ll.map(p=>p[0]))+.00015)*1000);
   const miny=Math.floor((Math.min(...ll.map(p=>p[1]))-.0001)*1000),maxy=Math.floor((Math.max(...ll.map(p=>p[1]))+.0001)*1000);
   for(let x=minx;x<=maxx;x++)for(let y=miny;y<=maxy;y++){const key=`${x}:${y}`,bucket=this.cells.get(key)||[];bucket.push(bridge);this.cells.set(key,bucket);}
  }
 }
 query(ll:readonly[number,number]) {return this.cells.get(`${Math.floor(ll[0]*1000)}:${Math.floor(ll[1]*1000)}`)||[];}
}
