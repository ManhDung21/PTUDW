'use client';

import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { API_PREFIX, apiClient, resolveMediaUrl } from '../../lib/api-client';
import { useAuth } from '../../providers/AuthContext';
import { useCart } from '../../providers/CartContext';

type Variant = {
  _id: string;
  sku?: string;
  attributes?: Record<string, string>;
  price: number;
  stock_quantity?: number;
};

type Product = {
  _id: string;
  name: string;
  summary?: string;
  description_custom?: string;
  base_price: number;
  image_urls?: string[];
  thumbnail_url?: string;
  variants?: Variant[];
  seller_id?: string;
  media?: Array<{ url?: string }>;
};

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { addToCart } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const fetchProduct = async () => {
      try {
        setLoading(true);
        const { data } = await apiClient.get(`${API_PREFIX}/catalog/products/${params.id}`);
        if (active) {
          setProduct(data);
          setSelectedVariantId(data?.variants?.[0]?._id ?? null);
        }
      } catch (err) {
        console.error(err);
        setError('Không tìm thấy sản phẩm.');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    if (params.id) {
      void fetchProduct();
    }
    return () => {
      active = false;
    };
  }, [params.id]);

  const gallery = useMemo(() => {
    if (!product) {
      return [] as string[];
    }
    const sources = new Set<string>();
    if (product.thumbnail_url) {
      sources.add(product.thumbnail_url);
    }
    (product.image_urls ?? []).forEach((url) => {
      if (url) {
        sources.add(url);
      }
    });
    (product.media ?? []).forEach((item) => {
      if (item?.url) {
        sources.add(item.url);
      }
    });
    return Array.from(sources).map((url) => resolveMediaUrl(url) ?? '').filter(Boolean);
  }, [product]);

  const activeVariant = useMemo(() => {
    if (!selectedVariantId) {
      return null;
    }
    return product?.variants?.find((variant) => variant._id === selectedVariantId) ?? null;
  }, [product, selectedVariantId]);

  const displayPrice = activeVariant?.price ?? product?.base_price ?? 0;

  const handleAddToCart = async () => {
    if (!product) {
      return;
    }
    setFeedback(null);
    try {
      await addToCart(product._id, quantity, selectedVariantId);
      setFeedback('Đã thêm sản phẩm vào giỏ hàng.');
    } catch (err) {
      if (err instanceof Error && err.message === 'AUTH_REQUIRED') {
        setFeedback('Vui lòng đăng nhập để mua hàng.');
        router.push('/auth/login');
      } else {
        setFeedback('Không thể thêm sản phẩm.');
      }
    }
  };

  if (!product) {
    return <div className="page-container">{loading ? 'Đang tải sản phẩm...' : error}</div>;
  }

  return (
    <div className="page-container">
      <div className="product-detail">
        <div className="product-detail__gallery">
          {gallery.length ? (
            gallery.map((url) => (
              <div key={url} className="product-detail__image">
                <Image src={url} alt={product.name} fill sizes="(max-width: 768px) 100vw, 480px" />
              </div>
            ))
          ) : (
            <div className="product-detail__placeholder">Không có hình ảnh</div>
          )}
        </div>
        <div className="product-detail__info">
          <h1>{product.name}</h1>
          {product.summary ? <p className="product-detail__summary">{product.summary}</p> : null}
          <div className="product-detail__price">{displayPrice.toLocaleString('vi-VN')}đ</div>
          {product.variants && product.variants.length > 0 ? (
            <div className="product-detail__variants">
              <h4>Chọn biến thể</h4>
              <div className="variant-grid">
                {product.variants.map((variant) => (
                  <button
                    key={variant._id}
                    type="button"
                    className={`variant-chip ${selectedVariantId === variant._id ? 'is-active' : ''}`}
                    onClick={() => setSelectedVariantId(variant._id)}
                  >
                    {variant.sku || Object.values(variant.attributes ?? {}).join(', ') || 'Biến thể'}
                    {variant.stock_quantity !== undefined ? ` • ${variant.stock_quantity} sp` : ''}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="product-detail__actions">
            <label className="product-detail__quantity">
              Số lượng
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(event) => setQuantity(Math.max(1, Number(event.target.value)))}
              />
            </label>
            <button type="button" className="primary-button" onClick={handleAddToCart}>
              {user ? 'Thêm vào giỏ' : 'Đăng nhập để mua'}
            </button>
          </div>
          {feedback ? <span className="product-detail__feedback">{feedback}</span> : null}
          {product.description_custom ? (
            <div className="product-detail__description">
              <h4>Chi tiết sản phẩm</h4>
              <p>{product.description_custom}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
