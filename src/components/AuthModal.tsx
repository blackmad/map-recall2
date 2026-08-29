import { FormEvent, useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../AuthContext';

export function AuthModal({ onClose }: { onClose: () => void }) {
  const { createAccount, signInWithEmail, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (creating) await createAccount(email, password);
      else await signInWithEmail(email, password);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message.replace('Firebase: ', '') : 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  };

  return <div className="fixed inset-0 z-[80] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
    <div className="app-dialog w-full max-w-sm p-5" onClick={(event) => event.stopPropagation()}>
      <div className="flex items-center justify-between mb-4">
        <div><h2 className="font-bold text-white">{creating ? 'Create account' : 'Sign in'}</h2><p className="text-xs text-slate-400">Optional: sync progress across devices. Guest play always works.</p></div>
        <button onClick={onClose} className="p-1 text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
      </div>
      <button disabled={busy} onClick={async () => { setBusy(true); setError(null); try { await signInWithGoogle(); onClose(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not sign in.'); } finally { setBusy(false); } }} className="w-full rounded-xl bg-white py-2.5 text-sm font-bold text-slate-900 disabled:opacity-50">Continue with Google</button>
      <div className="my-3 text-center text-[11px] uppercase tracking-wider text-slate-500">or</div>
      <form onSubmit={submit} className="space-y-3">
        <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" className="w-full rounded-xl border border-slate-700 bg-slate-800 p-2.5 text-sm text-white outline-none focus:border-blue-500" />
        <input required minLength={6} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" className="w-full rounded-xl border border-slate-700 bg-slate-800 p-2.5 text-sm text-white outline-none focus:border-blue-500" />
        {error && <p className="text-xs text-rose-400">{error}</p>}
        <button disabled={busy} className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Please wait…' : creating ? 'Create account' : 'Sign in'}</button>
      </form>
      <button onClick={() => setCreating((value) => !value)} className="mt-3 w-full text-xs text-blue-400 hover:text-blue-300">{creating ? 'Already have an account? Sign in' : 'New here? Create an account'}</button>
    </div>
  </div>;
}
