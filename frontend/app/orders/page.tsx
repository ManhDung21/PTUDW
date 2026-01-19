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

  const totalOrders = orders.length;
  const totalSpent = orders.reduce((sum, order) => sum + (order.total_amount ?? 0), 0);
  const formattedTotalSpent = totalSpent.toLocaleString('vi-VN');
  const inProgressOrders = orders.filter((order) => {
    const status = order.fulfillment_status?.toLowerCase() ?? '';
    return !['completed', 'delivered', 'hoan thanh', 'hoàn thành'].includes(status);
  }).length;
  const completedOrders = orders.filter((order) => {
    const status = order.fulfillment_status?.toLowerCase() ?? '';
    return ['completed', 'delivered', 'hoan thanh', 'hoàn thành'].includes(status);
  }).length;

  const formatStatusLabel = (status: string) => {
    const normalized = status ? status.toLowerCase() : '';
    if (['pending', 'processing', 'dang xu ly', 'đang xử lý'].includes(normalized)) {
      return 'Đang xử lý';
    }
    if (['shipping', 'shipped', 'đang giao', 'dang giao'].includes(normalized)) {
      return 'Đang giao';
    }
    if (['completed', 'delivered', 'hoan thanh', 'hoàn thành'].includes(normalized)) {
      return 'Hoàn thành';
    }
    if (['cancelled', 'canceled', 'da huy', 'đã hủy'].includes(normalized)) {
      return 'Đã hủy';
    }
    return status;
  };

  const getStatusTone = (status: string) => {
    const normalized = status ? status.toLowerCase() : '';
    if (['completed', 'delivered', 'hoan thanh', 'hoàn thành'].includes(normalized)) {
      return 'success';
    }
    if (['cancelled', 'canceled', 'da huy', 'đã hủy'].includes(normalized)) {
      return 'danger';
    }
    if (['shipping', 'shipped', 'đang giao', 'dang giao'].includes(normalized)) {
      return 'info';
    }
    return 'warning';
  };

  return (
    <div className="page-container orders-view">
      <section className="dashboard-hero dashboard-hero--orders">
        <div className="dashboard-hero__content">
          <span className="dashboard-hero__badge">Quản lý đơn hàng</span>
          <h1 className="dashboard-hero__title">Đơn hàng của bạn</h1>
          <p className="dashboard-hero__subtitle">
            Theo dõi trạng thái giao hàng, thanh toán và giá trị đơn mua chỉ trong một bảng điều khiển.
          </p>
          <div className="dashboard-hero__actions">
            <Link href="/store" className="secondary-button">
              Tiếp tục mua sắm
            </Link>
            <Link href="/cart" className="dashboard-hero__link">
              Xem giỏ hàng
            </Link>
          </div>
        </div>
        <div className="dashboard-hero__stats">
          <div className="dashboard-hero__stat">
            <span className="dashboard-hero__stat-label">Tổng đơn</span>
            <strong>{totalOrders}</strong>
            <span className="dashboard-hero__stat-sub">Trong toàn bộ thời gian</span>
          </div>
          <div className="dashboard-hero__stat">
            <span className="dashboard-hero__stat-label">Đang xử lý</span>
            <strong>{inProgressOrders}</strong>
            <span className="dashboard-hero__stat-sub">Chờ giao hoặc chờ xác nhận</span>
          </div>
          <div className="dashboard-hero__stat">
            <span className="dashboard-hero__stat-label">Hoàn tất</span>
            <strong>{completedOrders}</strong>
            <span className="dashboard-hero__stat-sub">Đã giao thành công</span>
          </div>
          <div className="dashboard-hero__stat">
            <span className="dashboard-hero__stat-label">Tổng chi tiêu</span>
            <strong>{formattedTotalSpent}đ</strong>
            <span className="dashboard-hero__stat-sub">Bao gồm phí và khuyến mãi</span>
          </div>
        </div>
      </section>

      {loading ? <p className="section-hint">Đang tải đơn hàng...</p> : null}
      {error ? <p className="section-error">{error}</p> : null}

      {!loading && orders.length === 0 ? (
        <div className="empty-state orders-empty">
          <strong>Bạn chưa có đơn hàng nào</strong>
          <p>Bắt đầu mua sắm để trải nghiệm giao diện đặt hàng mới của Chợ Tốt+.</p>
          <Link className="primary-button" href="/store">
            Khám phá sản phẩm nổi bật
          </Link>
        </div>
      ) : (
        <div className="order-table">
          <div className="order-table__header">
            <span>Mã đơn & thời gian</span>
            <span>Sản phẩm</span>
            <span>Trạng thái</span>
            <span>Tổng cộng</span>
            <span>Hành động</span>
          </div>
          <div className="order-table__body">
            {orders.map((order) => {
              const firstItems = order.items.slice(0, 2).map((item) => `${item.product_name} x${item.quantity}`);
              const remaining = order.items.length - firstItems.length;
              const itemsSummary = `${firstItems.join(', ')}${remaining > 0 ? ` +${remaining} sản phẩm` : ''}`;
              const statusLabel = formatStatusLabel(order.fulfillment_status);
              const paymentLabel = formatStatusLabel(order.payment_status);
              const statusTone = getStatusTone(order.fulfillment_status);

              return (
                <article key={order._id} className="order-table__row">
                  <div className="order-table__cell order-table__cell--code">
                    <strong>{order.order_code}</strong>
                    <span>{new Date(order.created_at).toLocaleString()}</span>
                  </div>
                  <div className="order-table__cell order-table__cell--items">
                    <span>{itemsSummary}</span>
                  </div>
                  <div className="order-table__cell order-table__cell--status">
                    <span className={`order-chip order-chip--${statusTone}`}>{statusLabel}</span>
                    <span className="order-chip order-chip--outline">Thanh toán: {paymentLabel}</span>
                  </div>
                  <div className="order-table__cell order-table__cell--total">
                    <strong>{order.total_amount.toLocaleString('vi-VN')}đ</strong>
                  </div>
                  <div className="order-table__cell order-table__cell--actions">
                    <Link href={`/orders/${order._id}`} className="order-table__link">
                      Theo dõi đơn
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
