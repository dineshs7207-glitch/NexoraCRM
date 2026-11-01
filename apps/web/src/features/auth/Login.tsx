import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { appUrl, supabase } from '../../lib/supabase';
import { useSession } from '../../lib/session';
import { AuthScreen } from '../../shell/AuthGate';
import { Field, Spinner } from '../../ui';

type Mode = 'password' | 'link' | 'reset';

export function Login() {
  const s = useSession();
  const location = useLocation();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(params.get('error') ?? '');
  const [sent, setSent] = useState('');

  const from = (location.state as { from?: string } | null)?.from;
  if (s.status === 'preview' || s.status === 'signedIn') return <Navigate to={from && from !== '/login' ? from : '/'} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError('');
    const address = email.trim();
    const result =
      mode === 'password'
        ? await supabase.auth.signInWithPassword({ email: address, password })
        : mode === 'link'
          ? await supabase.auth.signInWithOtp({ email: address, options: { shouldCreateUser: false, emailRedirectTo: appUrl() } })
          : await supabase.auth.resetPasswordForEmail(address, { redirectTo: appUrl() });
    setBusy(false);
    if (result.error) return setError(mode === 'link' && result.error.status === 422 ? 'No Nexora account uses that email. Ask an admin to invite you.' : result.error.message);
    if (mode === 'link') setSent(`We've emailed a sign-in link to ${address}.`);
    if (mode === 'reset') setSent(`If ${address} has an account, a reset link is on its way.`);
  };

  const google = async () => {
    if (!supabase) return;
    setError('');
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: appUrl() } });
    if (error) setError(error.message.includes('not enabled') ? 'Google sign-in isn’t switched on for this project yet.' : error.message);
  };

  const titles: Record<Mode, [string, string]> = {
    password: ['Sign in', 'Welcome back to Nexora. New here? Ask an admin to invite you.'],
    link: ['Email me a sign-in link', "No password needed. We'll send a one-time link."],
    reset: ['Reset your password', "We'll email you a link to choose a new one."],
  };
  const switchMode = (m: Mode) => {
    setMode(m);
    setError('');
    setSent('');
  };

  return (
    <AuthScreen title={titles[mode][0]} sub={titles[mode][1]}>
      {sent ? (
        <div className="stack">
          <div className="box auth-ok">{sent} You can close this tab once you've opened it.</div>
          <button className="btn ghost" onClick={() => switchMode('password')}>
            Back to sign in
          </button>
        </div>
      ) : (
        <form className="stack" onSubmit={submit}>
          {mode === 'password' && (
            <>
              <button type="button" className="btn" onClick={() => void google()} disabled={busy}>
                <GoogleMark /> Continue with Google
              </button>
              <div className="auth-or">or</div>
            </>
          )}
          <Field label="Work email">
            <input className="input" type="email" autoComplete="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          {mode === 'password' && (
            <Field label="Password">
              <input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
          )}
          {error && (
            <div className="box auth-error" role="alert">
              {error}
            </div>
          )}
          <button className="btn primary" type="submit" disabled={busy}>
            {busy && <Spinner size={16} />}
            {mode === 'password' ? 'Sign in' : mode === 'link' ? 'Send sign-in link' : 'Send reset link'}
          </button>
          <div className="auth-links">
            {mode !== 'password' && (
              <button type="button" className="btn ghost sm" onClick={() => switchMode('password')}>
                Sign in with password
              </button>
            )}
            {mode !== 'link' && (
              <button type="button" className="btn ghost sm" onClick={() => switchMode('link')}>
                Email me a link instead
              </button>
            )}
            {mode === 'password' && (
              <button type="button" className="btn ghost sm" onClick={() => switchMode('reset')}>
                Forgot password?
              </button>
            )}
          </div>
        </form>
      )}
    </AuthScreen>
  );
}

/** Reached from an invite or password-reset email: the link has already signed the user in. */
export function SetPassword() {
  const s = useSession();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (s.status === 'preview') return <Navigate to="/" replace />;
  if (s.status === 'signedOut') return <Navigate to="/login?error=That%20link%20has%20expired.%20Request%20a%20new%20one." replace />;
  if (s.status === 'loading')
    return (
      <div className="auth-screen" aria-busy="true">
        <Spinner size={26} />
      </div>
    );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setError('Use at least 8 characters.');
    if (password !== confirm) return setError("The two passwords don't match.");
    setBusy(true);
    const { error } = await supabase!.auth.updateUser({ password });
    setBusy(false);
    if (error) return setError(error.message);
    navigate('/', { replace: true });
  };

  return (
    <AuthScreen title="Choose a password" sub={`For ${s.session.user.email}. You can also keep signing in with email links.`}>
      <form className="stack" onSubmit={submit}>
        <Field label="New password" hint="At least 8 characters">
          <input className="input" type="password" autoComplete="new-password" required autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="Confirm password">
          <input className="input" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        {error && (
          <div className="box auth-error" role="alert">
            {error}
          </div>
        )}
        <button className="btn primary" type="submit" disabled={busy}>
          {busy && <Spinner size={16} />}
          Save password
        </button>
        <button type="button" className="btn ghost sm" onClick={() => navigate('/', { replace: true })}>
          Skip for now
        </button>
      </form>
    </AuthScreen>
  );
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z" />
      <path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
    </svg>
  );
}
