import assert from 'node:assert/strict';
import {lngLatToRd,rdToLngLat} from './rdNew.ts';
import {rdMercatorBasis,mapRdLocalPoint} from './rdMercatorBasis.ts';

const project=([lng,lat]:[number,number])=>{const phi=lat*Math.PI/180;
  return{x:(lng+180)/360,y:(1-Math.log(Math.tan(phi)+1/Math.cos(phi))/Math.PI)/2};};
const origin:[number,number]=[4.872449997145829,52.369280002196604],rd=lngLatToRd(origin),basis=rdMercatorBasis(origin,project,rd);
const metresPerMercator=40_075_016.68557849*Math.cos(origin[1]*Math.PI/180);
for(const [east,north] of [[367.7,162.5],[-700,950],[1000,-1000],[0,0]]){
  const actual=project(rdToLngLat({x:rd.x+east,y:rd.y+north})),mapped=mapRdLocalPoint(basis,east,north);
  const error=Math.hypot(actual.x-mapped.x,actual.y-mapped.y)*metresPerMercator;
  assert(error<.25,`RD-to-Mercator local error ${error.toFixed(3)} m at ${east},${north}`);
}
const local=mapRdLocalPoint(basis,367.7,162.5),old={x:basis.origin.x+367.7/(metresPerMercator),y:basis.origin.y-162.5/(metresPerMercator)};
assert(Math.hypot(local.x-old.x,local.y-old.y)*metresPerMercator>3,'the named canal window exposes the old unrotated drift');
console.log('RD/Mercator basis: named canal coordinate and district offsets align');
