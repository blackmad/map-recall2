import { FormEvent, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../AuthContext';

export function AuthModal({ onClose }: { onClose: () => void }) {
  const { createAccount, signInWithEmail, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

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

  return (
    <div
      className="fixed inset-0 z-[80] bg-[rgba(7,20,48,0.82)] backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="app-dialog w-full max-w-sm p-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 id="auth-modal-title" className="font-bold text-white">
              {creating ? 'Create account' : 'Sign in'}
            </h2>
            <p className="text-xs text-white/60">
              Optional: sync progress across devices. Guest play always works.
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-white/60 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await signInWithGoogle();
              onClose();
            } catch (reason) {
              setError(reason instanceof Error ? reason.message : 'Could not sign in.');
            } finally {
              setBusy(false);
            }
          }}
          className="button-secondary w-full py-2.5 text-sm font-bold disabled:opacity-50"
        >
          Continue with Google
        </button>
        <div className="my-3 text-center text-xs uppercase tracking-wider text-white/50">or</div>
        <form onSubmit={submit} className="space-y-3">
          <input
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email"
            className="enamel-chip w-full p-2.5 text-sm text-white outline-none placeholder:text-white/50"
          />
          <input
            required
            minLength={6}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            className="enamel-chip w-full p-2.5 text-sm text-white outline-none placeholder:text-white/50"
          />
          {error && <p className="text-xs text-white/80">{error}</p>}
          <button disabled={busy} className="button-primary w-full py-2.5 text-sm font-bold disabled:opacity-50">
            {busy ? 'Please wait…' : creating ? 'Create account' : 'Sign in'}
          </button>
        </form>
        <button
          onClick={() => setCreating((value) => !value)}
          className="mt-3 w-full text-xs text-[#c4a35a] hover:text-white"
        >
          {creating ? 'Already have an account? Sign in' : 'New here? Create an account'}
        </button>
      </div>
    </div>
  );
}
