# Map Recall — design

Product identity for Canal Recall and the Map Quest quiz surface. Audience:
new Amsterdam residents learning the city by navigating and recalling names.

## Thesis

Canal Recall (2026-09-26): **daylight paper, one copper accent, one enamel
plaque.** The earlier all-cobalt chrome over a mostly-water map read as heavy
blue-on-blue, so the owner retired it. Surfaces are warm paper with near-black
ink; copper marks action and selection and nothing else; cobalt enamel stays
only where it is literal — the title plaque, echoing Amsterdam's real street
signs — and the copper Start stamp keeps its rim and rivets.

Map Quest has not been migrated and still runs the cobalt world below.

## Daylight (Canal Recall)

| Token | Value | Role |
| --- | --- | --- |
| `--day-paper` | `#F4EFE5` | Ground: setup rail, knowledge screen, loading |
| `--day-paper-raised` | `#FBF8F2` | Cards, tiles, panels, quiz card |
| `--day-ink` | `#1F1C17` | Primary text (14.8:1 on paper) |
| `--day-ink-muted` | `#5F584D` | Secondary text (6.1:1) |
| `--day-line` / `-strong` | ink at 14% / 26% | Hairlines, tile borders |
| `--day-fill` / `-hover` | ink at 4.5% / 8.5% | Sunk fields, quiet buttons |
| `--day-accent` | `#B4682C` | Selected tile border, stick knob, progress, finish arrow |
| `--day-accent-ink` | `#8A4A18` | Copper text on paper (6.0:1) |
| `--day-accent-soft` | copper at 13% | Selected tile fill, focus halo |

Values live in `daylightTheme` (`src/canalRecall/hudTheme.ts`) and publish as
`--day-*`; Canal's `index.html` `:root` maps its semantic tokens (`--ink`,
`--line`, `--surface*`, `--accent*`) onto them, overriding the shared cobalt
tokens for Canal only. `hudSurface` (canvas HUD) uses the same values: paper
plates at 90% over the map so the corridor stays legible.

## Cobalt enamel (Map Quest; Canal title plaque)

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

- **Canal Recall route setup** — map-led asymmetric: left paper rail (phones:
  full-screen rail, no vista; a fade + More cue when it scrolls), right CC0
  Reguliersgracht vista on desktop (Storybook and live setup). Primary controls stay
  dense: City is a native enamel select; Travel / Route are one-word icon
  strips; View is an icon-only strip on the rail (name + hint via tooltip /
  aria). Harder difficulties and assists stay in More options.
- **Map Quest start** — same grammar: riveted Map Recall plaque rail over the
  CC0 vista; Canals & Streets elevated; other layers demoted; mode gloss on
  the rail. Phone keeps a bottom vista strip (rail is not a full cobalt wall).
  During an active round the header collapses to brand + modes + score
  (filters live in the overflow menu); phone play uses a shorter header,
  icon-only modes, and capped quiz cards so the map stays the hero.
- **In-drive HUD** — daylight paper plates (`hudSurface`,
  `rgba(251,248,242,.9)`), ink type, copper-ink accent (distance, streak,
  compass north), bright copper only for the finish arrow and the held
  thumbstick knob. Two pieces: the left plaque (street name
  headline → neighbourhood + speed/odometer → score → feedback; no kicker
  labels) and the destination card with the finish arrow inside it. No
  separate arrow box, no trip pill. Utility FABs use the same plate. Setup,
  recall prompt, help/settings panels, knowledge review and arrival card are
  paper too; only the title plaque is cobalt.
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
