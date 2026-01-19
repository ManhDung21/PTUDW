'use client';

import { useEffect, useState } from 'react';

import { AddressForm } from '../components/AddressForm';
import { API_PREFIX, apiClient } from '../lib/api-client';
import { useAuth } from '../providers/AuthContext';

type Profile = {
  id: string;
  email?: string | null;
  phone_number?: string | null;
  full_name?: string | null;
  bio?: string | null;
};

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

export default function AccountPage() {
  const { user, refreshProfile } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);

  useEffect(() => {
    const fetchProfileAndAddresses = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const [profileRes, addressRes] = await Promise.all([
          apiClient.get(`${API_PREFIX}/users/me`),
          apiClient.get(`${API_PREFIX}/users/me/addresses`),
        ]);
        setProfile(profileRes.data);
        setAddresses(addressRes.data.items ?? []);
      } catch (err) {
        console.error(err);
        setError('Không thể tải thông tin tài khoản.');
      } finally {
        setLoading(false);
      }
    };
    void fetchProfileAndAddresses();
  }, [user]);

  const handleProfileUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) {
      return;
    }
    const form = new FormData(event.currentTarget);
    try {
      setError(null);
      await apiClient.put(`${API_PREFIX}/users/me`, {
        full_name: form.get('full_name') || null,
        bio: form.get('bio') || null,
        phone_number: form.get('phone_number') || null,
      });
      await refreshProfile();
    } catch (err) {
      console.error(err);
      setError('Không thể cập nhật thông tin.');
    }
  };

  const handleCreateAddress = async (payload: any) => {
    try {
      const { data } = await apiClient.post(`${API_PREFIX}/users/me/addresses`, payload);
      setAddresses((prev) => [data, ...prev]);
      setShowAddressForm(false);
    } catch (err) {
      console.error(err);
      setError('Không thể thêm địa chỉ.');
      throw err;
    }
  };

  const handleDeleteAddress = async (addressId: string) => {
    try {
      await apiClient.delete(`${API_PREFIX}/users/me/addresses/${addressId}`);
      setAddresses((prev) => prev.filter((item) => item._id !== addressId));
    } catch (err) {
      console.error(err);
      setError('Không thể xóa địa chỉ.');
    }
  };

  if (!user) {
    return <div className="page-container">Vui lòng đăng nhập.</div>;
  }

  const displayName = profile?.full_name?.trim() || profile?.email || user.email || 'Người dùng Chợ Tốt+';
  const addressCount = addresses.length;
  const defaultAddress = addresses.find((item) => item.is_default) ?? addresses[0] ?? null;

  return (
    <div className="page-container account-view">
      <section className="dashboard-hero dashboard-hero--account">
        <div className="dashboard-hero__content">
          <span className="dashboard-hero__badge">Bảng điều khiển cá nhân</span>
          <h1 className="dashboard-hero__title">Xin chào, {displayName}</h1>
          <p className="dashboard-hero__subtitle">
            Cập nhật hồ sơ, quản lý địa chỉ giao hàng và theo dõi thông tin liên hệ của bạn.
          </p>
          <div className="dashboard-hero__actions">
            <button type="button" className="secondary-button" onClick={() => setShowAddressForm(true)}>
              Thêm địa chỉ mới
            </button>
            <button type="button" className="dashboard-hero__link" onClick={() => setShowAddressForm((value) => !value)}>
              {showAddressForm ? 'Đóng biểu mẫu' : 'Mở biểu mẫu địa chỉ'}
            </button>
          </div>
        </div>
        <div className="dashboard-hero__stats">
          <div className="dashboard-hero__stat">
            <span className="dashboard-hero__stat-label">Tài khoản</span>
            <strong>{profile?.email ?? user.email}</strong>
            <span className="dashboard-hero__stat-sub">Email đăng nhập</span>
          </div>
          <div className="dashboard-hero__stat">
            <span className="dashboard-hero__stat-label">Số điện thoại</span>
            <strong>{profile?.phone_number || 'Chưa cập nhật'}</strong>
            <span className="dashboard-hero__stat-sub">Dễ dàng nhận thông báo</span>
          </div>
          <div className="dashboard-hero__stat">
            <span className="dashboard-hero__stat-label">Địa chỉ giao hàng</span>
            <strong>{addressCount}</strong>
            <span className="dashboard-hero__stat-sub">
              {defaultAddress ? `Mặc định: ${defaultAddress.recipient_name}` : 'Bổ sung địa chỉ để đặt hàng'}
            </span>
          </div>
        </div>
      </section>

      {loading ? <p className="section-hint">Đang tải thông tin tài khoản...</p> : null}
      {error ? <p className="section-error">{error}</p> : null}

      <div className="account-dashboard">
        <section className="account-card">
          <header className="account-card__header">
            <h2>Thông tin cá nhân</h2>
            <p className="account-card__hint">Cập nhật để người bán dễ liên lạc và giao hàng chính xác.</p>
          </header>
          {profile ? (
            <form className="form account-form" onSubmit={handleProfileUpdate}>
              <div className="form__row">
                <label className="form__label">
                  Họ và tên
                  <input type="text" name="full_name" defaultValue={profile.full_name ?? ''} placeholder="Nguyễn Văn A" />
                </label>
                <label className="form__label">
                  Số điện thoại
                  <input type="tel" name="phone_number" defaultValue={profile.phone_number ?? ''} placeholder="09xx xxx xxx" />
                </label>
              </div>
              <div className="form__row">
                <label className="form__label">
                  Email
                  <input type="email" defaultValue={profile.email ?? ''} disabled />
                </label>
              </div>
              <label className="form__label">
                Giới thiệu ngắn
                <textarea name="bio" rows={3} defaultValue={profile.bio ?? ''} placeholder="Chia sẻ đôi chút về bạn..." />
              </label>
              <div className="form__actions">
                <button className="primary-button account-form__submit" type="submit">
                  Lưu thay đổi
                </button>
              </div>
            </form>
          ) : null}
        </section>

        <section className="account-card">
          <header className="account-card__header account-card__header--row">
            <div>
              <h2>Địa chỉ giao hàng</h2>
              <p className="account-card__hint">Quản lý các địa chỉ nhận hàng để đặt đơn nhanh chóng.</p>
            </div>
            <button type="button" className="secondary-button" onClick={() => setShowAddressForm((value) => !value)}>
              {showAddressForm ? 'Đóng' : 'Thêm địa chỉ'}
            </button>
          </header>
          {showAddressForm ? <AddressForm onSubmit={handleCreateAddress} onCancel={() => setShowAddressForm(false)} /> : null}
          {addresses.length === 0 ? (
            <p className="section-hint">Chưa có địa chỉ nào. Hãy thêm địa chỉ mới để bắt đầu mua sắm.</p>
          ) : (
            <div className="address-board">
              {addresses.map((address) => (
                <div key={address._id} className={`address-card address-card--surface ${address.is_default ? 'is-active' : ''}`}>
                  <div className="address-card__body">
                    <div className="address-card__header">
                      <strong>{address.recipient_name}</strong>
                      {address.is_default ? <span className="chip">Mặc định</span> : null}
                    </div>
                    <p className="address-card__contact">{address.phone_number}</p>
                    <p className="address-card__text">
                      {address.address_line}, {address.ward}, {address.district}, {address.province}, {address.country}
                    </p>
                    <div className="address-card__actions">
                      <button type="button" className="link-button" onClick={() => handleDeleteAddress(address._id)}>
                        Xóa địa chỉ
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
