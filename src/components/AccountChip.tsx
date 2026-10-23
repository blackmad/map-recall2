import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, LogIn, LogOut, Route } from 'lucide-react';
import { useT } from '../i18n/useT';

export interface AccountChipUser {
  /** Display name, else email. */
  label: string;
  email?: string | null;
  photoURL?: string | null;
}

export interface AccountChipProps {
  /** Null for a guest. */
  user: AccountChipUser | null;
  /** Sign-in is configured on this build; false shows a disabled chip. */
  available?: boolean;
  busy?: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
  /** My progress page. */
  progressHref: string;
  id?: string;
  /** Avatar only when signed in, and a round icon-only "Sign in" for a guest (in-round headers). */
  compact?: boolean;
  /** Start with the menu open (Storybook states). */
  defaultOpen?: boolean;
}

/** First letter of the first word, for the avatar fallback. */
export function accountInitial(label: string): string {
  const letter = label.trim().match(/[\p{L}\p{N}]/u)?.[0];
  return (letter ?? '?').toLocaleUpperCase();
}

/** "Ada" from "Ada Lovelace" or "ada" from "ada@example.org". */
export function accountShortName(label: string): string {
  const trimmed = label.trim();
  const name = trimmed.includes('@') ? trimmed.split('@')[0] : trimmed.split(/\s+/)[0];
  return name.slice(0, 18) || 'Account';
}

function Avatar({ user }: { user: AccountChipUser }) {
  const [broken, setBroken] = useState(false);
  if (user.photoURL && !broken) {
    return <img className="account-chip-avatar" src={user.photoURL} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} />;
  }
  return <span className="account-chip-avatar account-chip-initial" aria-hidden="true">{accountInitial(user.label)}</span>;
}

/**
 * The one account control shared by the ride, Map Quest and My progress.
 * Guests see "Sign in"; a signed-in player sees their avatar, which opens a
 * small menu with My progress and Sign out. Styled by `.account-chip` in
 * src/theme/enamel-chrome.css.
 */
export function AccountChip({ user, available = true, busy = false, onSignIn, onSignOut, progressHref, id, compact = false, defaultOpen = false }: AccountChipProps) {
  const t = useT();
  const [open, setOpen] = useState(defaultOpen);
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      root.current?.querySelector<HTMLButtonElement>('.account-chip-button')?.focus();
    };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', escape); };
  }, [open]);
  useEffect(() => { if (!user) setOpen(false); }, [user]);

  if (!user) {
    return (
      <div className="account-chip" data-state="guest" ref={root}>
        <button
          id={id}
          type="button"
          className={`account-chip-button account-chip-signin${compact ? ' account-chip-icon' : ''}`}
          aria-label={compact ? t('account.signIn') : undefined}
          disabled={busy || !available}
          title={available ? t('account.signInTitle') : t('account.unavailable')}
          onClick={() => onSignIn()}
        >
          <LogIn aria-hidden="true" strokeWidth={2.25} />
          {compact ? null : <span>{busy ? t('account.signingIn') : t('account.signIn')}</span>}
        </button>
      </div>
    );
  }

  return (
    <div className="account-chip" data-state="signed-in" data-open={open ? '' : undefined} ref={root}>
      <button
        id={id}
        type="button"
        className="account-chip-button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Account: ${user.label}`}
        disabled={busy}
        onClick={() => setOpen(value => !value)}
      >
        <Avatar user={user} />
        {compact ? null : <span className="account-chip-name">{accountShortName(user.label)}</span>}
        <ChevronDown className="account-chip-caret" aria-hidden="true" strokeWidth={2.5} />
      </button>
      {open ? (
        <div className="account-chip-menu" id={menuId} role="menu" aria-label="Account">
          <div className="account-chip-who">
            <strong>{user.label}</strong>
            {user.email && user.email !== user.label ? <small>{user.email}</small> : <small>{t('account.syncNote')}</small>}
          </div>
          <a role="menuitem" className="account-chip-item" href={progressHref}>
            <Route aria-hidden="true" strokeWidth={2.25} /> My progress
          </a>
          <button
            role="menuitem"
            type="button"
            className="account-chip-item"
            onClick={() => { setOpen(false); onSignOut(); }}
          >
            <LogOut aria-hidden="true" strokeWidth={2.25} /> Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
