'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import type { AxiosError } from 'axios';

import { resolveMediaUrl } from '../lib/api-client';
import { useAuth } from '../providers/AuthContext';
import { useCart } from '../providers/CartContext';

export type ProductCardProps = {
  product: {
    _id: string;
    name: string;
    summary?: string | null;
    base_price: number;
    thumbnail_url?: string | null;
    image_urls?: string[];
    min_order_quantity?: number;
  };
};

export function ProductCard({ product }: ProductCardProps) {
  const { user } = useAuth();
  const { addToCart } = useCart();
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const thumbnail = resolveMediaUrl(product.thumbnail_url ?? product.image_urls?.[0] ?? null);

  const handleAddToCart = async () => {
    setMessage(null);
    setAdding(true);
    try {
      await addToCart(product._id, product.min_order_quantity ?? 1);
      setMessage('Added to cart');
    } catch (err) {
      if (err instanceof Error && err.message === 'AUTH_REQUIRED') {
        setMessage('Please log in to purchase');
      } else {
        const axiosErr = err as AxiosError<{ detail?: string }>;
        const detail = axiosErr.response?.data?.detail;
        if (typeof detail === 'string') {
          setMessage(detail);
        } else {
          setMessage('Unable to add product.');
        }
      }
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="product-card">
      <Link href={`/product/${product._id}`} className="product-card__media">
        {thumbnail ? (
          <Image src={thumbnail} alt={product.name} width={320} height={320} />
        ) : (
          <div className="product-card__placeholder">Không có ảnh</div>
        )}
      </Link>
      <div className="product-card__body">
        <Link href={`/product/${product._id}`} className="product-card__title">
          {product.name}
        </Link>
        {product.summary ? <p className="product-card__summary">{product.summary}</p> : null}
        <div className="product-card__footer">
          <span className="product-card__price">{product.base_price.toLocaleString('vi-VN')}đ</span>
          <button
            type="button"
            className="primary-button"
            onClick={handleAddToCart}
            disabled={adding}
          >
            {user ? (adding ? 'Đang thêm...' : 'Thêm vào giỏ') : 'Đăng nhập để mua'}
          </button>
        </div>
        {message ? <span className="product-card__message">{message}</span> : null}
      </div>
    </div>
  );
}
