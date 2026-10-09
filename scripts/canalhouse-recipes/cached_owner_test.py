import unittest
from cached_owner import resolve_cached_owner


class MultiPandOwnerTests(unittest.TestCase):
    def test_two_buildings_share_one_active_vbo_but_keep_separate_geometry_owners(self):
        vbo = {'id': 'vbo', 'properties': {'pand.href': ['https://official/pand-a', 'https://official/pand-b']}}
        def pand(uuid, number):
            return {'id': uuid, 'properties': {'identificatie': number, 'status': 'Pand in gebruik', 'verblijfsobject.href': ['https://official/vbo']}}
        a, b = pand('pand-a', '0363100012168158'), pand('pand-b', '0363100012168162')
        selected, records = [('vbo-source', vbo)], [('a-source', a), ('b-source', b)]
        with self.assertRaisesRegex(ValueError, 'no unique'):
            resolve_cached_owner(selected, records)
        for owner in [a, b]:
            _, result, relevant, parents = resolve_cached_owner(selected, records, owner['properties']['identificatie'])
            self.assertEqual(result, owner)
            self.assertEqual(relevant, selected)
            self.assertEqual(parents, ['pand-a', 'pand-b'])
        with self.assertRaisesRegex(ValueError, 'within address parents'):
            resolve_cached_owner(selected, records, '0363100012999999')
        b['properties']['verblijfsobject.href'] = []
        with self.assertRaisesRegex(ValueError, 'not reciprocal'):
            resolve_cached_owner(selected, records, '0363100012168162')


if __name__ == '__main__':
    unittest.main()
