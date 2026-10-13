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

## How a question behaves while riding: `ridingPrompt.ts`

Only multiple-choice route questions ride (`promptModeFor`). Typed answers need
the keyboard, and bridge-arrival, water-crossing and transit questions are
about the place being passed right now, so they keep the freeze
(`questionFreezesRide`). `game.ridingPrompts = false` restores blocking for
everything.

Options sit in the bottom band; keys 1 to 4 or a tap answer while moving. A
question ends one of three ways:

- answered: graded right, wrong or no idea as usual;
- expired: `RIDING_PROMPT_TIMEOUT_SECONDS = 12` with no answer. Graded
  `passed`; the card hides, the name stays hidden because the rider is still on
  the street;
- left: the vehicle was on another road for an unbroken
  `RIDING_LEAVE_STREET_SECONDS = 1.2` (long enough to ignore a junction
  crossing or a bridge-end wobble). Graded `passed` and the name is shown in
  a one-line reveal. Leaving wins over timing out.

`passed` is a grade of its own: no attempt, no points, the streak is kept and
the name is revealed, and it counts as exposure for spaced repetition, never as
a miss. Penalising a rider for riding well would teach them to stop.

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

- `game.js` `_quizFreezesRide()` is the frame-loop hook; the page's
  `hookInstalled` flag tells the typed module whether the page honours riding
  mode.
- The riding band is covered by `ridingPromptBand.ts` in the bottom-HUD check
  and six Storybook states (desktop, portrait, stacked notices, small phone,
  landscape, with postcard). `tests/e2e/riding-pacing.spec.ts` rides the seeded
  route and asserts the budget and zero frozen seconds.
- Spaced repetition itself and the review-ride planner live outside
  `game/`; see TODO for the open `review-ride` regression
  (`tests/e2e/review-ride.spec.ts`, due street off every landmark line).

## Open questions

- Cross-device memory: a fresh device cannot yet carry the spaced-repetition
  state with it (TODO).
- The budget is a flat per-minute rate. A rider who answers everything right
  could be asked less, and a struggling rider more; not tried yet.
- Typed mode and bridge-arrival questions still freeze. Whether bridge
  questions can ride once the bridge has been crossed is untested.
