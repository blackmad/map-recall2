"""Offline structural regressions; no weights, network or imagery needed."""
import importlib.util
from pathlib import Path
import unittest
import numpy as np
from copy import deepcopy
import fit_openings
import feature_ontology
import layout_hypotheses

spec=importlib.util.spec_from_file_location('compiler',Path(__file__).with_name('compile-dino-photo.py'))
compiler=importlib.util.module_from_spec(spec);spec.loader.exec_module(compiler)


def opening(i,box,kind='window'):
    return {'id':str(i),'box':box,'kind':kind,'state':'proposed','reasons':[],
            'basis':'observed','detector':{'box':box[:],'score':.4,'label':'a '+kind}}


class Fitting(unittest.TestCase):
    def test_layout_extends_only_with_two_agreeing_peers_and_retains_measurement(self):
        raw=[opening('left',[10,100,50,240],'door'),opening('middle',[70,102,110,215]),opening('right',[130,101,170,238])]
        result=layout_hypotheses.propose(raw)
        self.assertEqual(result[1]['box'],[70,102,110,239])
        self.assertEqual(result[1]['reconstruction']['measuredBox'],raw[1]['box'])
        self.assertEqual(result[1]['basis'],'inferred')
        self.assertEqual(layout_hypotheses.propose(raw[:2])[1]['box'],raw[1]['box'])

    def test_layout_preserves_repeated_short_window_family(self):
        raw=[opening('small',[10,200,50,275]),opening('tall1',[70,200,110,295]),opening('tall2',[130,200,170,295]),
             opening('same-bay-1',[10,100,50,175]),opening('same-bay-2',[10,0,50,75])]
        result=layout_hypotheses.propose(raw)
        self.assertEqual(result[0]['box'],raw[0]['box'])

    def test_grid_completion_adds_only_the_missing_dense_crossing(self):
        raw=[];image=np.full((260,260,3),90,np.uint8)
        for row,y in enumerate([20,100,180]):
            for col,x in enumerate([20,100,180]):
                if row==1 and col==1:continue
                item=opening(f'{row}-{col}',[x,y,x+40,y+55]);raw.append(item);image[y:y+55,x:x+40]=240
        result=layout_hypotheses.propose(raw,image,complete_missing=True)
        inferred=[item for item in result if item['id'].startswith('grid-')]
        self.assertEqual(len(inferred),1)
        self.assertEqual(inferred[0]['box'],[100,100,140,155])
        self.assertIsNone(inferred[0]['reconstruction']['measuredBox'])
        self.assertEqual(len(layout_hypotheses.propose(raw[:5],image,complete_missing=True)),5)

    def test_tall_central_glazing_has_a_separate_sill_family(self):
        image=np.full((180,260,3),90,np.uint8)
        raw=[opening('side-left',[10,20,60,90]),opening('central',[95,20,155,115]),opening('side-right',[190,20,240,90])]
        for o in raw:
            x0,y0,x1,y1=o['box'];image[y0:y1,x0:x1]=240
        result,summary=fit_openings.fit(image,raw)
        self.assertEqual(result[1]['box'][3],115)
        self.assertFalse(any({'central','side-left'}<=set(group) for group in summary['sillGroups']))
        self.assertFalse(any({'central','side-right'}<=set(group) for group in summary['windowFamilies']))

    def test_geometry_preserves_exceptions_and_does_not_fill_gaps(self):
        image=np.full((260,300,3),90,np.uint8)
        truth=[[20,20,60,90],[100,20,140,90],[180,20,200,90],[20,140,60,240],[100,140,140,240]]
        for x0,y0,x1,y1 in truth:image[y0:y1,x0:x1]=240
        raw=[opening(i,b[:]) for i,b in enumerate(truth)]+[opening('door',[225,100,275,245],'door')]
        raw[0]['box'][0]+=2
        before=deepcopy(raw);result,summary=fit_openings.fit(image,raw)
        self.assertEqual(raw,before)
        self.assertEqual([o['id'] for o in result],[o['id'] for o in raw])
        self.assertEqual(result[-1],raw[-1])
        self.assertFalse(any('2' in g for g in summary['widthGroups']))
        self.assertLess(summary['after']['rowWidthsMeanDeviationPx'],summary['before']['rowWidthsMeanDeviationPx'])
        self.assertGreater(result[3]['box'][3]-result[3]['box'][1],result[0]['box'][3]-result[0]['box'][1]+20)
        for a,b in zip(raw,result):self.assertLessEqual(max(abs(x-y) for x,y in zip(a['box'],b['box'])),5)

    def test_unsupported_edges_abstain(self):
        raw=[opening(0,[20,20,60,90]),opening(1,[100,23,137,93])]
        result,summary=fit_openings.fit(np.full((120,180,3),128,np.uint8),raw)
        self.assertGreater(summary['attemptedCount'],0)
        self.assertEqual(summary['adjustedCount'],0)
        self.assertEqual([o['box'] for o in result],[o['box'] for o in raw])

    def test_secondary_requires_actual_candidate_mask_edges_and_no_overlap(self):
        raw=[opening(0,[20,20,60,80]),opening(1,[100,20,140,80]),opening(2,[20,110,60,175]),opening(3,[100,110,140,175])]
        raw[-1].update(state='needs-review',reasons=['Below primary detector threshold; secondary evidence required'])
        raw[-1]['detector']['score']=.24
        rgb=np.full((220,180,3),90,np.uint8)
        for o in raw:
            x0,y0,x1,y1=o['box'];rgb[y0:y1,x0:x1]=240
        report={'samDinoClean':{'proposals':[{'box':raw[-1]['box'],'promptBox':raw[-1]['box'],'needsReview':False}]}}
        positive=deepcopy(raw);compiler.secondary_pass(rgb,positive,report)
        self.assertEqual(positive[-1]['state'],'proposed')
        self.assertTrue(positive[-1]['secondaryCheck']['edgePassed'])
        self.assertEqual(positive[-1]['detector']['score'],.24)
        for bad_rgb,bad_report in [(np.zeros_like(rgb),report),(rgb,{'samDinoClean':{'proposals':[]}})]:
            failed=deepcopy(raw);compiler.secondary_pass(bad_rgb,failed,bad_report)
            self.assertEqual(failed[-1]['state'],'needs-review')
        overlapping=deepcopy(raw)+[opening('assembly',[95,100,150,190],'door')]
        compiler.secondary_pass(rgb,overlapping,report)
        self.assertFalse(overlapping[3]['secondaryCheck']['passed'])

    def test_secondary_cross_detector_ensemble_recovers_isolated_low_score_window(self):
        weak=opening('weak',[20,20,60,80]);weak.update(state='needs-review',reasons=['Below primary detector threshold; secondary evidence required'])
        weak['detector']['score']=.22
        rgb=np.full((120,100,3),90,np.uint8);rgb[20:80,20:60]=240
        semantic=np.zeros((120,100),np.uint8);semantic[20:80,20:60]=4
        report={'samDinoClean':{'proposals':[{'box':weak['box'],'promptBox':weak['box'],'needsReview':False}]}}
        compiler.secondary_pass(rgb,[weak],report,semantic)
        self.assertEqual(weak['state'],'proposed')
        self.assertEqual(weak['secondaryCheck']['supportMode'],'cross-detector-ensemble')
        rejected=opening('weak',[20,20,60,80]);rejected.update(state='needs-review',reasons=['Below primary detector threshold; secondary evidence required'])
        compiler.secondary_pass(rgb,[rejected],report,np.zeros_like(semantic))
        self.assertEqual(rejected['state'],'needs-review')

    def test_secondary_recovers_measured_dormer_above_lower_facade_windows(self):
        dormer=opening('dormer',[60,20,100,70]);dormer.update(
            state='needs-review',reasons=['Below primary detector threshold; secondary evidence required'])
        lower=[opening('lower-1',[150,100,200,170]),opening('lower-2',[230,190,280,260])]
        rgb=np.full((300,320,3),90,np.uint8)
        for item in [dormer,*lower]:
            x0,y0,x1,y1=item['box'];rgb[y0:y1,x0:x1]=240
        report={'samDinoClean':{'proposals':[{
            'box':dormer['box'],'promptBox':dormer['detector']['box'],'needsReview':False}]}}
        openings=[dormer,*lower]
        compiler.secondary_pass(rgb,openings,report,np.zeros((300,320),np.uint8))
        self.assertEqual(dormer['state'],'proposed')
        self.assertEqual(dormer['basis'],'inferred')
        self.assertEqual(dormer['secondaryCheck']['supportMode'],'roof-context')
        compiler.context_check(openings,np.zeros((300,320),np.uint8),rgb,report)
        self.assertEqual(dormer['state'],'proposed')
        self.assertTrue(dormer['contextCheck']['roofContextSupported'])

        unsupported=opening('roof-shape',[60,20,100,70]);unsupported.update(
            state='needs-review',reasons=['Below primary detector threshold; secondary evidence required'])
        compiler.secondary_pass(np.full_like(rgb,90),[unsupported,*lower],report,np.zeros((300,320),np.uint8))
        self.assertEqual(unsupported['state'],'needs-review')

        mid_facade=opening('mid',[60,120,100,170]);mid_facade.update(
            state='needs-review',reasons=['Below primary detector threshold; secondary evidence required'])
        top_peer=opening('higher',[150,20,200,90]);bottom_peer=opening('bottom',[230,220,280,290])
        rgb_mid=np.full((320,320,3),90,np.uint8)
        for item in [mid_facade,top_peer,bottom_peer]:
            x0,y0,x1,y1=item['box'];rgb_mid[y0:y1,x0:x1]=240
        mid_report={'samDinoClean':{'proposals':[{
            'box':mid_facade['box'],'promptBox':mid_facade['detector']['box'],'needsReview':False}]}}
        compiler.secondary_pass(rgb_mid,[mid_facade,top_peer,bottom_peer],mid_report,np.zeros((320,320),np.uint8))
        self.assertEqual(mid_facade['state'],'needs-review')
        self.assertFalse(mid_facade['secondaryCheck']['aboveFacadeOpenings'])

    def test_unknown_ontology_never_inherits_display_defaults(self):
        record={'sourceSha256':'a'*64,'maskSha256':'b'*64,'openings':[]}
        result=feature_ontology.build(record)
        self.assertIsNone(result['building']['roof.colour']['value'])
        self.assertEqual(result['building']['roof.colour']['basis'],'unknown')

    def test_nested_door_hypothesis_records_parent_assembly(self):
        record={'width':200,'height':240,'frame':{'metresPerPixelX':.02,'metresPerPixelY':.02,'leftM':0,'topM':5,'wallWidthM':4}}
        benchmark={'dino':{'proposals':[{'box':[20,40,90,210],'label':'a door','score':.5},
                                         {'box':[25,100,85,205],'label':'a door','score':.4}]}}
        result=compiler.proposals(record,benchmark)
        self.assertEqual(result[0]['assembly']['componentIds'],['dino-2'])
        self.assertEqual(result[1]['assembly']['parentId'],'dino-1')

    def test_isolated_semantic_disagreement_is_reviewed_even_with_high_score(self):
        raw=[opening(0,[20,20,60,80]),opening(1,[100,20,140,80]),opening('poster',[100,180,140,240],'door')]
        raw[-1]['detector']['score']=.9
        compiler.context_check(raw,np.ones((270,170),np.uint8))
        self.assertEqual(raw[-1]['state'],'needs-review')
        self.assertEqual(raw[0]['state'],'proposed')

    def test_unknown_semantic_baseline_abstains_without_circular_agreement(self):
        raw=[opening('isolated',[20,20,60,80])]
        compiler.context_check(raw,np.ones((120,100),np.uint8),semantic_state='unknown')
        self.assertEqual(raw[0]['state'],'proposed')
        self.assertEqual(raw[0]['contextCheck']['state'],'unknown')
        self.assertIsNone(raw[0]['contextCheck']['baselineOpeningFraction'])

    def test_semantic_disagreement_uses_supported_neighbour_but_keeps_hoarding_abstention(self):
        rgb=np.full((300,220,3),90,np.uint8)
        garage=opening('garage',[20,170,110,260],'door');garage['detector']['score']=.64
        transom=opening('transom',[125,120,165,160]);transom.update(state='needs-review',reasons=['Below primary detector threshold; secondary evidence required'])
        for o in [garage,transom]:
            x0,y0,x1,y1=o['box'];rgb[y0:y1,x0:x1]=240
        benchmark={'samDinoClean':{'proposals':[{'box':transom['box'],'promptBox':transom['detector']['box'],'needsReview':False}]}}
        compiler.context_check([garage,transom],np.ones((300,220),np.uint8),rgb,benchmark)
        self.assertEqual(garage['state'],'proposed')
        self.assertEqual(garage['contextCheck']['weakObservedPeerIds'],['transom'])

        hoarding=opening('hoarding',[20,170,110,260],'door');hoarding['detector']['score']=.9
        compiler.context_check([hoarding],np.ones((300,220),np.uint8),rgb,benchmark)
        self.assertEqual(hoarding['state'],'needs-review')


if __name__=='__main__':unittest.main()
