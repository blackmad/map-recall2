/**
 * What Canal Recall's Sentry init drops before sending (`ignoreErrors`). Pure, so the
 * patterns are unit-tested (`monitoringFilters.test.ts`) without loading Sentry.
 *
 * Every entry is noise we cannot act on. Never add a real error of ours to shorten the list.
 */
export const IGNORED_ERRORS: readonly RegExp[] = [
  // A dead GPU process makes every shader query answer false with an empty
  // info log; MapLibre 5 then throws this from every render frame. `mapGuard`
  // handles maps we own, and this keeps unguarded pages from flooding the
  // project. A real shader bug carries a GLSL log and still reports.
  /Could not compile (fragment|vertex) shader:\s*(null)?$/,
  /Program failed to link:\s*(null)?$/,
  // Microsoft's link scanner (Outlook SafeLinks / Defender, a CefSharp host on
  // Windows Chrome) rejects a non-Error string from its own injected bridge,
  // thousands of times per visit (Sentry CANAL-RECALL-G/-F, 2026-10-24). Not
  // a person and not our code.
  /Object Not Found Matching Id:\d+, MethodName:\w+, ParamCount:\d+/,
  // The same scanner profile (Windows Chrome 139, no WebGL, reCAPTCHA calls
  // blocked) makes App Check's reCAPTCHA re-render its invisible widget after
  // the blocked call (Sentry CANAL-RECALL-M, 2026-10-27). Thrown inside
  // Google's script; App Check falls back to no token either way.
  /reCAPTCHA has already been rendered in this element/,
];

/** Would Sentry's `ignoreErrors` drop an event with this message? (Sentry matches substrings and regexes.) */
export function isIgnoredErrorMessage(message: string): boolean {
  return IGNORED_ERRORS.some(pattern => pattern.test(message));
}
