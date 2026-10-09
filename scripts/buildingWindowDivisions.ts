/** Shared photo-selected sash divisions; fractions stay editable in the recipe. */
export const WINDOW_DIVISIONS:Record<string,number[]>={
 single:[],pair:[.5],triple:[1/3,2/3],
 'wide-centre':[.18,.82],'wide-left':[.7],'wide-right':[.3],
};
export function windowDivision(mullions:number[]|undefined){
 if(mullions===undefined)return 'automatic';
 return Object.entries(WINDOW_DIVISIONS).find(([,fractions])=>fractions.length===mullions.length&&fractions.every((n,i)=>Math.abs(n-mullions[i])<1e-8))?.[0]??'custom';
}
export function divisionMullions(preset:string){
 const fractions=WINDOW_DIVISIONS[preset];if(!fractions)throw Error('Unknown window division.');return [...fractions];
}
