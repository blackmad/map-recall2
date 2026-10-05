# Building face overlap audit

`npm run audit:building-coplanar` scans the generated ordinary building meshes in every installed z14 extract tile. The JSON report records building IDs, horizontal/wall/sloped face classes, intersecting area and triangle-pair counts. Run `npm run test:coplanar-surfaces` for the reported Sloterdijk, Centraal and Kleur & Co neighborhoods plus synthetic ownership, roof-union and separate-batch regressions.

The renderer clips intersecting wall rectangles and equal-height flat roof triangles. Taller wall volumes own coincident outward faces; equal-height ties use the building ID. Opposing party walls are internal. UVs retain their original window grid when a rectangle is split. Nearby distinct walls, raised volumes, courtyard holes and non-overlapping wings remain separate. The spatial index limits candidate comparisons. Geometry cleanup runs in the existing building worker.

Detailed and coarse batches receive neighboring overlapping footprints as context. A neighbor arriving or leaving invalidates affected batches; picking rebuilds with the context that produced the installed mesh. Context buildings do not create extra drawn ranges.

## Review on 2026-10-05

The reported tile neighborhoods had 1 (Sloterdijk), 98 (Centraal) and 27 (Kleur & Co) conflicting owner/plane pairs in the previous mesh builder, and zero after cleanup. Both building identities survive the tower/podium repair. Native desktop and touch game camera pans show the join and retain neighboring window facades.

The 295-tile scan leaves one small candidate: `w1391423890`, tile `8408/5384`, approximately 0.011 m² between horizontal triangles of the same owner after Float32 upload coordinates. It remains recorded, rather than rounding it out of the report.

This is a geometry candidate audit, not a claim that every possible flicker has been eliminated. It currently excludes separate custom GLBs and kit meshes, inter-layer depth conflicts, cross-tile comparisons and near-coplanar faces missed by the quantized plane buckets. Sloped roof ownership is reported but not automatically repaired. Extend the audit to those surfaces when investigating a remaining screenshot.

Cleanup adds worker build cost. The first measured full source-tile builds were about 66 ms at Sloterdijk, 169 ms at Centraal and 163 ms near Kleur & Co, compared with about 20/49/48 ms before cleanup. These are worker generation timings, not frame times; unchanged frames do not recompute intersections. The implementation preserves existing roof vertices when cleanup is unnecessary and separates roof candidates by height and spatial cell. Further optimization should retain the same geometry and visual checks.
