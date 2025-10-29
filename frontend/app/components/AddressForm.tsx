'use client';

import { useState } from 'react';

type AddressPayload = {
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

type Props = {
  initialValues?: Partial<AddressPayload>;
  onSubmit: (payload: AddressPayload) => Promise<void>;
  onCancel?: () => void;
};

export function AddressForm({ initialValues, onSubmit, onCancel }: Props) {
  const [form, setForm] = useState<AddressPayload>({
    label: initialValues?.label ?? '',
    recipient_name: initialValues?.recipient_name ?? '',
    phone_number: initialValues?.phone_number ?? '',
    address_line: initialValues?.address_line ?? '',
    ward: initialValues?.ward ?? '',
    district: initialValues?.district ?? '',
    province: initialValues?.province ?? '',
    postal_code: initialValues?.postal_code ?? '',
    country: initialValues?.country ?? 'Việt Nam',
    is_default: initialValues?.is_default ?? false,
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (field: keyof AddressPayload, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(form);
    } catch (err) {
      console.error(err);
      setError('Không thể lưu địa chỉ.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="form__row">
        <label className="form__label">
          Tên địa chỉ
          <input
            type="text"
            value={form.label ?? ''}
            onChange={(event) => handleChange('label', event.target.value)}
          />
        </label>
        <label className="form__label">
          Người nhận*
          <input
            type="text"
            required
            value={form.recipient_name}
            onChange={(event) => handleChange('recipient_name', event.target.value)}
          />
        </label>
      </div>
      <div className="form__row">
        <label className="form__label">
          Số điện thoại*
          <input
            type="tel"
            required
            pattern="^[0-9]{10,11}$"
            value={form.phone_number}
            onChange={(event) => handleChange('phone_number', event.target.value)}
          />
        </label>
        <label className="form__label">
          Quốc gia
          <input
            type="text"
            value={form.country ?? ''}
            onChange={(event) => handleChange('country', event.target.value)}
          />
        </label>
      </div>
      <label className="form__label">
        Địa chỉ*
        <input
          type="text"
          required
          value={form.address_line}
          onChange={(event) => handleChange('address_line', event.target.value)}
        />
      </label>
      <div className="form__row">
        <label className="form__label">
          Phường/Xã
          <input type="text" value={form.ward ?? ''} onChange={(event) => handleChange('ward', event.target.value)} />
        </label>
        <label className="form__label">
          Quận/Huyện
          <input
            type="text"
            value={form.district ?? ''}
            onChange={(event) => handleChange('district', event.target.value)}
          />
        </label>
        <label className="form__label">
          Tỉnh/Thành phố
          <input
            type="text"
            value={form.province ?? ''}
            onChange={(event) => handleChange('province', event.target.value)}
          />
        </label>
      </div>
      <div className="form__row">
        <label className="form__label">
          Mã bưu điện
          <input
            type="text"
            value={form.postal_code ?? ''}
            onChange={(event) => handleChange('postal_code', event.target.value)}
          />
        </label>
        <label className="form__checkbox">
          <input
            type="checkbox"
            checked={!!form.is_default}
            onChange={(event) => handleChange('is_default', event.target.checked)}
          />
          Đặt làm địa chỉ mặc định
        </label>
      </div>
      {error ? <span className="form__error">{error}</span> : null}
      <div className="form__actions">
        <button className="primary-button" type="submit" disabled={submitting}>
          {submitting ? 'Đang lưu...' : 'Lưu địa chỉ'}
        </button>
        {onCancel ? (
          <button className="secondary-button" type="button" onClick={onCancel}>
            Hủy
          </button>
        ) : null}
      </div>
    </form>
  );
}
