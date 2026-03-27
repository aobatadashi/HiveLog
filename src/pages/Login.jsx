/**
 * Login.jsx — Email + Password auth (v1 temporary)
 *
 * TODO — PHONE AUTH MIGRATION:
 * When ready to switch to phone + SMS OTP + 4-digit PIN (the final spec),
 * see PHONE_AUTH_TODO.md in the project root for the full migration guide.
 * The useAuth hook and supabaseClient need no changes — only this file.
 */

import { useState } from 'react';
import { supabase } from '../supabaseClient.js';

const STEPS = {
  SIGN_IN: 'sign_in',
  SIGN_UP: 'sign_up',
  FORGOT: 'forgot',
  FORGOT_SENT: 'forgot_sent',
};

export default function Login() {
  const [step, setStep] = useState(STEPS.SIGN_IN);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function clearError() { setError(''); }

  // ── Sign In ──────────────────────────────────────────────────
  async function handleSignIn(e) {
    e.preventDefault();
    clearError();
    if (!email || !password) { setError('Enter your email and password'); return; }
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) setError(err.message === 'Invalid login credentials'
      ? 'Wrong email or password'
      : err.message);
    setLoading(false);
  }

  // ── Sign Up ──────────────────────────────────────────────────
  async function handleSignUp(e) {
    e.preventDefault();
    clearError();
    if (!email || !password) { setError('Enter your email and password'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (password !== passwordConfirm) { setError('Passwords do not match'); return; }
    setLoading(true);
    const { error: err } = await supabase.auth.signUp({ email, password });
    if (err) {
      setError(err.message);
    } else {
      // Supabase may auto-confirm or send a confirmation email depending on project settings.
      // If email confirmation is disabled in Supabase → Auth → Settings, the user is
      // logged in immediately. Otherwise show a helpful message.
      setError('');
    }
    setLoading(false);
  }

  // ── Forgot Password ──────────────────────────────────────────
  async function handleForgot(e) {
    e.preventDefault();
    clearError();
    if (!email) { setError('Enter your email address'); return; }
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (err) {
      setError(err.message);
    } else {
      setStep(STEPS.FORGOT_SENT);
    }
    setLoading(false);
  }

  return (
    <div className="page login-page">
      {/* Header */}
      <div className="login-header">
        <div className="login-logo">🐝</div>
        <h1>HiveLog</h1>
        <p className="login-subtitle">Hive event logging for beekeepers</p>
      </div>

      {/* ── Sign In ── */}
      {step === STEPS.SIGN_IN && (
        <form className="login-form" onSubmit={handleSignIn} noValidate>
          <h2>Sign In</h2>

          <label htmlFor="email-si">Email</label>
          <input
            id="email-si"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => { clearError(); setEmail(e.target.value); }}
            autoComplete="email"
            inputMode="email"
          />

          <label htmlFor="pw-si">Password</label>
          <input
            id="pw-si"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => { clearError(); setPassword(e.target.value); }}
            autoComplete="current-password"
          />

          {error && <p className="error-msg">{error}</p>}

          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={loading}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>

          <div className="login-links">
            <button
              type="button"
              className="link-btn"
              onClick={() => { clearError(); setPassword(''); setStep(STEPS.FORGOT); }}
            >
              Forgot password?
            </button>
            <button
              type="button"
              className="link-btn"
              onClick={() => { clearError(); setPassword(''); setPasswordConfirm(''); setStep(STEPS.SIGN_UP); }}
            >
              Create account →
            </button>
          </div>
        </form>
      )}

      {/* ── Sign Up ── */}
      {step === STEPS.SIGN_UP && (
        <form className="login-form" onSubmit={handleSignUp} noValidate>
          <h2>Create Account</h2>

          <label htmlFor="email-su">Email</label>
          <input
            id="email-su"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => { clearError(); setEmail(e.target.value); }}
            autoComplete="email"
            inputMode="email"
          />

          <label htmlFor="pw-su">Password</label>
          <input
            id="pw-su"
            type="password"
            placeholder="Min. 6 characters"
            value={password}
            onChange={(e) => { clearError(); setPassword(e.target.value); }}
            autoComplete="new-password"
          />

          <label htmlFor="pw-confirm">Confirm Password</label>
          <input
            id="pw-confirm"
            type="password"
            placeholder="Same password again"
            value={passwordConfirm}
            onChange={(e) => { clearError(); setPasswordConfirm(e.target.value); }}
            autoComplete="new-password"
          />

          {error && <p className="error-msg">{error}</p>}

          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={loading}
          >
            {loading ? 'Creating account…' : 'Create Account'}
          </button>

          <div className="login-links">
            <button
              type="button"
              className="link-btn"
              onClick={() => { clearError(); setPassword(''); setPasswordConfirm(''); setStep(STEPS.SIGN_IN); }}
            >
              ← Back to sign in
            </button>
          </div>
        </form>
      )}

      {/* ── Forgot Password ── */}
      {step === STEPS.FORGOT && (
        <form className="login-form" onSubmit={handleForgot} noValidate>
          <h2>Reset Password</h2>
          <p className="login-hint">
            Enter your email and we'll send you a reset link.
          </p>

          <label htmlFor="email-fp">Email</label>
          <input
            id="email-fp"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => { clearError(); setEmail(e.target.value); }}
            autoComplete="email"
            inputMode="email"
          />

          {error && <p className="error-msg">{error}</p>}

          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={loading}
          >
            {loading ? 'Sending…' : 'Send Reset Link'}
          </button>

          <div className="login-links">
            <button
              type="button"
              className="link-btn"
              onClick={() => { clearError(); setStep(STEPS.SIGN_IN); }}
            >
              ← Back to sign in
            </button>
          </div>
        </form>
      )}

      {/* ── Reset Email Sent ── */}
      {step === STEPS.FORGOT_SENT && (
        <div className="login-form login-success">
          <div className="success-icon">✉️</div>
          <h2>Check your email</h2>
          <p>
            We sent a password reset link to <strong>{email}</strong>.
            Click the link in that email, then come back and sign in.
          </p>
          <button
            type="button"
            className="btn btn-primary btn-full"
            onClick={() => { clearError(); setStep(STEPS.SIGN_IN); }}
          >
            Back to Sign In
          </button>
        </div>
      )}
    </div>
  );
}
