'use client';

import Link from 'next/link';
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
      setLocalError('Đăng ký không thành công.');
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-layout">
        <section className="auth-hero">
          <span className="auth-hero__badge">Gia nhập nhà bán Chợ Tốt+</span>
          <h1 className="auth-hero__title">Tạo tài khoản trong 60 giây</h1>
          <p className="auth-hero__subtitle">
            Đăng ký miễn phí để đăng tin, quản lý đơn và nhận báo cáo doanh thu mọi lúc mọi nơi.
          </p>
          <ul className="auth-hero__list">
            <li>Bảng điều khiển trực quan giúp theo dõi doanh thu theo ngày.</li>
            <li>Đồng bộ sản phẩm, tin đăng và khách hàng trên đa nền tảng.</li>
            <li>Nhận hỗ trợ ưu tiên từ đội ngũ Chợ Tốt+ khi có vấn đề.</li>
          </ul>
          <div className="auth-hero__footer">
            <span>Đã có tài khoản?</span>
            <Link href="/auth/login">Đăng nhập ngay</Link>
          </div>
        </section>
        <div className="auth-panel">
          <div className="auth-card auth-card--raised">
            <header className="auth-card__header">
              <span className="auth-card__badge">Đăng ký</span>
              <h2>Mở khóa trải nghiệm mua bán chuyên nghiệp</h2>
              <p className="auth-card__hint">Điền thông tin cơ bản để bắt đầu xây dựng gian hàng của bạn.</p>
            </header>
            {localError ? <p className="section-error">{localError}</p> : null}
            {error ? <p className="section-error">{error}</p> : null}
            <form className="form auth-form" onSubmit={handleSubmit}>
              <label className="form__label">
                Họ và tên (không bắt buộc)
                <input
                  type="text"
                  value={form.full_name}
                  onChange={(event) => setForm((prev) => ({ ...prev, full_name: event.target.value }))}
                  placeholder="Nguyễn Văn A"
                />
              </label>
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
                  minLength={6}
                  value={form.password}
                  onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                  placeholder="Tối thiểu 6 ký tự"
                />
              </label>
              <button className="primary-button auth-form__submit" type="submit" disabled={loading}>
                {loading ? 'Đang tạo tài khoản...' : 'Tạo tài khoản'}
              </button>
            </form>
            <div className="auth-card__footer">
              <span>Đã có tài khoản?</span>
              <Link href="/auth/login">Đăng nhập</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
