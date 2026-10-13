import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {buildHuizeFrankendael} from './huize-frankendael-builder';
export function huizeFrankendaelDraftGeometry(){
 const geometries:T.BufferGeometry[]=[];
 const add:BuildingTools['add']=(g,c,x=0,y=0,z=0,a=0)=>{g.rotateY(a);g.translate(x,y,z);g.userData.palette=c;geometries.push(g)};
 const box:BuildingTools['box']=(x,y,z,w,h,d,c,a=0)=>add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,a);
 const unused=()=>{throw Error('Unexpected primitive')};
 buildHuizeFrankendael(32.46,12.91,{add,box,prism:unused,hip:unused,gableRoof:unused,window:unused,clock:unused,sign:unused});
 return geometries;
}
