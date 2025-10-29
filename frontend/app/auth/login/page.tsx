'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { useAuth } from '../../providers/AuthContext';

export default function LoginPage() {
  const router = useRouter();
  const { login, error, loading } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setLocalError(null);
      await login(form.email, form.password);
      router.push('/store');
    } catch (err) {
      console.error(err);
      setLocalError('ÄÄƒng nháº­p khÃ´ng thÃ nh cÃ´ng.');
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>ÄÄƒng nháº­p</h1>
        {localError ? <p className="section-error">{localError}</p> : null}
        {error ? <p className="section-error">{error}</p> : null}
        <form className="form" onSubmit={handleSubmit}>
          <label className="form__label">
            Email
            <input
              type="email"
              required
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            />
          </label>
          <label className="form__label">
            Password
            <input
              type="password"
              required
              value={form.password}
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
            />
          </label>
          <div className="form__actions">
            <button className="primary-button" type="submit" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
            <a className="link-button" href="/auth/register">
              Need an account? Sign up
            </a>
          </div>
          <div className="form__footer">
            <a className="link-button" href="/auth/forgot">
              Forgot password?
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
