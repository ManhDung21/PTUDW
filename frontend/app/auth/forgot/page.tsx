'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { AxiosError } from 'axios';

import { API_PREFIX, apiClient } from '../../lib/api-client';

type ForgotResponse = {
  message?: string;
};

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      setLoading(true);
      const { data } = await apiClient.post<ForgotResponse>(`${API_PREFIX}/auth/forgot-password`, {
        identifier: email,
      });
      setSuccess(data?.message ?? 'Reset code has been sent if the email exists.');
    } catch (err) {
      const axiosErr = err as AxiosError<{ detail?: string }>;
      const detail = axiosErr.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Unable to send reset code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Forgot password</h1>
        <p className="section-hint">
          Enter the email linked to your account. We will send you a verification code to reset your password.
        </p>
        {error ? <p className="section-error">{error}</p> : null}
        {success ? <p className="section-success">{success}</p> : null}
        <form className="form" onSubmit={handleSubmit}>
          <label className="form__label">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? 'Sending...' : 'Send reset code'}
          </button>
        </form>
        <div className="auth-card__footer">
          <Link className="link-button" href="/auth/login">
            Back to sign in
          </Link>
          <Link className="link-button" href="/auth/reset">
            Already have a code?
          </Link>
        </div>
      </div>
    </div>
  );
}

