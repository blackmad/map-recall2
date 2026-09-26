import { createHash } from 'node:crypto';
export const reviewEvidenceKey=(record,aerial)=>createHash('sha256').update(JSON.stringify([record.derivationKey,aerial?.sha256??null,aerial?.context?.sha256??null])).digest('hex');
