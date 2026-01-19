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
  const [activeImage, setActiveImage] = useState<string | null>(null);

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

  useEffect(() => {
    if (gallery.length) {
      setActiveImage((current) => (current && gallery.includes(current) ? current : gallery[0]));
    } else {
      setActiveImage(null);
    }
  }, [gallery]);

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
      <div className="listing-detail">
        <div className="listing-detail__media">
          <div className="listing-detail__main">
            {activeImage ? (
              <Image src={activeImage} alt={product.name} fill sizes="(max-width: 768px) 100vw, 560px" />
            ) : (
              <div className="listing-detail__placeholder">Không có hình ảnh</div>
            )}
          </div>
          {gallery.length > 1 ? (
            <div className="listing-detail__thumbs">
              {gallery.map((url, index) => (
                <button
                  key={url}
                  type="button"
                  className={`listing-detail__thumb ${activeImage === url ? 'is-active' : ''}`}
                  onClick={() => setActiveImage(url)}
                  aria-label={`Chọn hình ảnh ${index + 1}`}
                >
                  <span className="listing-detail__thumb-image">
                    <Image src={url} alt={product.name} fill sizes="80px" />
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="listing-detail__aside">
          <div className="listing-detail__header">
            <span className="listing-detail__badge">Tin nổi bật</span>
            <h1>{product.name}</h1>
            {product.summary ? <p className="listing-detail__summary">{product.summary}</p> : null}
          </div>
          <div className="listing-detail__panel">
            <div className="listing-detail__pricing">
              <span className="listing-detail__price">{displayPrice.toLocaleString('vi-VN')}đ</span>
              <span className="listing-detail__status">Còn hàng</span>
            </div>
            <div className="listing-detail__stats">
              <span>{gallery.length} hình ảnh</span>
              {product.variants?.length ? <span>{product.variants.length} lựa chọn</span> : null}
            </div>
            {product.variants && product.variants.length > 0 ? (
              <div className="listing-detail__section">
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
            <div className="listing-detail__section listing-detail__quantity">
              <label htmlFor="listing-quantity">Số lượng</label>
              <div className="listing-detail__quantity-control">
                <input
                  id="listing-quantity"
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(event) => setQuantity(Math.max(1, Number(event.target.value)))}
                />
                <button type="button" className="primary-button" onClick={handleAddToCart}>
                  {user ? 'Thêm vào giỏ hàng' : 'Đăng nhập để mua'}
                </button>
              </div>
            </div>
            {feedback ? <div className="listing-detail__feedback">{feedback}</div> : null}
          </div>
          {product.description_custom ? (
            <div className="listing-detail__description">
              <h3>Chi tiết sản phẩm</h3>
              <p>{product.description_custom}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
