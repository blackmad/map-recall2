import type {SignatureModelSpec} from './signaturePlacement';

/** Renderer-only substitutions retain curated POI identities and whole owners. */
export function mergeCanalhousePreviewModels(accepted:readonly SignatureModelSpec[],candidates:readonly SignatureModelSpec[]):SignatureModelSpec[]{
 const result=[...accepted],seen=new Set<string>();
 for(const candidate of candidates){
  const ids=new Set(candidate.suppressOsmIds??[]);
  const pandIds=[...ids].filter(id=>id.startsWith('NL.IMBAG.Pand.'));
  if(pandIds.some(id=>seen.has(id)))throw Error('Duplicate canalhouse preview owner');
  pandIds.forEach(id=>seen.add(id));
  const overlaps=result.filter(model=>(model.suppressOsmIds??[]).some(id=>ids.has(id)));
  if(!overlaps.length){result.push(candidate);continue;}
  // A frontage candidate may not replace only one part of an accepted complex.
  if(overlaps.length!==1||overlaps[0].suppressOsmIds?.some(id=>id.startsWith('NL.IMBAG.Pand.')&&!ids.has(id)))continue;
  const owner=overlaps[0],index=result.indexOf(owner);
  result[index]={...candidate,id:owner.id,name:owner.name,landmarkId:owner.landmarkId,
   relatedLandmarkIds:owner.relatedLandmarkIds,destinationLandmarkIds:owner.destinationLandmarkIds,
   suppressOsmIds:[...new Set([...(owner.suppressOsmIds??[]),...ids])]};
 }
 return result;
}

export interface CanalhousePreviewCatalogue<Entry> {
 entries:readonly Entry[];
 reviewRows?:readonly {id:string;houseIds:readonly string[]}[];
}
export function canalhousePreviewEntries<Entry extends {id:string}>(selection:string|null,pilot:Entry[],...catalogues:CanalhousePreviewCatalogue<Entry>[]):Entry[]{
 if(selection==='pilot')return pilot;
 const matches=catalogues.flatMap(catalogue=>(catalogue.reviewRows??[]).filter(row=>row.id===selection).map(row=>({catalogue,row})));
 if(matches.length>1)throw Error('Ambiguous canalhouse preview row across catalogues');
 if(!matches.length)return [];
 const {catalogue,row}=matches[0];
 if(!row.houseIds.length||new Set(row.houseIds).size!==row.houseIds.length)throw Error('Invalid canalhouse preview row membership');
 return row.houseIds.map(id=>{const entries=catalogue.entries.filter(entry=>entry.id===id);if(entries.length!==1)throw Error('Missing or ambiguous canalhouse preview row entry');return entries[0];});
}


/** A gallery-wide view must not silently become a smaller overlapping game row. */
export function canalhousePreviewRowForMembers<Row extends {houseIds:readonly string[]}>(ids:readonly string[],rows:readonly Row[]):Row|undefined{
 if(!ids.length||new Set(ids).size!==ids.length)return undefined;
 const members=new Set(ids),matches=rows.filter(row=>row.houseIds.length===ids.length&&new Set(row.houseIds).size===ids.length&&row.houseIds.every(id=>members.has(id)));
 if(matches.length>1)throw Error('Ambiguous canalhouse preview row membership');
 return matches[0];
}
