"""Focused read-only scene recovery and malformed-file checks."""
import hashlib
from pathlib import Path
import tempfile
import unittest
from compression import zstd
from read_blend import BlendFile

SCENE = Path('artifacts/building-library/rozengracht-158.blend')


class SceneReaderTests(unittest.TestCase):
    def test_scope_and_topology(self):
        before = hashlib.sha256(SCENE.read_bytes()).hexdigest()
        scene = BlendFile(SCENE)
        meshes = list(scene.records('Mesh'))
        first, second = meshes[0][0], meshes[1][0]
        offset = scene.types['Mesh']['fields']['attribute_storage']['offset']
        a = scene.field(first,offset,'AttributeStorage','dna_attributes')
        b = scene.field(second,offset,'AttributeStorage','dna_attributes')
        self.assertEqual(a,b)  # Blender deliberately reuses DATA addresses per ID.
        self.assertIsNot(scene.resolve(first,a),scene.resolve(second,b))
        triangles = 0
        for obj,_ in scene.records('Object'):
            props = scene.properties(obj)
            if scene.field(obj,0,'Object','type') != 1 or props.get('sourceOnly'): continue
            mesh = scene.resolve(obj,scene.field(obj,0,'Object','data'),'Mesh')
            vertices,faces,_ = scene.mesh_arrays(mesh)
            self.assertTrue(vertices)
            triangles += sum(len(face)-2 for face in faces)
        self.assertEqual(triangles,5961)
        self.assertEqual(before,hashlib.sha256(SCENE.read_bytes()).hexdigest())

    def test_reject_malformed_files(self):
        data = zstd.decompress(SCENE.read_bytes())
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/'broken.blend'
            for candidate in (b'not a scene',data[:-1],data+b'extra',b'BLENDER17-02'+data[12:]):
                path.write_bytes(candidate)
                with self.assertRaises(ValueError): BlendFile(path)

    def test_missing_pointer_is_not_guessed(self):
        scene = BlendFile(SCENE)
        owner,_ = next(scene.records('Object'))
        with self.assertRaises(ValueError): scene.resolve(owner,1)
        mesh,_ = next(scene.records('Mesh'))
        with self.assertRaises(ValueError): scene.resolve(owner,mesh['address'],'Object')


if __name__ == '__main__': unittest.main()
