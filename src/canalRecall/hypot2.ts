// Math.hypot for two numbers, without the builtin's allocation.
//
// Desktop-perf 2026-11-27: V8's Math.hypot is a variadic builtin that TurboFan does not inline: every call collects its
// arguments and boxes its result, ~48 bytes of garbage (measured in node). The road guard's contacts, building bases and
// landmark reach checks call it thousands of times a frame. This is V8's own algorithm (builtins/math.tq MathHypot:
// Infinity before NaN, 0 when both are 0, else a Kahan sum of (|v| / max)^2 then sqrt(sum) * max) in plain doubles,
// so it returns Math.hypot's bits (hypot2.test.ts pins that on a million pairs and the edge cases).

// Every return is a double already in hand (never a literal Infinity, NaN or 0): a constant among the returns made
// TurboFan box the inlined result, ~36 bytes a road span again (measured in node).
export function hypot2(x: number, y: number): number {
  const ax = Math.abs(x), ay = Math.abs(y);
  if (ax === Infinity) return ax;
  if (ay === Infinity) return ay;
  if (ax !== ax) return ax;
  if (ay !== ay) return ay;
  const max = ax > ay ? ax : ay;
  if (max === 0) return max;
  // The builtin's Kahan sum over two terms: its compensation after the first term is exactly 0.
  const n0 = ax / max, n1 = ay / max;
  return Math.sqrt(n0 * n0 + n1 * n1) * max;
}
