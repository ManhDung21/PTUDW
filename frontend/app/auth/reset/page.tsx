'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { AxiosError } from 'axios';

import { API_PREFIX, apiClient } from '../../lib/api-client';

type ResetResponse = {
  message?: string;
};

export default function ResetPasswordPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    email: '',
    code: '',
    password: '',
    confirm: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (form.password !== form.confirm) {
      setError('Password confirmation does not match.');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        identifier: form.email,
        token: form.code,
        new_password: form.password,
      };
      const { data } = await apiClient.post<ResetResponse>(`${API_PREFIX}/auth/reset-password`, payload);
      setSuccess(data?.message ?? 'Password has been updated.');
      setTimeout(() => {
        router.push('/auth/login');
      }, 1500);
    } catch (err) {
      const axiosErr = err as AxiosError<{ detail?: string }>;
      const detail = axiosErr.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Unable to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Reset password</h1>
        <p className="section-hint">
          Enter the verification code you received together with your new password.
        </p>
        {error ? <p className="section-error">{error}</p> : null}
        {success ? <p className="section-success">{success}</p> : null}
        <form className="form" onSubmit={handleSubmit}>
          <label className="form__label">
            Email
            <input
              type="email"
              required
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              placeholder="you@example.com"
            />
          </label>
          <label className="form__label">
            Verification code
            <input
              type="text"
              required
              value={form.code}
              onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))}
              placeholder="6-digit code"
            />
          </label>
          <label className="form__label">
            New password
            <input
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
            />
          </label>
          <label className="form__label">
            Confirm password
            <input
              type="password"
              required
              minLength={6}
              value={form.confirm}
              onChange={(event) => setForm((prev) => ({ ...prev, confirm: event.target.value }))}
            />
          </label>
          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? 'Updating...' : 'Update password'}
          </button>
        </form>
        <div className="auth-card__footer">
          <Link className="link-button" href="/auth/login">
            Back to sign in
          </Link>
          <Link className="link-button" href="/auth/forgot">
            Need a new code?
          </Link>
        </div>
      </div>
    </div>
  );
}

