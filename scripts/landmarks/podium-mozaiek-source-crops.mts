import fs from 'node:fs';
import path from 'node:path';
import {perspectiveCrop} from '../street-appearance/perspective.ts';
const pack=path.resolve('../map-recall2-source-data/models/podium-mozaiek');const out=path.join(pack,'processed');fs.mkdirSync(out,{recursive:true});
const views=[{id:'2024-west-front',original:'terdam_21112024_Track10_Sphere_00046.jpg',heading:142,pitch:20,fov:90,width:1500,height:1100},{id:'2025-west-front',original:'recording_2025-06-17_08-04-10_01648.jpg',heading:148,pitch:20,fov:90,width:1500,height:1100}];
for(const v of views)fs.writeFileSync(path.join(out,v.id+'.jpg'),perspectiveCrop(fs.readFileSync(path.join(pack,'raw',v.original)),v.heading,v.width,v.height,v.fov,v.pitch));
fs.writeFileSync(path.join(out,'crop-plan.json'),JSON.stringify({coordinateConvention:'heading clockwise north, perspectiveCrop pitch',views},null,2));
console.log(out);
