'use client';

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div>
          <strong>Fruitify</strong>
          <p>Tạo mô tả sản phẩm trái cây và quản lý đơn hàng toàn diện.</p>
        </div>
        <div className="site-footer__links">
          <a href="/" className="site-footer__link">
            Trang chủ
          </a>
          <a href="/orders" className="site-footer__link">
            Đơn hàng
          </a>
          <a href="/account" className="site-footer__link">
            Tài khoản
          </a>
        </div>
        <span className="site-footer__hint">© {new Date().getFullYear()} Fruitify. All rights reserved.</span>
      </div>
    </footer>
  );
}
