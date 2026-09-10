import {buildElevations,type BuildElevationOptions,type Elevation} from '../../src/canalRecall/facade/elevations.ts';
import {lngLatToRd,type LngLat,type RdPoint} from '../../src/canalRecall/facade/rdNew.ts';

export type FootprintGeometry =
  | {type:'Polygon';coordinates:number[][][]}
  | {type:'MultiPolygon';coordinates:number[][][][]};
export interface FootprintElevation extends Elevation {
  /** Source indices are provenance only; they are deliberately absent from stable IDs. */
  sourcePolygonIndex:number;
  sourceRingIndex:number;
  sourceRingRole:'exterior'|'courtyard';
}
export interface FootprintElevationOptions extends BuildElevationOptions {
  /** Defaults to the BAG WGS84 → metric RD transform. Override for metric fixtures. */
  project?:(point:LngLat)=>RdPoint;
}

/** All multipart exteriors and courtyard walls, preserving existing exterior IDs. */
export function buildFootprintElevations(geometry:FootprintGeometry,{project=lngLatToRd,...options}:FootprintElevationOptions={}):FootprintElevation[]{
  if(!geometry||!['Polygon','MultiPolygon'].includes(geometry.type))throw Error('Facade source must be Polygon or MultiPolygon');
  const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates;
  const result:FootprintElevation[]=[],ids=new Set<string>();
  for(const [sourcePolygonIndex,polygon]of polygons.entries())for(const [sourceRingIndex,ring]of polygon.entries()){
    if(!Array.isArray(ring)||ring.some(p=>!Array.isArray(p)||p.length<2||!p.slice(0,2).every(Number.isFinite)))throw Error('Nonfinite or malformed footprint ring');
    const courtyard=sourceRingIndex>0;
    for(const wall of buildElevations(ring.map(p=>project([p[0],p[1]])),options)){
      if(ids.has(wall.elevationId))throw Error('Duplicate physical wall across footprint rings: '+wall.elevationId);
      ids.add(wall.elevationId);
      result.push({...wall,
        ...(courtyard?{normal:{x:-wall.normal.x,y:-wall.normal.y},facingDeg:(wall.facingDeg+180)%360}:{}),
        sourcePolygonIndex,sourceRingIndex,sourceRingRole:courtyard?'courtyard':'exterior'});
    }
  }
  return result;
}
