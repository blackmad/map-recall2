"""Restrict experimental model SVG to inert geometry before rasterization."""
import re
import sys
import xml.etree.ElementTree as ET

TAGS = {'svg', 'g', 'rect', 'path', 'polygon', 'polyline', 'circle', 'ellipse', 'line', 'title', 'desc', 'metadata'}
ATTRS = {'xmlns', 'viewBox', 'width', 'height', 'preserveAspectRatio', 'x', 'y', 'x1', 'x2', 'y1', 'y2', 'rx', 'ry', 'cx', 'cy', 'r', 'd', 'points', 'fill', 'stroke', 'stroke-width', 'opacity', 'fill-opacity', 'stroke-opacity', 'stroke-linecap', 'stroke-linejoin', 'fill-rule', 'transform', 'id'}

def sanitize_svg(text, width, height):
    if len(text) > 250000 or re.search(r'<!DOCTYPE|<!ENTITY|<\?', text, re.I):
        raise ValueError('SVG declarations/entities or oversized response')
    root = ET.fromstring(text)
    elements = list(root.iter())
    if len(elements) > 2000:
        raise ValueError('Too many SVG elements')
    for node in elements:
        tag = node.tag.removeprefix('{http://www.w3.org/2000/svg}')
        if tag not in TAGS:
            raise ValueError('Unsupported SVG element: ' + tag)
        for key, value in node.attrib.items():
            if key not in ATTRS and not re.fullmatch(r'data-[a-z-]+', key):
                raise ValueError('Unsupported SVG attribute: ' + key)
            if re.search(r'url\s*\(|javascript:|https?:|data:|file:', value, re.I):
                raise ValueError('External SVG reference')
            if key in {'fill', 'stroke'} and not re.fullmatch(r'#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?|none', value):
                raise ValueError('Use hex colours or none')
    if root.tag.removeprefix('{http://www.w3.org/2000/svg}') != 'svg':
        raise ValueError('Root must be SVG')
    box = [float(x) for x in re.split(r'[ ,]+', root.attrib.get('viewBox', '').strip())]
    if box != [0, 0, 1000, 1000]:
        raise ValueError('Expected normalized viewBox')
    root.set('width', str(width)); root.set('height', str(height))
    root.set('preserveAspectRatio', 'none')
    ET.register_namespace('', 'http://www.w3.org/2000/svg')
    return ET.tostring(root, encoding='unicode')

if __name__ == '__main__':
    print(sanitize_svg(sys.stdin.read(), int(sys.argv[1]), int(sys.argv[2])))
