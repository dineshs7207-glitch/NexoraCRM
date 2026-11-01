import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { roleLabels } from '@nexora/shared';
import { adoptProfile } from '../data/actions';
import { loadRemote, setAuthor, syncCommit } from '../data/remote';
import { replaceDB, setCommitHook } from '../data/store';
import type { Role } from '../data/types';
import { signOut, useSession } from '../lib/session';
import { Spinner } from '../ui';

/** Card on a plain page, shared by the sign-in screens. */
export function AuthScreen({ title, sub, children }: { title: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="auth-screen">
      <div className="auth-card card">
        <div className="brand">
          <span className="brand-logo">N</span>
          <span className="brand-name">Nexora</span>
        </div>
        <h1>{title}</h1>
        {sub && <p className="muted">{sub}</p>}
        {children}
      </div>
    </div>
  );
}

/** Shows the app only to signed-in users with an active profile. Builds without Supabase settings run as an open preview. */
export function AuthGate({ children }: { children: ReactNode }) {
  const s = useSession();
  const { pathname } = useLocation();
  const [adopted, setAdopted] = useState<string>();
  const [loadError, setLoadError] = useState('');
  const profile = s.status === 'signedIn' ? s.profile : null;

  // Load this account's workspace from Supabase before showing anything, then save every change back.
  useEffect(() => {
    if (!profile) return;
    let live = true;
    setLoadError('');
    loadRemote(profile.id)
      .then(({ db, key }) => {
        if (!live) return;
        setCommitHook(() => {});
        replaceDB(db, key);
        adoptProfile({ id: profile.id, name: profile.full_name, email: profile.work_email, role: roleLabels[profile.role] as Role, team: profile.team ?? 'Unassigned' });
        setAuthor(profile.id);
        setCommitHook(syncCommit);
        setAdopted(profile.id);
      })
      .catch((e: Error) => live && setLoadError(e.message));
    return () => {
      live = false;
    };
  }, [profile]);

  if (s.status === 'preview') return <>{children}</>;
  if (s.status === 'signedOut') return <Navigate to="/login" replace state={{ from: pathname }} />;
  if (s.status === 'noProfile')
    return (
      <AuthScreen title="Can't open Nexora" sub={s.message}>
        <button className="btn" onClick={() => void signOut()}>
          Sign out
        </button>
      </AuthScreen>
    );
  if (loadError)
    return (
      <AuthScreen title="Couldn't load your workspace" sub={loadError}>
        <button className="btn primary" onClick={() => location.reload()}>
          Try again
        </button>
      </AuthScreen>
    );
  if (s.status === 'loading' || adopted !== profile?.id)
    return (
      <div className="auth-screen" aria-busy="true">
        <Spinner size={26} />
      </div>
    );
  return <>{children}</>;
}
