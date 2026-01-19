'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AxiosError } from 'axios';

import { AddressForm } from '../components/AddressForm';
import { API_PREFIX, apiClient } from '../lib/api-client';
import { useAuth } from '../providers/AuthContext';
import { useCart } from '../providers/CartContext';

type Address = {
  _id: string;
  label?: string;
  recipient_name: string;
  phone_number: string;
  address_line: string;
  ward?: string;
  district?: string;
  province?: string;
  postal_code?: string;
  country?: string;
  is_default?: boolean;
};

export default function CheckoutPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { cart, refreshCart } = useCart();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [creatingAddress, setCreatingAddress] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    const fetchAddresses = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const { data } = await apiClient.get(`${API_PREFIX}/users/me/addresses`);
        setAddresses(data.items ?? []);
        const defaultAddress = data.items?.find((item: Address) => item.is_default) ?? data.items?.[0] ?? null;
        setSelectedAddressId(defaultAddress?._id ?? null);
      } catch (err) {
        console.error(err);
        setError('Unable to load addresses.');
      } finally {
        setLoading(false);
      }
    };
    void fetchAddresses();
  }, [user]);

  const handleCreateAddress = async (payload: any) => {
    setError(null);
    try {
      const { data } = await apiClient.post(`${API_PREFIX}/users/me/addresses`, payload);
      setAddresses((prev) => [data, ...prev]);
      setSelectedAddressId(data._id);
      setCreatingAddress(false);
    } catch (err) {
      console.error(err);
      const axiosErr = err as AxiosError<{ detail?: string }>;
      const detail = axiosErr.response?.data?.detail;
      if (typeof detail === 'string') {
        setError(detail);
      } else {
        setError('Unable to create a new address.');
      }
      throw err;
    }
  };

  const handleSetDefault = async (addressId: string) => {
    try {
      const { data } = await apiClient.post(`${API_PREFIX}/users/me/addresses/${addressId}/default`);
      setAddresses((prev) => prev.map((address) => ({ ...address, is_default: address._id === data._id })));
      setSelectedAddressId(addressId);
    } catch (err) {
      console.error(err);
      setError('Unable to set as default.');
    }
  };

  const handleCheckout = async () => {
    if (!selectedAddressId) {
      setError('Please select a shipping address.');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const { data } = await apiClient.post(`${API_PREFIX}/orders/checkout`, {
        address_id: selectedAddressId,
        payment_method: 'cod',
        note: note.trim() || null,
      });
      setSuccess(`Order placed successfully. Code: ${data.order_code}`);
      await refreshCart();
      router.push('/orders');
    } catch (err) {
      console.error(err);
      const axiosErr = err as AxiosError<{ detail?: string }>;
      const detail = axiosErr.response?.data?.detail;
      if (typeof detail === 'string') {
        setError(detail);
      } else {
        setError('Unable to place order.');
      }
    } finally {
      setLoading(false);
    }
  };
  const totalAmount = useMemo(() => cart?.subtotal ?? 0, [cart]);
  const totalItems = cart?.total_items ?? 0;
  const formattedTotal = totalAmount.toLocaleString('vi-VN');

  if (!user) {
    return null;
  }

  return (
    <div className="page-container checkout-view">
      <section className="commerce-hero commerce-hero--checkout">
        <div className="commerce-hero__content">
          <span className="commerce-hero__badge">Bước 2</span>
          <h1 className="commerce-hero__title">Thanh toán & giao nhận</h1>
          <p className="commerce-hero__subtitle">
            Hoàn tất thông tin giao hàng và kiểm tra giá trị đơn để đặt hàng thành công.
          </p>
          <ul className="commerce-hero__steps">
            <li className="is-complete">Giỏ hàng</li>
            <li className="is-active">Thông tin giao hàng</li>
            <li>Hoàn tất</li>
          </ul>
        </div>
        <div className="commerce-hero__meta">
          <div className="commerce-hero__stat">
            <span className="commerce-hero__stat-label">Sản phẩm</span>
            <strong>{totalItems}</strong>
          </div>
          <div className="commerce-hero__stat">
            <span className="commerce-hero__stat-label">Thành tiền</span>
            <strong>{formattedTotal}đ</strong>
          </div>
        </div>
      </section>
      <div className="checkout-page">
        <div className="checkout-page__main">
          <header className="checkout-section__header">
            <div>
              <h2>Thông tin giao hàng</h2>
              <p className="checkout-section__hint">Chọn địa chỉ nhận hàng hoặc tạo mới để đảm bảo giao đúng nơi.</p>
            </div>
            <button type="button" className="checkout-section__link" onClick={() => setCreatingAddress((value) => !value)}>
              {creatingAddress ? 'Đóng biểu mẫu' : 'Thêm địa chỉ mới'}
            </button>
          </header>
          {error ? <p className="section-error">{error}</p> : null}
          {success ? <p className="section-success">{success}</p> : null}
          {creatingAddress ? <AddressForm onSubmit={handleCreateAddress} onCancel={() => setCreatingAddress(false)} /> : null}
          <section className="checkout-section checkout-section--addresses">
            {loading ? (
              <p className="section-hint">Đang tải địa chỉ...</p>
            ) : addresses.length === 0 ? (
              <p className="section-hint">Bạn chưa có địa chỉ giao hàng.</p>
            ) : (
              <div className="address-list">
                {addresses.map((address) => (
                  <label key={address._id} className={`address-card ${selectedAddressId === address._id ? 'is-active' : ''}`}>
                    <input
                      type="radio"
                      name="address"
                      checked={selectedAddressId === address._id}
                      onChange={() => setSelectedAddressId(address._id)}
                    />
                    <div className="address-card__body">
                      <div className="address-card__header">
                        <strong>{address.recipient_name}</strong>
                        {address.is_default ? <span className="chip">Mặc định</span> : null}
                      </div>
                      <p>{address.phone_number}</p>
                      <p>
                        {address.address_line}, {address.ward}, {address.district}, {address.province}, {address.country}
                      </p>
                      <div className="address-card__actions">
                        {!address.is_default ? (
                          <button type="button" className="link-button" onClick={() => handleSetDefault(address._id)}>
                            Đặt làm mặc định
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </section>
          <section className="checkout-section checkout-section--note">
            <h3>Ghi chú cho người giao hàng</h3>
            <p className="checkout-section__hint">Ví dụ: giờ nhận hàng thuận tiện, hướng dẫn bảo vệ sản phẩm.</p>
            <textarea
              placeholder="Hướng dẫn giao hàng, thời gian nhận hàng..."
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </section>
        </div>
        <aside className="checkout-summary">
          <div className="checkout-summary__card">
            <span className="checkout-summary__badge">Đơn hàng của bạn</span>
            <h3 className="checkout-summary__title">Tổng tiền cần thanh toán</h3>
            <div className="checkout-summary__grid">
              <div className="checkout-summary__row">
                <span>Tạm tính</span>
                <strong>{formattedTotal}đ</strong>
              </div>
              <div className="checkout-summary__row">
                <span>Phí vận chuyển</span>
                <strong>0đ</strong>
              </div>
              <div className="checkout-summary__row checkout-summary__row--total">
                <span>Thành tiền</span>
                <strong>{formattedTotal}đ</strong>
              </div>
            </div>
            <div className="checkout-summary__actions">
              <button
                type="button"
                className="primary-button checkout-summary__action"
                disabled={!cart || cart.items.length === 0}
                onClick={handleCheckout}
              >
                Đặt hàng ngay
              </button>
              <p className="checkout-summary__note">Thanh toán khi nhận hàng (COD) – bạn chỉ trả khi đơn được giao đến.</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
