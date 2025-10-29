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

  return (
    <div className="page-container">
      <div className="cart-page">
        <div className="cart-page__content">
          <h1>Giỏ hàng của bạn</h1>
          {error ? <p className="section-error">{error}</p> : null}
          {!cart || cart.items.length === 0 ? (
            <div className="empty-state">
              <p>Giỏ hàng đang trống.</p>
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
        </div>
        <aside className="cart-summary">
          <div className="cart-summary__card">
            <h2>Tổng kết</h2>
            <div className="cart-summary__row">
              <span>Tổng sản phẩm</span>
              <span>{cart?.total_items ?? 0}</span>
            </div>
            <div className="cart-summary__row cart-summary__row--total">
              <span>Tạm tính</span>
              <strong>{(cart?.subtotal ?? 0).toLocaleString('vi-VN')}đ</strong>
            </div>
            <button
              type="button"
              className="primary-button w-100"
              disabled={!cart || cart.items.length === 0}
              onClick={() => router.push('/checkout')}
            >
              Tiến hành đặt hàng
            </button>
            <a className="secondary-button w-100" href="/store">
              Tiếp tục mua sắm
            </a>
          </div>
        </aside>
      </div>
    </div>
  );
}
