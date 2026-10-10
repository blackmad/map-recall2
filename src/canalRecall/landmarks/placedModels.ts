/** Every model the game places (all three categories, buildingCategory.ts),
 * for scripts that must know which footprints are already modelled (audits,
 * backlogs). Not imported by the landmark/route runtime: landmark status lives
 * in SIGNATURE_MODELS only. */
import { SIGNATURE_MODELS } from './signatureModels';
import { MANUAL_ORDINARY_BUILDINGS } from './manualModels';
import { ORDINARY_BUILDINGS } from './ordinaryModels';
import type { SignatureModelSpec } from './signaturePlacement';

export const PLACED_MODELS: readonly SignatureModelSpec[] = [...SIGNATURE_MODELS, ...MANUAL_ORDINARY_BUILDINGS, ...ORDINARY_BUILDINGS];

/** Every OSM/BAG footprint a placed model stands in for (landmarks, ordinary buildings, recipe houses). */
export const placedSuppressedOsmIds = (): string[] => PLACED_MODELS.flatMap(model => [...model.suppressOsmIds]);
