import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { isFirebaseConfigured } from './firebaseConfig';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  configured: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  createAccount: (email: string, password: string) => Promise<void>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured) return setLoading(false);
    let unsubscribe: (() => void) | undefined;
    let active = true;
    Promise.all([import('./firebase'), import('firebase/auth')]).then(([{ auth }, { onAuthStateChanged }]) => {
      if (!active || !auth) return setLoading(false);
      unsubscribe = onAuthStateChanged(auth, (nextUser) => {
        setUser(nextUser);
        setLoading(false);
      });
    }).catch(() => setLoading(false));
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    configured: isFirebaseConfigured,
    signInWithGoogle: async () => {
      const [{ auth }, { GoogleAuthProvider, signInWithPopup }] = await Promise.all([import('./firebase'), import('firebase/auth')]);
      if (!auth) throw new Error('Firebase is not configured.');
      await signInWithPopup(auth, new GoogleAuthProvider());
    },
    signInWithEmail: async (email, password) => {
      const [{ auth }, { signInWithEmailAndPassword }] = await Promise.all([import('./firebase'), import('firebase/auth')]);
      if (!auth) throw new Error('Firebase is not configured.');
      await signInWithEmailAndPassword(auth, email, password);
    },
    createAccount: async (email, password) => {
      const [{ auth }, { createUserWithEmailAndPassword }] = await Promise.all([import('./firebase'), import('firebase/auth')]);
      if (!auth) throw new Error('Firebase is not configured.');
      await createUserWithEmailAndPassword(auth, email, password);
    },
    signOutUser: async () => {
      const [{ auth }, { signOut }] = await Promise.all([import('./firebase'), import('firebase/auth')]);
      if (auth) await signOut(auth);
    },
  }), [loading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
