'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { CartItemRow } from '../components/CartItemRow';
import { useAuth } from '../providers/AuthContext';
import { useCart } from '../providers/CartContext';

export default function CartPage() {
  const { user, loading: authLoading } = useAuth();
  const { cart, loading: cartLoading, error } = useCart();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
    }
  }, [authLoading, user, router]);

  if (authLoading || cartLoading) {
    return <div className="page-container">Đang tải giỏ hàng...</div>;
  }

  if (!user) {
    return null;
  }

  const totalItems = cart?.total_items ?? 0;
  const subtotal = cart?.subtotal ?? 0;
  const formattedSubtotal = subtotal.toLocaleString('vi-VN');

  return (
    <div className="page-container cart-view">
      <section className="commerce-hero commerce-hero--cart">
        <div className="commerce-hero__content">
          <span className="commerce-hero__badge">Bước 1</span>
          <h1 className="commerce-hero__title">Giỏ hàng của bạn</h1>
          <p className="commerce-hero__subtitle">
            Kiểm tra lại số lượng và ghi chú trước khi chuyển sang bước thanh toán.
          </p>
        </div>
        <div className="commerce-hero__meta">
          <div className="commerce-hero__stat">
            <span className="commerce-hero__stat-label">Sản phẩm</span>
            <strong>{totalItems}</strong>
          </div>
          <div className="commerce-hero__stat">
            <span className="commerce-hero__stat-label">Tạm tính</span>
            <strong>{formattedSubtotal}đ</strong>
          </div>
        </div>
      </section>
      <div className="cart-page">
        <section className="cart-page__content">
          <header className="cart-section__header">
            <div>
              <h2>Danh sách sản phẩm</h2>
              <p className="cart-section__hint">Chỉnh sửa số lượng hoặc để lại lời nhắn cho người bán nếu cần.</p>
            </div>
            <button type="button" className="cart-section__link" onClick={() => router.push('/store')}>
              Thêm sản phẩm khác
            </button>
          </header>
          {error ? <p className="section-error">{error}</p> : null}
          {!cart || cart.items.length === 0 ? (
            <div className="empty-state cart-empty">
              <strong>Giỏ hàng của bạn đang trống</strong>
              <p>Khám phá thêm sản phẩm và quay lại đây để hoàn tất đơn.</p>
              <a className="primary-button" href="/store">
                Tiếp tục mua sắm
              </a>
            </div>
          ) : (
            <div className="cart-list">
              {cart.items.map((item) => (
                <CartItemRow key={item.item_id} item={item} />
              ))}
            </div>
          )}
        </section>
        <aside className="cart-summary">
          <div className="cart-summary__card">
            <span className="cart-summary__badge">Tổng kết đơn</span>
            <h3 className="cart-summary__title">Sẵn sàng thanh toán</h3>
            <p className="cart-summary__subtitle">Kiểm tra lại chi tiết trước khi tiếp tục đến thanh toán.</p>
            <div className="cart-summary__grid">
              <div className="cart-summary__row">
                <span>Tổng sản phẩm</span>
                <strong>{totalItems}</strong>
              </div>
              <div className="cart-summary__row">
                <span>Tạm tính</span>
                <strong>{formattedSubtotal}đ</strong>
              </div>
            </div>
            <div className="cart-summary__actions">
              <button
                type="button"
                className="primary-button cart-summary__action"
                disabled={!cart || cart.items.length === 0}
                onClick={() => router.push('/checkout')}
              >
                Tiến hành đặt hàng
              </button>
              <a className="cart-summary__link" href="/store">
                Tiếp tục mua sắm
              </a>
            </div>
            <p className="cart-summary__note">Tài khoản của bạn sẽ được cập nhật trạng thái đơn ngay khi đặt hàng thành công.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
