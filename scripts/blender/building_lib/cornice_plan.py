"""Shared box layout for the stepped/flat cornice generator.

Coordinates stay in the facade frame. Boolean cutting and materials belong
to the consuming backend; a portable consumer must reject overlapping holes.
"""


def cornice_blocks(spec):
    if spec['kind'] != 'cornice':
        raise ValueError('Cornice planner requires a resolved cornice')
    if spec['profile'] == 'flat':
        return [('flat fascia', spec['x'], spec['z'], spec['width'],
                 spec['height'], spec['projection'])]
    if spec['profile'] != 'stepped':
        raise ValueError('Unsupported cornice profile')
    h = spec['height']; bottom = spec['z'] - h / 2
    return [(label, spec['x'], bottom + h * mid, spec['width'],
             h * fraction, spec['projection'] * projection)
            for label, fraction, mid, projection in
            [('lower fillet', .25, .125, .47), ('fascia', .45, .475, .72),
             ('cap', .30, .85, 1)]]
