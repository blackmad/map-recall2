// House rows: the rows that draw by default, without a URL flag (round-1 install, David's sign-off per row). The
// publish writes this file together with the rows' records in public/data/front-records/row-front.json: `rows` are row
// ids (a record's series id up to its `/`), `chunks` the street chunks whose ROW_FRONT variant those rows need (the
// `wallOnly.chunk` of their members). `?rowFront=0` / ROW_FRONT=0 turns every row off; `?rowFront=1` / ROW_FRONT=1 draws
// every record, published or staged. Empty: nothing draws by default (the flag-off world, byte for byte).
export const PUBLISHED_ROWS: { readonly rows: readonly string[]; readonly chunks: readonly string[] } = {
  rows: [],
  chunks: [],
};
