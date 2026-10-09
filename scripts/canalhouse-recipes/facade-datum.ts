/** Rebase an entire photo annotation when a foreground obstruction was mistaken
 * for pavement. Original source annotations are never mutated. */
export function rebaseFacadeDatum<N extends Record<string,any>,L extends Record<string,any>>(source:N,lowerSource:L,newGround:number){
 const note=structuredClone(source),lower=structuredClone(lowerSource),frame=note.facadeScreenQuad;
 const oldGround=frame.yGround,oldHeight=oldGround-frame.yEaves,newHeight=newGround-frame.yEaves;
 if(!Number.isFinite(newGround)||newHeight<=0||newGround<=oldGround||newGround-oldGround>60||lower.facadeScreenQuad.yGround!==oldGround)throw Error('Unsupported facade datum correction');
 const ordinate=(y:number)=>(newGround-oldGround+y*oldHeight)/newHeight;
 const rect=(r:any)=>{r.bottom=ordinate(r.bottom);r.height=r.height*oldHeight/newHeight;};
 for(const o of note.openings)rect(o);
 if(note.door)rect(note.door);
 for(const b of note.horizontalBands){const base=b.bottom===0&&/basement|plinth/.test(b.label);rect(b);if(base){b.height+=b.bottom;b.bottom=0;}}
 for(const b of note.facadeBlocksNormalized??[])rect(b);
 for(const b of note.corniceFragmentsNormalized??[])rect(b);
 for(const o of note.ornamentsNormalized??[])o.profile=o.profile.map(([x,y]:number[])=>[x,ordinate(y)]);
 note.crown.profileNormalized=note.crown.profileNormalized.map(([x,y]:number[])=>[x,ordinate(y)]);
 for(const o of lower.openings){rect(o);o.normalizedRect=[o.left,o.bottom,o.width,o.height];}
 note.facadeScreenQuad.yGround=newGround;lower.facadeScreenQuad.yGround=newGround;
 return {note,lower,provenance:{oldGroundPixel:oldGround,newGroundPixel:newGround,oldHeightPixel:oldHeight,newHeightPixel:newHeight,classification:'bounded inferred pavement datum; source roof/footprint unchanged'}};
}
