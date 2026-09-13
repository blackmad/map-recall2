import assert from 'node:assert/strict';
import { machineSignEligible, machineSignRevocationReason, truncateMachineSignText, machineSignBandWidth, drawMachineSignTexture } from '../src/canalRecall/cityAppearanceMachineSigns.ts';

const base = {
  id: 'frontage-1', evidenceKey: 'evidence-1', derivationKey: 'derivation-1',
  images: { ground: { sha256: 'a'.repeat(64), panoramaSha256: 'b'.repeat(64), date: '2026-09-01' } },
  effectiveProposal: { shopfront: 'yes', groundUsable: 'yes' },
  visualReview: { fieldEligibility: { shopfront: true, signText: true } },
  machineRoutingProposal: { signText: 'DORUS', signTextEligible: 'yes' },
};
assert.equal(machineSignEligible(base), true);
assert.equal(machineSignRevocationReason(base), null);
assert.equal(machineSignEligible({ ...base, review: { placement: 'rejected' } }), false);
assert.equal(machineSignRevocationReason({ ...base, review: { placement: 'rejected' } }), 'revoked-placement');
assert.equal(machineSignEligible({ ...base, machineRoutingProposal: { signText: 'old', signTextEligible: 'unknown' } }), false);
assert.equal(machineSignRevocationReason({ ...base, machineRoutingProposal: { signText: 'old', signTextEligible: 'unknown' } }), 'sign-text-not-eligible');
assert.equal(machineSignEligible({ ...base, images: { ground: { sha256: 'a'.repeat(64), panoramaSha256: 'b'.repeat(64) } } }), false);
assert.equal(truncateMachineSignText('A'.repeat(40)).length, 28);
assert.ok(machineSignBandWidth('SHOP', 5) < 5);
console.log('Machine sign checks passed: source/date binding, positive field gate, literal text, revocation and bounded placement.');

for(const height of [64,128]){
  const drawn=[],context={canvas:{height},font:'',measureText(text){return{width:text.length*parseFloat(this.font.split(' ')[1])*.6};},fillRect(){},fillText(text,x,y){drawn.push({text,x,y,size:parseFloat(this.font.split(' ')[1])});}};
  drawMachineSignTexture(context,'VISIBLE SIGN',512);
  assert.equal(drawn.length,1);assert.ok(drawn[0].y-drawn[0].size/2>=0&&drawn[0].y+drawn[0].size/2<=height,'text remains inside both full and reduced texture heights');
}

// Game façade relief must not bury the sign, and coordinate conversion must preserve height.
const {machineSignPlacementsForGame,planMachineSignPlacements}=await import('../src/canalRecall/cityAppearanceMachineSigns.ts');
const owner={id:'fixture',geometry:{frame:{heightDatum:'legacy-block-NAP-minus-0.65m',originRD:{x:120000,y:480000}},building:{id:'fixture',height:12,groundNAP:.65,
  footprint:{type:'Polygon',coordinates:[[[0,0],[12,0],[12,8],[0,8],[0,0]]]},
  surfaces:[{type:'wall',rings:[[[0,0,0],[12,0,0],[12,12,0],[0,12,0]]]}]}},observations:[]};
const observation={...base,renderBuildingId:'fixture',renderSurfaceIndices:[0],localStart:[0,0],localEnd:[12,0]};
const planned=planMachineSignPlacements(owner,owner.geometry.building.surfaces[0],0,[observation],[owner]);
const game=machineSignPlacementsForGame([owner],[observation]);
assert.equal(planned.length,1);assert.equal(game.length,1);
const source=planned[0].localPosition,sign=game[0];
assert.ok(Math.abs((sign.position[0]-source[0])*sign.normal[0]+(sign.position[1]+source[2])*sign.normal[1]-.2)<1e-8,'sign clears the additional .18 m game façade relief');
assert.equal(sign.position[2],source[1],'legacy datum offset is restored before subtracting ground NAP');
