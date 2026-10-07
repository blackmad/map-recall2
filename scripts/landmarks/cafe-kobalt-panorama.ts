import fs from 'node:fs';
import {perspectiveCrop} from '../street-appearance/perspective';
const root='artifacts/cafe-kobalt-recovery/raw',metadata=JSON.parse(fs.readFileSync(`${root}/selected-panorama.json`,'utf8')),ll=metadata.geometry.coordinates;
const target=[(4.8943444408207935+4.894438403744322)/2,(52.37948593426044+52.37956811332444)/2];
const dx=(target[0]-ll[0])*111320*Math.cos(52.37952*Math.PI/180),north=(target[1]-ll[1])*111320,heading=Math.atan2(dx,north)*180/Math.PI;
fs.mkdirSync('artifacts/cafe-kobalt-recovery/processed',{recursive:true});fs.writeFileSync('artifacts/cafe-kobalt-recovery/processed/panorama-front.jpg',perspectiveCrop(fs.readFileSync(`${root}/panorama.jpg`),heading,1400,1000,90,20));
fs.writeFileSync('artifacts/cafe-kobalt-recovery/processed/panorama-view.json',JSON.stringify({panoramaId:metadata.pano_id,timestamp:metadata.timestamp,camera:ll,target,heading,pitch:20,fov:90,viewport:[1400,1000],helper:'scripts/street-appearance/perspective.ts worldaligned municipal convention',framingAdjustmentDegrees:0,occlusion:'Sun glare overlowerpui andcafeawnings;use2024photo+operatorcornerforopeningtruth;projectionnotcalibratedorthographic',kind:'derived perspective projection, not original'},null,2));
