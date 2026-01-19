'use client';

export function Footer() {
  return (
    <footer className="site-footer site-footer--enhanced">
      <div className="site-footer__inner">
        <div className="site-footer__brand">
          <span className="site-footer__logo">Fruitify Marketplace+</span>
          <p className="site-footer__description">
            Giải pháp tạo mô tả sản phẩm, đồng bộ đơn hàng và chăm sóc khách hàng cho nhà bán hàng hiện đại.
          </p>
          <div className="site-footer__cta">
            <a className="site-footer__cta-button" href="/ai">
              Khởi động với AI mô tả
            </a>
          </div>
        </div>
        <div className="site-footer__columns">
          <div className="site-footer__column">
            <h4>Điều hướng</h4>
            <nav>
              <a href="/" className="site-footer__link">
                Trang chủ
              </a>
              <a href="/store" className="site-footer__link">
                Sản phẩm
              </a>
              <a href="/orders" className="site-footer__link">
                Đơn hàng
              </a>
              <a href="/account" className="site-footer__link">
                Tài khoản
              </a>
            </nav>
          </div>
          <div className="site-footer__column">
            <h4>Hỗ trợ</h4>
            <nav>
              <a href="/auth/login" className="site-footer__link">
                Đăng nhập
              </a>
              <a href="/auth/register" className="site-footer__link">
                Đăng ký
              </a>
              <a href="/cart" className="site-footer__link">
                Giỏ hàng
              </a>
              <a href="/ai" className="site-footer__link">
                Trung tâm AI
              </a>
            </nav>
          </div>
        </div>
      </div>
      <div className="site-footer__meta">
        <span>© {new Date().getFullYear()} Fruitify Marketplace+. Đã đăng ký bản quyền.</span>
        <span>Thiết kế theo chuẩn Chợ Tốt+. Kết nối mọi nhà bán.</span>
      </div>
    </footer>
  );
}
