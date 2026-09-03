// The two transient cards in the bottom band: the landmark/trivia card and the
// neighborhood postcard.
//
// They lived in `game.js` as ~215 lines of interleaved measurement and canvas
// calls, which meant the only way to see one was to drive to a landmark and the
// only way to check its text fit was to look. Both are split here into a pure
// measure pass — text wrapping, elision, the shrink-to-fit name, the card's own
// height — and a paint pass that consumes it.
//
// The measure pass takes a `measureText` function rather than a context, so a
// check can run it with a stub and assert what the player would read. That is
// the part worth testing; the paint pass is just `ctx` calls in order.

export interface TextMeasurer {
  (text: string, font: string): number;
}

export interface Rect { x: number; y: number; width: number; height: number }

// --- Landmark / trivia card -------------------------------------------------

export interface LandmarkCardProps {
  name: string;
  /** Body text. Falls back through longDetail → detail → the place-only line. */
  body: string;
  /** Feature class, shown as a badge: MUSEUM, BRIDGE, LIBRARY… */
  category?: string;
  /** Language chip, shown only when the blurb is not English. */
  extractLang?: string;
  /** What kind of fact the body is — `Name`, `History`, `Curiosity`. Set only
   *  when the body is generated trivia rather than the article lede, and shown
   *  so that a player passing the same bridge twice can see that the game is
   *  telling them something new rather than repeating itself. */
  factKind?: string;
  hasArticle?: boolean;
  hasImage?: boolean;
}

export interface LandmarkCardLayout {
  width: number;
  height: number;
  imageWidth: number;
  imageHeight: number;
  textLeft: number;
  /** Badges in draw order, already positioned relative to the card. */
  badges: Array<{ label: string; x: number; width: number; kind: 'category' | 'lang' | 'article' | 'more' | 'fact' }>;
  /** Body text already wrapped and elided to the lines that will be drawn. */
  lines: string[];
  /** The name, elided with an ellipsis if it would not fit. */
  displayName: string;
  /** True when `lines` dropped part of the body, so an expanded view has
   *  something the card does not already show. */
  truncated: boolean;
}

const CARD_WIDTH = 480;
const IMAGE_WIDTH = 90;
const IMAGE_HEIGHT = 110;
const BADGE_FONT = 'bold 9px monospace';
const NAME_FONT = 'bold 15px monospace';
const BODY_FONT = '11px monospace';

/**
 * The card's own size and content, given only what fits. A card with a photo
 * gets four lines of body text and a taller box; a bare one gets two.
 */
export function measureLandmarkCard(
  props: LandmarkCardProps,
  measure: TextMeasurer,
  /** The width the card has to fit in. A phone gives it the screen width less
   *  margins; setting the width after measuring only clipped the text. */
  cardWidth: number = CARD_WIDTH,
): LandmarkCardLayout {
  const hasImage = !!props.hasImage;
  const imageWidth = hasImage ? IMAGE_WIDTH : 0;
  const textLeft = hasImage ? imageWidth + 20 : 16;
  const height = hasImage
    ? Math.max(130, IMAGE_HEIGHT + 20)
    : (props.body ? 80 : 50);

  const maxTextWidth = Math.max(60, cardWidth - textLeft - 16);
  const body = props.body || '';
  const lines = wrapToLines(body, maxTextWidth, hasImage ? 4 : 2, measure, BODY_FONT);
  // The card shows a prefix of the body; whether anything was left behind is
  // what decides if there is a bigger version worth opening.
  const shownWords = lines.reduce((total, line) => total + line.split(' ').length, 0);
  const truncated = body ? shownWords < body.split(' ').length : false;

  const badges: LandmarkCardLayout['badges'] = [];
  let cursor = textLeft;
  const pushBadge = (label: string, kind: LandmarkCardLayout['badges'][number]['kind']) => {
    const width = measure(label, BADGE_FONT) + 10;
    badges.push({ label, x: cursor, width, kind });
    cursor += width + 6;
  };
  if (props.category) pushBadge(props.category, 'category');
  // Directly after the category, because it qualifies the same thing: what
  // this card is about is the category, what it says about it is the kind.
  if (props.factKind && props.body) pushBadge(props.factKind.toUpperCase(), 'fact');
  // The language chip is a claim about the body text, so it only makes sense
  // when there is body text to be in that language.
  if (props.extractLang && props.extractLang !== 'en' && props.body) {
    pushBadge(props.extractLang.toUpperCase(), 'lang');
  }
  if (props.hasArticle) pushBadge('W  WIKIPEDIA', 'article');
  // Nothing else on a canvas card says it can be clicked, so the cut body has
  // to advertise the panel that holds the rest of it.
  if (truncated) pushBadge('+  MORE', 'more');

  let displayName = props.name || '';
  if (measure(displayName, NAME_FONT) > maxTextWidth) {
    while (displayName.length > 10 && measure(`${displayName}…`, NAME_FONT) > maxTextWidth) {
      displayName = displayName.slice(0, -1);
    }
    displayName += '…';
  }

  return {
    width: cardWidth,
    height,
    imageWidth,
    imageHeight: IMAGE_HEIGHT,
    textLeft,
    badges,
    displayName,
    lines,
    truncated,
  };
}

/**
 * Greedy wrap to a line budget. A body that overruns is cut at the budget —
 * the card is a glance, not an article, and `W` opens the real one.
 */
export function wrapToLines(
  text: string,
  maxWidth: number,
  maxLines: number,
  measure: TextMeasurer,
  font: string,
): string[] {
  if (!text) return [];
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const candidate = line ? `${line} ${word}` : word;
    if (measure(candidate, font) > maxWidth && line) {
      lines.push(line);
      if (lines.length >= maxLines) return lines;
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines;
}

/**
 * What a landmark card says when the encyclopedia has nothing. 124 of the 420
 * landmarks have no article — mostly OBA branch libraries and neighborhood
 * cinemas — and a badge over a blank strip read as a rendering failure. The
 * kind of place and the neighborhood are both true and both worth reading.
 */
export function placeOnlyDetail(type: string | undefined, neighborhood: string | undefined): string {
  const kind = String(type || 'landmark').replace('_', ' ');
  const article = /^[aeiou]/i.test(kind) ? 'An' : 'A';
  const where = neighborhood ? ` in ${neighborhood}` : ' in Amsterdam';
  return `${article} ${kind}${where}. No encyclopedia article yet.`;
}

// --- Neighborhood postcard --------------------------------------------------

export interface PostcardProps {
  name: string;
  kind?: string;
  imageArea?: string;
  hasImage?: boolean;
}

export interface PostcardLayout {
  width: number;
  height: number;
  photoWidth: number;
  textLeft: number;
  heading: string;
  name: string;
  /** Shrunk until the name fits the card; never below the floor. */
  nameFontSize: number;
  caption: string;
}

const POSTCARD_WIDTH = 390;
const POSTCARD_HEIGHT = 104;
const POSTCARD_PHOTO_WIDTH = 144;
/** Gap between the photo’s right edge and the first glyph of the name. */
const POSTCARD_TEXT_GAP = 18;
const NAME_MAX = 24;
const NAME_MIN = 16;

export function measurePostcard(
  props: PostcardProps,
  measure: TextMeasurer,
  /** The width the postcard has to fit in; a phone gives it less than 390. */
  cardWidth: number = POSTCARD_WIDTH,
): PostcardLayout {
  // textLeft used to hardcode 136 while the photo was 144 wide, and the
  // renderer’s fade ran to x+170 — so “Weesperbuurt” started inside the photo
  // and under a dark gradient left over from the old navy card.
  const textLeft = props.hasImage ? POSTCARD_PHOTO_WIDTH + POSTCARD_TEXT_GAP : 22;
  const available = Math.max(60, cardWidth - textLeft - 18);
  let nameFontSize = NAME_MAX;
  const fontAt = (size: number) => `800 ${size}px system-ui, sans-serif`;
  while (nameFontSize > NAME_MIN && measure(props.name || '', fontAt(nameFontSize)) > available) {
    nameFontSize -= 1;
  }
  return {
    width: cardWidth,
    height: POSTCARD_HEIGHT,
    photoWidth: POSTCARD_PHOTO_WIDTH,
    textLeft,
    nameFontSize,
    name: props.name || '',
    heading: `ENTERING ${String(props.kind || 'NEIGHBORHOOD').toUpperCase()}`,
    // Crediting the photo matters when it was borrowed from the containing
    // district rather than taken in this neighborhood.
    caption: props.imageArea ? `Photo: ${props.imageArea} · Amsterdam` : 'Amsterdam · Noord-Holland',
  };
}

/** Cover-crop a source image into a box without distorting it. */
export function coverCrop(
  naturalWidth: number,
  naturalHeight: number,
  boxWidth: number,
  boxHeight: number,
): { sx: number; sy: number; sw: number; sh: number } {
  const targetAspect = boxWidth / boxHeight;
  const aspect = naturalWidth / naturalHeight;
  let sw = naturalWidth;
  let sh = naturalHeight;
  let sx = 0;
  let sy = 0;
  if (aspect > targetAspect) {
    sw = naturalHeight * targetAspect;
    sx = (naturalWidth - sw) / 2;
  } else {
    sh = naturalWidth / targetAspect;
    sy = (naturalHeight - sh) / 2;
  }
  return { sx, sy, sw, sh };
}
