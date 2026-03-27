import { useState } from 'react';
import { supabase } from '../supabaseClient.js';

const STEPS = {
  PHONE: 'phone',
  OTP: 'otp',
  SET_PIN: 'set_pin',
  LOGIN_PIN: 'login_pin',
  FORGOT_OTP: 'forgot_otp',
  RESET_PIN: 'reset_pin',
};

export default function Login() {
  const [step, setStep] = useState(STEPS.PHONE);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);

  function clearError() {
    setError('');
  }

  function formatPhone(value) {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 1) return '+' + digits;
    return '+' + digits;
  }

  async function handleSendOtp() {
    clearError();
    if (phone.length < 10) {
      setError('Enter a valid phone number with country code');
      return;
    }
    setLoading(true);
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({ phone });
      if (otpError) {
        setError(otpError.message);
      } else {
        setIsNewUser(true);
        setStep(STEPS.OTP);
      }
    } catch {
      setError('Failed to send verification code');
    }
    setLoading(false);
  }

  async function handleLoginWithPin() {
    clearError();
    if (pin.length !== 4) {
      setError('PIN must be 4 digits');
      return;
    }
    setLoading(true);
    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        phone,
        password: pin,
      });
      if (loginError) {
        if (loginError.message.includes('Invalid login credentials')) {
          setError('Wrong PIN. Tap "Forgot PIN" to reset.');
        } else {
          setError(loginError.message);
        }
      }
    } catch {
      setError('Login failed');
    }
    setLoading(false);
  }

  async function handleVerifyOtp() {
    clearError();
    if (otp.length !== 6) {
      setError('Enter the 6-digit code');
      return;
    }
    setLoading(true);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        phone,
        token: otp,
        type: 'sms',
      });
      if (verifyError) {
        setError(verifyError.message);
      } else {
        setStep(STEPS.SET_PIN);
      }
    } catch {
      setError('Verification failed');
    }
    setLoading(false);
  }

  async function handleSetPin() {
    clearError();
    if (pin.length !== 4) {
      setError('PIN must be 4 digits');
      return;
    }
    if (pin !== pinConfirm) {
      setError('PINs do not match');
      return;
    }
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: pin,
      });
      if (updateError) {
        setError(updateError.message);
      }
      // Auth state change will redirect automatically
    } catch {
      setError('Failed to set PIN');
    }
    setLoading(false);
  }

  async function handleForgotPin() {
    clearError();
    setLoading(true);
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({ phone });
      if (otpError) {
        setError(otpError.message);
      } else {
        setOtp('');
        setPin('');
        setPinConfirm('');
        setStep(STEPS.FORGOT_OTP);
      }
    } catch {
      setError('Failed to send verification code');
    }
    setLoading(false);
  }

  async function handleForgotVerify() {
    clearError();
    if (otp.length !== 6) {
      setError('Enter the 6-digit code');
      return;
    }
    setLoading(true);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        phone,
        token: otp,
        type: 'sms',
      });
      if (verifyError) {
        setError(verifyError.message);
      } else {
        setStep(STEPS.RESET_PIN);
      }
    } catch {
      setError('Verification failed');
    }
    setLoading(false);
  }

  async function handleResetPin() {
    clearError();
    if (pin.length !== 4) {
      setError('PIN must be 4 digits');
      return;
    }
    if (pin !== pinConfirm) {
      setError('PINs do not match');
      return;
    }
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: pin,
      });
      if (updateError) {
        setError(updateError.message);
      }
    } catch {
      setError('Failed to reset PIN');
    }
    setLoading(false);
  }

  function handlePhoneSubmit(e) {
    e.preventDefault();
    if (isNewUser) {
      handleSendOtp();
    } else {
      handleLoginWithPin();
    }
  }

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ textAlign: 'center', marginBottom: 'var(--space-xl)' }}>
        <h1 style={{ fontSize: '40px', marginBottom: 'var(--space-sm)' }}>🐝 HiveLog</h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-lg)' }}>
          Hive event logging for beekeepers
        </p>
      </div>

      {/* PHONE ENTRY */}
      {step === STEPS.PHONE && (
        <div>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 'var(--space-sm)' }}>
            Phone Number
          </label>
          <input
            type="tel"
            placeholder="+1234567890"
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            autoComplete="tel"
          />
          <div style={{ display: 'flex', gap: 'var(--space-md)', marginTop: 'var(--space-lg)' }}>
            <button
              className="btn btn-primary"
              style={{ flex: 1 }}
              onClick={handleSendOtp}
              disabled={loading}
            >
              {loading ? 'Sending...' : 'Send Code'}
            </button>
            <button
              className="btn btn-secondary"
              style={{ flex: 1 }}
              onClick={() => {
                clearError();
                setIsNewUser(false);
                setStep(STEPS.LOGIN_PIN);
              }}
            >
              I have a PIN
            </button>
          </div>
        </div>
      )}

      {/* LOGIN WITH PIN */}
      {step === STEPS.LOGIN_PIN && (
        <form onSubmit={handlePhoneSubmit}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 'var(--space-sm)' }}>
            Phone Number
          </label>
          <input
            type="tel"
            placeholder="+1234567890"
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            style={{ marginBottom: 'var(--space-lg)' }}
            autoComplete="tel"
          />
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 'var(--space-sm)' }}>
            4-Digit PIN
          </label>
          <input
            type="number"
            inputMode="numeric"
            placeholder="••••"
            value={pin}
            onChange={(e) => setPin(e.target.value.slice(0, 4))}
            maxLength={4}
            style={{ textAlign: 'center', fontSize: 'var(--font-2xl)', letterSpacing: '8px' }}
            autoComplete="current-password"
          />
          <button
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 'var(--space-lg)' }}
            type="submit"
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-lg)' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: 'var(--font-body)' }}
              onClick={() => {
                clearError();
                setPin('');
                setStep(STEPS.PHONE);
              }}
            >
              ← Back
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: 'var(--font-body)' }}
              onClick={handleForgotPin}
              disabled={loading || phone.length < 10}
            >
              Forgot PIN
            </button>
          </div>
        </form>
      )}

      {/* OTP VERIFY (new user) */}
      {step === STEPS.OTP && (
        <div>
          <p style={{ marginBottom: 'var(--space-lg)', color: 'var(--color-text-secondary)' }}>
            Enter the 6-digit code sent to {phone}
          </p>
          <input
            type="number"
            inputMode="numeric"
            placeholder="000000"
            value={otp}
            onChange={(e) => setOtp(e.target.value.slice(0, 6))}
            maxLength={6}
            style={{ textAlign: 'center', fontSize: 'var(--font-2xl)', letterSpacing: '8px' }}
            autoComplete="one-time-code"
          />
          <button
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 'var(--space-lg)' }}
            onClick={handleVerifyOtp}
            disabled={loading}
          >
            {loading ? 'Verifying...' : 'Verify'}
          </button>
          <button
            className="btn btn-secondary"
            style={{ width: '100%', marginTop: 'var(--space-md)' }}
            onClick={() => {
              clearError();
              setOtp('');
              setStep(STEPS.PHONE);
            }}
          >
            ← Back
          </button>
        </div>
      )}

      {/* SET PIN (first time) */}
      {(step === STEPS.SET_PIN || step === STEPS.RESET_PIN) && (
        <div>
          <h2 style={{ marginBottom: 'var(--space-lg)' }}>
            {step === STEPS.RESET_PIN ? 'Reset Your PIN' : 'Set Your PIN'}
          </h2>
          <p style={{ marginBottom: 'var(--space-lg)', color: 'var(--color-text-secondary)' }}>
            Choose a 4-digit PIN for quick sign-in.
          </p>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 'var(--space-sm)' }}>
            PIN
          </label>
          <input
            type="number"
            inputMode="numeric"
            placeholder="••••"
            value={pin}
            onChange={(e) => setPin(e.target.value.slice(0, 4))}
            maxLength={4}
            style={{ textAlign: 'center', fontSize: 'var(--font-2xl)', letterSpacing: '8px', marginBottom: 'var(--space-lg)' }}
            autoComplete="new-password"
          />
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 'var(--space-sm)' }}>
            Confirm PIN
          </label>
          <input
            type="number"
            inputMode="numeric"
            placeholder="••••"
            value={pinConfirm}
            onChange={(e) => setPinConfirm(e.target.value.slice(0, 4))}
            maxLength={4}
            style={{ textAlign: 'center', fontSize: 'var(--font-2xl)', letterSpacing: '8px' }}
            autoComplete="new-password"
          />
          <button
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 'var(--space-lg)' }}
            onClick={step === STEPS.RESET_PIN ? handleResetPin : handleSetPin}
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save PIN'}
          </button>
        </div>
      )}

      {/* FORGOT PIN — OTP VERIFY */}
      {step === STEPS.FORGOT_OTP && (
        <div>
          <h2 style={{ marginBottom: 'var(--space-lg)' }}>Reset PIN</h2>
          <p style={{ marginBottom: 'var(--space-lg)', color: 'var(--color-text-secondary)' }}>
            Enter the 6-digit code sent to {phone}
          </p>
          <input
            type="number"
            inputMode="numeric"
            placeholder="000000"
            value={otp}
            onChange={(e) => setOtp(e.target.value.slice(0, 6))}
            maxLength={6}
            style={{ textAlign: 'center', fontSize: 'var(--font-2xl)', letterSpacing: '8px' }}
            autoComplete="one-time-code"
          />
          <button
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 'var(--space-lg)' }}
            onClick={handleForgotVerify}
            disabled={loading}
          >
            {loading ? 'Verifying...' : 'Verify'}
          </button>
          <button
            className="btn btn-secondary"
            style={{ width: '100%', marginTop: 'var(--space-md)' }}
            onClick={() => {
              clearError();
              setOtp('');
              setStep(STEPS.LOGIN_PIN);
            }}
          >
            ← Back
          </button>
        </div>
      )}

      {error && (
        <p className="error-msg" style={{ textAlign: 'center', marginTop: 'var(--space-md)' }}>
          {error}
        </p>
      )}
    </div>
  );
}
