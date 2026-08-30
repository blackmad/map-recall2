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
  badges: Array<{ label: string; x: number; width: number; kind: 'category' | 'lang' | 'article' }>;
  /** Body text already wrapped and elided to the lines that will be drawn. */
  lines: string[];
  /** The name, elided with an ellipsis if it would not fit. */
  displayName: string;
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
): LandmarkCardLayout {
  const hasImage = !!props.hasImage;
  const imageWidth = hasImage ? IMAGE_WIDTH : 0;
  const textLeft = hasImage ? imageWidth + 20 : 16;
  const height = hasImage
    ? Math.max(130, IMAGE_HEIGHT + 20)
    : (props.body ? 80 : 50);

  const badges: LandmarkCardLayout['badges'] = [];
  let cursor = textLeft;
  const pushBadge = (label: string, kind: 'category' | 'lang' | 'article') => {
    const width = measure(label, BADGE_FONT) + 10;
    badges.push({ label, x: cursor, width, kind });
    cursor += width + 6;
  };
  if (props.category) pushBadge(props.category, 'category');
  // The language chip is a claim about the body text, so it only makes sense
  // when there is body text to be in that language.
  if (props.extractLang && props.extractLang !== 'en' && props.body) {
    pushBadge(props.extractLang.toUpperCase(), 'lang');
  }
  if (props.hasArticle) pushBadge('W  WIKIPEDIA', 'article');

  const maxTextWidth = CARD_WIDTH - textLeft - 16;

  let displayName = props.name || '';
  if (measure(displayName, NAME_FONT) > maxTextWidth) {
    while (displayName.length > 10 && measure(`${displayName}…`, NAME_FONT) > maxTextWidth) {
      displayName = displayName.slice(0, -1);
    }
    displayName += '…';
  }

  return {
    width: CARD_WIDTH,
    height,
    imageWidth,
    imageHeight: IMAGE_HEIGHT,
    textLeft,
    badges,
    displayName,
    lines: wrapToLines(props.body || '', maxTextWidth, hasImage ? 4 : 2, measure, BODY_FONT),
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
const NAME_MAX = 24;
const NAME_MIN = 16;

export function measurePostcard(props: PostcardProps, measure: TextMeasurer): PostcardLayout {
  const textLeft = (props.hasImage ? 136 : 0) + 22;
  const available = POSTCARD_WIDTH - textLeft - 18;
  let nameFontSize = NAME_MAX;
  const fontAt = (size: number) => `800 ${size}px system-ui, sans-serif`;
  while (nameFontSize > NAME_MIN && measure(props.name || '', fontAt(nameFontSize)) > available) {
    nameFontSize -= 1;
  }
  return {
    width: POSTCARD_WIDTH,
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
