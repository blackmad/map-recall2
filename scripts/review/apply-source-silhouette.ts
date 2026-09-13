/** Clips source-space preview geometry to an inspected pixel silhouette.
 * This deliberately changes only the synthetic study owner, never 3DBAG. */
import {ShapeUtils,Vector2} from 'three';
type Point=[number,number,number]; type Pixel=[number,number];
const EPS=1e-9;
const area=(a:number[],b:number[],c:number[])=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const finite=(p:number[])=>p.length===3&&p.every(Number.isFinite);
function unique(points:Pixel[]){return points.filter((p,i)=>i===0||p[0]!==points[i-1][0]||p[1]!==points[i-1][1]);}
function clipConvex(subject:Point[],clip:Pixel[]){
 let output=subject;const orientation=clip.reduce((sum,p,i)=>sum+p[0]*clip[(i+1)%clip.length][1]-clip[(i+1)%clip.length][0]*p[1],0)>=0?1:-1;
 for(let i=0;i<clip.length&&output.length;i++){const a=clip[i],b=clip[(i+1)%clip.length],input=output;output=[];const side=(p:Point)=>orientation*area(a,b,[p[0],p[1]]);for(let j=0;j<input.length;j++){const p=input[j],q=input[(j+1)%input.length],sp=side(p),sq=side(q),insideP=sp>=-EPS,insideQ=sq>=-EPS;if(insideP)output.push(p);if(insideP!==insideQ){const ratio=sp/(sp-sq);output.push([p[0]+(q[0]-p[0])*ratio,p[1]+(q[1]-p[1])*ratio,p[2]+(q[2]-p[2])*ratio]);}}
 }
 return output;
}
function local(frame:any,p:number[]):[number,number,number]{const dx=p[0]-frame.a[0],dz=p[2]-frame.a[1];return [dx*frame.u[0]+dz*frame.u[1],p[1],-(dx*frame.n[0]+dz*frame.n[1])];}
function world(frame:any,p:[number,number,number]):Point{return [frame.a[0]+frame.u[0]*p[0]-frame.n[0]*p[2],p[1],frame.a[1]+frame.u[1]*p[0]-frame.n[1]*p[2]];}
/** `polygonPx` is source pixel-edge order. X is mirrored to retain photo left/right. */
export function applySourceSilhouette(study:any,input:{width:number;height:number},polygonPx:Pixel[]){
 if(!study?.mode||study.mode!=='source-space-shape-study'||!study.frame||!Array.isArray(study?.patches)||!Number.isFinite(input?.width)||!Number.isFinite(input?.height)||input.width<=0||input.height<=0)throw Error('Source-space silhouette requires a valid study and dimensions');
 const source=unique(polygonPx);if(source.length<3||source.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)||p[0]<0||p[0]>input.width||p[1]<0||p[1]>input.height))throw Error('Invalid source silhouette pixels');
 const scale=.01,margin=.12,toLocal=([x,y]:Pixel):Pixel=>[input.width*scale+margin-x*scale,input.height*scale-y*scale];
 const silhouette=source.map(toLocal),faces=ShapeUtils.triangulateShape(silhouette.map(p=>new Vector2(...p)),[]);if(!faces.length)throw Error('Degenerate source silhouette');
 const triangles=silhouette.map(p=>[p[0],p[1]] as Pixel),clipped:any[]=[];
 for(const patch of study.patches){const out:number[]=[];for(let offset=0;offset<patch.triangles.length;offset+=9){const original:[Point,Point,Point]=[[patch.triangles[offset],patch.triangles[offset+1],patch.triangles[offset+2]],[patch.triangles[offset+3],patch.triangles[offset+4],patch.triangles[offset+5]],[patch.triangles[offset+6],patch.triangles[offset+7],patch.triangles[offset+8]]];if(!original.every(finite))continue;const localTriangle=original.map(p=>local(study.frame,p));for(const face of faces){const clippedPolygon=clipConvex(localTriangle,[triangles[face[0]],triangles[face[1]],triangles[face[2]]]);for(let i=1;i+1<clippedPolygon.length;i++){const tri=[world(study.frame,clippedPolygon[0]),world(study.frame,clippedPolygon[i]),world(study.frame,clippedPolygon[i+1])];const ab=tri[1].map((v,j)=>v-tri[0][j]),ac=tri[2].map((v,j)=>v-tri[0][j]),cross=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];if(Math.hypot(...cross)>EPS&&tri.flat().every(Number.isFinite))out.push(...tri.flat());}}
 }
 if(out.length)clipped.push({...patch,triangles:out,sign:undefined});
 }
 const ring=silhouette.map(p=>world(study.frame,[p[0],p[1],0]));study.owner.geometry.building.surfaces[0].rings=[ring];study.patches=clipped;study.sourceSilhouette={mode:'source-pixel-approximate',polygonPx:source,coordinateConvention:'pixel-edge; source x mirrored into study frame',patchesClipped:true};return study;
}
