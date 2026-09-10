"""Frozen MobileNet features + small supervised heads. Human labels only; candidate exports."""
import argparse
from datetime import datetime
from collections import Counter
import hashlib
import json
from pathlib import Path
import time

import numpy as np
from PIL import Image, ImageOps
import torch
import torchvision
from torchvision.models import mobilenet_v3_small, MobileNet_V3_Small_Weights
from torchvision.transforms import functional as TF
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.metrics import balanced_accuracy_score, confusion_matrix
from sklearn.preprocessing import StandardScaler


def sha(data):
    return hashlib.sha256(data).hexdigest()


def prepare(image):
    # Preserve the entire tall facade; the usual ImageNet centre crop loses shop/gable.
    image = ImageOps.pad(image.convert('RGB'), (224, 224), method=Image.Resampling.BILINEAR, color=(124, 116, 104))
    return TF.normalize(TF.to_tensor(image), [0.485, 0.456, 0.406], [0.229, 0.224, 0.225])


def embeddings(root, manifest):
    weights = MobileNet_V3_Small_Weights.IMAGENET1K_V1
    torch.set_num_threads(4)
    model = mobilenet_v3_small(weights=weights).eval()
    identity = {'backbone': 'torchvision.mobilenet_v3_small', 'weights': 'IMAGENET1K_V1',
                'weightsUrl': weights.url, 'torch': torch.__version__, 'torchvision': torchvision.__version__,
                'preprocess': 'whole-and-lower45pct; fit-pad-224-bilinear; ImageNet-normalization; L2-per-view',
                'weightsSha256': sha(b''.join(v.detach().cpu().numpy().tobytes() for v in model.state_dict().values()))}
    cache = root / 'features'
    cache.mkdir(exist_ok=True)
    all_features, timings = [], []
    for item in manifest['items']:
        full = (root / 'images' / item['image']).read_bytes()
        ground = (root / 'images' / item['groundImage']).read_bytes()
        if sha(full) != item['sourceSha256'] or sha(ground) != item['groundSha256']:
            raise ValueError('Source image changed: ' + item['id'])
        key = sha(json.dumps([identity, item['sourceSha256'], item['groundSha256']], sort_keys=True).encode())
        target = cache / (key + '.npy')
        if target.exists():
            vector = np.load(target, allow_pickle=False)
        else:
            started = time.perf_counter()
            batch = torch.stack([prepare(Image.open(root / 'images' / item[k])) for k in ['image', 'groundImage']])
            with torch.inference_mode():
                values = model.avgpool(model.features(batch)).flatten(1)
                values = torch.nn.functional.normalize(values, dim=1)
            vector = values.numpy().reshape(-1)
            timings.append(time.perf_counter() - started)
            np.save(target, vector, allow_pickle=False)
        all_features.append(vector)
    return np.stack(all_features), identity, timings


def validate_labels(manifest, data):
    if data.get('datasetId') != manifest['datasetId']:
        raise ValueError('Labels belong to another dataset')
    items = {i['id']: i for i in manifest['items']}
    rows = {}
    for row in data['labels']:
        item = items.get(row.get('itemId'))
        task = manifest['tasks'].get(row.get('task'))
        if not item or item['sourceSha256'] != row.get('sourceSha256') or not task:
            raise ValueError('Stale or unknown source label')
        if row.get('value') not in [c[0] for c in task['choices']] or row.get('origin') != 'human-review' or not row.get('reviewer') or not row.get('reviewedAt'):
            raise ValueError('Invalid or non-human label')
        if not isinstance(row['reviewer'], str) or not row['reviewer'].strip():
            raise ValueError('Missing reviewer')
        if datetime.fromisoformat(row['reviewedAt'].replace('Z', '+00:00')).tzinfo is None:
            raise ValueError('Review timestamp needs a timezone')
        key = (row['itemId'], row['task'])
        if key in rows:
            raise ValueError('Duplicate label decision')
        rows[key] = row
    return rows


def fit_head(x, y):
    scale = StandardScaler().fit(x)
    head = LogisticRegression(C=0.05, class_weight='balanced', max_iter=1000, random_state=41).fit(scale.transform(x), y)
    return scale, head


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path('.cache/facade-rebuild/router-review'))
    parser.add_argument('--labels', type=Path)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--features-only', action='store_true')
    args = parser.parse_args()
    manifest = json.loads((args.root / 'manifest.json').read_text())
    labels_bytes = (args.labels or args.root / 'labels.json').read_bytes() if not args.features_only else b''
    labels = validate_labels(manifest, json.loads(labels_bytes)) if labels_bytes else {}
    x, identity, timings = embeddings(args.root, manifest)
    args.out.mkdir(parents=True, exist_ok=True)
    report = {'datasetId': manifest['datasetId'], 'labelSnapshotSha256': sha(labels_bytes), 'backbone': identity,
              'newEmbeddingCount': len(timings), 'medianEmbeddingSeconds': float(np.median(timings)) if timings else None,
              'tasks': {}, 'predictions': {}, 'status': 'development-only',
              'evaluationNote': 'Cross-validation on the reviewed development seed. Not a frozen city holdout; no automatic production acceptance.'}
    for task in manifest['tasks']:
        usable = [(j, labels[(i['id'], task)]['value']) for j, i in enumerate(manifest['items'])
                  if (i['id'], task) in labels and labels[(i['id'], task)]['value'] != 'unclear']
        counts = Counter(v for _, v in usable)
        entry = {'labelled': len(usable), 'classCounts': dict(counts)}
        report['tasks'][task] = entry
        if len(usable) < 12 or len(counts) < 2 or min(counts.values()) < 3:
            entry.update(status='needs-labels', reason='Need at least 12 clear labels, with 3 examples in each of at least 2 classes.')
            continue
        ix = np.array([j for j, _ in usable])
        y = np.array([v for _, v in usable])
        groups = np.array([manifest['items'][j]['group'] for j in ix])
        classes = sorted(counts)
        group_counts = {c: len(set(groups[y == c])) for c in classes}
        entry['groupsPerClass'] = group_counts
        if min(group_counts.values()) >= 3:
            predicted = np.empty_like(y)
            valid = True
            for train, test in StratifiedGroupKFold(3, shuffle=True, random_state=41).split(x[ix], y, groups):
                if set(y[train]) != set(classes):
                    valid = False
                    break
                assert not set(groups[train]) & set(groups[test])
                scaler, head = fit_head(x[ix][train], y[train])
                predicted[test] = head.predict(scaler.transform(x[ix][test]))
            if valid:
                entry['developmentEvaluation'] = {'method': '3-fold shared-street/camera-mission groups',
                    'balancedAccuracy': float(balanced_accuracy_score(y, predicted)),
                    'classes': classes, 'confusionMatrix': confusion_matrix(y, predicted, labels=classes).tolist()}
        if 'developmentEvaluation' not in entry:
            entry['evaluationUnavailable'] = 'Need three independent street/camera groups per class with all classes represented in training folds.'
        scaler, head = fit_head(x[ix], y)
        payload = {'schemaVersion': 1, 'task': task, 'datasetId': manifest['datasetId'], 'labelSnapshotSha256': sha(labels_bytes),
                   'backbone': identity, 'classes': head.classes_.tolist(), 'mean': scaler.mean_.tolist(),
                   'scale': scaler.scale_.tolist(), 'coef': head.coef_.tolist(), 'intercept': head.intercept_.tolist(),
                   'status': 'candidate', 'scoreMeaning': 'Uncalibrated classifier score, not probability of correctness'}
        (args.out / (task + '.json')).write_text(json.dumps(payload) + '\n')
        scores = head.predict_proba(scaler.transform(x))
        report['predictions'][task] = {item['id']: {'value': str(head.classes_[np.argmax(p)]), 'score': float(np.max(p)),
              'alreadyLabelled': (item['id'], task) in labels} for item, p in zip(manifest['items'], scores)}
        entry['status'] = 'candidate-trained'
    (args.out / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({k: {'status': v['status'], 'labelled': v['labelled']} for k, v in report['tasks'].items()}))


if __name__ == '__main__':
    main()
