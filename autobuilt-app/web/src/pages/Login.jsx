import { useState } from 'react';
import { useAuth } from '../lib/auth.jsx';
import './Login.css';

// The front door. A new client signs up here (creates their business +
// their own login in one step), an existing one signs back in. Nothing
// past this screen is reachable without a valid session — see requireAuth
// on the backend, which enforces the same thing server-side.
export default function Login() {
  const { login, signup, error, setError } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    const ok = mode === 'login' ? await login(email, password) : await signup(businessName, email, password);
    setBusy(false);
    if (!ok) return; // error already set by the auth context
  }

  function switchMode(next) {
    setMode(next);
    setError(null);
  }

  return (
    <div className="login">
      <div className="login-inner">
        <div className="eyebrow">AutoBuilt</div>
        <h1 className="login-title">{mode === 'login' ? 'Welcome back.' : 'Create your account.'}</h1>
        <p className="login-sub">
          {mode === 'login'
            ? 'Sign in to your business dashboard.'
            : "Set up your business's own login. Takes about a minute."}
        </p>

        <form onSubmit={submit}>
          {mode === 'signup' && (
            <div className="field">
              <label>Business name</label>
              <input
                className="input"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Riverside Nail Bar"
                autoFocus
                required
              />
            </div>
          )}
          <div className="field">
            <label>Email</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@yourbusiness.com"
              autoFocus={mode === 'login'}
              required
            />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'signup' ? 'At least 8 characters' : '••••••••'}
              minLength={mode === 'signup' ? 8 : undefined}
              required
            />
          </div>

          {error && <p className="login-error">{error}</p>}

          <button className="btn btn-primary btn-block" disabled={busy} type="submit">
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <button
          className="btn btn-ghost btn-block"
          style={{ marginTop: 4 }}
          onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
        >
          {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  );
}
