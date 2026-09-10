import assert from 'node:assert/strict';
import {facadeOpeningLayout,overlapsOpening} from '../src/canalRecall/facadeOpeningLayout.ts';
import {rectangleFitsFace} from '../public/canal-drive/da-costa-block/face-containment.js';
const frame=(bottom=0,top=15,holes=[])=>({width:6.6,bottom,top,intervalBounded:true,polygon:[[0,bottom],[6.6,bottom],[6.6,top],[0,top]],holes});
for(const bottom of [-.6,0,.2,.7,1.8])for(const top of [8,12,16,20]){
  const f=frame(bottom,top),floors=Math.max(2,Math.min(5,Math.round((top-bottom)/3.65)));
  const layout=facadeOpeningLayout(f,{floors,bays:3,windowWidth:1.3,windowHeight:Math.min(2.05,(top-Math.max(.2,bottom))/floors*.64)});
  const doors=layout.openings.filter(o=>o.isDoor);assert.equal(doors.length,1,`door survives source datum ${bottom}/${top}`);
  for(const o of layout.openings)assert.ok(rectangleFitsFace(f,o.rect.t,o.rect.y,o.rect.width,o.rect.height));
  assert.ok(doors[0].rect.y-doors[0].rect.height/2>=Math.max(.2,bottom));
  if(layout.belt)assert.equal(overlapsOpening(layout.belt,layout.openings),false,'belt never crosses doors/windows/frames/sills');
}
const f=frame(.7);
assert.equal(rectangleFitsFace(f,1.1,1.5,1.25,2.79),false,'old world-zero door is rejected');
const normal=facadeOpeningLayout(f,{floors:4,bays:3,windowWidth:1.3,windowHeight:2.05});
const blocked=facadeOpeningLayout(frame(.7,15,[[[.6,.8],[1.6,.8],[1.6,3.6],[.6,3.6]]]),{floors:4,bays:3,windowWidth:1.3,windowHeight:2.05});
assert.ok(normal.openings.some(o=>o.isDoor));assert.equal(blocked.openings.some(o=>o.isDoor),false,'source hole withholds the whole door, including its handle');
assert.equal(overlapsOpening({t:normal.openings[1].t,y:normal.openings[1].y,width:4,height:.16},normal.openings),true,'old fascia crossing detected');
console.log('Opening layout: variable source ground levels, complete doors, source holes and nonintersecting trim passed.');
assert.throws(()=>facadeOpeningLayout(frame(),{floors:Infinity,bays:3,windowWidth:1,windowHeight:2}),/Invalid/);
