/** A compact, unregistered photo-to-SVG experiment. Coordinates are integer
 * positions in a 1000 × 1000 image plane; they are never building metres. */
import type {FacadeFeature} from '../facadeDescription.js';

export type Point = [number,number];
export type Polygon = Point[];
export type WallMaterial = 'brick'|'stone'|'render'|'painted-masonry'|'unknown';
export type RoofMaterial = 'tile'|'slate'|'metal'|'unknown';
export type Visibility = 'observed'|'inferred'|'unknown';
export interface FacadeSvgExperiment {
 version:1;
 walls:{points:Polygon;colour:string;material:WallMaterial}[];
 openings:{kind:'window'|'door'|'shop';bounds:[number,number,number,number];shape:'rect'|'arched';frameColour:string;colour:string;visibility:Visibility}[];
 roof?:{points:Polygon;colour:string;material:RoofMaterial};
 occlusions?:{points:Polygon;kind:'tree'|'vehicle'|'other'}[];
 notes:string;
}

const coordinate={type:'integer',minimum:0,maximum:1000} as const;
const point={type:'array',items:coordinate,minItems:2,maxItems:2} as const;
const polygon={type:'array',items:point,minItems:3,maxItems:32} as const;
const colour={type:'string',pattern:'^#[0-9A-Fa-f]{6}$'} as const;
export const FACADE_SVG_JSON_SCHEMA={
 type:'object',additionalProperties:false,
 required:['version','walls','openings','notes'],
 properties:{
  version:{type:'integer',const:1},
  walls:{type:'array',maxItems:8,items:{type:'object',additionalProperties:false,required:['points','colour','material'],properties:{
   points:polygon,colour,material:{type:'string',enum:['brick','stone','render','painted-masonry','unknown']}}}},
  openings:{type:'array',maxItems:64,items:{type:'object',additionalProperties:false,
   required:['kind','bounds','shape','frameColour','colour','visibility'],properties:{
    kind:{type:'string',enum:['window','door','shop']},bounds:{type:'array',items:coordinate,minItems:4,maxItems:4},
    shape:{type:'string',enum:['rect','arched']},frameColour:colour,colour,
    visibility:{type:'string',enum:['observed','inferred','unknown']}}}},
  roof:{type:'object',additionalProperties:false,required:['points','colour','material'],properties:{
   points:polygon,colour,material:{type:'string',enum:['tile','slate','metal','unknown']}}},
  occlusions:{type:'array',maxItems:16,items:{type:'object',additionalProperties:false,
   required:['points','kind'],properties:{points:polygon,kind:{type:'string',enum:['tree','vehicle','other']}}}},
  notes:{type:'string',maxLength:1000},
 },
} as const;

type RecordValue=Record<string,unknown>;
const isRecord=(value:unknown):value is RecordValue=>typeof value==='object'&&value!==null&&!Array.isArray(value);
function record(value:unknown,path:string,required:readonly string[],allowed:readonly string[]):RecordValue{
 if(!isRecord(value))throw Error(`${path} must be an object`);
 for(const key of required)if(!(key in value))throw Error(`${path}.${key} is required`);
 for(const key of Object.keys(value))if(!allowed.includes(key))throw Error(`${path}.${key} is not allowed`);
 return value;
}
function member(value:unknown,values:readonly string[],path:string):void{
 if(typeof value!=='string'||!values.includes(value))throw Error(`${path} must be one of ${values.join(', ')}`);
}
function hex(value:unknown,path:string):void{
 if(typeof value!=='string'||!/^#[0-9a-fA-F]{6}$/.test(value))throw Error(`${path} must be a six-digit hex colour`);
}
function integer(value:unknown,path:string):number{
 if(!Number.isInteger(value)||Number(value)<0||Number(value)>1000)throw Error(`${path} must be an integer from 0 to 1000`);
 return value as number;
}
function points(value:unknown,path:string):void{
 if(!Array.isArray(value)||value.length<3||value.length>32)throw Error(`${path} needs 3–32 points`);
 for(const [i,p] of value.entries()){
  if(!Array.isArray(p)||p.length!==2)throw Error(`${path}[${i}] needs two coordinates`);
  integer(p[0],`${path}[${i}][0]`);integer(p[1],`${path}[${i}][1]`);
 }
 const area=value.reduce((sum:number,p:Point,i:number)=>{
  const q=value[(i+1)%value.length] as Point;return sum+p[0]*q[1]-q[0]*p[1];
 },0);
 if(Math.abs(area)<2)throw Error(`${path} must have nonzero area`);
}
function colouredRegion(value:unknown,path:string,materials:readonly string[]):void{
 const r=record(value,path,['points','colour','material'],['points','colour','material']);
 points(r.points,`${path}.points`);hex(r.colour,`${path}.colour`);member(r.material,materials,`${path}.material`);
}
/** Throws on malformed or over-complex model output; also narrows unknown. */
export function validateFacadeSvgExperiment(input:unknown):FacadeSvgExperiment{
 const root=record(input,'experiment',['version','walls','openings','notes'],['version','walls','openings','roof','occlusions','notes']);
 if(root.version!==1)throw Error('experiment.version must be 1');
 if(!Array.isArray(root.walls)||root.walls.length>8)throw Error('experiment.walls must contain at most eight regions');
 root.walls.forEach((wall,i)=>colouredRegion(wall,`experiment.walls[${i}]`,['brick','stone','render','painted-masonry','unknown']));
 if(!Array.isArray(root.openings)||root.openings.length>64)throw Error('experiment.openings must contain at most 64 openings');
 root.openings.forEach((opening,i)=>{
  const path=`experiment.openings[${i}]`,o=record(opening,path,
   ['kind','bounds','shape','frameColour','colour','visibility'],['kind','bounds','shape','frameColour','colour','visibility']);
  member(o.kind,['window','door','shop'],`${path}.kind`);member(o.shape,['rect','arched'],`${path}.shape`);
  member(o.visibility,['observed','inferred','unknown'],`${path}.visibility`);
  hex(o.frameColour,`${path}.frameColour`);hex(o.colour,`${path}.colour`);
  if(!Array.isArray(o.bounds)||o.bounds.length!==4)throw Error(`${path}.bounds needs [x,y,width,height]`);
  const [x,y,w,h]=o.bounds.map((v,j)=>integer(v,`${path}.bounds[${j}]`));
  if(w===0||h===0||x+w>1000||y+h>1000)throw Error(`${path}.bounds must be positive and inside the image`);
 });
 if(root.roof!==undefined)colouredRegion(root.roof,'experiment.roof',['tile','slate','metal','unknown']);
 if(root.occlusions!==undefined){
  if(!Array.isArray(root.occlusions)||root.occlusions.length>16)throw Error('experiment.occlusions must contain at most 16 regions');
  root.occlusions.forEach((region,i)=>{
   const path=`experiment.occlusions[${i}]`,o=record(region,path,['points','kind'],['points','kind']);
   points(o.points,`${path}.points`);member(o.kind,['tree','vehicle','other'],`${path}.kind`);
  });
 }
 if(typeof root.notes!=='string'||root.notes.length>1000||/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(root.notes))
  throw Error('experiment.notes must be SVG-safe text of at most 1000 characters');
 return input as FacadeSvgExperiment;
}

const escapeXml=(value:string)=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]!));
const path=(polygon:Polygon)=>`M${polygon.map(([x,y])=>`${x} ${y}`).join(' L')} Z`;
const canvas=(size:{width:number;height:number})=>{
 if(!Number.isInteger(size.width)||!Number.isInteger(size.height)||size.width<1||size.height<1||size.width>20000||size.height>20000)
  throw Error('Source image dimensions must be positive integers at most 20000');
 return size;
};
/** Flat colours intentionally avoid implying measured brick scale or albedo. */
export function renderFacadeSvg(input:unknown,size:{width:number;height:number}):string{
 const data=validateFacadeSvgExperiment(input),{width,height}=canvas(size);
 const out=[`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 1000 1000" preserveAspectRatio="none">`,
  `<desc>${escapeXml(data.notes)}</desc>`,
  '<rect width="1000" height="1000" fill="#F4F4F1"/>'];
 if(data.roof)out.push(`<path data-material="${data.roof.material}" d="${path(data.roof.points)}" fill="${data.roof.colour}"/>`);
 for(const wall of data.walls)out.push(`<path data-material="${wall.material}" d="${path(wall.points)}" fill="${wall.colour}"/>`);
 for(const opening of data.openings){
  const [x,y,w,h]=opening.bounds,r=Math.min(w/2,h/3),shape=opening.shape==='rect'
   ?`<rect x="${x}" y="${y}" width="${w}" height="${h}"`
   :`<path d="M${x} ${y+h} V${y+r} A${w/2} ${r} 0 0 1 ${x+w} ${y+r} V${y+h} Z"`;
  const opacity=opening.visibility==='observed'?1:opening.visibility==='inferred'?.6:.35;
  const dash=opening.visibility==='observed'?'':' stroke-dasharray="8 5"';
  out.push(`${shape} data-kind="${opening.kind}" data-visibility="${opening.visibility}" fill="${opening.colour}" stroke="${opening.frameColour}" stroke-width="5" opacity="${opacity}"${dash}/>`);
 }
 for(const occlusion of data.occlusions??[])out.push(`<path data-occlusion="${occlusion.kind}" d="${path(occlusion.points)}" fill="#8D928B" fill-opacity="0.55" stroke="#525851" stroke-width="2"/>`);
 out.push('</svg>');return out.join('');
}

/** Source-pixel candidates only. No homography, wall identity or acceptance is
 * inferred. The legacy feature grammar has no shop kind; an observed shop
 * aperture becomes ground-floor window geometry. Unobserved openings stay in
 * the experiment JSON and are deliberately omitted from this adapter. */
export function toSourceFacadeFeatures(input:unknown,size:{width:number;height:number}):FacadeFeature[]{
 const data=validateFacadeSvgExperiment(input),{width,height}=canvas(size);
 return data.openings.flatMap((opening,i)=>{
  if(opening.visibility!=='observed')return [];
  const [x,y,w,h]=opening.bounds;
  return [{
   id:`svg-${opening.kind}-${i}`,kind:opening.kind==='door'?'door':'window',
   bounds:[x*width/1000,y*height/1000,(x+w)*width/1000,(y+h)*height/1000],
   disposition:'machine-observed-unreviewed',head:opening.shape==='arched'?'rounded':'rectangular',
   colour:opening.colour,frameColour:opening.frameColour,
   ...(opening.kind==='shop'?{region:'ground-floor'}:{}),
  } satisfies FacadeFeature];
 });
}
