import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore, doc, runTransaction, serverTimestamp, getDocs, collection, query, where, limit } from 'firebase/firestore';

const response = await fetch(new URL('firebase-config.json', location.href), { cache: 'no-store' });
if (!response.ok) throw new Error('Firebase configuration is unavailable. Your draft is kept on this device.');
const app = initializeApp(await response.json());
const auth = getAuth(app);
const db = getFirestore(app);
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
