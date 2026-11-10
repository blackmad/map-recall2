/**
 * J2 hand labels (one reader: the J2 lane, Sonnet 5.5, looking at the contact sheets). Single-reader truth, so every accuracy below
 * carries that noise; "null"/missing means not judged. Index = position in .cache/jev-j2/sets.json (A = 48 AB07 good crops sorted by pand id,
 * B = 12 marginal + 12 bad crops for occlusion).
 * colour: nb near-black painted, db dark brown brick, rb red-brown brick, ob orange brick, ps pale salmon brick, ty tan/yellow brick, wp white plaster, gs grey stone/grey
 * head (dominant window head on upper storeys): f flat, s segmental, r round arch, p pointed
 * bands/surround/cornice: white speklagen bands, white window surrounds, white cornice (y/n). balcony/stoop: y/n. van/trunk/branches: occlusion (y/n).
 */
const T = 'y', F = 'n';
const row = (colour, head, bands, surround, cornice, extra = {}) => ({colour, head, bands: bands === 'y', surround: surround === 'y', cornice: cornice === 'y', ...extra});
export const A = [
  row('rb','f','n','y','y'), row('rb','f','y','n','y',{van:T}), row('nb','f','n','n','y',{branches:T}), row('rb','f','y','n','n',{balcony:T}), row('ps','f','n','n','n',{balcony:T}), row('nb','f','n','y','n'),
  row('ob','r','n',null,'n'), row('ps','f','n','y','n',{stoop:T}), row('rb','f','n','y','n'), row('nb','f','y','y','y',{stoop:T}), row('ps','f','n','n','n',{balcony:T}), row('rb','s','y','n','y'),
  row('nb','f','n','y','n'), row('rb','f','n','y','n'), row('rb','s','n','n','y',{stoop:T}), row('rb','f','y','y','n',{branches:T,van:T}), row('rb','f','y','y','n',{branches:T}), row('nb','f','n','y','n'),
  row('db','f','n','y','y',{balcony:T}), row('wp','f','n','n','n'), row('nb','f','n','n','n',{stoop:T}), row('rb','s','y','n','n'), row('db','f','y','y','n',{branches:T}), row('rb','r','n','y','y'),
  row('db','f','n','y','n'), row('rb','f','n','y','n'), row('rb','f','y','n','n',{balcony:T}), row('gs','f','n','n','n',{balcony:T,branches:T}), row('nb','f','n','y','n'), row('rb','f','n','y','n'),
  row('wp','f','n','n','y',{branches:T}), row('rb','f','y','n','y'), row('ob','f','n','n','n'), row('rb','f','n','y','n',{van:T}), row('db','f','n','y','n'), row('gs','f','n','n','n'),
  row('rb','f','y','n','n',{branches:T}), row('ty','f','n','n','n'), row('db','f','n','y','n',{stoop:T}), row('rb','f','n','n','n'), row('db','f','n','y','n'), row('db','f','n','n','n',{stoop:T}),
  row('ob','f','n','n','n'), row('ps','f','n','y','n',{branches:T}), row('rb','f','y','n','y'), row('db','f','n','n','n'), row('rb','s','n','n','y'), row('db','f','n','y','n'),
];
// B: occlusion only. van = van/truck, trunk = tree trunk, branches = bare branches, scaffold/boat have no positive in this set.
const occ = (van = F, trunk = F, branches = F) => ({van, trunk, branches, scaffold: F, boat: F});
export const B = [
  occ(T,F,T), occ(), occ(F,F,T), occ(), occ(F,F,T), occ(F,T,T), occ(T), occ(), occ(), occ(), occ(), occ(F,T,T),
  occ(F,F,T), occ(), occ(), occ(T), occ(), occ(), occ(), occ(), occ(), occ(), occ(F,F,T), occ(),
];
