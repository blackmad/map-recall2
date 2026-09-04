# Map Recall — design

Product identity for Canal Recall and the Map Quest quiz surface. Audience:
new Amsterdam residents learning the city by navigating and recalling names.

## Thesis

The thing you learn is the chrome. Cobalt enamel street plaques are the brand
signal — not soft cream quiz cards, and not arcade rivet spam on every control.

## Own-world

| Token | Value | Role |
| --- | --- | --- |
| Enamel | `#0B3A8C` | Primary plaque fill |
| Enamel bright | `#1450B8` | Selected / raised plaque |
| Enamel deep | `#072861` | Shadowed plaque / shell |
| Night ground | `#071430` | App / map shell |
| Ink | `#FFFFFF` | Caps on enamel |
| Muted ink | `rgba(255,255,255,0.72)` | Secondary copy |
| Rivet | `#C4A35A` | Accents; tiny rivets on hero/Start only |
| Copper | `#B87333` | Start route / primary CTA stamp |
| Type | Barlow Condensed | Plaque titles and CTAs |
| UI type | system / JetBrains Mono | Body and readouts |

**Source of truth:** hex values live in `src/canalRecall/hudTheme.ts`
(`enamelTheme` + `hudSurface`). Run `npm run publish:enamel-css` to emit
`src/theme/enamel-tokens.css` and `public/canal-drive/css/enamel.css`. Shared
plaque/tile rules live in `src/theme/enamel-chrome.css`. Map Quest imports
those via `src/index.css`; Canal links `css/enamel.css`. Product-local chrome
(setup rail, quiz chips, dialogs) stays in each surface’s own sheet.

**Hierarchy:** title plaque + Start stamp carry framed enamel (white rim,
corner rivets). Choice options are quieter `enamel-tile` fills — same cobalt
family, no rivet costume. Setup vista uses the CC0 canal photo; the legacy
neon canvas attract screen stays hidden while setup is open.

Plaque chrome is HTML/CSS/SVG. No AI-generated shipping text or AI raster
plaque frames. Photographic backdrops are real CC0 (or the live map): see
`public/canal-drive/assets/media/ATTRIBUTION.md`.

## Surfaces

- **Canal Recall route setup** — map-led asymmetric: left enamel rail, right
  CC0 Reguliersgracht vista (Storybook and live setup).
- **Map Quest start** — same grammar: riveted Map Recall plaque rail over the
  CC0 vista; Canals & Streets elevated; other layers demoted; mode gloss on
  the rail. Phone keeps a bottom vista strip (rail is not a full cobalt wall).
  During an active round the header collapses to brand + modes + score
  (filters live in the overflow menu); phone play uses a shorter header,
  icon-only modes, and capped quiz cards so the map stays the hero.
- **In-drive HUD** — deep navy plates (`hudSurface`, `rgba(7,20,48,.84)`),
  not cobalt: the basemap is mostly water, and cobalt over blue canals is
  blue-on-blue. White type, one gold accent (distance, streak, compass north),
  copper only for the finish arrow. Two pieces: the left plaque (street name
  headline → neighbourhood + speed/odometer → score → feedback; no kicker
  labels) and the destination card with the finish arrow inside it. No
  separate arrow box, no trip pill. Utility FABs use the same plate. Cobalt
  stays on surfaces you stop at: setup, recall prompt, help/settings panels,
  arrival card.
- **Map Quest** — header, dialogs, and map reveal labels use shared enamel
  primitives plus Map Quest–only classes in `src/index.css`: `app-dialog`,
  `enamel-chip`, `enamel-segment`, `enamel-float`, `button-primary` /
  `button-secondary`. Do not add slate/stone/emerald/amber utilities on these
  surfaces; do not give a component class a `display` value (it would defeat
  Tailwind `hidden`). Canvas values come from `hudTheme.ts` (`enamelTheme`;
  `paperTheme` / `paperCssVariables` are historical aliases).

## Constraints that stay true

- Never reveal the street/canal under question in the HUD before the answer.
- Trivia and neighborhood cards stay compact and near the bottom.
- Geographic learning outranks arcade spectacle.
