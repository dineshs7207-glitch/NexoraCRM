import { useSyncExternalStore } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Profile } from '@nexora/shared';
import { supabase } from './supabase';

export type SessionState =
  | { status: 'preview' } // no Supabase settings in this build
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'noProfile'; session: Session; message: string }
  | { status: 'signedIn'; session: Session; profile: Profile };

let state: SessionState = supabase ? { status: 'loading' } : { status: 'preview' };
const listeners = new Set<() => void>();
function set(next: SessionState) {
  state = next;
  listeners.forEach((l) => l());
}

async function loadProfile(session: Session) {
  const { data, error } = await supabase!
    .from('profiles')
    .select('id, full_name, work_email, role, team, manager_id, scope, active')
    .eq('id', session.user.id)
    .maybeSingle<Profile>();
  if (error) return set({ status: 'noProfile', session, message: error.message });
  if (!data) return set({ status: 'noProfile', session, message: 'This account has no Nexora profile yet. Ask an admin to invite you.' });
  if (!data.active) return set({ status: 'noProfile', session, message: 'This account has been deactivated.' });
  set({ status: 'signedIn', session, profile: data });
}

let lastUserId: string | undefined;
supabase?.auth.onAuthStateChange((_event, session) => {
  if (!session) {
    lastUserId = undefined;
    return set({ status: 'signedOut' });
  }
  // Token refreshes fire this too; only refetch the profile when the user changes.
  if (session.user.id === lastUserId && state.status !== 'loading') return;
  lastUserId = session.user.id;
  // Supabase advises against awaiting its own calls inside this callback.
  setTimeout(() => void loadProfile(session), 0);
});

export function useSession() {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => void listeners.delete(l)),
    () => state,
  );
}

export async function signOut() {
  await supabase?.auth.signOut();
}
