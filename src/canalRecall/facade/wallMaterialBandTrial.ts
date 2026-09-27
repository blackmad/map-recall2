/** One opt-in source-supported material split. Approximate photo-plane height;
 * repeated around the existing footprint for this diagnostic, not measured 3D. */
export const WALL_BAND_TRIAL = Object.freeze({
 index:17,buildingId:'0363100012094649',
 sourceSha256:'a122cf2d42e5b8cde414affec4fd7946ba2082af3b4143c9bfd72c28f74891ee',
 geometryRevision:'526403e3caab3005da92785c86a2bfdc7d34dd35b9c9896d2763233dc1f41899',
 upperMaterial:'palecreamrender',lowerMaterial:'redbrick',
 boundaryRow:556,sourceHeight:699,planeBaseZ:.15800000429153443,planeTopZ:15.7,groundNAP:.4580000042915344,
 evidence:'review-data/facade-assessment/wall-patch-controls.json:17',
});
export function resolveWallBandTrial(entries:readonly {index:number;buildingId:string;sourceSha256:string;geometryRevision:string}[],enabled:boolean){
 if(!enabled)return null;
 const trial=WALL_BAND_TRIAL,entry=entries.find(e=>e.index===trial.index);
 if(!entry||entry.buildingId!==trial.buildingId||entry.sourceSha256!==trial.sourceSha256||entry.geometryRevision!==trial.geometryRevision)
  throw Error('Source material-band trial binding changed');
 const heightM=trial.planeTopZ-trial.boundaryRow/trial.sourceHeight*(trial.planeTopZ-trial.planeBaseZ)-trial.groundNAP;
 return {...trial,heightM,featureId:`NL.IMBAG.Pand.${trial.buildingId}`};
}
