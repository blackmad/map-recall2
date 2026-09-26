/** A local RD grid is rotated relative to Web Mercator. Scaling its x/y axes
 * without reprojection drifts façade detail metres away from MapLibre masses. */
import {lngLatToRd,rdToLngLat,type RdPoint,type LngLat} from './rdNew.js';

type MercatorXY={x:number;y:number};
export type MercatorProject=(point:LngLat)=>MercatorXY;
export interface RdMercatorBasis {origin:MercatorXY;east:MercatorXY;north:MercatorXY;originRD:RdPoint}

export function rdMercatorBasis(originLngLat:LngLat,project:MercatorProject,exactOriginRD?:RdPoint):RdMercatorBasis{
  const originRD=exactOriginRD??lngLatToRd(originLngLat),origin=project(originLngLat),step=100;
  if(![originRD.x,originRD.y,origin.x,origin.y].every(Number.isFinite))throw Error('Invalid RD/Mercator origin');
  const eastPlus=project(rdToLngLat({x:originRD.x+step,y:originRD.y})),eastMinus=project(rdToLngLat({x:originRD.x-step,y:originRD.y}));
  const northPlus=project(rdToLngLat({x:originRD.x,y:originRD.y+step})),northMinus=project(rdToLngLat({x:originRD.x,y:originRD.y-step}));
  const east={x:(eastPlus.x-eastMinus.x)/(2*step),y:(eastPlus.y-eastMinus.y)/(2*step)};
  const north={x:(northPlus.x-northMinus.x)/(2*step),y:(northPlus.y-northMinus.y)/(2*step)};
  if(![east.x,east.y,north.x,north.y].every(Number.isFinite))throw Error('Invalid RD/Mercator basis');
  return{origin,east,north,originRD};
}

/** Source mesh axes are x=east, y=north, z=height. */
export function mapRdLocalPoint(basis:RdMercatorBasis,eastM:number,northM:number):MercatorXY{
  return{x:basis.origin.x+basis.east.x*eastM+basis.north.x*northM,
    y:basis.origin.y+basis.east.y*eastM+basis.north.y*northM};
}
