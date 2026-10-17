import { canalFirebase } from '../firebaseShared';

// One Firebase app per page: on the ride this reuses the recall store's
// instance (and its sign-in) instead of initialising a second app.
const fb = await canalFirebase();
if (!fb) throw new Error('Firebase configuration is unavailable. Your draft is kept on this device.');
const { auth, db } = fb;
const { GoogleAuthProvider, signInWithPopup } = fb.authApi;
const { doc, runTransaction, serverTimestamp, getDocs, collection, query, where, limit } = fb.firestoreApi;

await auth.authStateReady();

export async function signIn() {
  if (!auth.currentUser) await signInWithPopup(auth, new GoogleAuthProvider());
}
export async function save(id: string, payload: Record<string, unknown>) {
  if (!auth.currentUser) throw new Error('Sign in with Google before saving.');
  const uid = auth.currentUser.uid;
  await runTransaction(db, async transaction => {
    const ref = doc(db, 'canalFeedback', id);
    if ((await transaction.get(ref)).exists()) return;
    transaction.set(ref, {
    ...payload, ownerUid: uid, schemaVersion: 1,
    status: 'open', createdAt: serverTimestamp(), updatedAt: serverTimestamp(), resolution: '',
    });
  });
}
export async function list() {
  if (!auth.currentUser) return [];
  const result = await getDocs(query(collection(db, 'canalFeedback'), where('ownerUid', '==', auth.currentUser.uid), limit(100)));
  return result.docs.map(d => ({ id: d.id, ...d.data() }));
}
export function userLabel() { return auth.currentUser?.displayName || auth.currentUser?.email || ''; }
