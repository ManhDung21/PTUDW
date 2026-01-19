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
      <div className="auth-layout">
        <section className="auth-hero">
          <span className="auth-hero__badge">Trợ giúp tài khoản</span>
          <h1 className="auth-hero__title">Quên mật khẩu?</h1>
          <p className="auth-hero__subtitle">
            Đừng lo, chúng tôi sẽ gửi mã xác minh để bạn đặt lại mật khẩu trong vài bước đơn giản.
          </p>
          <ul className="auth-hero__list">
            <li>Xác minh email để đảm bảo tài khoản thuộc về bạn.</li>
            <li>Đặt lại mật khẩu mới an toàn hơn chỉ sau vài phút.</li>
            <li>Tiếp tục quản lý đơn hàng và trao đổi với khách không gián đoạn.</li>
          </ul>
          <div className="auth-hero__footer">
            <span>Nhớ mật khẩu rồi?</span>
            <Link href="/auth/login">Quay lại đăng nhập</Link>
          </div>
        </section>
        <div className="auth-panel">
          <div className="auth-card auth-card--raised">
            <header className="auth-card__header">
              <span className="auth-card__badge">Khôi phục mật khẩu</span>
              <h2>Nhập email để nhận mã xác minh</h2>
              <p className="auth-card__hint">Chúng tôi sẽ gửi mã gồm 6 chữ số đến hộp thư của bạn.</p>
            </header>
            {error ? <p className="section-error">{error}</p> : null}
            {success ? <p className="section-success">{success}</p> : null}
            <form className="form auth-form" onSubmit={handleSubmit}>
              <label className="form__label">
                Email
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="ban@chotot.vn"
                />
              </label>
              <button className="primary-button auth-form__submit" type="submit" disabled={loading}>
                {loading ? 'Đang gửi mã...' : 'Gửi mã đặt lại'}
              </button>
            </form>
            <div className="auth-card__footer auth-card__footer--split">
              <Link href="/auth/login">Quay lại đăng nhập</Link>
              <Link href="/auth/reset">Đã có mã? Đặt lại ngay</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

