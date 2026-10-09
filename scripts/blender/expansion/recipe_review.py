"""Cheap recipe warnings for the next photo pass; never invent corrections."""
from building_lib.ir import resolve


def review_warnings(recipe):
    expanded = resolve(recipe)
    warnings = []
    for floor in expanded['storeys']:
        if floor['id'] != 'ground' and floor['top'] - floor['bottom'] > 4.2:
            warnings.append({'code': 'stretched-upper-storey', 'storey': floor['id'],
                'reason': 'Upper storey exceeds 4.2m. Check whether owner roof height was spread across too few visible rows; separate the street cornice and roof attachment before choosing inferred proportions. Tall historic storeys remain valid with evidence.'})
    roof = expanded['roof']
    appearance = expanded.get('massing', {}).get('appearanceRoof')
    if not appearance and roof['top'] - roof['eaves'] > 1.5:
        warnings.append({'code': 'native-roof-volume', 'reason':
            'Owner peak exceeds street eaves by more than 1.5m. Check attic, rear roof and cornice before retaining the native silhouette.'})
    for front in expanded['frontages']:
        authored = next((f for f in recipe['frontages'] if f['id'] == front['id']), {})
        if not appearance and authored.get('profileLayout'):
            warnings.append({'code': 'native-authored-silhouette-conflict', 'frontage': front['id'],
                'reason': 'Authored street silhouette still shares an envelope with retained native roofs. Inspect front and quarter views for triangles, spikes or walls crossing the gable before accepting the recipe.'})
        ground = [o for o in front['openings'] if o.get('storey') == 'ground']
        if not any(o.get('kind') == 'door' for o in ground):
            warnings.append({'code': 'missing-entrance', 'frontage': front['id'],
                'reason': 'No ground entrance. Confirm a residential door or record the warehouse, garage or side-entry exception.'})
        highest = max((o['z'] + o['height']/2 for o in front['openings']), default=0)
        lowest_top = min(z for _, z in front['profile'])
        if lowest_top - highest > 1.5:
            warnings.append({'code': 'blank-upper-volume', 'frontage': front['id'],
                'reason': 'More than 1.5m of full-width facade above the highest opening. Check missing attic lights, floor count and visible cornice height.'})
        finish = front.get('storefront', {}).get('finishColour')
        wall = expanded.get('materials', {}).get('wallColour')
        if finish and isinstance(finish, str) and len(finish) == 7 and finish.startswith('#'):
            try:
                red, green, blue = [int(finish[i:i+2], 16) for i in (1, 3, 5)]
                if green > red + 10 and green > blue + 10:
                    warnings.append({'code': 'green-wall-evidence', 'frontage': front['id'],
                        'reason': 'Green ground finish needs exposed wall evidence. Exclude vines, trees, flags, glazing and dark door leaves before assigning masonry colour; genuine painted walls remain valid.'})
            except ValueError:
                pass
        if finish and wall and finish.lower() != wall.lower():
            warnings.append({'code': 'distinct-ground-finish', 'frontage': front['id'],
                'reason': 'Ground wall differs from upper brick. Confirm the wall/column finish separately from dark doors, sash and glazing.'})
    return warnings
