import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import outline from './kriterion-front-lettering.json';
/** Observed real thin fabricated sign, bounded OFL font-family approximation.
 * caller supplies actual panel origin at baseline; glyph fronts face +Z before
 * yaw. Font outline holes remain open. Gold body/red face approximate the
 * observed red tube with pale gold edge, without invented pixel lettering. */
export function addKcriterionFrontLettering(b:BuildingTools,origin:T.Vector3,angle:number,width=6.1,height=.78){
 const path=new T.ShapePath();
 for(const command of outline.commands){const c=command as{type:string,x?:number,y?:number,x1?:number,y1?:number,x2?:number,y2?:number};if(c.type==='M')path.moveTo(c.x!,-c.y!);else if(c.type==='L')path.lineTo(c.x!,-c.y!);else if(c.type==='Q')path.quadraticCurveTo(c.x1!,-c.y1!,c.x!,-c.y!);else if(c.type==='C')path.bezierCurveTo(c.x1!,-c.y1!,c.x2!,-c.y2!,c.x!,-c.y!);else if(c.type==='Z')path.currentPath!.closePath();}
 const shapes=path.toShapes(false),base=new T.ExtrudeGeometry(shapes,{depth:.024,bevelEnabled:false,curveSegments:8});base.computeBoundingBox();const bb=base.boundingBox!,size=bb.getSize(new T.Vector3()),cx=(bb.min.x+bb.max.x)/2,cy=bb.min.y;base.translate(-cx,-cy,0);base.scale(width/size.x,height/size.y,1);
 const front=new T.ShapeGeometry(shapes,8);front.translate(-cx,-cy,.027);front.scale(width/size.x,height/size.y,1);
 // Red face remains exactly on each glyph contour; pale gold relief shows at
 // oblique angles. Exact neon tube section/illumination remain approximate.
 for(const [geometry,colour]of[[base,'gold'],[front,'red']]as const){geometry.rotateY(angle);geometry.translate(origin.x,origin.y,origin.z);b.add(geometry,colour);}
}
