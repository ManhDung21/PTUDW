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

  if (!user) {
    return null;
  }

  return (
    <div className="page-container">
      <div className="checkout-page">
        <div className="checkout-page__main">
          <h1>Thanh toán</h1>
          {error ? <p className="section-error">{error}</p> : null}
          {success ? <p className="section-success">{success}</p> : null}
          <section className="address-section">
            <div className="address-section__header">
              <h2>Địa chỉ giao hàng</h2>
              <button type="button" className="secondary-button" onClick={() => setCreatingAddress((value) => !value)}>
                {creatingAddress ? 'Đóng' : 'Thêm địa chỉ mới'}
              </button>
            </div>
            {creatingAddress ? <AddressForm onSubmit={handleCreateAddress} onCancel={() => setCreatingAddress(false)} /> : null}
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
          <section className="note-section">
            <h2>Ghi chú</h2>
            <textarea
              placeholder="Hướng dẫn giao hàng, thời gian nhận hàng..."
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </section>
        </div>
        <aside className="checkout-summary">
          <div className="checkout-summary__card">
            <h2>Đơn hàng</h2>
            <div className="checkout-summary__row">
              <span>Tạm tính</span>
              <span>{totalAmount.toLocaleString('vi-VN')}đ</span>
            </div>
            <div className="checkout-summary__row">
              <span>Phí vận chuyển</span>
              <span>0đ</span>
            </div>
            <div className="checkout-summary__row checkout-summary__row--total">
              <span>Thành tiền</span>
              <strong>{totalAmount.toLocaleString('vi-VN')}đ</strong>
            </div>
            <button type="button" className="primary-button w-100" disabled={!cart || cart.items.length === 0} onClick={handleCheckout}>
              Đặt hàng
            </button>
            <p className="section-hint">Phương thức thanh toán: Thanh toán khi nhận hàng (COD)</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
