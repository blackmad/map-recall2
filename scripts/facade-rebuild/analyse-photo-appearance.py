"""Reuse immutable raw segmentation to analyse colour, texture and window detail offline."""
import argparse
import hashlib
import json
import shutil
from pathlib import Path
import numpy as np
from PIL import Image
import photo_appearance


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--input', type=Path, required=True)
    ap.add_argument('--out', type=Path, required=True)
    args = ap.parse_args()
    if args.out.exists():
        ap.error('Output exists; use a new immutable run directory')
    source = args.input/'manifest.json'
    run = json.loads(source.read_text())
    args.out.mkdir(parents=True)
    for record in run['records']:
        if record['status'] != 'proposed':
            continue
        for key, digest in [('image','sourceSha256'), ('mask','maskSha256')]:
            filename = record[key]
            if Path(filename).name != filename or sha(args.input/filename) != record[digest]:
                raise ValueError(f'Stale or invalid {key}: {record["id"]}')
            shutil.copyfile(args.input/filename,args.out/filename)
        rgb = np.array(Image.open(args.input/record['image']).convert('RGB'))
        mask = np.array(Image.open(args.input/record['mask']))
        appearance, valid = photo_appearance.analyse(rgb,mask,record)
        record['appearance'] = appearance
        record['rawOpenings'] = record['openings']
        record['rawWallColour'] = record.get('wallColour')
        record['openings'] = appearance['openings']
        if appearance['state'] == 'proposed':
            record['visibleRows'] = appearance['region']['rows']
            record['wallColour'] = appearance['wall']['colour']
            for b in record['openings']:
                b['appearance'] = appearance['windows'].get(b['id'])
            filename = record['id']+'.wall-samples.png'
            Image.fromarray((valid*255).astype('uint8')).save(args.out/filename)
            appearance['wall']['samplingMask'] = filename
            appearance['wall']['samplingMaskSha256'] = sha(args.out/filename)
        else:
            record['status'] = 'needs-review'; record['reason'] = appearance['reason']
        print(record['source']['address'], appearance.get('coverage'), flush=True)
    run['appearanceStage'] = {'version': photo_appearance.VERSION, 'inputManifestSha256': sha(source),
                             'analyserSha256': sha(Path(photo_appearance.__file__)), 'runnerSha256': sha(Path(__file__)),
                             'note': 'Raw model predictions reused unchanged. Appearance proposals do not accept image registration.'}
    (args.out/'manifest.json').write_text(json.dumps(run,indent=2)+'\n')


if __name__ == '__main__':
    main()
