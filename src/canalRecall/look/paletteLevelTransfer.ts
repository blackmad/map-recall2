// Browser-measured sun-side transfer of a generic wall tint (tests/e2e/palette-level.spec.ts, PALETTE_LEVEL=transfer, read by
// scripts/look/palette-level-transfer.mts). Pose: Tichelstraat, chase, build 2026-11-09, `?tier=high&governor=0`. Every facade
// chunk's tint attribute was overwritten with the test tint; the rows are the median sRGB of the 1294 wall pixels (black with
// a #000000 tint, answering to a grey tint) of one sunlit street face. The fit and its error are in look/paletteLevel.ts.
import type { TransferRow } from './paletteLevel.ts';
export const RENDER_TRANSFER_ROWS: Record<string, TransferRow> = {
 "#40261f": {
  "sun": [
   65,
   37,
   29
  ]
 },
 "#5b362b": {
  "sun": [
   94,
   54,
   42
  ]
 },
 "#7b3a2f": {
  "sun": [
   128,
   59,
   46
  ]
 },
 "#9a5846": {
  "sun": [
   160,
   90,
   70
  ]
 },
 "#b05a40": {
  "sun": [
   183,
   92,
   64
  ]
 },
 "#c58b5e": {
  "sun": [
   204,
   142,
   95
  ]
 },
 "#d3b184": {
  "sun": [
   219,
   180,
   131
  ]
 },
 "#b0756d": {
  "sun": [
   183,
   120,
   109
  ]
 },
 "#6f6f6f": {
  "sun": [
   116,
   114,
   110
  ]
 },
 "#9b9a98": {
  "sun": [
   162,
   157,
   150
  ]
 },
 "#858687": {
  "sun": [
   139,
   137,
   133
  ]
 },
 "#e5dfd1": {
  "sun": [
   236,
   226,
   205
  ]
 },
 "#efe7e0": {
  "sun": [
   245,
   233,
   219
  ]
 },
 "#8c4a38": {
  "sun": [
   146,
   75,
   56
  ]
 },
 "#ffffff": {
  "sun": [
   255,
   253,
   246
  ]
 },
 "#000000": {
  "sun": [
   0,
   0,
   0
  ]
 }
};
