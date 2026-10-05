import data from './allotment-canopy-data.js';
export const allotmentCanopyTrees=data.trees;
const bounds=data.parks.map(g=>{const p=(g.type==='Polygon'?[g.coordinates]:g.coordinates).flat(2);return[Math.min(...p.map(q=>q[0])),Math.min(...p.map(q=>q[1])),Math.max(...p.map(q=>q[0])),Math.max(...p.map(q=>q[1]))];});
function inRing([x,y],ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
export function isAllotmentCanopyPosition(tree){return data.parks.some((g,i)=>tree.lng>=bounds[i][0]&&tree.lng<=bounds[i][2]&&tree.lat>=bounds[i][1]&&tree.lat<=bounds[i][3]&&(g.type==='Polygon'?[g.coordinates]:g.coordinates).some(p=>inRing([tree.lng,tree.lat],p[0])&&!p.slice(1).some(h=>inRing([tree.lng,tree.lat],h))));}
/** Source heights and management stay fixed; unmeasured crown widths get a scoped aerial prior. */
export function scopeAllotmentCrown(tree,t){
 if(!t||!isAllotmentCanopyPosition(tree))return t;
 const authored=tree.source==='allotment-prior';
 const width=authored?1.65:['rounded','domed','airy-oval','irregular-spreading','weeping','vase'].includes(t.archetype)?1.35:1;
 return {...t,lobes:t.lobes.map(l=>({...l,offset:[l.offset[0]*width,l.offset[1],l.offset[2]*width],scale:[l.scale[0]*width,l.scale[1],l.scale[2]*width]})),provenance:{...t.provenance,...(authored?{position:'authored private-garden canopy prior',height:'approximate 8–13m garden-tree prior'}:{}),widthBasis:'scoped aerial-guided width prior; individual crowns unmeasured'}};
}
