Keep the stylized 3D presentation, but make the major architectural decisions follow the dated photographs. The priorities are entrances, opening silhouettes and layout, ground-floor assemblies, material contrast, awnings and tenant identity. More detail on a uniform window grid will not fix the underlying problem.

The earlier implementation supplies parts of this pipeline, including a residential entrance prior, height conversions and richer rendering. Those engineering changes have not established photographic fidelity. Use the regression sets below to finish and validate the work before expanding extraction along the route.

1. Freeze evidence and establish reference annotations.

   Preserve the existing release, original crops and captures. Bind each of the twelve user examples to its screenshot hash, observation, building, dated crop and wall interval. Keep repeated examples of the same building as separate assertions. The issue-to-image mapping in `development-examples.json` is provisional until checked against the original image; the captions are not a source for exact architectural measurements.

   Inspect and annotate sources independently of extractor predictions: door versus window, pixel bounds, curved opening versus curved lintel, visible divisions, material-region boundaries, sign identity and dated awning state. Hidden details stay unknown. Agent inspection stays labelled agent-inspected; it does not become human review.

2. Repair entrances and ground contact first.

   Stop dropping entrances when residential observations replace contextual windows. Extract single and paired doors, transoms, thresholds and neighbouring large windows as separate assemblies. Use a labelled entrance prior only on established public residential frontages where placement is unknown; never count it as a detected door.

   Trace source wall/base, pavement and game coordinates through the shared NAP conversion. Check source building contact independently of the threshold. Correct an artificial gap with a documented plinth/base patch only where evidence supports it. Preserve raised entrances, basement levels and roof geometry. Validate both viewers at the same frontage.

3. Replace repetitive grids with registered opening layouts.

   Extend the existing extraction, fitting and compilation path. Infer source-image opening bounds, classification, rows/bays, width/height, head shape, transoms and major mullions. Project through the registered wall frame, retain uncertainty and abstain when placement is ambiguous. Resolve upper and ground imagery independently, especially when capture dates differ.

   Render asymmetric spacing, paired openings and distinct ground-floor proportions. Use cheap segmental/rounded silhouettes, curved frames, shallow reveals and sills. A curved masonry lintel must not automatically turn rectangular glazing into an arched window.

4. Restore shop assemblies, material contrast and awnings.

   Model entrance doors, display windows and fascia separately. Preserve dark restaurant fronts, white surrounds, contrasting ground floors and white masonry bands/accents as independent regions. Use shared metric brick shading with restrained mortar and variation, fading to flat colour at distance.

   Treat awning installation and deployment separately. Extended fabric becomes a canopy; retracted fabric becomes a housing/roll. Absent or unknown deployment cannot become an extended canopy. Never borrow deployment from another capture date.

   Recover Fuoco Vivo and Engels Verf through the dated sources recorded in `named-compatibility.json`. Restore their observed assemblies after verifying current frontage registration. Do not reinstate illustrative shelves, decorative shapes or repeated signs merely because a previous demo included them. Panorama seams and adjoining wall subdivisions must not duplicate a physical sign. Separate evidenced physical signs may repeat the same tenant name.

5. Use three architectural regression sets and retain engineering checks.

   `regression-sets.json` indexes all sets:

   | Set | Membership | Purpose |
   | --- | --- | --- |
   | User development | Twelve image-numbered definitions | Repair every reported failure; exact reference annotations pending |
   | Named compatibility | Fuoco Vivo and Engels Verf | Preserve distinctive, dated shop architecture |
   | Held-out evaluation | Thirty frozen candidate frontages, fifteen per district | Measure generalization without tuning on these cases |
   | Game traversal | Fourteen cameras in desktop and phone layouts | Clearance, occlusion, streaming, disposal and resource limits |
   | Synthetic engineering | Legacy/observed opening and material fixtures | Detect renderer bugs; never substitute for photo evaluation |

   Certify that held-out buildings exclude all supplied examples and earlier development fixtures once the image identities are known. Stratify each district across residential entrances, curved openings, shops, extended/retracted awnings, contrasting finishes and obscured evidence. The proposed per-district quotas total fifteen and are stored in the set index. Inspect sources to assign these strata; routing output is not ground truth. If a category is unavailable, report it explicitly.

6. Make acceptance depend on architecture, not processing coverage.

   - Development: every clearly visible door/window has the correct type, head shape, count and proportions. Hidden details remain unknown.
   - Held-out: at least 90% precision and recall for visible openings, matched at IoU ≥ 0.7 in the registered wall plane. Report doors and windows separately as well as overall, and show registration failures and abstentions separately.
   - Awnings: every development example matches its ground crop's dated state. No absent/unknown example acquires extended fabric.
   - Materials/shops: match inspected major finish categories and region boundaries; no cross-tenant spillover or unsupported repeated signs.
   - Contact: no unexplained building/pavement gap over 5 cm at designated checks. Raised-threshold exceptions require source evidence.
   - Visual review: capture tight ground-floor, full-façade and oblique game views. Highlight the exact frontage, hide unrelated labels, keep the inspector outside the capture, and inspect before/after alongside the original crop. Screenshot similarity alone cannot pass fidelity.
   - Runtime: preserve entrances, major colours and opening silhouettes before trim at lower detail. Keep the viewport-wide 11 MB limit, including allocated textures. Require camera clearance, deterministic compilation, disposal/rehydration and no duplicate paid requests on resume.

7. Roll out only after the compact cases pass.

   Use the existing authorization of up to $3 additional inference within the cumulative $5 ceiling: $1 development/repairs, $0.50 held-out evaluation and $1.50 route expansion. Reuse cached crops and results, reserve charges before requests, and stop on unresolved charges or either ceiling. Do not spend the route allocation on expansion while photographic gates fail.

   Start with the twelve examples and named shops; repair and re-evaluate them, then evaluate the held-out set. If the held-out set fails and is subsequently used for tuning, identify it as development data and establish a fresh untouched evaluation set before claiming generalization. Expand in resumable route batches only after acceptance, prioritizing visible frontage length and the feature classes above.

   Publish an immutable release with source-bound comparisons, measured per-feature fidelity, processing/rendering coverage, omissions, inspection notes and the reconciled cost ledger. Report coverage and fidelity separately. Photographic façade textures, sculpted ornament and full-city rich extraction remain outside this pass.
