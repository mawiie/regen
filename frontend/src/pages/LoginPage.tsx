import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './LoginPage.css';

type AuthMode = 'login' | 'signup' | 'forgot-password';

export function LoginPage() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { signIn, signUp, resetPassword } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (mode === 'forgot-password') {
      if (!email) {
        setError('Please enter your email');
        return;
      }

      setLoading(true);
      try {
        const { error } = await resetPassword(email);
        if (error) {
          setError(error);
        } else {
          setSuccessMessage('Password reset email sent! Check your inbox for a link to reset your password.');
          setEmail('');
        }
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    if (mode === 'signup') {
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
    }

    setLoading(true);

    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password);
        if (error) {
          setError(error);
        } else {
          navigate('/dashboard');
        }
      } else {
        const { error } = await signUp(email, password);
        if (error) {
          setError(error);
        } else {
          setSuccessMessage('Account created! Check your email to confirm your account, then sign in.');
          setMode('login');
          setPassword('');
          setConfirmPassword('');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login');
    setError(null);
    setSuccessMessage(null);
    setPassword('');
    setConfirmPassword('');
  };

  const showForgotPassword = () => {
    setMode('forgot-password');
    setError(null);
    setSuccessMessage(null);
    setPassword('');
    setConfirmPassword('');
  };

  const backToLogin = () => {
    setMode('login');
    setError(null);
    setSuccessMessage(null);
  };

  return (
    <div className="login-page">
      <div className="login-page__container">
        {/* Logo */}
        <div className="login-page__logo">
          <div className="login-page__logo-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          </div>
          <h1>Regen</h1>
          <p>Audio Transcription & Editing</p>
        </div>

        {/* Auth Form */}
        <div className="login-page__card glass-card">
          <h2>
            {mode === 'login' && 'Welcome back'}
            {mode === 'signup' && 'Create your account'}
            {mode === 'forgot-password' && 'Reset your password'}
          </h2>
          <p className="login-page__subtitle">
            {mode === 'login' && 'Sign in to access your transcripts'}
            {mode === 'signup' && 'Get started with audio transcription'}
            {mode === 'forgot-password' && "Enter your email and we'll send you a reset link"}
          </p>

          {error && (
            <div className="login-page__alert login-page__alert--error">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              {error}
            </div>
          )}

          {successMessage && (
            <div className="login-page__alert login-page__alert--success">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              {successMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-page__form">
            <div className="login-page__field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                className="input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            {mode !== 'forgot-password' && (
              <div className="login-page__field">
                <div className="login-page__field-header">
                  <label htmlFor="password">Password</label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      className="login-page__forgot-link"
                      onClick={showForgotPassword}
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <input
                  id="password"
                  type="password"
                  className="input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  required
                />
              </div>
            )}

            {mode === 'signup' && (
              <div className="login-page__field">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  className="input"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
            )}

            <button type="submit" className="btn btn-primary login-page__submit" disabled={loading}>
              {loading ? (
                <>
                  <span className="login-page__spinner" />
                  {mode === 'login' && 'Signing in...'}
                  {mode === 'signup' && 'Creating account...'}
                  {mode === 'forgot-password' && 'Sending reset email...'}
                </>
              ) : (
                <>
                  {mode === 'login' && 'Sign In'}
                  {mode === 'signup' && 'Create Account'}
                  {mode === 'forgot-password' && 'Send Reset Link'}
                </>
              )}
            </button>
          </form>

          {mode === 'forgot-password' ? (
            <p className="login-page__toggle login-page__toggle--center">
              <button type="button" onClick={backToLogin}>
                Back to sign in
              </button>
            </p>
          ) : (
            <>
              <div className="login-page__divider">
                <span>or</span>
              </div>

              <p className="login-page__toggle">
                {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
                <button type="button" onClick={toggleMode}>
                  {mode === 'login' ? 'Sign up' : 'Sign in'}
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
