"""Apply a saved candidate head to a new review manifest, emitting proposals only."""
import argparse
import importlib.util
import json
from pathlib import Path
import numpy as np

spec = importlib.util.spec_from_file_location('router_training', Path(__file__).with_name('train-router-classifiers.py'))
training = importlib.util.module_from_spec(spec)
spec.loader.exec_module(training)


def probabilities(features, model):
    scaled = (features - np.asarray(model['mean'])) / np.asarray(model['scale'])
    logits = scaled @ np.asarray(model['coef']).T + np.asarray(model['intercept'])
    if len(model['classes']) == 2:
        positive = 1 / (1 + np.exp(-np.clip(logits[:, 0], -700, 700)))
        return np.column_stack((1 - positive, positive))
    values = np.exp(logits - logits.max(axis=1, keepdims=True))
    return values / values.sum(axis=1, keepdims=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, required=True)
    parser.add_argument('--model', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    model = json.loads(args.model.read_text())
    manifest = json.loads((args.root / 'manifest.json').read_text())
    features, identity, _ = training.embeddings(args.root, manifest)
    if identity != model['backbone']:
        raise ValueError('Encoder or preprocessing changed; do not apply an incompatible head')
    scores = probabilities(features, model)
    rows = [{'itemId': item['id'], 'sourceSha256': item['sourceSha256'],
             'value': model['classes'][int(np.argmax(score))], 'score': float(np.max(score)),
             'classScores': dict(zip(model['classes'], score.tolist())), 'origin': 'machine-proposal'}
            for item, score in zip(manifest['items'], scores)]
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps({'schemaVersion': 1, 'datasetId': manifest['datasetId'], 'task': model['task'],
                                   'modelSha256': training.sha(args.model.read_bytes()), 'proposals': rows,
                                   'note': 'Uncalibrated scores; no production acceptance. Review uncertain cases and a random sample of confident cases.'}, indent=2) + '\n')
    print(f'Wrote {len(rows)} proposals to {args.out}')


if __name__ == '__main__':
    main()
