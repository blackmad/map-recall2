import type {CanalhouseElevation} from '../../src/canalRecall/canalhouseRecipes';

/** Acknowledgement is specific to this aperture and this source-selected flight.
 * It cannot excuse a roof, parent wall, another flight or a wholly hidden pane. */
export function sourceOccludingFlights(elevation:CanalhouseElevation,openingId:string):string[]{
 return (elevation.approaches??[]).filter(a=>a.assembly.value.occludedOpeningIds?.includes(openingId)).map(a=>a.id);
}
export function acknowledgedFlightHit(name:string|null,flights:readonly string[]):boolean{
 return name!==null&&flights.some(id=>name===`entrance/approach/${id}`||name.startsWith(`entrance/approach/${id}/`));
}

/** A rail on another window, an unobserved guard, or a parent wall cannot qualify. */
export function sourceOccludingRails(elevation:CanalhouseElevation,openingId:string):string[]{
 return (elevation.balconies?.value??[]).filter(r=>r.openingId===openingId&&r.occludesOpening===true).map(r=>r.id);
}
export function acknowledgedRailHit(name:string|null,rails:readonly string[]):boolean{
 return name!==null&&rails.some(id=>name.startsWith(`balcony/${id}/`));
}
