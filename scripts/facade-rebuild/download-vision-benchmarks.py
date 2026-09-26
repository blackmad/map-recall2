"""Acquire pinned public weights; separate from the offline image benchmark."""
import argparse
import json
import time
from pathlib import Path

from huggingface_hub import snapshot_download

MODELS = [
    ('IDEA-Research/grounding-dino-tiny', 'a2bb814dd30d776dcf7e30523b00659f4f141c71'),
    ('facebook/sam2.1-hiera-tiny', 'de431c4043854a71d8101e17995dfe596bf101a5'),
]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, default=Path('.cache/facade-rebuild/models'))
    parser.add_argument('--dino-base', action='store_true', help='Optional measured-failure comparison; writes catalog-base.json')
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    catalog = []
    models = MODELS if not args.dino_base else [('IDEA-Research/grounding-dino-base', '12bdfa3120f3e7ec7b434d90674b3396eccf88eb'), MODELS[1]]
    for repo, revision in models:
        start = time.perf_counter()
        path = snapshot_download(repo, revision=revision, cache_dir=str(args.out.resolve()),
                                 token=False, allow_patterns=['*.json', '*.safetensors', '*.txt', 'README.md', 'LICENSE*'])
        catalog.append(dict(repo=repo, revision=revision, path=path,
                            downloadSeconds=round(time.perf_counter()-start, 3)))
    (args.out/('catalog-base.json' if args.dino_base else 'catalog.json')).write_text(json.dumps(catalog, indent=2)+'\n')


if __name__ == '__main__':
    main()
