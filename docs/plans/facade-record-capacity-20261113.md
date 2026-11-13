# Facade record capacity: v2 or a second row (F1 #380, P5 ruling 6)

Status: note for a later decision, after D1's per-storey fields exist. Nothing here is built.

## Where the record is today

- One pand is 64 B, which is 4 RGBA32UI texels (`look/facadeRecord.ts`, `FACADE_FIELDS`).
- The record texture is one city-wide texture, 256 texels × 4096 rows (16.8 MB, allocated once). Each resident cell takes `ceil(records / 64)` rows (`look/facadeRecordTexture.ts`).
- The Dam resident set uses 5.1 MB; the city uses 21 MB of FREC.
- **The record is full.** The last spare bit (byte 59 bit 7) went to `archTop` in P2. Byte 63 is reserved for F2.
- Per-storey facts have no room:
  - window kind, head and pane layout per storey;
  - a white band per storey;
  - an arched storey other than the top one.
  Today they collapse to one value for the whole front plus `archTop`.

## Option A: record v2, 128 B (8 texels) for every pand

- **Memory:** record bytes double. The Dam resident set goes 5.1 → 10.2 MB. The texture either doubles to 33.6 MB or keeps its size and holds half the records, which is 2,048 cells' worth of rows. The aerial resident set uses about 1,300 rows today, so the second choice is tight.
- **Shader:** 8 texelFetch instead of 4, about +0.05 ms at the Dam at DPR 2. This is under the GPU timer's noise floor.
- **Shells:** FREC per cell doubles, roughly +6–8 % gz per record shell, because most of the extra bytes are zero and compress well.
- **Migration:**
  - `FACADE_RECORD_BYTES` and the FREC version are bumped.
  - Every record shell is recompiled.
  - The packer, the shader accessors and the CPU twin change together.
  - It is a one-shot cutover with no mixed worlds; the current flag state allows that.
- **Simplicity:** this is the simplest option. Every field still sits at a fixed offset, and the twin and field-coverage table stay one table.

## Option B: an optional second row (extension record)

- **Layout:** the base stays 64 B. Pands that have per-storey data get a 64 B extension in a second texture, or in a reserved row band of the same texture.
- **Indirection:** the base record needs a pointer to its extension, and there is no spare bit for one. The options are:
  - take F2's byte 63 (a u8 is too small for a cell-local index past 255);
  - add a parallel u16 index texture (+2 B per pand, a 3rd sampler);
  - steal `statedMask` (byte 30) and rebuild its meaning.
- **Memory:** this is the cheapest option when the data is sparse. At D1's likely coverage (canal belt first, perhaps 10–25 % of resident pands), the extension adds about 0.5–1.3 MB at the Dam.
- **Shader:** a conditional fetch, only where the pointer is set and only in the near/mid tier (the far tier does not need per-storey heads, per ruling 6). The cost is about the same as A, plus one branch.
- **Complexity:**
  - a second allocator, or a second row band;
  - the FREC stream gains an extension table;
  - the twin must resolve the pointer;
  - fields split across two tables.
  This is the main cost: more code, and more ways for the twin and the shader to disagree.

## Recommendation

- **Default:** choose A (v2, 128 B) unless the memory budget is the binding constraint when D1 lands. The cost is +5 MB at the Dam against a 700 MB aerial budget. A keeps one fixed layout and roughly 60 B of headroom.
- **When to choose B:** only if aerialGlMaxMB is within about 10 MB of the budget at that point, or if per-storey coverage stays under about 10 %.
- **Either way:**
  - Define the per-storey fields first, from D1's describer output (storey count is capped at 8, which makes the arrays fixed-size).
  - Then size the record from the fields rather than the other way round.
