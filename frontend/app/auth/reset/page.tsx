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
      <div className="auth-layout">
        <section className="auth-hero">
          <span className="auth-hero__badge">Hoàn tất khôi phục</span>
          <h1 className="auth-hero__title">Đặt lại mật khẩu mới</h1>
          <p className="auth-hero__subtitle">
            Nhập mã xác minh đã nhận cùng mật khẩu mới để tiếp tục sử dụng tài khoản Chợ Tốt+ của bạn.
          </p>
          <ul className="auth-hero__list">
            <li>Bảo vệ tài khoản bằng mật khẩu mạnh và duy nhất.</li>
            <li>Giữ thông tin đăng nhập an toàn, hạn chế chia sẻ.</li>
            <li>Trở lại quản lý đơn hàng và trò chuyện với khách ngay sau khi cập nhật.</li>
          </ul>
          <div className="auth-hero__footer">
            <span>Chưa nhận được mã?</span>
            <Link href="/auth/forgot">Gửi lại mã xác minh</Link>
          </div>
        </section>
        <div className="auth-panel">
          <div className="auth-card auth-card--raised">
            <header className="auth-card__header">
              <span className="auth-card__badge">Đặt lại mật khẩu</span>
              <h2>Xác nhận mã và tạo mật khẩu mới</h2>
              <p className="auth-card__hint">Kiểm tra email để lấy mã gồm 6 chữ số và nhập vào bên dưới.</p>
            </header>
            {error ? <p className="section-error">{error}</p> : null}
            {success ? <p className="section-success">{success}</p> : null}
            <form className="form auth-form" onSubmit={handleSubmit}>
              <label className="form__label">
                Email
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                  placeholder="ban@chotot.vn"
                />
              </label>
              <label className="form__label">
                Mã xác minh
                <input
                  type="text"
                  required
                  value={form.code}
                  onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))}
                  placeholder="Ví dụ: 123456"
                />
              </label>
              <label className="form__label">
                Mật khẩu mới
                <input
                  type="password"
                  required
                  minLength={6}
                  value={form.password}
                  onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                  placeholder="Tối thiểu 6 ký tự"
                />
              </label>
              <label className="form__label">
                Xác nhận mật khẩu
                <input
                  type="password"
                  required
                  minLength={6}
                  value={form.confirm}
                  onChange={(event) => setForm((prev) => ({ ...prev, confirm: event.target.value }))}
                  placeholder="Nhập lại mật khẩu"
                />
              </label>
              <button className="primary-button auth-form__submit" type="submit" disabled={loading}>
                {loading ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
              </button>
            </form>
            <div className="auth-card__footer auth-card__footer--split">
              <Link href="/auth/login">Quay lại đăng nhập</Link>
              <Link href="/auth/forgot">Cần gửi lại mã?</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

