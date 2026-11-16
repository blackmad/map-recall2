// Lane retail-real round 6: a correction layer over OSM from shopfronts read on the newest facing panorama
// (data/retail-ground/sign-reads.json; opus readers, scripts/retail-ground/front-photos.ts --newest cuts). Each read
// says what the ground floor at a templated pand shows; at READ_MIN_CONF or more it decides the pand's front:
//   match       keep the OSM template
//   other       the template its tag gives (templateForTags), else the neutral front
//   noShop      no shopfront at all (shopQuiet)
//   vacant      the neutral front (an unsigned shop pui: a closed shop still leaves its front)
//   unreadable  the neutral front (a shopfront, but what it sells cannot be told)
//   occluded    keep (nothing seen)
// Pure: Node build (build-templates.ts) and tests.

export const READ_MIN_CONF = 0.7;
export type ReadVerdict = 'match' | 'other' | 'noShop' | 'vacant' | 'unreadable' | 'occluded';
export type SignRead = { node: number; pano: string; date: string; reader: string; v: ReadVerdict; tag?: string; name?: string; conf: number };
export type Correction<T> = { action: 'keep' } | { action: 'template'; template: T; tags: Record<string, string> } | { action: 'neutral' } | { action: 'quiet' };

/** OSM-style tags from a read's `tag` ("shop=clothes") and sign name. */
export function readTags(read: Pick<SignRead, 'tag' | 'name'>): Record<string, string> {
  const m = /^(shop|amenity)=([a-z_;]+)$/.exec((read.tag ?? '').trim());
  return { ...(m ? { [m[1]]: m[2] } : {}), ...(read.name ? { name: read.name } : {}) };
}

export function correctionFor<T>(read: SignRead | undefined, templateFor: (tags: Record<string, string>) => T | null, minConf = READ_MIN_CONF): Correction<T> {
  if (!read || read.conf < minConf) return { action: 'keep' };
  switch (read.v) {
    case 'match': case 'occluded': return { action: 'keep' };
    case 'noShop': return { action: 'quiet' };
    case 'vacant': case 'unreadable': return { action: 'neutral' };
    case 'other': {
      const tags = readTags(read), template = tags.shop || tags.amenity ? templateFor(tags) : null;
      return template ? { action: 'template', template, tags } : { action: 'neutral' };
    }
  }
}
