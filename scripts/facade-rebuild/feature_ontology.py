"""An evidence vocabulary, not a claim that every architectural part was found."""
VERSION = 'facade-feature-ontology/1'


def field(value=None, basis='unknown', evidence=None, units=None, note=None, state='proposed'):
    return {'value':value, 'basis':basis if value is not None else 'unknown',
            'state':state, 'units':units,
            'confidence':None, 'evidence':evidence or [], 'note':note}


def build(record):
    source = record['sourceSha256']
    appearance = record.get('appearance',{})
    wall = appearance.get('wall',{})
    wall_colour = wall.get('colour') or {}
    wall_material = wall.get('material') or {}
    wall_refs = [{'sourceSha256':source, 'box':p['box'], 'patchId':p['id'], 'method':'wall-patch-camera-rgb'}
                 for p in wall.get('patches',[])]
    building = {
        'wall.colour':field(wall_colour.get('hex') if wall_colour else None,
                            wall_colour.get('basis','observed'),wall_refs,'sRGB',
                            'Source camera colour under source illumination; not intrinsic reflectance.',
                            wall_colour.get('state','proposed')),
        'wall.materialFamily':field(wall_material.get('value'),wall_material.get('basis','inferred'),wall_refs,
                                    state=wall_material.get('state','proposed')),
        'wall.texture.horizontalRepeats':field((wall.get('texture') or {}).get('horizontalRepeats') or None,'observed',wall_refs,
                                               'pixels and provisional metres','Autocorrelation candidates; do not establish brick bond.'),
    }
    for name in ['wall.texture.bond','wall.texture.roughness','roof.shape','roof.colour','roof.material',
                 'gable.profile','cornice.profile','cornice.colour','eave.profile','eave.colour']:
        building[name]=field(note='No targeted observation for this field; crop boundaries and renderer defaults are not evidence.')
    openings = []
    for o in record['openings']:
        x0,y0,x1,y1=o['box']; a=o.get('appearance') or {}
        detector=o.get('detector')
        refs=[{'sourceSha256':source,'box':o['box'],
               'method':'grid-inferred-outer-frame' if detector is None else 'fitted-outer-frame' if o.get('fit',{}).get('applied') else 'dino-outer-frame',
               **({'detectorBox':detector['box']} if detector else {}),
               **({'peerIds':o['reconstruction']['peerIds']} if detector is None else {})}]
        colour_refs=refs+[{'sourceSha256':source,'maskSha256':record['maskSha256'],'method':'derived-semantic-sampling-mask',
                           'samplingBox':a.get('sampleBox',o['box'])}]
        usable=o['state']=='proposed'
        def measured(value,basis='observed',units=None,note=None,references=None):
            return field(value if usable else None,basis,references or refs,units,note)
        values={
            'opening.kind':measured(o['kindEvidence']['value'],'inferred'),
            'opening.extent':measured(o['box'],o.get('basis','observed'),'source pixels'),
            'opening.aspectRatio':measured(round((x1-x0)/(y1-y0),4),o.get('basis','observed'),'width / height'),
            'opening.shape':field(note='Detector rectangles bound the opening; an arch/rectangle shape classification needs contour evidence.'),
            'frame.colour':measured(a.get('trimColour',{}).get('hex') if a.get('trimColour') else None,units='sRGB',references=colour_refs),
            'glazing.colour':measured(a.get('glassColour',{}).get('hex') if a.get('glassColour') else None,units='sRGB',references=colour_refs,
                                      note='Eroded opening pixels may include bars, blinds, curtains and reflections; material interpretation remains uncertain.'),
            'glazing.bars':measured(a.get('bars') or None,'inferred',note='Image line candidates can be branches or reflections; individually reviewable.'),
            'glazing.paneLayout':measured(a.get('paneLayout'),'inferred'),
            'door.colour':measured(a.get('panelColour',{}).get('hex') if a.get('panelColour') else None,units='sRGB',references=colour_refs,
                                   note='Eroded door-mask camera colour; panel layout and any glazed subregion remain unresolved.'),
        }
        for name in ['opening.mechanism','door.panelLayout','lintel.shape','lintel.colour','sill.profile','sill.colour']:
            values[name]=field(note='Requires a separate part mask or reviewed label; an opening mask does not isolate this material or shape.')
        openings.append({'id':o['id'],'state':o['state'],'fields':values})
    return {'version':VERSION,'building':building,'openings':openings,
            'note':'Per-field basis, review state and references are separate. Unknown fields never inherit authored render defaults.'}
