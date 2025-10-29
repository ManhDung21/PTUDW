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

  return (
    <div className="page-container">
      <h1>Tài khoản của tôi</h1>
      {loading ? <p className="section-hint">Đang tải...</p> : null}
      {error ? <p className="section-error">{error}</p> : null}
      <div className="account-page">
        <section className="account-section">
          <h2>Thông tin cá nhân</h2>
          {profile ? (
            <form className="form" onSubmit={handleProfileUpdate}>
              <label className="form__label">
                Họ và tên
                <input type="text" name="full_name" defaultValue={profile.full_name ?? ''} />
              </label>
              <label className="form__label">
                Email
                <input type="email" defaultValue={profile.email ?? ''} disabled />
              </label>
              <label className="form__label">
                Số điện thoại
                <input type="tel" name="phone_number" defaultValue={profile.phone_number ?? ''} />
              </label>
              <label className="form__label">
                Giới thiệu
                <textarea name="bio" rows={3} defaultValue={profile.bio ?? ''} />
              </label>
              <div className="form__actions">
                <button className="primary-button" type="submit">
                  Cập nhật
                </button>
              </div>
            </form>
          ) : null}
        </section>
        <section className="account-section">
          <div className="address-section__header">
            <h2>Địa chỉ giao hàng</h2>
            <button type="button" className="secondary-button" onClick={() => setShowAddressForm((value) => !value)}>
              {showAddressForm ? 'Đóng' : 'Thêm địa chỉ'}
            </button>
          </div>
          {showAddressForm ? <AddressForm onSubmit={handleCreateAddress} onCancel={() => setShowAddressForm(false)} /> : null}
          {addresses.length === 0 ? (
            <p className="section-hint">Chưa có địa chỉ nào.</p>
          ) : (
            <div className="address-list">
              {addresses.map((address) => (
                <div key={address._id} className={`address-card ${address.is_default ? 'is-active' : ''}`}>
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
                      <button type="button" className="link-button" onClick={() => handleDeleteAddress(address._id)}>
                        Xóa
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
