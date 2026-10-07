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
