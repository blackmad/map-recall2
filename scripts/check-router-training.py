"""Check provenance rejection and saved-head inference on synthetic features only."""
import copy
import importlib.util
from pathlib import Path
import numpy as np

root = Path(__file__).parent / 'facade-rebuild'


def module(name, filename):
    spec = importlib.util.spec_from_file_location(name, root / filename)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


train = module('train_router_check', 'train-router-classifiers.py')
predict = module('predict_router_check', 'predict-router-classifiers.py')
evaluate = module('evaluate_router_check', 'evaluate-router-benchmarks.py')
manifest = {'datasetId': 'test', 'items': [{'id': 'a', 'sourceSha256': 'current'}],
            'tasks': {'shopfront': {'choices': [['yes', 'Yes'], ['no', 'No']]}}}
data = {'datasetId': 'test', 'labels': [{'itemId': 'a', 'sourceSha256': 'current', 'task': 'shopfront',
        'value': 'yes', 'origin': 'human-review', 'reviewer': 'synthetic-test-only', 'reviewedAt': '2026-09-08T00:00:00Z'}]}
assert len(train.validate_labels(manifest, data)) == 1
for field, value in [('sourceSha256', 'stale'), ('origin', 'machine-proposal'), ('reviewer', ''), ('reviewedAt', 'invalid')]:
    bad = copy.deepcopy(data)
    bad['labels'][0][field] = value
    try:
        train.validate_labels(manifest, bad)
        raise AssertionError('Accepted invalid ' + field)
    except ValueError:
        pass
bad = copy.deepcopy(data)
bad['labels'] *= 2
try:
    train.validate_labels(manifest, bad)
    raise AssertionError('Accepted duplicate decisions')
except ValueError:
    pass
rng = np.random.default_rng(41)
x = rng.normal(size=(60, 8))
for count in [2, 3]:
    y = np.array([str(i % count) for i in range(len(x))])
    scaler, head = train.fit_head(x, y)
    serialized = {'mean': scaler.mean_.tolist(), 'scale': scaler.scale_.tolist(),
                  'coef': head.coef_.tolist(), 'intercept': head.intercept_.tolist(), 'classes': head.classes_.tolist()}
    np.testing.assert_allclose(predict.probabilities(x, serialized), head.predict_proba(scaler.transform(x)), atol=1e-10)
# Abstention must not inflate a scarce-positive detector's evaluation. Human
# uncertainty is excluded rather than silently becoming a negative example.
metrics = evaluate.task_metrics([
    {'human': 'yes', 'predicted': 'yes'}, {'human': 'yes', 'predicted': 'unclear'},
    {'human': 'no', 'predicted': 'no'}, {'human': 'no', 'predicted': 'error'},
    {'human': 'unclear', 'predicted': 'yes'},
], ['yes', 'no'])
assert metrics['humanCertain'] == 4 and metrics['answered'] == 2
assert metrics['accuracyWhenAnswered'] == 1 and metrics['accuracyIncludingAbstentions'] == .5
assert metrics['balancedAccuracyIncludingAbstentions'] == .5
assert metrics['humanUnclear'] == {'yes': 1}
print('Passed: provenance rejection, exported-head equivalence, and abstention/error accounting. No human dataset was trained or modified.')
