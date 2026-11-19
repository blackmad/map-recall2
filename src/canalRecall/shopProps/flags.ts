// Lane retail-pass-20261119 flags, read in the mesh worker from its own URL (engine/workerPool.ts withWorkerFlags
// forwards them) and in Node from the environment; a test sets the global. Both default off until David signs off.

type G = { location?: { search?: string }; process?: { env?: Record<string, string | undefined> } } & Record<string, unknown>;

function flag(global: string, query: RegExp, env: string): () => boolean {
  let cached: boolean | undefined;
  return () => {
    const g = globalThis as G;
    if (typeof g[global] === 'boolean') return g[global] as boolean;
    return (cached ??= query.test(g.location?.search ?? '') || g.process?.env?.[env] === '1');
  };
}

/** `?shopPass=1` (SHOP_PASS=1): round 1's visual pass on the shop props (salon styling stations at full size with lit
 *  mirrors, and the other round-1 template changes in shopProps/layout.ts SHOP_PROPS_PASS). */
export const shopPassOn = flag('__canalRecallShopPass', /[?&]shopPass=1\b/, 'SHOP_PASS');
/** `?shopInteriors=1` (SHOP_INTERIORS=1): round 2's shallow rooms behind shop glass (shopProps/interiors.ts). */
export const shopInteriorsOn = flag('__canalRecallShopInteriors', /[?&]shopInteriors=1\b/, 'SHOP_INTERIORS');
