import assert from 'node:assert/strict';
import { compileSourceShapePreview } from './source-shape-preview.ts';

const preview=compileSourceShapePreview({width:600,height:500,cropSha256:'a'.repeat(64),captureDate:'2025-01-01',features:[
  {id:'shallow-display',kind:'window',head:'segmental',archRise:.115,transom:.3,mullions:[.24,.71],bounds:[40,60,420,430],disposition:'agent-inspected'},
  {id:'door',kind:'door',head:'rectangular',topCornerRadius:.07,bounds:[440,100,560,460],disposition:'agent-inspected'},
  {id:'left-asymmetric',kind:'window',head:'rectangular',mullions:[.18,.63],bounds:[30,160,110,310],disposition:'agent-inspected'},
  {id:'right-asymmetric',kind:'window',head:'rectangular',mullions:[.18,.63],bounds:[470,160,550,310],disposition:'agent-inspected'},
  {id:'white',kind:'material',region:'ground-floor',colour:'#f4f1e8',bounds:[0,0,600,500],disposition:'agent-inspected'}
]});
assert.equal(preview.mode,'source-space-shape-study');
assert.equal(preview.counts.window,3);assert.equal(preview.counts.door,1);assert.equal(preview.counts.material,1);
assert.ok(preview.patches.length>0&&preview.patches.every(p=>p.previewOnly===true),'only explicit candidate-preview patches are returned');
assert.ok(preview.patches.flatMap(p=>p.triangles).every(Number.isFinite),'compiler produced finite source-space geometry');
const centre=(id:string)=>{const patch=preview.patches.find(p=>p.featureId.endsWith(id));const points=patch!.triangles;return points.filter((_,index)=>index%3===0).reduce((sum,x)=>sum+x,0)/(points.length/3);};
// PreviewBrowser's front camera has screen-right along -frame.u. Source pixel
// right must therefore produce a smaller world x on this synthetic wall.
assert.ok(centre('right-asymmetric')<centre('left-asymmetric'),'source image right projects screen-right, preserving asymmetric layout');
assert.ok(preview.frame.bottom<0&&preview.frame.top>5,'synthetic wall retains a margin around exact image bounds');
console.log('Source-space shape preview: unregistered source forms compile through the shared renderer.');
