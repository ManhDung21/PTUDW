'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { useAuth } from '../../providers/AuthContext';

export default function RegisterPage() {
  const router = useRouter();
  const { register, error, loading } = useAuth();
  const [form, setForm] = useState({ email: '', password: '', full_name: '' });
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setLocalError(null);
      await register({
        email: form.email,
        password: form.password,
        full_name: form.full_name || undefined,
      });
      router.push('/store');
    } catch (err) {
      console.error(err);
      setLocalError('Dang ky that bai.');
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Dang ky</h1>
        {localError ? <p className="section-error">{localError}</p> : null}
        {error ? <p className="section-error">{error}</p> : null}
        <form className="form" onSubmit={handleSubmit}>
          <label className="form__label">
            Ho va ten
            <input
              type="text"
              value={form.full_name}
              onChange={(event) => setForm((prev) => ({ ...prev, full_name: event.target.value }))}
            />
          </label>
          <label className="form__label">
            Email*
            <input
              type="email"
              required
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            />
          </label>
          <label className="form__label">
            Mat khau*
            <input
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
            />
          </label>
          <div className="form__actions">
            <button className="primary-button" type="submit" disabled={loading}>
              {loading ? 'Dang xu ly...' : 'Tao tai khoan'}
            </button>
            <a className="link-button" href="/auth/login">
              Da co tai khoan? Dang nhap
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
