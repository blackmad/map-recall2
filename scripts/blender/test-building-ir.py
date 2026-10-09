import copy
import unittest
from building_lib.ir import resolve


class IRTests(unittest.TestCase):
    def seed(self):
        return {'roof': {'eaves': 9, 'top': 11}, 'gable': {'family': 'spout', 'rise': 2.4},
                'storeyLayout': {'groundTop': 3, 'upperCount': 2},
                'frontages': [{'id': 'street', 'width': 6, 'openingRows': [
                    {'id': 'upper', 'storey': 'upper_1', 'centres': [1, 3, 5],
                     'sill': .6, 'height': 1.8, 'width': .9,
                     'provenance': {'basis': 'observed', 'evidence': ['capture-2025']}}]}]}

    def test_generators_are_deterministic_and_idempotent(self):
        recipe = self.seed(); before = copy.deepcopy(recipe)
        result = resolve(recipe)
        self.assertEqual(recipe, before)
        self.assertEqual(result, resolve(result))
        self.assertEqual(result['height'], 11.4)
        self.assertEqual([f['top'] for f in result['storeys']], [3, 6, 9])
        openings = result['frontages'][0]['openings']
        self.assertEqual([o['x'] for o in openings], [1, 3, 5])
        self.assertEqual(openings[0]['z'], 4.5)
        self.assertEqual(openings[0]['provenance']['evidence'], ['capture-2025'])
        self.assertEqual(result['gable']['provenance']['basis'], 'inferred')

    def test_explicit_unequal_storeys_preserved(self):
        recipe = self.seed()
        recipe['storeys'] = [{'id': 'ground', 'bottom': 0, 'top': 3}, {'id': 'upper_1', 'bottom': 3, 'top': 7}]
        self.assertEqual(resolve(recipe)['storeys'], recipe['storeys'])

    def test_duplicate_generated_id_and_invalid_position_rejected(self):
        recipe = self.seed()
        recipe['frontages'][0]['openings'] = [{'id': 'upper-1'}]
        with self.assertRaisesRegex(ValueError, 'Duplicate'):
            resolve(recipe)
        recipe = self.seed()
        recipe['frontages'][0]['openingRows'][0]['centres'] = [float('nan')]
        with self.assertRaisesRegex(ValueError, 'finite'):
            resolve(recipe)


if __name__ == '__main__':
    unittest.main()
