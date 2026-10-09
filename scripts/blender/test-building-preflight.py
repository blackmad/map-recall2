"""Attachment and glazing errors must be rejected without Blender mutation."""
import copy,json,unittest
from pathlib import Path
from building_lib.schema import validate
from building_lib.ir import resolve

BASE=Path(__file__).parent/'building_lib/recipes/synthetic-terrace.json'

class PreflightContracts(unittest.TestCase):
    def recipe(self):
        recipe=json.loads(BASE.read_text());recipe.setdefault('details',{})
        return recipe

    def test_invalid_glazing_depth(self):
        for depth in (None,True,'deep',float('nan'),float('inf'),-.035,.23):
            with self.subTest(depth=depth):
                recipe=self.recipe();recipe['frontages'][0]['openings'][0]['glazingDepth']=depth
                self.assertTrue(any('Glazing recess' in e for e in validate(recipe)))

    def test_dormer_dimension_and_outside_support(self):
        for item in ({'x':3,'y':3,'width':-1,'height':1},
                     {'x':30,'y':3,'width':1,'height':1},
                     {'x':3,'y':3,'width':1,'height':float('nan')},
                     {'x':3,'y':9.8,'width':1,'height':1}):
            recipe=self.recipe();recipe['details']['dormers']=[item]
            self.assertTrue(any('Dormer:' in e for e in validate(recipe)))

    def test_dormer_requires_clearance_above_rear_support(self):
        recipe=self.recipe();recipe['details']['dormers']=[{'x':1.5,'y':.8,'width':.6,'height':.01}]
        self.assertTrue(any('Dormer:' in e for e in validate(recipe)))

    def test_concave_notch_cannot_be_spanned_by_dormer_or_ridge(self):
        recipe=self.recipe();recipe['footprint']=[[0,0],[6,0],[6,4],[2.9,4],[2.9,4.2],[6,4.2],[6,10],[0,10]]
        recipe['details']={'dormers':[{'x':3,'y':3.8,'width':2,'height':2}], 'ridgeCap':True}
        errors=validate(recipe)
        self.assertTrue(any('not fully supported' in e for e in errors),errors)
        self.assertTrue(any('Ridge cap:' in e for e in errors),errors)

    def test_unsupported_and_zero_ridge_span(self):
        for kind in ('flat','shed'):
            recipe=self.recipe();recipe['roof']['kind']=kind;recipe['details']={'ridgeCap':True}
            self.assertTrue(any('Ridge cap:' in e for e in validate(recipe)))
        recipe=self.recipe();recipe['roof']['frontTransition']=11;recipe['details']={'ridgeCap':True}
        self.assertTrue(any('nonzero supported ridge span' in e for e in validate(recipe)))

    def test_supported_pilot_roof_details_keep_validating(self):
        for path in (BASE.parent.parent/'fixtures/roof-components').glob('*.json'):
            recipe=json.loads(path.read_text())
            if 'id' in recipe:self.assertEqual(validate(resolve(recipe)),[],path.name)

if __name__=='__main__':unittest.main()
