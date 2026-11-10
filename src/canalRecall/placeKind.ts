// What a mapped place is, in plain English, from its OSM tags.
//
// The click-POI extract (scripts/build-click-poi-info.ts) stores one phrase per
// place ("a café", "a Sikh gurdwara"), and the building card says it. A place
// of worship said only "a place of worship" for a gurdwara, a mosque and a
// cathedral alike; OSM's `religion` / `denomination` tags say which
// (user shot 2026-11-08, Shri Guru Nanak Gurdwara Sahib at Sloterdijk).

/** OSM values worth a phrase of their own; anything else is spelled out. */
export const PLACE_KIND_LABELS: Readonly<Record<string, string>> = {
  restaurant: 'a restaurant', cafe: 'a café', pub: 'a pub', bar: 'a bar', fast_food: 'a fast-food restaurant', ice_cream: 'an ice-cream shop',
  books: 'a bookshop', clothes: 'a clothing shop', shoes: 'a shoe shop', cheese: 'a cheese shop', bakery: 'a bakery',
  supermarket: 'a supermarket', convenience: 'a convenience store', department_store: 'a department store',
  bicycle: 'a bicycle shop', bicycle_rental: 'a bicycle rental', place_of_worship: 'a place of worship',
  museum: 'a museum', gallery: 'a gallery', theatre: 'a theatre', cinema: 'a cinema', arts_centre: 'an arts centre',
  library: 'a library', hotel: 'a hotel', hostel: 'a hostel', guest_house: 'a guest house', attraction: 'an attraction',
  university: 'a university', school: 'a school', college: 'a college', kindergarten: 'a kindergarten',
  clinic: 'a clinic', hospital: 'a hospital', pharmacy: 'a pharmacy', community_centre: 'a community centre',
  doityourself: 'a DIY store', police: 'a police station', townhall: 'a town hall', toys: 'a toy shop',
};

/** Keys whose bare value names the goods, not the place (`shop=gift`): "a gift shop". */
const SHOP_KEYS = new Set(['shop']);
/** Shop values that already name the place. */
const SHOP_PLACES = new Set(['butcher', 'florist', 'greengrocer', 'deli', 'mall', 'kiosk', 'optician', 'hairdresser', 'beauty']);

/** `religion=*` on a place of worship. Christian is refined by denomination below. */
const RELIGION_LABELS: Readonly<Record<string, string>> = {
  sikh: 'a Sikh gurdwara', muslim: 'a mosque', jewish: 'a synagogue', hindu: 'a Hindu temple',
  buddhist: 'a Buddhist place of worship', christian: 'a church',
};

/** `denomination=*` on a Christian place of worship (the Amsterdam extract's common ones). */
const DENOMINATION_LABELS: Readonly<Record<string, string>> = {
  protestant: 'a Protestant church', roman_catholic: 'a Roman Catholic church', catholic: 'a Roman Catholic church',
  reformed: 'a Reformed church', lutheran: 'a Lutheran church', baptist: 'a Baptist church',
  pentecostal: 'a Pentecostal church', old_catholic: 'an Old Catholic church', mennonite: 'a Mennonite church',
  evangelical: 'an evangelical church', orthodox: 'an Orthodox church', anglican: 'an Anglican church',
  jehovahs_witness: 'a Kingdom Hall of Jehovah’s Witnesses',
};

/** "a"/"an" before a phrase that has neither. */
export function withArticle(phrase: string): string {
  const text = phrase.trim();
  if (!text || /^(a|an|the)\s/i.test(text)) return text;
  return `${/^[aeiou]/i.test(text) ? 'an' : 'a'} ${text}`;
}

/** The phrase for one OSM value of a POI key (`amenity`, `shop`, …), religion-aware. */
export function placeKindLabel(kind: string, tags: Readonly<Record<string, string>> = {}, key = ''): string {
  if (kind === 'place_of_worship') {
    const religion = (tags.religion || '').trim().toLowerCase();
    const denomination = (tags.denomination || '').trim().toLowerCase();
    if (religion === 'christian' && DENOMINATION_LABELS[denomination]) return DENOMINATION_LABELS[denomination];
    if (RELIGION_LABELS[religion]) return RELIGION_LABELS[religion];
  }
  if (PLACE_KIND_LABELS[kind]) return PLACE_KIND_LABELS[kind];
  const words = kind.replaceAll('_', ' ').trim();
  return withArticle(SHOP_KEYS.has(key) && !SHOP_PLACES.has(kind) && !/\b(shop|store)$/.test(words) ? `${words} shop` : words);
}
