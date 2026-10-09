const enumeration=(...values)=>({type:'string',enum:values});
const object=properties=>({type:'object',additionalProperties:false,required:Object.keys(properties),properties});
const material=enumeration('brick','painted-brick','render','stone','concrete','glass','mixed','other','unknown');
const colour=enumeration('red','brown','buff','cream','white','grey','black','other','unknown');
const visibility=enumeration('clear','partial','occluded','unknown');
const presence=enumeration('visible','absent','unknown');
export const FACADE_SCHEMA=object({
 upper:object({material,colour,visibility}),
 base:object({material,colour,visibility,contrast:enumeration('same','different','mixed','unknown'),
  boundary:enumeration('horizontal-visible','irregular-visible','not-visible','unknown')}),
 openings:object({visibleStoreys:{type:['integer','null'],minimum:1,maximum:12},
  windowPattern:enumeration('regular-rows','irregular','mostly-obscured','unknown'),
  entrance:presence,visibility}),
 retail:object({use:enumeration('residential','retail','mixed','other','unknown'),displayGlazing:presence,
  fascia:presence,awning:presence,signLegibility:enumeration('readable','partial','unreadable','no-visible-sign','unknown'),
  literalSignText:{type:['string','null'],maxLength:120}}),
 roofline:object({shape:enumeration('flat','stepped','neck','bell','triangular','other','unknown'),
  targetAttribution:enumeration('clear','uncertain','unknown'),visibility}),
 caution:{type:'string',maxLength:240}
});
export const FACADE_PROMPT=`Assess only the target Amsterdam facade in these numbered photographs. Image1 is the full facade; image2, if supplied, is its detailed ground crop. They may be from different dates or cameras: do not silently combine incompatible states. Return the required JSON, without guessing obscured details. Every field can be unknown independently. Material is the exposed surface, colour excludes glass, trim and shadow. Base means street-level facade, not the next storey. Different base material requires visible evidence, not merely darker pixels. Identify entrances versus display glazing; do not invent hidden doors or complete window rows. visibleStoreys counts only visible opening levels, not an estimated building height. Roofline is the target FRONT facade silhouette, not roofs or trees behind it; if attribution is uncertain use shape unknown. 'absent' requires a sufficiently visible relevant region; otherwise unknown. Transcribe only fully readable literal sign text; partial, unreadable, absent and unknown sign text must be null. Do not infer business names from addresses. Give a short caution about the main uncertainty. This is a diagnostic assessment, not accepted geometry.`;
function matches(value,schema){
 if(schema.enum)return schema.enum.includes(value);
 if(Array.isArray(schema.type))return schema.type.some(type=>matches(value,{...schema,type}));
 if(schema.type==='null')return value===null;
 if(schema.type==='integer')return Number.isInteger(value)&&value>=schema.minimum&&value<=schema.maximum;
 if(schema.type==='string')return typeof value==='string'&&value.length<=(schema.maxLength??Infinity);
 if(schema.type==='object')return value!==null&&typeof value==='object'&&!Array.isArray(value)&&
  Object.keys(value).length===schema.required.length&&schema.required.every(k=>matches(value[k],schema.properties[k]));
 return false;
}
export function validateFacadeAssessment(value){
 if(!matches(value,FACADE_SCHEMA))return {valid:false,reason:'schema'};
 if(value.retail.signLegibility!=='readable'&&value.retail.literalSignText!==null)return {valid:false,reason:'unsupported-sign-text'};
 if(value.retail.signLegibility==='readable'&&!value.retail.literalSignText?.trim())return {valid:false,reason:'empty-readable-sign'};
 if(value.roofline.targetAttribution!=='clear'&&value.roofline.shape!=='unknown')return {valid:false,reason:'unattributed-roofline'};
 for(const group of ['upper','base'])if(['occluded','unknown'].includes(value[group].visibility)&&
   (value[group].material!=='unknown'||value[group].colour!=='unknown'))return {valid:false,reason:'hidden-material'};
 return {valid:true,reason:null};
}
export const GROUND_SCHEMA=object({entrance:presence,entranceCount:{type:['integer','null'],minimum:0,maximum:12},
 displayGlazing:presence,fascia:presence,awning:presence,
 baseMaterial:material,baseColour:colour,distinctPlinth:presence,
 signLegibility:enumeration('readable','partial','unreadable','no-visible-sign','unknown'),
 literalSignText:{type:['string','null'],maxLength:120}});
export const GROUND_PROMPT=`Inspect this single street-level facade photograph. Report only directly visible evidence. Entrance means a pedestrian door, including a glazed door; count each separate doorway, not each leaf of a double door. A display window is not an entrance. Identify shop display glazing, a sign fascia, awning, the dominant exposed base wall material/colour (not glass/shadow), and a distinct low plinth. Visible means at least one clearly seen example. Absent means the relevant area is exposed and none is there; otherwise unknown. Do not guess hidden doorways. For unknown entrance use entranceCount null. For absent entrance use entranceCount 0. Count visible entrances only. Sign text must be literal and fully readable, otherwise null. Return only JSON.`;
export function validateGroundAssessment(value){
 if(!matches(value,GROUND_SCHEMA))return {valid:false,reason:'schema'};
 if((value.signLegibility==='readable')!==Boolean(value.literalSignText?.trim()))return {valid:false,reason:'unsupported-sign-text'};
 if(value.entrance==='unknown'&&value.entranceCount!==null||value.entrance==='absent'&&value.entranceCount!==0||
  value.entrance==='visible'&&!(value.entranceCount>0))return {valid:false,reason:'entrance-count-conflict'};
 return {valid:true,reason:null};
}
