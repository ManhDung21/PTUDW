'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { API_PREFIX, apiClient } from '../lib/api-client';
import { useAuth } from '../providers/AuthContext';

type OrderItem = {
  product_name: string;
  quantity: number;
  total_amount: number;
};

type Order = {
  _id: string;
  order_code: string;
  total_amount: number;
  payment_status: string;
  fulfillment_status: string;
  created_at: string;
  items: OrderItem[];
};

export default function OrdersPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    const fetchOrders = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const { data } = await apiClient.get(`${API_PREFIX}/orders`);
        setOrders(data.items ?? []);
      } catch (err) {
        console.error(err);
        setError('Không thể tải đơn hàng.');
      } finally {
        setLoading(false);
      }
    };
    void fetchOrders();
  }, [user]);

  if (!user) {
    return null;
  }

  return (
    <div className="page-container">
      <h1>Đơn hàng của tôi</h1>
      {loading ? <p className="section-hint">Đang tải đơn hàng...</p> : null}
      {error ? <p className="section-error">{error}</p> : null}
      {!loading && orders.length === 0 ? (
        <div className="empty-state">
          <p>Bạn chưa có đơn hàng nào.</p>
          <Link className="primary-button" href="/store">
            Bắt đầu mua sắm
          </Link>
        </div>
      ) : (
        <div className="order-list">
          {orders.map((order) => (
            <div key={order._id} className="order-card">
              <div className="order-card__header">
                <div>
                  <h2>{order.order_code}</h2>
                  <span>{new Date(order.created_at).toLocaleString()}</span>
                </div>
                <div className="order-card__status">
                  <span className="chip">Thanh toán: {order.payment_status}</span>
                  <span className="chip">Giao hàng: {order.fulfillment_status}</span>
                </div>
              </div>
              <ul className="order-card__items">
                {order.items.map((item, index) => (
                  <li key={`${order._id}-${index}`}>
                    <span>{item.product_name}</span>
                    <span>
                      {item.quantity} x {item.total_amount.toLocaleString('vi-VN')}đ
                    </span>
                  </li>
                ))}
              </ul>
              <div className="order-card__footer">
                <strong>Tổng: {order.total_amount.toLocaleString('vi-VN')}đ</strong>
                <Link href={`/orders/${order._id}`} className="link-button">
                  Xem chi tiết
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
