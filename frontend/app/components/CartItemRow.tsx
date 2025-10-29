'use client';

import Image from 'next/image';
import { useState } from 'react';

import { resolveMediaUrl } from '../lib/api-client';
import { CartItem, useCart } from '../providers/CartContext';

type Props = {
  item: CartItem;
};

export function CartItemRow({ item }: Props) {
  const { updateQuantity, removeItem } = useCart();
  const [quantity, setQuantity] = useState(item.quantity);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const thumbnail = resolveMediaUrl(item.thumbnail_url ?? null);

  const handleUpdate = async (value: number) => {
    setProcessing(true);
    setError(null);
    try {
      setQuantity(value);
      await updateQuantity(item.item_id, value);
    } catch (err) {
      console.error(err);
      setError('Không thể cập nhật số lượng.');
      setQuantity(item.quantity);
    } finally {
      setProcessing(false);
    }
  };

  const handleRemove = async () => {
    setProcessing(true);
    setError(null);
    try {
      await removeItem(item.item_id);
    } catch (err) {
      console.error(err);
      setError('Không thể xóa sản phẩm.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="cart-item">
      <div className="cart-item__media">
        {thumbnail ? (
          <Image src={thumbnail} alt={item.product_name} width={96} height={96} />
        ) : (
          <div className="cart-item__placeholder">No image</div>
        )}
      </div>
      <div className="cart-item__content">
        <h3 className="cart-item__title">{item.product_name}</h3>
        {item.variant_name ? <span className="cart-item__variant">{item.variant_name}</span> : null}
        {Object.keys(item.attributes ?? {}).length > 0 ? (
          <div className="cart-item__attributes">
            {Object.entries(item.attributes).map(([key, value]) => (
              <span key={key}>{`${key}: ${value}`}</span>
            ))}
          </div>
        ) : null}
        <div className="cart-item__controls">
          <label className="cart-item__quantity">
            Số lượng
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(event) => setQuantity(Math.max(1, Number(event.target.value)))}
              onBlur={() => handleUpdate(Math.max(1, quantity))}
              disabled={processing}
            />
          </label>
          <button type="button" className="secondary-button" onClick={handleRemove} disabled={processing}>
            Xóa
          </button>
        </div>
        <div className="cart-item__price">
          <span>{item.price.toLocaleString('vi-VN')}đ</span>
          <strong>{item.total_price.toLocaleString('vi-VN')}đ</strong>
        </div>
        {error ? <span className="cart-item__error">{error}</span> : null}
      </div>
    </div>
  );
}
