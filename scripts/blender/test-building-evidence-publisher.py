"""Dated crop provenance must survive repeated cache basenames."""
import importlib.util,json,tempfile,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('publisher',Path(__file__).with_name('publish-building-evidence.py'))
publisher=importlib.util.module_from_spec(spec);spec.loader.exec_module(publisher)

class PublisherContracts(unittest.TestCase):
    def test_local_path_only_crop_preserves_source_identity(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);image=root/'crop.jpg';image.write_bytes(b'local evidence pixels')
            source=root/'case.json';source.write_text(json.dumps({'id':'case','derived':[
                {'path':'crop.jpg','tier':'full','captureDate':'2024-12-17'}]}))
            before=source.read_bytes();result=publisher.publish_bundle(source,root/'published',root)
            crop=result['derived'][0]
            self.assertEqual(crop['sourceUrlBeforePreview'],'crop.jpg')
            self.assertEqual((root/'published'/Path(crop['url']).name).read_bytes(),image.read_bytes())
            self.assertEqual(source.read_bytes(),before)

    def test_same_basename_different_dates_preserve_content_and_stable_urls(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);output=root/'published';crops=[]
            for year,payload in [('2022',b'original 2022 pixels'),('2025',b'different 2025 pixels')]:
                path=root/year/'owner-full.jpg';path.parent.mkdir();path.write_bytes(payload)
                crops.append({'path':str(path.relative_to(root)),'url':str(path.relative_to(root)),
                              'tier':'full','captureDate':year+'-01-01'})
            source=root/'case.json';source.write_text(json.dumps({'id':'case','derived':crops}))
            before=source.read_bytes();result=publisher.publish_bundle(source,output,root)
            urls=[c['url'] for c in result['derived']]
            self.assertEqual(len(set(urls)),2)
            for crop,payload in zip(result['derived'],[b'original 2022 pixels',b'different 2025 pixels']):
                self.assertEqual((output/Path(crop['url']).name).read_bytes(),payload)
            self.assertEqual(source.read_bytes(),before)
            self.assertEqual([c['url'] for c in publisher.publish_bundle(source,output,root)['derived']],urls)
            self.assertEqual((root/'2022/owner-full.jpg').read_bytes(),b'original 2022 pixels')

    def test_wrong_image_hash_blocks_bundle_publish(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);image=root/'crop.jpg';image.write_bytes(b'changed pixels')
            source=root/'case.json';source.write_text(json.dumps({'id':'case','derived':[
                {'path':'crop.jpg','url':'crop.jpg','sha256':'wrong','tier':'full'}]}))
            with self.assertRaisesRegex(ValueError,'hash differs'):
                publisher.publish_bundle(source,root/'published',root)
            self.assertFalse((root/'published/case.json').exists())

if __name__=='__main__':unittest.main()
