'use client';

import Link from 'next/link';
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
      setLocalError('Đăng nhập không thành công.');
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-layout">
        <section className="auth-hero">
          <span className="auth-hero__badge">Chợ Tốt+ Marketplace</span>
          <h1 className="auth-hero__title">Chào mừng trở lại</h1>
          <p className="auth-hero__subtitle">
            Kết nối nguồn hàng uy tín, theo dõi đơn và chăm sóc khách chỉ với một tài khoản duy nhất.
          </p>
          <ul className="auth-hero__list">
            <li>Đồng bộ giỏ hàng và lịch sử mua bán trên mọi thiết bị.</li>
            <li>Nhận thông báo đơn mới và ưu đãi tức thì.</li>
            <li>Gợi ý giá thông minh giúp chốt đơn nhanh hơn.</li>
          </ul>
          <div className="auth-hero__footer">
            <span>Chưa có tài khoản?</span>
            <Link href="/auth/register">Tạo tài khoản miễn phí</Link>
          </div>
        </section>
        <div className="auth-panel">
          <div className="auth-card auth-card--raised">
            <header className="auth-card__header">
              <span className="auth-card__badge">Đăng nhập</span>
              <h2>Tiếp tục hành trình mua bán</h2>
              <p className="auth-card__hint">Nhập email và mật khẩu để truy cập bảng điều khiển của bạn.</p>
            </header>
            {localError ? <p className="section-error">{localError}</p> : null}
            {error ? <p className="section-error">{error}</p> : null}
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
                Mật khẩu
                <input
                  type="password"
                  required
                  value={form.password}
                  onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                  placeholder="••••••"
                />
              </label>
              <div className="form__extras">
                <Link href="/auth/forgot">Quên mật khẩu?</Link>
              </div>
              <button className="primary-button auth-form__submit" type="submit" disabled={loading}>
                {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
              </button>
            </form>
            <div className="auth-card__footer">
              <span>Bạn mới tham gia?</span>
              <Link href="/auth/register">Đăng ký ngay</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
