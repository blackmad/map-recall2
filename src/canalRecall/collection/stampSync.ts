// Cloud half of POI stamps: users/{uid}/poiStamps/{id}.
//
// Both pages that hold stamps call this with their own Firebase handle: the
// ride through the shared app in firebaseShared.ts (recallStore.ts), the
// /progress page through Map Quest's app (src/progress/cloud.ts). The
// Firestore functions are passed in rather than imported, because one SDK
// copy's functions do not accept another copy's instances.

import {
  allStamps, fromStampDocs, loadStamps, mergeStamps, saveStamps, stampsToUpload, toStampDoc,
  type StampMap, type StampRecord, type StorageLike,
} from './poiCollection';

/** The four Firestore calls this needs, typed loosely enough for any SDK copy. */
export interface StampFirestoreApi<Db = unknown> {
  collection(db: Db, ...path: string[]): unknown;
  doc(db: Db, ...path: string[]): unknown;
  getDocs(query: never): Promise<{ docs: { data(): unknown }[] }>;
  writeBatch(db: Db): { set(ref: never, data: never): unknown; commit(): Promise<void> };
  setDoc?(ref: never, data: never): Promise<void>;
}

export interface StampCloud<Db = unknown> { db: Db; api: StampFirestoreApi<Db>; uid: string }

const COLLECTION = 'poiStamps';

/** Firestore batches take at most 500 writes. */
const BATCH_LIMIT = 450;

/**
 * Read the cloud stamps, merge them into this device's through `mergeLocal`
 * (which must persist the result and return it), and write back what the
 * cloud lacks. Returns the merged list and how many documents were written.
 */
export async function syncStamps<Db>(
  cloud: StampCloud<Db>,
  mergeLocal: (remoteDocs: readonly unknown[]) => readonly StampRecord[],
): Promise<{ merged: StampRecord[]; uploaded: number }> {
  const { db, api, uid } = cloud;
  const snapshot = await api.getDocs(api.collection(db, 'users', uid, COLLECTION) as never);
  const remoteDocs = snapshot.docs.map(entry => entry.data());
  const merged = [...mergeLocal(remoteDocs)];
  const mergedMap: StampMap = Object.fromEntries(merged.map(record => [record.id, record]));
  const upload = stampsToUpload(mergedMap, fromStampDocs(remoteDocs));
  for (let i = 0; i < upload.length; i += BATCH_LIMIT) {
    const batch = api.writeBatch(db);
    for (const record of upload.slice(i, i + BATCH_LIMIT)) {
      batch.set(api.doc(db, 'users', uid, COLLECTION, record.id) as never, toStampDoc(record) as never);
    }
    await batch.commit();
  }
  return { merged, uploaded: upload.length };
}

/** Mirror one stamp after it is earned (or earned again). */
export async function saveStamp<Db>(cloud: StampCloud<Db>, record: StampRecord): Promise<void> {
  const { db, api, uid } = cloud;
  const ref = api.doc(db, 'users', uid, COLLECTION, record.id);
  if (api.setDoc) { await api.setDoc(ref as never, toStampDoc(record) as never); return; }
  const batch = api.writeBatch(db);
  batch.set(ref as never, toStampDoc(record) as never);
  await batch.commit();
}

/** `mergeLocal` for a page that keeps stamps only in storage (the /progress page). */
export function mergeIntoStorage(storage: StorageLike | null | undefined) {
  return (remoteDocs: readonly unknown[]): StampRecord[] => {
    const merged = mergeStamps(loadStamps(storage), fromStampDocs(remoteDocs));
    saveStamps(storage, merged);
    return allStamps(merged);
  };
}
