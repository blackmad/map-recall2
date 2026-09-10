"""Compare hashed machine proposals with human reviews; abstentions count as misses."""
import argparse
from collections import Counter, defaultdict
import csv
import hashlib
import importlib.util
import json
from pathlib import Path
import statistics


TASK_FIELDS = {'shopfront': 'shopfront', 'awning': 'awning', 'visibility': 'occlusion', 'family': 'family'}
ALIASES = {'unknown': 'unclear', 'low': 'clear', 'historic-narrow': 'traditional-house',
           'warehouse-workshop': 'industrial'}


def task_metrics(cases, classes):
    # Rows are human labels; columns also include abstention and failed requests.
    columns = [*classes, 'unclear', 'error']
    known = [c for c in cases if c['human'] != 'unclear']
    matrix = [[sum(c['human'] == truth and c['predicted'] == pred for c in known)
               for pred in columns] for truth in classes]
    recalls = {truth: row[columns.index(truth)] / sum(row)
               for truth, row in zip(classes, matrix) if sum(row)}
    answered = sum(c['predicted'] not in ['unclear', 'error'] for c in known)
    correct = sum(c['human'] == c['predicted'] for c in known)
    return {'humanCertain': len(known), 'correct': correct, 'answered': answered,
            'accuracyIncludingAbstentions': correct / len(known) if known else None,
            'coverage': answered / len(known) if known else None,
            'accuracyWhenAnswered': correct / answered if answered else None,
            'recallByClass': recalls,
            'balancedAccuracyIncludingAbstentions': statistics.mean(recalls.values()) if recalls else None,
            'rows': classes, 'columns': columns, 'confusionMatrix': matrix,
            'humanUnclear': dict(Counter(c['predicted'] for c in cases if c['human'] == 'unclear'))}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--root', type=Path, default=Path('.cache/facade-rebuild/router-review'))
    p.add_argument('--labels', type=Path, required=True)
    p.add_argument('--reports', type=Path, nargs='+', required=True)
    p.add_argument('--out', type=Path, required=True)
    args = p.parse_args()
    spec = importlib.util.spec_from_file_location('router_training', Path(__file__).with_name('train-router-classifiers.py'))
    training = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(training)
    manifest = json.loads((args.root / 'manifest.json').read_text())
    labels_bytes = args.labels.read_bytes()
    labels = training.validate_labels(manifest, json.loads(labels_bytes))
    items = {(i['pandId'], i['sourceSha256']): i for i in manifest['items']}
    report = {'datasetId': manifest['datasetId'], 'labelSha256': hashlib.sha256(labels_bytes).hexdigest(),
              'note': 'Development seed agreement, not city accuracy. Human unclear excluded from accuracy. Machine abstentions/errors count as misses. Reports may cover different subsets.',
              'experiments': []}
    disagreements = []
    for source in args.reports:
        raw = json.loads(source.read_text())
        grouped = defaultdict(list)
        for result in raw['results']:
            if result['status'] == 'pending':
                raise ValueError('Benchmark is still running: ' + str(source))
            grouped[(result['model'], result['requestedSize'])].append(result)
        for (model, size), results in grouped.items():
            seen = set()
            cases = defaultdict(list)
            for result in results:
                key = (result['target'], result['sourceSha256'])
                if key not in items or key in seen:
                    raise ValueError('Unknown, changed or duplicate source: ' + str(key))
                seen.add(key)
                item = items[key]
                for task, field in TASK_FIELDS.items():
                    decision = labels.get((item['id'], task))
                    if decision is None:
                        continue
                    value = result.get('label', {}).get(field, 'error') if result['status'] == 'ok' else 'error'
                    predicted = ALIASES.get(value, value)
                    allowed = {c[0] for c in manifest['tasks'][task]['choices']} | {'error'}
                    if predicted not in allowed:
                        raise ValueError('Unexpected prediction: ' + predicted)
                    case = {'itemId': item['id'], 'pandId': item['pandId'], 'sourceSha256': item['sourceSha256'],
                            'address': item['address'], 'task': task, 'human': decision['value'], 'predicted': predicted}
                    cases[task].append(case)
                    if decision['value'] != predicted:
                        disagreements.append({'experiment': source.parent.name, 'model': model, 'size': size, **case})
            known_cost = sum(r.get('usage', {}).get('cost', 0) for r in results)
            unknown_cost = sum(r.get('reservedUsd', 0) for r in results if r.get('usage', {}).get('cost') is None)
            unbilled_requests = sum(r.get('usage', {}).get('cost') is None for r in results)
            elapsed = [r['elapsedSeconds'] for r in results if 'elapsedSeconds' in r]
            experiment = {'name': source.parent.name, 'source': str(source), 'configHash': raw['configHash'],
                          'model': model, 'size': size, 'requests': len(results),
                          'statusCounts': dict(Counter(r['status'] for r in results)),
                          'billedUsd': known_cost, 'unresolvedReservationUsd': unknown_cost,
                          'unknownChargeRequests': unbilled_requests,
                          'linearBilledUsdPer100kRequests': None if unbilled_requests else known_cost / len(results) * 100000,
                          'medianElapsedSeconds': statistics.median(elapsed) if elapsed else None,
                          'promptTokens': sum(r.get('usage', {}).get('prompt_tokens', r.get('usage', {}).get('promptTokens', 0)) for r in results),
                          'completionTokens': sum(r.get('usage', {}).get('completion_tokens', r.get('usage', {}).get('completionTokens', 0)) for r in results),
                          'tasks': {task: task_metrics(rows, [c[0] for c in manifest['tasks'][task]['choices'] if c[0] != 'unclear'])
                                    for task, rows in cases.items()}, 'cases': dict(cases)}
            report['experiments'].append(experiment)
    args.out.mkdir(parents=True, exist_ok=True)
    (args.out / 'comparison.json').write_text(json.dumps(report, indent=2) + '\n')
    with (args.out / 'disagreements.csv').open('w') as f:
        writer = csv.DictWriter(f, fieldnames=['experiment', 'model', 'size', 'itemId', 'pandId', 'sourceSha256', 'address', 'task', 'human', 'predicted'])
        writer.writeheader()
        writer.writerows(disagreements)
    lines = ['# Routing model development comparison', '', report['note'], '',
             '| Run / model / pixels | Calls | Billed USD | USD / 100k requests | Median s | Shopfront | Awning | Visibility | Family |',
             '| --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- |']
    for e in report['experiments']:
        cost = f"{e['billedUsd']:.6f}" if not e['unknownChargeRequests'] else f"unknown; {e['unresolvedReservationUsd']:.6f} reserved"
        projection = f"{e['linearBilledUsdPer100kRequests']:.2f}" if e['linearBilledUsdPer100kRequests'] is not None else 'unavailable'
        cells = [f"{e['name']} / {e['model']} / {e['size']}", str(e['requests']), cost,
                 projection, f"{e['medianElapsedSeconds']:.2f}"]
        for task in TASK_FIELDS:
            m = e['tasks'][task]
            cells.append(f"{m['correct']}/{m['humanCertain']} ({m['answered']} answered)")
        lines.append('| ' + ' | '.join(cells) + ' |')
    lines += ['', 'Prices extrapolate observed billing for these exact prompts/crops; retries, new crops, acquisition, electricity and review are excluded.',
              'Class-specific recall, confusion matrices, unclear-image outputs and provenance are in comparison.json. Disagreements are review suggestions, never replacement labels.', '']
    (args.out / 'summary.md').write_text('\n'.join(lines))
    print('\n'.join(lines))


if __name__ == '__main__':
    main()
