import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {perspectiveCrop} from '../street-appearance/perspective.ts';
const pack='/private/tmp/map-recall2-jan-evertsen-source-archive/models/kesbeke',out=path.join(pack,'processed','2024-11-21');fs.mkdirSync(out,{recursive:true});
const views=[{id:'shop-roof-and-upper',original:'shop-full-panorama.jpg',heading:270,pitch:38,fov:70,width:1600,height:1400},{id:'office-west-front',original:'shop-full-panorama.jpg',heading:113,pitch:20,fov:70,width:1500,height:1400},{id:'shop-full-front',original:'shop-full-panorama.jpg',heading:270,pitch:19,fov:62,width:1600,height:1700},{id:'shop-front-context',original:'shop-full-panorama.jpg',heading:270,pitch:10,fov:92,width:1800,height:1500},{id:'office-full-front',original:'office-full-panorama.jpg',heading:5,pitch:15,fov:67,width:1600,height:1400},{id:'office-and-shop-context',original:'office-full-panorama.jpg',heading:315,pitch:12,fov:110,width:1800,height:1400}];
for(const view of views){const original=fs.readFileSync(path.join(pack,'raw',view.original)),output=perspectiveCrop(original,view.heading,view.width,view.height,view.fov,view.pitch);fs.writeFileSync(path.join(out,view.id+'.jpg'),output);}
fs.writeFileSync(path.join(out,'crop-plan.json'),JSON.stringify({frozenOn:'2026-10-06',status:'source projections frozen before facade correction',convention:'Established world-aligned municipal perspectiveCrop, heading clockwise north; original camera metadata archived separately, no photographic pixels enter the model',views:views.map(view=>({...view,originalSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(pack,'raw',view.original))).digest('hex')}))},null,2)+'\n');
console.log(out);
