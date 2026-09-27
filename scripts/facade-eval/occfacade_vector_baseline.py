"""Turn verified OccFacade full-view labels into unaccepted opening proposals.

This deliberately traces only observed class pixels. A bounding rectangle describes
one connected mask component; it does not fill occlusion gaps or infer an opening.
"""

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage


CLASSES = {4: ('window', '#e84c3d'), 1: ('door', '#ed9a22'), 2: ('shop', '#36c0a5')}
CONNECTIVITY = np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]], dtype=np.uint8)


def sha256(path):
    with open(path, 'rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def components(labels, minimum_area_fraction=0.0005, minimum_side=3):
    """Return all components, including filtered small fragments, in stable order."""
    height, width = labels.shape
    image_area = width * height
    results = []
    for class_id, (kind, _colour) in CLASSES.items():
        islands, count = ndimage.label(labels == class_id, structure=CONNECTIVITY)
        slices = ndimage.find_objects(islands)
        for component_id in range(1, count + 1):
            extent = slices[component_id - 1]
            if extent is None:
                continue
            y_slice, x_slice = extent
            x0, x1 = x_slice.start, x_slice.stop
            y0, y1 = y_slice.start, y_slice.stop
            area = int(np.count_nonzero(islands[extent] == component_id))
            box_area = (x1 - x0) * (y1 - y0)
            reasons = []
            if area / image_area < minimum_area_fraction:
                reasons.append('area-below-threshold')
            if min(x1 - x0, y1 - y0) < minimum_side:
                reasons.append('side-below-threshold')
            results.append({
                'id': f'{kind}-{component_id}', 'classId': class_id, 'rawClass': kind,
                'pixelBounds': [x0, y0, x1, y1],  # half-open; no dilation
                'normalizedBounds': [round(x0 * 1000 / width, 3), round(y0 * 1000 / height, 3),
                                     round((x1 - x0) * 1000 / width, 3), round((y1 - y0) * 1000 / height, 3)],
                'componentPixels': area, 'imageAreaFraction': round(area / image_area, 8),
                'boxFillFraction': round(area / box_area, 6),
                'touchesImageEdge': x0 == 0 or y0 == 0 or x1 == width or y1 == height,
                'status': 'proposal' if not reasons else 'filtered-fragment',
                'filterReasons': reasons,
            })
    return results


def draw_outputs(image, labels, proposals, out_prefix):
    """Draw true component edges and their boxes, plus a blank box-only comparison."""
    overlay = image.convert('RGBA')
    blank = Image.new('RGB', image.size, 'white')
    blank_draw = ImageDraw.Draw(blank)
    contour_layer = Image.new('RGBA', image.size, (0, 0, 0, 0))
    contour = np.asarray(contour_layer).copy()
    for class_id, (kind, colour) in CLASSES.items():
        class_pixels = labels == class_id
        boundary = class_pixels & ~ndimage.binary_erosion(class_pixels, structure=CONNECTIVITY)
        rgb = tuple(bytes.fromhex(colour[1:]))
        contour[boundary] = (*rgb, 255)
    overlay = Image.alpha_composite(overlay, Image.fromarray(contour))
    draw = ImageDraw.Draw(overlay)
    for item in proposals:
        if item['status'] != 'proposal':
            continue
        kind = item['rawClass']
        colour = next(value for name, value in CLASSES.values() if name == kind)
        x0, y0, x1, y1 = item['pixelBounds']
        # A rectangle is a component extent, not a completed window or door.
        draw.rectangle((x0, y0, x1 - 1, y1 - 1), outline=colour, width=2)
        blank_draw.rectangle((x0, y0, x1 - 1, y1 - 1), outline=colour, width=2)
    overlay.convert('RGB').save(f'{out_prefix}-overlay.png')
    blank.save(f'{out_prefix}-rectangles.png')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cohort', type=Path, required=True)
    parser.add_argument('--occ-receipt', type=Path, required=True)
    parser.add_argument('--labels-dir', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--indices', default='0,1,3,10,11,13,17,30,52,64')
    parser.add_argument('--minimum-area-fraction', type=float, default=0.0005)
    parser.add_argument('--minimum-side', type=int, default=3)
    args = parser.parse_args()
    if args.out.exists():
        parser.error('Output directory exists; use a fresh path to preserve evidence.')
    if not 0 <= args.minimum_area_fraction <= 1 or args.minimum_side < 1:
        parser.error('Invalid component thresholds.')
    indices = [int(part) for part in args.indices.split(',')]
    if len(indices) != len(set(indices)):
        parser.error('Duplicate index.')
    cohort = json.loads(args.cohort.read_text())
    receipt = json.loads(args.occ_receipt.read_text())
    if receipt['manifestSha256'] != sha256(args.cohort):
        raise ValueError('OccFacade receipt does not bind this cohort manifest')
    entries = {entry['index']: entry for entry in cohort['entries']}
    mask_records = {record['index']: record for record in receipt['records'] if record['kind'] == 'full'}
    verified = []
    for index in indices:
        entry, record = entries[index], mask_records[index]
        source = next(item for item in entry['images'] if item['kind'] == 'full')
        source_path = Path(source['path'])
        labels_path = args.labels_dir / f'{index:03d}-full-labels.png'
        if (record['sourceSha256'] != source['sha256'] or
                record['buildingId'] != entry['buildingId'] or
                record['observationId'] != entry['observationId'] or
                record['geometryRevision'] != entry['geometryRevision']):
            raise ValueError(f'Cohort/OccFacade binding mismatch at {index}')
        if sha256(source_path) != source['sha256']:
            raise ValueError(f'Source SHA mismatch at {index}')
        if sha256(labels_path) != record['labelsSha256']:
            raise ValueError(f'Mask SHA mismatch at {index}')
        with Image.open(source_path) as source_image, Image.open(labels_path) as label_image:
            if source_image.size != label_image.size or list(source_image.size) != record['size']:
                raise ValueError(f'Source/mask dimensions mismatch at {index}')
            labels = np.asarray(label_image)
            if labels.ndim != 2 or not np.isin(labels, range(len(receipt['classes']))).all():
                raise ValueError(f'Invalid labels at {index}')
        verified.append((index, entry, source, source_path, labels_path))
    args.out.mkdir(parents=True)
    manifest = {
        'version': 1, 'kind': 'occfacade-connected-component-proposals',
        'policy': 'Unaccepted raw-mask components. Bounding boxes do not fill occlusions, certify openings, or establish owner identity.',
        'cohortPath': str(args.cohort), 'cohortSha256': sha256(args.cohort),
        'occReceiptPath': str(args.occ_receipt), 'occReceiptSha256': sha256(args.occ_receipt),
        'occCheckpointSha256': receipt['checkpointSha256'],
        'scriptSha256': sha256(__file__), 'connectivity': 4,
        'minimumAreaFraction': args.minimum_area_fraction, 'minimumSidePixels': args.minimum_side,
        'records': [],
    }
    for index, entry, source, source_path, labels_path in verified:
        image = Image.open(source_path).convert('RGB')
        labels = np.asarray(Image.open(labels_path))
        items = components(labels, args.minimum_area_fraction, args.minimum_side)
        prefix = args.out / f'{index:03d}'
        draw_outputs(image, labels, items, prefix)
        manifest['records'].append({
            'index': index, 'buildingId': entry['buildingId'], 'observationId': entry['observationId'],
            'sourcePath': str(source_path), 'sourceSha256': source['sha256'],
            'labelsPath': str(labels_path), 'labelsSha256': sha256(labels_path),
            'size': list(image.size), 'components': items,
            'proposalCount': sum(item['status'] == 'proposal' for item in items),
            'overlayPath': str(prefix) + '-overlay.png',
            'overlaySha256': sha256(str(prefix) + '-overlay.png'),
            'rectanglesPath': str(prefix) + '-rectangles.png',
            'rectanglesSha256': sha256(str(prefix) + '-rectangles.png'),
        })
    (args.out / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(f'{args.out / "manifest.json"}: {sum(row["proposalCount"] for row in manifest["records"])} proposals across {len(indices)} sources')


if __name__ == '__main__':
    main()
