import assert from 'node:assert/strict';
import test from 'node:test';
import {flagBridgeClusters,validateWallPair} from './build-opening-review.ts';
import {adjudicateOpeningProposals, type OpeningCandidate} from '../../src/canalRecall/facade/openingProposalAdjudication.ts';

const source=(id:string,lane:string,along:number,width:number):OpeningCandidate&{lane:string}=>({
 id,lane,kind:'window',along,up:3,width,height:2,evidence:'model-proposal',
});

test('broad bridging box flags a cluster containing distinct same-lane windows',()=>{
 const a=source('a','rfdetr',0,1.5),b=source('b','rfdetr',.8,1.5),bridge=source('bridge','rsjek',.4,1.5);
 const result=adjudicateOpeningProposals({widthM:5,heightM:8},[
  {name:'rfdetr',candidates:[a,b]},{name:'rsjek',candidates:[bridge]},
 ],{mode:'evidence-aware'});
 assert.equal(result.proposals.length,1,'connected component joins the two same-lane windows');
 const proposal=result.proposals[0];
 const flagged=flagBridgeClusters(result.proposals);
 assert.equal(flagged[0].status,'needs-review');
 assert.ok(flagged[0].reasons.includes('multi-overlap-bridge'));
 assert.equal(proposal.status,'proposed','input proposal stays untouched');
});

test('two lanes must describe the same wall and crop geometry',()=>{
 const a={buildingId:'bag:1',elevationId:'wall:1',surfaceId:'wall:1',wallWidthM:6,wallHeightM:10,
  cropFile:'/tmp/crop.jpg',cropWidthPx:270,cropHeightPx:450,boxes:[]};
 validateWallPair(a,{...a,wallWidthM:6.01});
 assert.throws(()=>validateWallPair(a,{...a,wallWidthM:6.1}),/disagree/);
 assert.throws(()=>validateWallPair(a,{...a,cropFile:'/tmp/other.jpg'}),/disagree/);
 assert.throws(()=>validateWallPair(a,{...a,cropHeightPx:451}),/disagree/);
});
