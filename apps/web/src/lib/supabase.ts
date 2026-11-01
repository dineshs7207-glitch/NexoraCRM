import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/** Null when the build has no Supabase settings (the public GitHub Pages demo): the app runs as a local preview. */
export const supabase = url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;

/** Where email links (magic link, invite, password reset) send people back to: this app's base URL. */
export const appUrl = () => `${location.origin}${location.pathname}`;

/**
 * Email links come back with tokens in the URL hash (#access_token=…&type=…), which the hash router
 * would otherwise treat as a route. Let supabase-js read them first, then swap in a real route.
 * Must run before the router is created.
 */
export async function bootAuth() {
  if (!supabase) return;
  const params = new URLSearchParams(location.hash.slice(1));
  const fromEmail = params.has('access_token') || params.has('error_description');
  await supabase.auth.getSession();
  if (!fromEmail) return;
  const error = params.get('error_description');
  const type = params.get('type');
  const route = error ? `/login?error=${encodeURIComponent(error)}` : type === 'invite' || type === 'recovery' ? '/set-password' : '/';
  history.replaceState(null, '', `${location.pathname}${location.search}#${route}`);
}
