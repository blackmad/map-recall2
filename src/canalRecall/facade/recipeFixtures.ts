import pilot from './fixtures/recipe-pilot-source.json';
import { buildElevations } from './elevations.ts';
import { lngLatToRd } from './rdNew.ts';
import { dependencyHash } from './registrationGold.ts';
import { authoredField, type BuildingRecipe, type RecipeOpening, type RecipePolygon } from './recipe.ts';

const studyNote = 'Authored compiler study; no image measurements or identity acceptance.';
const palette = { wall: '#70665c', roof: '#544a47', trim: '#eee5d1', glass: '#345361', door: '#293b37' };
const detailing = { wallMaterial: 'flat' as const, windowStyle: 'plain' as const, cornice: 'none' as const, gableTrim: false };
const point = (x: number, y: number) => ({ x, y });

function openingStudy(width: number): RecipeOpening[] {
  const bays = width > 10 ? 5 : 3;
  const openings: RecipeOpening[] = [];
  for (let floor = 0; floor < 3; floor++) for (let bay = 0; bay < bays; bay++) {
    const door = floor === 0 && bay === 0;
    const w = Math.min(1.15, width / bays * 0.55);
    openings.push({ id: `f${floor}-b${bay}`, kind: door ? 'door' : 'window',
      leftM: (bay + 0.5) * width / bays - w / 2, bottomM: door ? 0 : 0.9 + floor * 3.1,
      widthM: w, heightM: door ? 2.7 : 1.9 });
  }
  return openings;
}

/** Fixed development fixtures. Synthetic cases never acquire BAG aliases or enter the map. */
export async function recipeDevelopmentFixtures(): Promise<BuildingRecipe[]> {
  const geometry = pilot.feature.geometry;
  const coordinates = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  const polygons = (coordinates as number[][][][]).map(p => ({ outer: p[0].map(p => lngLatToRd([p[0], p[1]])),
    holes: p.slice(1).map(r => r.map(p => lngLatToRd([p[0], p[1]]))) }));
  const sourceHash = await dependencyHash(pilot.feature);
  const real: BuildingRecipe = {
    schemaVersion: 1, buildingId: `bag:${pilot.feature.properties.identificatie}`, label: 'Herengracht 270 · authored study',
    aliases: [`NL.IMBAG.Pand.${pilot.feature.properties.identificatie}`],
    identity: { state: 'proposed', sourceHash, note: 'BAG pand geometry fetched from PDOK; pictured building and facade remain unreviewed.' },
    footprint: { value: polygons, basis: 'observed', state: 'proposed', evidence: [sourceHash], note: 'Full PDOK Polygon, including all supplied rings. BAG CC0-1.0.' },
    groundNapM: { ...authoredField(0, 'Flat-map ground approximation; local NAP ground is not measured.'), basis: 'inferred' },
    wallTopM: authoredField(11, studyNote), palette: authoredField({ ...palette, wall: '#928d83' }, studyNote),
    detailing: authoredField({...detailing}, studyNote),
    elevations: [], simplifications: ['Authored opening positions and palette are not extracted evidence.',
      'Flat roof is conservative massing; actual roof planes remain unknown.', 'Openings use shallow quads, without changing driving collision.'],
  };
  const east = buildElevations(polygons[0].outer, { pandId: pilot.feature.properties.identificatie })
    .filter(w => w.lengthM > 3).sort((a, b) => b.normal.x - a.normal.x)[0];
  real.elevations = [{ elevationId: east.elevationId, polygonIndex: 0,
    openings: authoredField(openingStudy(east.lengthM), studyNote), parapet: authoredField([], studyNote) }];
  const synthetic = async (id: string, label: string, footprint: RecipePolygon[], profile: Array<[number, number]>): Promise<BuildingRecipe> => {
    const buildingId = `fixture:${id}`;
    const walls = buildElevations(footprint[0].outer, { pandId: buildingId });
    const front = walls.find(w => w.normal.y < -0.9)!;
    return { schemaVersion: 1, buildingId, label, aliases: [], identity: { state: 'proposed', sourceHash: await dependencyHash(footprint), note: studyNote },
      footprint: authoredField(footprint, studyNote), groundNapM: authoredField(0, 'Synthetic zero-NAP regression.'),
      wallTopM: authoredField(11, studyNote), palette: authoredField({ ...palette }, studyNote),
      detailing: authoredField({...detailing}, studyNote),
      elevations: [{ elevationId: front.elevationId, polygonIndex: 0,
        openings: authoredField(openingStudy(front.lengthM), studyNote), parapet: authoredField(profile, studyNote) }],
      simplifications: ['Synthetic geometry fixture, not a real Amsterdam building.', 'Gable outline is a shallow parapet above conservative flat roof massing.'] };
  };
  return [real,
    await synthetic('narrow-gable', 'Narrow gable · synthetic', [{ outer: [point(0, 0), point(6, 0), point(6, 17), point(0, 17)], holes: [] }],
      [[0, 11], [0.7, 11], [0.7, 12], [1.4, 12], [1.4, 13], [2.2, 13], [2.2, 14], [3.8, 14], [3.8, 13], [4.6, 13], [4.6, 12], [5.3, 12], [5.3, 11], [6, 11]]),
    await synthetic('courtyard', 'Courtyard and passage · synthetic', [
      { outer: [point(0, 0), point(18, 0), point(18, 25), point(0, 25)], holes: [[point(4, 6), point(14, 6), point(14, 19), point(4, 19)]] },
      { outer: [point(23, 0), point(29, 0), point(29, 12), point(23, 12)], holes: [] },
    ], []),
  ];
}
