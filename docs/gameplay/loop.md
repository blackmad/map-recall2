# Gameplay loop: how a ride teaches

Living document. Source of truth is the typed code under
`src/canalRecall/game/`; this file explains why the numbers are what they
are. Update it in the same change that moves a number. History of how the
loop got here: the 2026-10-13 entry in `public/canal-drive/HISTORY.md`
("Route questions no longer freeze the rider"). Sibling:
`docs/gameplay/bike-ferry-crossings.md`.

## The loop in one paragraph

Pick a route (home to a landmark, a surprise ride, a review ride, or a transit
line). Ride it. The map teaches by showing places, not by quizzing: street
cards, drive-by landmark cards, neighbourhood postcards. Now and then the ride
asks one multiple-choice question about the street the rider is on, in a band
at the bottom, while the bike keeps moving. Every answer feeds spaced
repetition, which decides what comes back on a later ride. The finish card
reports recall, points and what the rider now knows.

## Principles that constrain every number below

1. Geographic learning outranks arcade spectacle. The street or canal under
   question is never named by the HUD or the map before the answer. A name may
   be revealed only after the rider has left that street.
2. The ride is the lesson, the question is the check. A question must not stop
   the vehicle. Measured on the seeded Anne Frank to Rijksmuseum ride, the old
   freezing design cost 10 prompts, 4.8 per minute and 30 s frozen; the budget
   design costs 3 prompts, 1.9 per minute and 0 s frozen.
3. One thing talks to the rider at a time (the one-card rule), and everything
   that talks is paced from one clock, `raceTime`, which restarts at 0 each
   ride. A timestamp later than now belongs to an earlier ride and never
   blocks anything.
4. Cards and bands stay near the bottom and compact; the driving corridor
   stays visible.

## Which names earn a question: `questionBudget.ts`

Pure. It sees the ride clock and one candidate name event and answers
`ask`, `reveal-after-pass` or `skip`.

| Candidate kind | Meaning |
| --- | --- |
| `due-review` | the spaced-repetition schedule says it is due |
| `new-unlearned` | never answered correctly here; `teachingStreet` marks streets the route is meant to teach |
| `known` | known and not due: always `skip` |

- Budget: `DEFAULT_MAX_ASKS_PER_MINUTE = 2` over a rolling
  `BUDGET_WINDOW_SECONDS = 60`. `0` turns route questions off (unlearned names
  are still revealed after passing); `Infinity` restores ask-everything.
- Spacing: `minGapSeconds` is half the even spacing, 15 s at the default, so
  two asks can cluster a little but never land back to back.
- Priority is due-review, then new teaching-street name, then everything
  else. It is enforced by reserving the last slot of the minute for the first
  two classes, not by sorting, so a stray side street cannot spend the slot a
  due review needed. A declined unlearned name becomes `reveal-after-pass`; a
  declined review simply stays due and is asked on a later street.
- `recordAsk` records an ask the game actually opened.

## How a question behaves: it blocks, and the budget keeps the ride flowing

Every question stops the vehicle until it is answered (user decision
2026-10-13: the non-blocking "riding" question, options in the bottom band
while moving, was tried and retired; a question you can ride away from
teaches less than one you have to answer). What keeps the centre from
stopping the bike every block is the budget above, not a moving card.

A name the budget declines is a **silent pass** (`silentPass.ts`): the HUD
withholds it while the rider is on the street (`? ? ?` on the plaque, no
label on the map), and once the vehicle has been on another road for an
unbroken `LEAVE_STREET_SECONDS = 1.2` (long enough to ignore a junction
crossing or a bridge-end wobble) the name is said in one line, "That was
Singel", and graded `passed`.

`passed` is a grade of its own: no attempt, no points, the streak is kept and
the name is revealed, and it counts as exposure for spaced repetition, never as
a miss.

**Bridge names** are not asked below hard difficulty unless the bridge is
famous (`notableBridges.ts`: the Magere Brug, Blauwbrug, Torensluis, Hoge
Sluis, Berlagebrug, Nesciobrug and a handful more). Amsterdam has a named
bridge every hundred metres and most names are a number or a councillor;
on easy and medium they were noise beside the street names. This applies
both to the route question on a named bridge way ("Which bridge are you
on?", the name simply shows as the road instead) and to the crossing
question (`crossingQuestionKind`, the water under it is still taught). Hard
and expert ask every bridge; `custom` follows the answer mode.

## Everything else that talks: `teachingPacer.ts`

One home for the cooldowns that used to live in five modules. `driveByTrigger`,
`postcardPacing` and `transit/browser` re-export them.

| Thing | Rule | Value |
| --- | --- | --- |
| Drive-by landmark card | minimum gap | 15 s |
| Street or drive-by card | holds the slot before a landmark may preempt it | 6 s (20 s when the rider clicked it open) |
| Neighbourhood postcard | always for the first visits to a neighbourhood | 3 entries |
| | familiar entry needs this long without a trivia card | 45 s |
| | and this long since the last postcard | 120 s |
| | lull postcard after riding with no trivia | 90 s, then 180 s apart |
| Bridge question | cooldown | 90 s |
| Transit stop / line / street / transfer questions | cooldowns | 18 / 45 / 22 / 40 s |
| Street question after a stop question | at least half the stop cooldown | 9 s |
| Plaque feedback line | times out | 6 s |
| Self-opened street or drive-by card | folds to a title line | after 8 s |

A card the rider clicked open, and the finish-screen arrival card, never fold.
Why each number exists: Amsterdam has a bridge every 100 m, so bridge questions
stay an occasional highlight; in the canal belt a landmark stands every few
houses, so drive-by cards need a gap; the plaque feedback line once never timed
out and, through the one-card rule, blocked every card until the next question.

## Where the code connects

- `game.js` `_quizFreezesRide()` is the frame-loop hook: true for every open
  question, false for a silent pass (a withheld name with no card).
- `tests/e2e/question-budget.spec.ts` rides the seeded route twice
  (ask-everything, then the budget) and asserts at most two asks a rolling
  minute, a zeroed speed at every question, no early reveal, and at least
  one silent-pass reveal.
- Spaced repetition itself and the review-ride planner live outside
  `game/`. `tests/e2e/review-ride.spec.ts` (seeded origin, mulberry32) pins
  that a due street off every landmark line is ridden as a via: the planner
  offers the chosen pair again with each grazed due name as a via
  (`REVIEW_MISSED_VIA_TRIES = 2`), and `roadGraph.ts` counts consecutive
  equal positions once so a bridge ramp meeting its deck is not a turn-back.
- **Exposure** (`recallExposure.ts`): a `passed` name is parked by
  `RecallStore.expose()` for 30 minutes, doubling per repeat up to a day. No
  review event, no change to repetitions, lapses or ease; known names keep
  their schedule. A parked name counts as "answered near here recently", so
  the same ride does not ask it straight away; after the interval it is an
  ordinary unlearned name. `buildKnowledgeReview` skips exposure-only states.
- **Setting**: "Questions a minute" (1 / 2 / 3 / Off, default 2) in the ride
  options and the live settings panel, persisted as `maxAsksPerMinute`;
  `_askBudgetPerMinute()` reads it, an explicit `game.maxAsksPerMinute` still
  wins as a test hook.
- On a ferry `_updateQuizOnFerry` keeps the feedback timeout and a silent
  pass ticking, so a name withheld at boarding is said once the ferry has
  left its street instead of hanging until the crossing ends.

## Open questions

- Cross-device memory: a fresh device cannot yet carry the spaced-repetition
  state with it (TODO).
- The budget is a flat per-minute rate. A rider who answers everything right
  could be asked less, and a struggling rider more; not tried yet.
- Typed mode and bridge-arrival questions still freeze. Whether bridge
  questions can ride once the bridge has been crossed is untested.
