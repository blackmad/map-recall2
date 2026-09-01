/** Split model input into the exact numbered units used for provenance. */
export function sourceSentences(source: string): string[] {
  return source.replace(/\s+/g, ' ').trim()
    .split(/(?<=[.!?])\s+(?=[A-Z0-9“‘])/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

/** Resolve consecutive one-based sentence IDs back to exact source text. */
export function evidenceFor(ids: readonly number[], source: string): string | null {
  const sentences = sourceSentences(source);
  const unique = [...new Set(ids)].filter(Number.isInteger).sort((a, b) => a - b);
  if (!unique.length || unique.length > 3) return null;
  if (unique.some((id) => id < 1 || id > sentences.length)) return null;
  if (unique.some((id, index) => index > 0 && id !== unique[index - 1] + 1)) return null;
  return unique.map((id) => sentences[id - 1]).join(' ');
}

/** Remove sentence IDs a model redundantly echoes into its display prose. */
export function stripEvidenceMarkers(text: string): string {
  const stripped = text.trim().replace(/\s*\[\s*\d+(?:\s*[-,]\s*\d+)*\s*\](?=[.!?]?$)/g, '');
  return /[.!?]$/.test(stripped) ? stripped : `${stripped}.`;
}
