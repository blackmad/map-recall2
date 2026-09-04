# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: a new Amsterdam resident who needs a working mental map of the city — street and canal names, landmarks, and neighborhoods — so everyday navigation stops feeling like a blank slate.

Other audiences (tourists, language learners, multi-city Randstad users) exist in the codebase but are not the first design priority until confirmed.

## Product Purpose

Map Recall helps people learn real places by testing geographic memory against authentic city data. Success means the player can name and situate streets, canals, bridges, and landmarks they will actually encounter — and retain that knowledge over time through spaced review — without the product teaching something false.

## Positioning

Learning happens in place: the player travels a real corridor (boat on waterways; cycling presentation on Amsterdam streets) or quizzes against a real map, and must recall the feature before the product reveals it. Neighboring map games can copy tiles or trivia cards; they cannot truthfully claim this combination of navigation-through-real-topology, answer-before-reveal discipline, and spaced mastery of named infrastructure.

## Operating Context

- Browser on desktop and phone; Canal Recall fills the viewport and is played with keyboard or on-screen controls.
- Two surfaces today: **Map Quest** (React map quiz) and **Canal Recall** (navigate-and-recall prototype, currently Amsterdam-forward).
- Knowledge is backed by versioned city extracts (OSM and related open/government sources), encyclopedia-grounded trivia, and optional signed-in progress when cloud auth is configured.
- Development handoff lives in `public/canal-drive/TODO.md` and `HISTORY.md`; geographic failures become named regression pins.

## Capabilities and Constraints

Confirmed:

- Quiz and navigate-and-recall modes over real city geography.
- Spaced-repetition memory for learned street/canal names; shared store direction between surfaces.
- Amsterdam is the primary city; Randstad coverage (e.g. Rotterdam, Den Haag, Utrecht) is in progress via extracts and trivia.
- English encyclopedia text in the English game; preserve foreign source text and provenance for resumable translation.
- Geographic correctness outranks arcade spectacle; the feature under question must never be revealed by HUD or map before the answer.
- Driving corridor stays visible; trivia/neighborhood cards stay compact and bottom-weighted.
- OSM topology and display geometry are imperfect; junctions, bridges, boundaries, and split same-name ways need measured tolerances and regression coverage.
- Prefer cached/versioned extracts over live third-party APIs at runtime when suitable.
- Building-appearance enrichment and photoreal paths are constrained by licensing and measured evidence gates (open municipal sources preferred; do not ship unlicensed third-party imagery).

Undecided:

- Final public brand alignment of the **Map Quest** quiz chrome to the **Map Recall** family name.
- Formal accessibility standard (WCAG level) beyond readable chrome and phone usability.
- Which non-Amsterdam city becomes the next primary market after Amsterdam residents.

## Brand Commitments

- Durable product identity: **Map Recall**.
- **Canal Recall** is the navigate-and-recall mode (user-facing Amsterdam title today: *Amsterdam Canal Recall*).
- **Map Quest** is the current quiz-surface label in the React app; treat it as a mode name subordinate to Map Recall, not a second product brand. Prefer not expanding “Map Quest” as the umbrella (collision risk with MapQuest the mapping company).
- Repo and internal docs still say “Map Recall” / `map-recall2`; keep that as the family name unless the owner renames deliberately.
- Voice: clear, factual, learning-first — not arcade hype that would spoil geographic answers.

## Evidence on Hand

- Playable Canal Recall at `public/canal-drive/` with Storybook HUD states.
- Map Quest React app at repo root (`index.html` / `src/`).
- Versioned extracts under `public/data/extracts/` (Amsterdam and other cities).
- Published Randstad trivia pipeline and Trivia Lab human-review flow (thousands of grounded facts; stratified human audit still open).
- Measured building/façade/roof research docs and demos in `public/canal-drive/` (not all production-published).
- Credits/provenance: OpenStreetMap, CARTO, Smokey’s Bandit lineage (GPL-3.0) for the drive runtime ancestor.
- Do not fabricate testimonials, retention metrics, or city-coverage claims beyond what extracts and review gates actually support.

## Product Principles

1. Teach true geography first; a beautiful lie is a product bug.
2. Never spoil the street, canal, or landmark name before the player answers.
3. Prefer explainable learning mechanics (spaced review, novelty-aware routing with detour caps) over spectacle.
4. Keep navigation readable; learning UI supports the corridor, it does not replace it.
5. Ground claims in versioned data, provenance, and regression pins — especially where OSM or enrichment is imperfect.
