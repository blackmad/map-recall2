/**
 * My progress's cloud half, through Map Quest's Firebase app (src/firebase.ts).
 * The ride writes the same `users/{uid}/gameSessions` documents through its
 * own app on the same origin and config, so a ride finished as a guest on
 * this device is uploaded here, and rides from other devices come down.
 */
import type { User } from 'firebase/auth';
import { loadRouteHistory, mergeHistories, saveRouteHistory, toCloudDoc, type RideRecord } from '../canalRecall/routeHistory';
import { mergeIntoStorage, syncStamps as syncStampDocs, type StampCloud } from '../canalRecall/collection/stampSync';
import type { StampRecord } from '../canalRecall/collection/poiCollection';

const storage = (): Storage | null => {
  try { return localStorage; } catch { return null; }
};

export async function syncRides(user: User): Promise<RideRecord[]> {
  const [{ db }, { collection, doc, getDocs, writeBatch }] = await Promise.all([import('../firebase'), import('firebase/firestore')]);
  const local = loadRouteHistory(storage());
  if (!db) return local;
  const snapshot = await getDocs(collection(db, 'users', user.uid, 'gameSessions'));
  const { merged, upload } = mergeHistories(local, snapshot.docs.map(entry => entry.data()));
  saveRouteHistory(storage(), merged);
  if (upload.length) {
    const batch = writeBatch(db);
    for (const record of upload) batch.set(doc(db, 'users', user.uid, 'gameSessions', record.id), toCloudDoc(record));
    await batch.commit();
  }
  return merged;
}

/** Landmark stamps: users/{uid}/poiStamps merged with this device's, and the difference written back. */
export async function syncStamps(user: User): Promise<StampRecord[] | null> {
  const [{ db }, firestore] = await Promise.all([import('../firebase'), import('firebase/firestore')]);
  if (!db) return null;
  const cloud = { db, api: firestore as unknown as StampCloud['api'], uid: user.uid } as StampCloud;
  const { merged } = await syncStampDocs(cloud, mergeIntoStorage(storage()));
  return merged;
}
