# Firebase feedback polling handoff

Requested by the user on 2026-10-07. Check at session start, between landmark batches, before release, and roughly every 30 minutes during active work. This does not create an unattended background schedule.

Use `.agents/skills/canal-feedback/SKILL.md` and run:

```sh
npm run feedback:queue -- pull
npm run feedback:queue -- pull --status in-progress
```

Read full notes, screenshots, anchors, model fingerprints and hosted build context before claiming. If a pull reaches its limit, increase the limit; do not call the queue empty. Preserve private evidence under `.cache/canal-feedback/`. Claim and transition with the latest Firestore update-time precondition. Resolve only after the actual hosted behavior is verified; a locally repaired model awaiting publication remains unresolved.

## Last successful check

2026-10-07: two open reports, zero in-progress reports; neither pull reached its limit. Both full records and screenshots were inspected. No statuses were changed.

- `1d79b5b9-8491-4c91-b99f-9f9820b69e5b`: Kriterion lower window glazing. Saved screenshot shows two lower bays with masonry visible behind their mullions. Reported asset `452d0da753f4c034`, hosted build `105600d`. Compare against current hosted/source asset and existing Kriterion repair evidence before claiming or resolving.
- `2640c293-6433-4f34-8f80-0020351bf270`: Boom Chicago roof and architectural character. Saved screenshot shows open roof ends and the older facade/sign treatment. Reported asset `926c88d13bb852a8`, hosted build `71daa5e`. Current unpublished repair `93f24ea15c5e59af` has independent source/gallery/native acceptance, but publication and hosted verification remain pending. Connect this feedback to the existing Boom task; do not duplicate the building or resolve before deployment.

Full notes, screenshots, private user identity and Firestore update times remain in the private local pull files. Recover/re-pull at the next checkpoint because another worker or the user may have changed the queue.

The landmark continuation is in `docs/landmark-finish-nine-handoff-20261006.md`. Keep periodic feedback checks alongside those existing tasks.


## Hosted checkpoint — 2026-10-07

This supersedes the earlier two-open-report state above. Root verified the hosted Boom repair `93f24ea15c5e59af` in public commit `1c492a108d31079b8360241f6954cbe252a6e08a` / Hosting run `37584807879`, then conditionally resolved `2640c293-6433-4f34-8f80-0020351bf270`. Confirmed Firestore update time: `2026-10-07T07:17:16.646835Z`. Hosted Boom default gallery was inspected and accepted; exact bytes and actual route/pin/physical-card/masks/neighbors pass. Source/failure evidence remains privately archived at `205d04f0`, with append-only hosted proofs pushed at `d47d3b8e118d7a7d53980d3b0c4c2ec09b3396a2` under `models/boom-chicago/validation/hosted-release-20261007`.

Kriterion `1d79b5b9-8491-4c91-b99f-9f9820b69e5b` is now claimed in-progress by root, Firestore update time `2026-10-07T07:22:57.384483Z`. Its currently hosted/source mesh `452d0da753f4c034` matches the faulty reported asset; lower window glazing still needs repair and verification. This metadata worker did not perform another cloud pull or status transition. Root's successful verified Boom resolution and subsequent Kriterion claim are the latest supplied checkpoints; re-pull both open and in-progress queues before the next active batch and continue roughly 30-minute active-work checks.
