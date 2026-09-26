import type { RoofSummary } from '../../scripts/review/workbench-roofs';
/** Small review payloads keep the workbench independent of full render geometry. */
export type WorkbenchImage = { url: string; sha256: string; captureDate: string; width: number; height: number };
export type WorkbenchCase = {
  caseId: string;
  buildingId: string;
  address: string;
  note: string;
  source: { full?: WorkbenchImage; ground?: WorkbenchImage };
  previousRenderUrl: string | null;
  previewUrl: string;
  omissions: string[];
  roof: RoofSummary;
};
export type WorkbenchDiagnostic = {
  caseId: string;
  buildingId: string;
  cropSha256: string;
  tier: string;
  binding: string;
  matched: number | null;
  complete: number;
  partial: number;
  explanation: string;
  reviewCaseId: string | null;
};
export type WorkbenchPayload = {
  version: 1;
  generatedAt: string;
  project: {
    activeReleaseId: string | null;
    activeBuildings: number | null;
    candidateReleaseId: string | null;
    analyzedGround: number | null;
    analyzedFull: number | null;
    renderedBuildings: number | null;
    acceptedRegistrations: number | null;
    accountedUsd: number | null;
    ceilingUsd: number | null;
    conservativeUsd: number | null;
    unresolvedCharges: number | null;
    snapshotCount: number;
    snapshotStatus: string;
    findings: string[];
  };
  quality: { status: string; explanation: string; diagnostics: WorkbenchDiagnostic[]; actions: string[] };
  preview: { sha256: string | null; cases: WorkbenchCase[]; error: string | null };
};

export type ReconstructionCandidateVariant = 'baseline' | 'roof-planes';
