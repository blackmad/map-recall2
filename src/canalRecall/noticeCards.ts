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

import { hudSurface } from './hudTheme.ts';

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
  articleLabel?: string;
  hasImage?: boolean;
}

export interface LandmarkCardLayout {
  width: number;
  height: number;
  imageWidth: number;
  imageHeight: number;
  textLeft: number;
  /** Badges in draw order, already positioned relative to the card. A `more`
   *  entry is drawn as a text link at the header's right edge, not a chip. */
  badges: Array<{ label: string; x: number; width: number; kind: 'category' | 'lang' | 'article' | 'more' | 'fact' }>;
  /** Top of the chip row relative to the card, and the pill height. */
  headerTop: number;
  badgeHeight: number;
  /** True when the chips and the name share one row. */
  headerInline: boolean;
  /** Where the name starts, and its baseline when it sits on its own row
   *  (an inline name is centred on the chips by the renderer). */
  nameX: number;
  nameBaseline: number;
  /** Baseline of the first body line, and the step between lines. */
  bodyBaseline: number;
  lineStep: number;
  /** Body text already wrapped and elided to the lines that will be drawn. */
  lines: string[];
  /** The name, elided with an ellipsis if it would not fit. */
  displayName: string;
  /** True when `lines` dropped part of the body, so an expanded view has
   *  something the card does not already show. */
  truncated: boolean;
  /** The close "×" at the header row's right end, and the larger corner
   *  region that takes a tap on it. Cards stay up until closed or replaced
   *  (user request 2026-10-03), so every card needs a way to put it away. */
  close: Rect;
  closeHit: Rect;
}

const CARD_WIDTH = 480;
const IMAGE_WIDTH = 90;
const IMAGE_HEIGHT = 110;
/** Even inset on every side of a bare card. */
const PAD_X = 16;
const PAD_RIGHT = 16;
const PAD_TOP = 14;
const PAD_BOTTOM = 14;
/** The image sits at this inset; text starts a gutter past it. */
const IMAGE_INSET = 12;
const IMAGE_GUTTER = 14;
/** A comfortable line length for the body. The card used to stretch to 480
 *  px whatever it held, so a two-line street origin sat in a wide plate with a
 *  band of empty paper below and to the right (user report 2026-10-02). */
const BODY_MEASURE = 400;
/** Smallest a bare card shrinks to, so a one-word card still reads as a card. */
const MIN_CARD_WIDTH = 220;
// Measured in the faces `renderer.drawLandmarkCard` actually draws with; these
// were bare `monospace`, so wrapping and badge widths were computed for Courier
// while the card drew system-ui and Barlow.
const BADGE_FONT = `700 11px ${hudSurface.fontMono}`;
const NAME_FONT = `800 16px ${hudSurface.fontPlaque}`;
const BODY_FONT = `500 11px ${hudSurface.fontUi}`;
const BADGE_HEIGHT = 16;
const LINE_STEP = 15;
/** Ascent of the 11 px body face above its baseline, and descent below it. */
const BODY_ASCENT = 9;
const BODY_DESCENT = 3;
/** Cap height of the 16 px plaque face. */
const NAME_CAP = 12;
/** Body lines on a bare encyclopedia/street card — enough for a full short
 *  lede sentence without turning into an article. */
const BARE_BODY_LINES = 3;
const PHOTO_BODY_LINES = 4;
const BADGE_GAP = 6;
/** Air between the chips and an inline name, and before the "more" link. */
const NAME_GAP = 10;
const MORE_GAP = 16;
/** "More" is the action that opens the panel, so it reads as a link with an
 *  arrow rather than as one more chip beside the category. */
const MORE_LABEL = 'MORE ›';
/** The close glyph's box, and the header room it reserves beside "more". */
const CLOSE_SIZE = 14;
const CLOSE_ROOM = CLOSE_SIZE + 10;
/** Side of the square corner region a tap on the close takes: a finger is
 *  wider than the glyph. */
const CLOSE_HIT = 40;

/**
 * Badges that fit on one row of the text column. On a 320 px phone
 * "CHURCH · W WIKIPEDIA · + MORE" ran off the card's edge. The Wikipedia
 * chip shortens to its "W" mark first, and then chips go by priority. The
 * chips that stay longest are "more", the only sign the card opens, and
 * the language chip, which says the text is not English.
 */
export function fitBadges(
  badges: LandmarkCardLayout['badges'],
  maxWidth: number,
  measure: TextMeasurer,
): LandmarkCardLayout['badges'] {
  let row = badges.map(badge => ({ ...badge }));
  if (badgeRowWidth(row) <= maxWidth) return row;
  const article = row.find(badge => badge.kind === 'article');
  if (article) { article.label = 'W'; article.width = measure('W', BADGE_FONT) + 10; }
  const dropOrder: Array<LandmarkCardLayout['badges'][number]['kind']> = ['article', 'fact', 'category', 'lang', 'more'];
  for (const kind of dropOrder) {
    if (badgeRowWidth(row) <= maxWidth) break;
    row = row.filter(badge => badge.kind !== kind);
  }
  return row;
}

/** Width of a header row: chips at a fixed gap, "more" a wider gap after. */
function badgeRowWidth(row: LandmarkCardLayout['badges']): number {
  const chips = row.filter(badge => badge.kind !== 'more');
  const more = row.find(badge => badge.kind === 'more');
  const chipsWidth = chips.reduce((total, badge) => total + badge.width, 0)
    + Math.max(0, chips.length - 1) * BADGE_GAP;
  return chipsWidth + (more ? (chips.length ? MORE_GAP : 0) + more.width : 0);
}

/**
 * The card's own size and content, given only what fits. The card is as wide
 * as what it holds (up to `cardWidth`) and as tall as its text: the category
 * chip and the name share a row when they fit, "more" is a link at that row's
 * right end, and the plate keeps the same padding on every side.
 */
export function measureLandmarkCard(
  props: LandmarkCardProps,
  measure: TextMeasurer,
  /** The widest the card may be. A phone gives it the screen width less
   *  margins; setting the width after measuring only clipped the text. */
  cardWidth: number = CARD_WIDTH,
): LandmarkCardLayout {
  const hasImage = !!props.hasImage;
  const imageWidth = hasImage ? IMAGE_WIDTH : 0;
  const textLeft = hasImage ? IMAGE_INSET + imageWidth + IMAGE_GUTTER : PAD_X;
  const columnWidth = Math.max(60, cardWidth - textLeft - PAD_RIGHT);
  const bodyWidth = Math.min(columnWidth, BODY_MEASURE);
  const body = props.body || '';
  const maxLines = hasImage ? PHOTO_BODY_LINES : (body ? BARE_BODY_LINES : 0);
  const wrapped = wrapToLines(body, bodyWidth, maxLines, measure, BODY_FONT);
  // The card shows a prefix of the body; whether anything was left behind is
  // what decides if there is a bigger version worth opening.
  const shownWords = wrapped.reduce((total, line) => total + line.split(' ').length, 0);
  const truncated = body ? shownWords < body.split(' ').length : false;
  const lines = truncated ? endCutLines(wrapped, bodyWidth, measure, BODY_FONT) : wrapped;

  let badges: LandmarkCardLayout['badges'] = [];
  const pushBadge = (label: string, kind: LandmarkCardLayout['badges'][number]['kind']) => {
    badges.push({ label, x: 0, width: measure(label, BADGE_FONT) + (kind === 'more' ? 0 : 10), kind });
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
  if (props.hasArticle) pushBadge(props.articleLabel || 'W  WIKIPEDIA', 'article');
  // Nothing else on a canvas card says it can be clicked, so the cut body has
  // to advertise the panel that holds the rest of it.
  if (truncated) pushBadge(MORE_LABEL, 'more');
  // The header row shares its right end with the close "×".
  const headerColumn = columnWidth - CLOSE_ROOM;
  badges = fitBadges(badges, headerColumn, measure);

  const chips = badges.filter(badge => badge.kind !== 'more');
  const more = badges.find(badge => badge.kind === 'more') || null;
  const chipsWidth = chips.reduce((total, badge) => total + badge.width, 0)
    + Math.max(0, chips.length - 1) * BADGE_GAP;
  const moreWidth = more ? MORE_GAP + more.width : 0;
  const name = (props.name || '').toUpperCase();
  const nameWidth = measure(name, NAME_FONT);
  const inlineNameX = chips.length ? chipsWidth + NAME_GAP : 0;
  // A card with no chips always keeps the name on the top row, beside "more".
  const headerInline = !chips.length || inlineNameX + nameWidth + moreWidth <= headerColumn;

  let displayName = props.name || '';
  const nameRoom = headerInline ? headerColumn - inlineNameX - moreWidth : headerColumn;
  if (measure(displayName.toUpperCase(), NAME_FONT) > nameRoom) {
    while (displayName.length > 10 && measure(`${displayName}…`.toUpperCase(), NAME_FONT) > nameRoom) {
      displayName = displayName.slice(0, -1);
    }
    displayName += '…';
  }
  const shownNameWidth = measure(displayName.toUpperCase(), NAME_FONT);

  // Width: the widest of the header and the body, inside the column.
  const headerWidth = CLOSE_ROOM + (headerInline
    ? inlineNameX + shownNameWidth + moreWidth
    : Math.max(badgeRowWidth(badges), shownNameWidth));
  const bodyLinesWidth = lines.reduce((widest, line) => Math.max(widest, measure(line, BODY_FONT)), 0);
  const contentWidth = Math.min(columnWidth, Math.ceil(Math.max(headerWidth, bodyLinesWidth)));
  const width = Math.min(cardWidth, Math.max(hasImage ? textLeft + 160 : MIN_CARD_WIDTH, textLeft + contentWidth + PAD_RIGHT));

  let cursor = textLeft;
  for (const badge of badges) {
    if (badge.kind === 'more') badge.x = width - PAD_RIGHT - CLOSE_ROOM - badge.width;
    else { badge.x = cursor; cursor += badge.width + BADGE_GAP; }
  }

  // Vertical rhythm. With chips the header is the pill's height; a name on
  // its own row sits a gap below; the body starts a gap below the header.
  const headerTop = hasImage ? IMAGE_INSET + 2 : PAD_TOP;
  const rowCentre = headerTop + BADGE_HEIGHT / 2;
  let nameBaseline: number;
  let headerBottom: number;
  if (headerInline) {
    nameBaseline = Math.round(rowCentre + NAME_CAP / 2);
    headerBottom = headerTop + Math.max(BADGE_HEIGHT, NAME_CAP + 2);
  } else {
    nameBaseline = headerTop + BADGE_HEIGHT + 6 + NAME_CAP;
    headerBottom = nameBaseline;
  }
  const bodyBaseline = headerBottom + 10 + BODY_ASCENT;
  const textBottom = lines.length
    ? bodyBaseline + (lines.length - 1) * LINE_STEP + BODY_DESCENT
    : headerBottom;
  const height = Math.max(
    hasImage ? IMAGE_INSET * 2 + IMAGE_HEIGHT : 0,
    Math.round(textBottom + PAD_BOTTOM),
  );

  return {
    width,
    height,
    imageWidth,
    imageHeight: IMAGE_HEIGHT,
    textLeft,
    badges,
    headerTop,
    badgeHeight: BADGE_HEIGHT,
    headerInline: headerInline && chips.length > 0,
    nameX: textLeft + (headerInline ? inlineNameX : 0),
    nameBaseline,
    bodyBaseline,
    lineStep: LINE_STEP,
    displayName,
    lines,
    truncated,
    close: { x: width - PAD_RIGHT - CLOSE_SIZE + 3, y: Math.round(rowCentre - CLOSE_SIZE / 2), width: CLOSE_SIZE, height: CLOSE_SIZE },
    closeHit: { x: width - CLOSE_HIT, y: 0, width: CLOSE_HIT, height: CLOSE_HIT },
  };
}

/**
 * A cut body ends cleanly: on the last whole sentence the lines hold, when
 * that keeps at least half of them, otherwise on a word with "…". A card
 * ending "…officially called the Kerkstraatbrug," read as a rendering fault
 * (the same complaint as the finish card, user report 2026-09-29).
 */
export function endCutLines(lines: readonly string[], maxWidth: number, measure: TextMeasurer, font: string): string[] {
  if (!lines.length) return [];
  const shown = lines.join(' ');
  let stop = -1;
  for (const match of shown.matchAll(/[.!?]["')\]]?(?=\s|$)/g)) stop = match.index! + match[0].length;
  if (stop >= shown.length / 2) return wrapToLines(shown.slice(0, stop), maxWidth, lines.length, measure, font);
  const out = lines.slice();
  let last = out[out.length - 1].replace(/[\s,;:–—-]+$/, '');
  while (last.includes(' ') && measure(`${last}…`, font) > maxWidth) {
    last = last.slice(0, last.lastIndexOf(' ')).replace(/[\s,;:–—-]+$/, '');
  }
  out[out.length - 1] = `${last}…`;
  return out;
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
export function placeOnlyDetail(
  type: string | undefined,
  neighborhood: string | undefined,
  cityName = 'Amsterdam',
): string {
  const kind = String(type || 'landmark').replace('_', ' ');
  const article = /^[aeiou]/i.test(kind) ? 'An' : 'A';
  const where = neighborhood ? ` in ${neighborhood}` : ` in ${cityName}`;
  return `${article} ${kind}${where}. No encyclopedia article yet.`;
}

// --- Neighborhood postcard --------------------------------------------------

export interface PostcardProps {
  name: string;
  kind?: string;
  imageArea?: string;
  hasImage?: boolean;
  /** City name for the caption; defaults keep Amsterdam cards unchanged. */
  cityName?: string;
  provinceCaption?: string;
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
    caption: props.imageArea
      ? `Photo: ${props.imageArea} · ${props.cityName || 'Amsterdam'}`
      : `${props.cityName || 'Amsterdam'}${props.provinceCaption ? ` · ${props.provinceCaption}` : ''}`,
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
