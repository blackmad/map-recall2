# Gameplay and UI plan (2026-11-08): more fun, more attractive

User ask (2026-11-08): "do a gameplay and UI plan, see what could be more fun and more attractive in the UI." This is the plan; the engine round-5 lanes (`engine-round5-plan-20261108.md`) run alongside and are not repeated here.

## What the game is today (survey of origin/main, 2026-11-08)

- **Loop.** Setup form (travel boat/bike/transit; route surprise/home/here/free; difficulty) → overview flight → ride; a question stops the bike (user, 2026-10-13), budget 5 a minute, priority due-review > teaching street > other; multiple choice or typed; silent pass shows `? ? ?` then "That was Singel". Score = 100 × difficulty × streak (cap 1.9) × novelty 1.15 × separated-cycle-track 1.1; "No idea" is free. Arrival card: time, points, distance, tally, best streak, story lines, passport stamp, route ribbon, Next route / Share link (copies a URL) / Setup.
- **Learning.** SM-2-like spaced review, exposure parking, mastery bands, novelty routing with a 12 % detour cap (25 % with due names), home radius growing with known names. Knowledge screen lists names; the only map of what you know is the M-key city overview during a ride.
- **Free Ride.** No route, no questions, tap markers for cards, a "places opened" tally. Nothing to collect, nothing to finish.
- **Surfaces.** Street plaque, destination card, compass, radar, re-center, hints bar (desktop, 12 s), question card, one bottom card at a time (drive-by landmark/trivia, street origin, bridge, building, neighbourhood postcard), landmark panel, utility cluster (hidden until the mouse moves). Static landing page for everyone; 3-card onboarding once; What's New on its own page, never inside the ride.
- **Visual language.** Daylight paper `#f4efe5`, ink `#1f1c17`, one copper accent `#b4682c`, cobalt enamel plaques with rivets; Barlow Condensed + JetBrains Mono; one `paperCard()` style. Good bones, used sparingly.
- **Principles that stay** (CLAUDE.md + user): geographic learning outranks arcade spectacle; the corridor stays visible; cards compact at the bottom; never reveal the street under question; no NPC traffic, no audio; time of day is a welcome nicety. "The fun should come from flow, turns, geographic decisions, and chaining successful trips" (HISTORY design note). "Arcade reference: Crazy Taxi, not GTA."

## Where the fun leaks out (findings)

1. **Every ride is an island.** Arrival deals a fresh pair; nothing carries over but numbers. The parked Crazy Taxi "fares" idea (chained stops, a running fare) is the single biggest fun lever and it is already designed.
2. **No reason to come back today.** No daily ride, no "due" nudge on the landing page, no streak visible before you start. The place streak exists but is a one-line string on the arrival card.
3. **Landmarks are scenery, not play.** 460 modelled landmarks, drive-by cards are read-only, "named" stamps never fire because no landmark question exists.
4. **Progress is text.** Knowledge screen: lists and a "Map key" without a map. Passport: a string. A player cannot see the city filling in.
5. **Free Ride has no goal**, and it is the mode the user plays most and shows people.
6. **Being wrong is punished, being good is not rewarded.** A wrong answer resets the streak with no comeback; a perfect rider gets the same 5 questions a minute as a struggling one.
7. **Share is a URL.** No image, no route shape, nothing to post.
8. **Small UI debts that read as unfinished:** hints bar says "D labels" (D steers, T toggles labels, #24); Help lists N for Sound with nothing bound; no account control while riding; finish title truncates on 414×896; Feedback overlaps "Share this route"; phone zoom snaps when a question card closes; tours exist only as `?tour=` links; `docs/gameplay/loop.md` contradicts the code on blocking questions and the budget default.

## The plan: seven lanes, opus or haiku, each a thin slice that ships

Order is by fun-per-effort. Every lane: Storybook states desktop + phone for each new card/HUD combination, a Playwright spec for the new flow, the one-card rule, the corridor visible, no spoiler of the street under question. Copy in English, short, in the plaque voice (nouns, no exclamation marks). Flags `?x=0` where behaviour changes mid-ride; new UI off the critical path needs no flag.

### G1 — Chained stops: the fare (opus)
After arrival, "Next stop" keeps the meter running: a **run** is a chain of stops in one session; the arrival card shows the run so far (stops, names learned, run points) with a chain multiplier +5 % per stop (cap +25 %, calm mode shows no multiplier) and the next stop dealt 1–3 km away by the existing surprise picker with the novelty bias. Ending the run (Exit or 10 min idle) shows a **run card**: stops as a stamped list, total, best streak, names learned, one line of story. Persist the open run in localStorage so a reload continues it. Gate: a 3-stop run end to end on desktop and phone; the arrival card gains one line and one button, nothing else grows.

### G2 — Today's ride and the landing that knows you (opus)
A **daily seed**: one route per day (date-seeded from the surprise picker, same for everyone), shown as "Today's ride · Jordaan → Oosterpark · 4.1 km" with a calm leaderboard of your own past days (times and recall %; a shared board only when signed in, later). The **landing page** for a returning player stops being static: three cards, Today's ride / Continue (your due names: "7 names due · 12 min") / Free Ride, with your place streak and passport count in the header; first-time visitors keep today's landing. The due nudge uses the existing review route picker. Gate: landing renders from localStorage only (no network), both layouts; the daily route is identical across two browsers on the same date.

### G3 — Landmarks you can name (opus)
A **landmark question** when a modelled landmark with a card enters the view cone within 150 m and the budget allows: "Which building is this?" with four names from the same buurt (one correct), answered like a street question, scored like one, and it fires the "named" passport stamp that today never fires. Drive-by cards gain a one-tap "Noticed" that marks the landmark seen (counts toward the buurt's passport). Free Ride gets the same question as an opt-in toggle ("Quiz me on landmarks"). Gate: no landmark question while a street question is open (one-card rule); the landmark is never named on the HUD before the answer; stamps fire in a scripted ride past the Westerkerk.

### G4 — Free Ride with a purpose: the collection (opus)
Free Ride gets a **buurt checklist**: on entering a neighbourhood, the postcard shows "Marineterrein · 3 of 9 places" and the radar marks the unopened places; opening all of them stamps the buurt in the passport (the first way to earn a stamp without a quiz). A **discovery token** (small enamel coin, no sound) appears at a landmark you have not opened; tapping or riding through it opens the card. Markers fade with distance (user asked, 2026-10-30). Gate: the checklist never shows a street name under question (Free Ride has none, keep the guard anyway); phone layout; the token is ≤ 24 px at distance and never over the corridor.

### G5 — Seeing what you know (opus)
A **knowledge map** on the Knowledge screen and the run card: the city overview (`cityOverview.ts` already colours known/due/mastered roads) rendered as a static paper map with buurt mastery fill, a legend, and tap-to-filter. The **passport** becomes a stamp album: a grid of buurt stamps (the large-letter postcard compositor already exists; a stamp is its small square variant), greyed when unearned, with the date earned. The arrival/run card shows the stamp you just earned as a stamp, not a string. Gate: Storybook states for 0, 3, 24 stamps on both layouts; the map renders under 100 ms from localStorage.

### G6 — Share a ride as a picture (haiku, after G1)
A **share card** PNG from canvas: the route silhouette on paper (the parked "blank silhouette routes" idea), destination name, distance, time, ribbon, "rideamsterdam.nl". "Share this route" offers the image (Web Share API with files where available, else download) and keeps the link. Gate: the card is 1200×630, legible at 25 % scale, no street names of unanswered questions.

### G7 — UI debts and polish (haiku)
Fix the hints bar key (D → T for labels); remove N/Sound from Help or bind nothing and say so; an account chip in the settings panel while riding; finish title and Feedback overlap on 414×896; the phone zoom snap when a question card closes; tours back as a row of cover cards under "More options" (not in the default form, the user removed them from the main path); `docs/gameplay/loop.md` corrected to blocking questions and budget 5; What's New surfaced once per new build as a one-line toast on the landing page with a link. Gate: Storybook for each touched state, the clarity-review items re-scored.

## Later, not now (parked with reasons)
- **Time of day / golden hour** for Free Ride: welcome (user), but it sits on the engine's light rig while round 5 is changing shadows and roofs; schedule after round 5 settles.
- **Rival routes, transfer dares, Dutch plaque hard mode, currents/tailwinds, power-ups** (HISTORY design notes): arcade-first; revisit after G1–G5 show whether chaining and collection carry the fun.
- **Sound**: no (user, 2026-10-29).
- **Shared leaderboards**: only once signed-in play is common; G2 keeps the board personal.

## Measurement
The game has no play analytics beyond Sentry heartbeats. Each lane adds a local counter the arrival/run card can show and the dev can read (`__canalRecallSession`): rides per session, stops per run, questions answered/declined, landmarks named, places opened, stamps earned. The user's own week of play decides which lane earned its keep; nothing is sent anywhere.

## Integrator
One issue per lane (G1–G7) with this doc's section; spawn G1, G3, G4 first (independent code: arrival/run, questions, free ride), then G2, G5 (share the landing and knowledge screens), then G6, G7. Ports from 4690. Merge order G7 (small, unblocks the others' Storybook), G1, G3, G4, G2, G5, G6. Each lane's hand-back includes the Storybook state names and the spec.
