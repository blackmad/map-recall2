"""Regression for identical simple GPU states across semantic material roles."""
import sys,tempfile,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from building_lib.materials.blender import material,rendered_state_key

class StateTests(unittest.TestCase):
    def test_semantic_roles_share_only_identical_simple_states(self):
        brick={'baseColour':'#81553f','family':'masonry'}
        render={'baseColour':'#81553f','family':'render'}
        self.assertEqual(rendered_state_key('redbrick',brick,'simple'),rendered_state_key('whiterender',render,'simple'))
        self.assertNotEqual(rendered_state_key('brass',{**brick,'family':'metal'},'simple'),rendered_state_key('redbrick',brick,'simple'))
        self.assertNotEqual(rendered_state_key('redbrick',{**brick,'baseColour':'#815540'},'simple'),rendered_state_key('redbrick',brick,'simple'))
    def test_textured_roles_retain_separate_map_identity(self):
        spec={'baseColour':'#81553f','family':'masonry'}
        self.assertNotEqual(rendered_state_key('redbrick',spec,'textured'),rendered_state_key('whiterender',spec,'textured'))

if '--blender' in sys.argv:
    import bpy
    with tempfile.TemporaryDirectory() as directory:
        cache=Path(directory)
        a=material('redbrick',cache,'#81553f','simple');b=material('whiterender',cache,'#81553f','simple')
        assert a is b,'Identical opaque shader states must share one Blender material'
        assert material('brass',cache,'#81553f','simple') is not a,'Metallic state must remain separate'
        assert material('redbrick',cache,'#815540','simple') is not a,'Different colour must remain separate'
        print('MATERIAL_SHARING_BLENDER_RESULT 3 checks pass')
else:unittest.main()
