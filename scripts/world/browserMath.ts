/**
 * Chrome's Math.cos / Math.sin in Node, for the world compiler.
 *
 * The compiler bakes the decorator chain's output, so it must compute what the browser computes, to the bit.
 * Node 26 (V8 14.6) and Chrome 151/156 disagree in the last bit of Math.cos for ~1 % of the latitudes the
 * footprint projection feeds it (cos(lat), roofMesh fitRect -> riseM -> roofEavesHeightM): the 2026-10-30
 * browser A/B found 47 buildings in the four Westerkerk tiles whose roofEavesHeightM differed by one ulp,
 * and every one traced to cos. Chrome's results are the correctly rounded ones (checked against a
 * 60-digit series), Node's are fdlibm's. So the compiler installs correctly rounded cos and sin: a
 * double-double evaluation (~106 bits) rounded once. `npm run world:browser-math` (scripts/world/check-browser-math.mjs)
 * replays a sample in Chrome to prove the match.
 */
type DD = [number, number];
const SPLIT = 134217729; // 2^27 + 1
function twoSum(a: number, b: number): DD { const s = a + b, bb = s - a; return [s, (a - (s - bb)) + (b - bb)]; }
function quickTwoSum(a: number, b: number): DD { const s = a + b; return [s, b - (s - a)]; }
function twoProd(a: number, b: number): DD {
  const p = a * b;
  let t = SPLIT * a; const ah = t - (t - a), al = a - ah;
  t = SPLIT * b; const bh = t - (t - b), bl = b - bh;
  return [p, ((ah * bh - p) + ah * bl + al * bh) + al * bl];
}
function add(a: DD, b: DD): DD { const [s, e] = twoSum(a[0], b[0]); const [t, f] = twoSum(a[1], b[1]); let [h, l] = quickTwoSum(s, e + t); [h, l] = quickTwoSum(h, l + f); return [h, l]; }
function mul(a: DD, b: DD): DD { const [p, e] = twoProd(a[0], b[0]); return quickTwoSum(p, e + (a[0] * b[1] + a[1] * b[0])); }
function divN(a: DD, n: number): DD { // a / n for a small integer n, to dd precision
  const q1 = a[0] / n; const [p, e] = twoProd(q1, n); const r = (a[0] - p - e + a[1]) / n; return quickTwoSum(q1, r);
}
const PI2: DD = [6.283185307179586, 2.4492935982947064e-16];
const PI: DD = [3.141592653589793, 1.2246467991473532e-16];
/** x reduced to [-pi, pi] in double-double; exact enough for |x| < 1e5 (the compiler's angles are < 2 pi). */
function reduce(x: number): DD {
  if (Math.abs(x) <= PI[0]) return [x, 0];
  const k = Math.round(x / PI2[0]);
  return add([x, 0], mul(PI2, [-k, 0]));
}
/** Taylor series in double-double around 0 for |r| <= pi: cos (start 1, k = 0) or sin (start r, k = 1). */
function series(r: DD, odd: boolean): DD {
  const r2 = mul(r, r);
  let term: DD = odd ? r : [1, 0], sum: DD = term;
  for (let n = odd ? 1 : 0; n < 60; n += 2) {
    term = divN(mul(term, r2), (n + 1) * (n + 2)); term = [-term[0], -term[1]];
    sum = add(sum, term);
    if (Math.abs(term[0]) < 1e-40) break;
  }
  return sum;
}
const native = { cos: Math.cos, sin: Math.sin };
export function correctlyRoundedCos(x: number): number {
  if (!Number.isFinite(x) || Math.abs(x) > 1e5) return native.cos(x);
  const [h, l] = series(reduce(x), false);
  return h + l;
}
export function correctlyRoundedSin(x: number): number {
  if (!Number.isFinite(x) || Math.abs(x) > 1e5) return native.sin(x);
  if (x === 0) return x; // keeps -0
  const [h, l] = series(reduce(x), true);
  return h + l;
}
/** Make this process's Math.cos / Math.sin the browser's. Idempotent; returns how to undo it. */
export function installBrowserMath(): () => void {
  if ((Math.cos as unknown) === correctlyRoundedCos) return () => {};
  Math.cos = correctlyRoundedCos; Math.sin = correctlyRoundedSin;
  return () => { Math.cos = native.cos; Math.sin = native.sin; };
}
export const nativeMath = native;
