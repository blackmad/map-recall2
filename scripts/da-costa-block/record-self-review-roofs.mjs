/** Frozen image-first roof observations. Reads no model answers or geometry classifications. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {readFrozenJson,REVIEW_INPUT_PINS} from './review-input-pins.mjs';
const base=path.resolve('.cache/da-costa-neighbourhood'),root=path.join(base,'self-review-2026-09-09');
const source=await readFrozenJson(path.join(root,'roof-sources.json'),REVIEW_INPUT_PINS.roofPackets);
// index, roofShape, decorative facadeTop, supporting observations, unresolved details
const frozenObservations=[
  [1,'flat-with-front-pitch','unknown',
    'The overhead pair shows a substantial flat central roof/deck with small rooftop structures, rather than one continuous ridge and two gable slopes. The street-side packet visibly has a sloping, vegetation-covered roof skirt above its lower horizontal eave. Together these support a flat core plus pitched perimeter/front section. The selected broad side is not the pointed front face reviewed in the earlier packet.',
    'Vegetation hides the precise side silhouette and surface covering. The footprint outline is not a surveyed roof-edge boundary; small offsets remain visible. Do not propagate the other wall\'s pointed facadeTop to this face.'],
  [8,'flat-with-front-pitch','unknown',
    'Street roof pixels show a steep roof strip with dormer openings; the wider aerial places the outlined corner building at the end of the block and reveals a large level central deck containing rooftop objects. This combination supports flat core plus front/perimeter pitch, not a simple full gable roof. The dark area beyond the edge is shadow; context is essential to avoid treating the whole outlined object as water or an unrelated pier.',
    'Branches and low street resolution prevent a confident decorative-top label. Materials differ across deck and pitched edge and cannot be assigned one reliable whole-roof material.'],
  [11,'unknown','stepped',
    'The street image directly supports a stepped decorative facade. Overhead adds a broad gray rectangular roof area and multiple raised edge/central structures; it rules out inferring roof shape solely from the staircase silhouette.',
    'At this aerial resolution, a small front pitch, raised flat attic volume and adjacent edge structures cannot be separated reliably. Keep roofShape unknown rather than choose flat merely because the central surface looks level.'],
  [12,'unknown','unknown',
    'Overhead reveals a broad flat-looking central surface and a differently shaped front-side zone. Street view has a tall asymmetrical projecting/tower-like section next to a lower cornice, not one simple gable silhouette.',
    'The front-side zone may include a pitched component or a raised/vertical front volume. This packet does not resolve those alternatives, and its mixed-height street top does not fit one confident six-way decorative-top class.'],
  [28,'unknown','unknown',
    'The broad block contains visibly different roof sections and terraces. Aerial context is useful for recognising that this is a large composite building rather than a single narrow pitched roof.',
    'coverageComplete=false: the target footprint exits the aerial crop/tile. Deep shadows also obscure interior parts, and the street roof crop is an extremely shallow clock-and-sky strip. Obtain complete overhead coverage and bay-level street crops before labelling whole-building roof volume.'],
  [29,'flat-with-front-pitch','unknown',
    'The broad street face has an unmistakable dark sloping roof strip with a small dormer between raised facade elements. The overhead images show a large bright level roof/deck over the wedge-shaped building, without a matching full-length gable ridge. Both views therefore support a flat core plus street-facing pitch.',
    'The bright deck and dark pitch should not receive one material label. This wall combines different decorative top elements, so a single facadeTop is left unknown.'],
  [34,'flat-with-front-pitch','unknown',
    'Street pixels clearly show a gray standing-seam sloping front roof with dormers. Overhead shows that it borders a long flat-looking interior roof/deck strip, rather than continuing into a simple symmetric two-slope gable roof. This supports the hybrid flat-core/front-pitch category.',
    'Metal seams are supported specifically for the visible front pitch, not all roof surfaces. A stepped brick end and dormer features coexist along the photographed wall, so one decorative facade-top label would lose the distinction.'],
  [45,'unknown','stepped',
    'The two stepped decorative gables and the shallow tiled front slope are directly visible. The aerial adds a broad main deck with rooftop structures, so the decorative staircase must not be read as the whole roof volume.',
    'A long rear part of this L-shaped target is deeply shadowed. The complete building may include additional roof volumes not distinguishable here. The main-deck/front-pitch components are evident, but whole-building roofShape remains unknown.'],
  [54,'flat-with-front-pitch','neck',
    'The street-facing top is a narrow neck with curved shoulders, with a short sloping roof surface and roof windows to either side. Both overhead crops reveal the much larger rectangular flat core behind that facade. Combining these, rather than the neck silhouette alone, supports flat core plus front pitch.',
    'The narrow rear extension is partly shaded. No full gable/hipped volume or uniform material is established. The neck classification belongs only to this entrance facade at number 7.'],
  [56,'flat-with-front-pitch','neck',
    'The street packet shows a neck-like decorative top with a small stepped cap and a roof window set into the neighbouring short slope. Overhead shows the broad rectangular flat roof core behind the front strip. This supports the same hybrid volume family as the neighbouring entrance building, independently of its retail branding.',
    'Do not merge the two frontage identities merely because both signs say Sterk. Whole-roof material remains uncertain; the small street-facing sloped section is not the entire roof.'],
  [73,'unknown','straight',
    'The photographed institutional frontage has a straight roof silhouette. Overhead clearly reveals extensive level roof/deck surfaces with solar-panel arrays, services and multiple roof levels on the visible long wing.',
    'coverageComplete=false: the large building footprint exits the tile and an interior wing is deeply shadowed. The observed wing is predominantly flat, but that is not a complete whole-building roofShape label. Keep the local flat-wing observation and request expanded aerial coverage.'],
  [90,'unknown','straight',
    'The street-facing brick parapet is straight. The overhead crop adds a roof surface with strong light/dark divisions and a distinct front/right edge; the same neighbour context is visible in the wider crop.',
    'Deep shadow and the small number of source pixels leave it unclear whether the dark/light division is a roof pitch, a height change or cast shadow. Do not promote the straight facade top to flat roof volume or treat dark pixels as a material label.'],
];
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const records=[];
for(const [index,roofShape,facadeTop,observations,limitations] of frozenObservations){
  const r=source.records.find(r=>r.index===index);if(!r)throw Error('Missing roof packet '+index);
  for(const m of r.images){if(sha(await fs.readFile(path.join(base,'images',m.file)))!==m.sha256)throw Error('Reviewed pixels changed '+m.file);}
  for(const m of r.originalPanoramas){if(sha(await fs.readFile(m.file))!==m.sha256)throw Error('Original source changed '+m.file);}
  records.push({id:r.id,buildingId:r.buildingId,address:r.address,derivationKey:r.derivationKey,origin:'agent-visual-review',reviewer:'Codex / review_hardening / direct street-plus-aerial image inspection',humanReviewed:false,metricEligible:false,buildingMatch:'yes',cropQuality:r.coverageComplete===false?'partial':'usable',appearanceEligible:true,needsReview:roofShape==='unknown',proposal:{roofShape,facadeTop,roofMaterial:'unknown'},fieldEligibility:{roofShape:roofShape!=='unknown',facadeTop:facadeTop!=='unknown',roofMaterial:false},evidence:observations+' '+limitations,observations,limitations,scope:{roofShape:'Whole main building roof-volume family; flat-with-front-pitch explicitly includes a flat core and a visible pitched street/perimeter section, not an exact reconstructed solid.',facadeTop:'Only this photographed wall; never propagate to another frontage merely because buildingId matches.',roofMaterial:'Whole-roof material; withheld when only one local surface is identifiable.'},quality:{aerialCoverageComplete:r.coverageComplete,roofRecropBeforeHuman:r.coverageComplete===false,footprintAlignment:'Visual context checked; outline not independently surveyed and relief/shadow can complicate edges.'},images:r.images.map(m=>({kind:m.kind,file:m.file,sha256:m.sha256,...(m.panoramaId?{panoramaId:m.panoramaId,panoramaSha256:m.panoramaSha256}:{}),...(m.date?{date:m.date}:{})})),originalPanoramas:r.originalPanoramas,aerialSource:{sha256:r.images.find(m=>m.kind==='aerial').sourceSha256,url:r.images.find(m=>m.kind==='aerial').url,layer:r.images.find(m=>m.kind==='aerial').layer},sheet:r.sheet});
}
const findings={version:1,createdAt:new Date().toISOString(),origin:'agent-visual-review',humanReviewed:false,metricEligible:false,costUsd:0,method:'Direct view_image inspection of twelve street full/upper-roof + aerial tight/context packets, selected from existing conflict flags without reading existing proposal answers. Image-first interpretations frozen before any model-output comparison. Prior conversation disclosed some roof issues; not a blinded benchmark. Original street panorama hashes are retained as provenance but those panoramas were not reopened in this roof-only pass.',selection:'Twelve distinct buildings, preferring broader useful street faces; includes two incomplete-coverage buildings deliberately retained as abstention controls.',integration:'This file assesses only roofShape, facadeTop and roofMaterial. It must not erase earlier ground-floor proposals. Unknown/fieldEligibility=false is abstention, not a replacement label. No geometry changes are authorised by these machine-only hypotheses.',summary:{packets:records.length,supportedRoofFamilies:records.filter(r=>r.fieldEligibility.roofShape).length,unresolved:records.filter(r=>!r.fieldEligibility.roofShape).length,incompleteAerialFootprints:records.filter(r=>r.quality.aerialCoverageComplete===false).map(r=>r.buildingId),supportedMaterialLabels:0},records};
await fs.writeFile(path.join(root,'roof-findings.json'),JSON.stringify(findings,null,2));console.log(JSON.stringify(findings.summary,null,2));
