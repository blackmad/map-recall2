import test from 'node:test';
import assert from 'node:assert/strict';
import { ExtraSink, wallExtras, type ExtraContext } from './facadeExtras.ts';
const context=(id:string):ExtraContext=>({id,style:'canal',period:'canal',wallKey:'front',f:{x0:0,y0:0,ux:1,uy:0,nx:0,ny:-1,len:6},base:0,top:12,layout:{bays:2,bayWidthM:3,groundM:3.2,storeys:2,storeyM:3.1,doorBays:[0]},wallHex:'#765044',accentHex:'#30362e',groundLevel:true,streetSide:true,recipe:{family:'masonry',period:'canal',confidence:.9,balconyPolicy:'assembly-only'}});
test('observed quiet frontages omit incidental balconies across the generic random cohort',()=>{
 let baselineBalconies=0;
 for(let i=0;i<100;i++){
  const c=context(`observed-${i}`),used=wallExtras(c,new ExtraSink(230));
  assert.ok(!used.some(id=>id.includes('balcon')||id==='gallery-walkway'));
  const generic=wallExtras({...c,recipe:{...c.recipe!,balconyPolicy:undefined}},new ExtraSink(230));
  baselineBalconies+=Number(generic.some(id=>id.includes('balcon')));
 }
 assert.ok(baselineBalconies>0,'test cohort exercises the contradiction rather than relying on quiet random seeds');
});
test('assembly-only policy retains an explicitly supported historic stack',()=>{
 const c=context('observed-stack');c.recipe={...c.recipe!,facadeAssembly:'stacked-iron-balcony',sash:'paired-transom'};
 assert.equal(wallExtras(c,new ExtraSink(230))[0],'historic-balcony-stack');
});
test('architectural detail policy spends relief on facade structure rather than unsourced dressing',()=>{
 const allowed=new Set(['door-surround','hoist-beam','wall-anchors','white-window-frames','white-lintels','string-courses']);
 for(let i=0;i<40;i++){
  const c=context(`quiet-${i}`);c.recipe={...c.recipe!,detailPolicy:'architectural'};
  const used=wallExtras(c,new ExtraSink(230));
  for(const id of used)assert.ok(allowed.has(id),`unexpected dressing ${id}`);
 }
});
