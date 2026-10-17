/**
 * My progress is a view of the Map Quest app chosen by path: `/progress` on
 * the public site (a Hosting rewrite onto /quiz/index.html) and on the dev
 * server (Vite's SPA fallback), `<base>progress` under a subpath build.
 */
export function isProgressPath(pathname: string): boolean {
  return /\/progress\/?$/.test(pathname);
}
