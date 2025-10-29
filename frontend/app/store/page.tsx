'use client';

import { useEffect, useMemo, useState } from 'react';

import { ProductCard } from '../components/ProductCard';
import { API_PREFIX, apiClient } from '../lib/api-client';
import { useAuth } from '../providers/AuthContext';

type Category = {
  _id: string;
  name: string;
  slug?: string;
};

type Product = {
  _id: string;
  name: string;
  summary?: string | null;
  base_price: number;
  thumbnail_url?: string | null;
  image_urls?: string[];
  min_order_quantity?: number;
};

export default function StorePage() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const { data } = await apiClient.get(`${API_PREFIX}/catalog/categories`);
        setCategories(data ?? []);
      } catch (err) {
        console.error(err);
      }
    };
    void loadCategories();
  }, []);

  useEffect(() => {
    let active = true;
    const fetchProducts = async () => {
      try {
        setLoading(true);
        setError(null);
        const params: Record<string, unknown> = {
          limit: 12,
          status_filter: 'active',
        };
        if (selectedCategory) {
          params.category_ids = [selectedCategory];
        }
        if (keyword.trim()) {
          params.keyword = keyword.trim();
        }
        const { data } = await apiClient.get(`${API_PREFIX}/catalog/products`, { params });
        if (active) {
          setProducts(data?.items ?? []);
        }
      } catch (err) {
        console.error(err);
        if (active) {
          setError('Không thể tải danh sách sản phẩm.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    void fetchProducts();
    return () => {
      active = false;
    };
  }, [keyword, selectedCategory]);

  const greeting = useMemo(() => {
    if (!user) {
      return 'Khám phá những loại trái cây tươi ngon, được cập nhật mỗi ngày.';
    }
    return `Chào ${user.full_name || user.email || user.phone_number}, hãy chọn những sản phẩm tốt nhất cho giỏ hàng của bạn.`;
  }, [user]);

  return (
    <div className="store-page">
      <section className="store-hero">
        <div className="store-hero__content">
          <span className="store-hero__badge">Trái cây tươi sạch</span>
          <h1>Trải nghiệm mua sắm trái cây thông minh</h1>
          <p>{greeting}</p>
          <div className="store-search">
            <input
              type="search"
              placeholder="Tìm kiếm sản phẩm, ví dụ: Cam Mỹ, Táo đỏ, Dưa lưới..."
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
          </div>
        </div>
        <div className="store-hero__stats">
          <div>
            <strong>{categories.length}</strong>
            <span>Danh mục</span>
          </div>
          <div>
            <strong>{products.length}</strong>
            <span>Sản phẩm nổi bật</span>
          </div>
          <div>
            <strong>24/7</strong>
            <span>Hỗ trợ khách hàng</span>
          </div>
        </div>
      </section>

      <section className="category-filter">
        <button
          type="button"
          className={`category-chip ${selectedCategory === null ? 'is-active' : ''}`}
          onClick={() => setSelectedCategory(null)}
        >
          Tất cả
        </button>
        {categories.map((category) => (
          <button
            type="button"
            key={category._id}
            className={`category-chip ${selectedCategory === category._id ? 'is-active' : ''}`}
            onClick={() => setSelectedCategory((current) => (current === category._id ? null : category._id))}
          >
            {category.name}
          </button>
        ))}
      </section>

      <section className="product-section">
        <div className="product-section__header">
          <h2>Sản phẩm nổi bật</h2>
          <p>Chọn mua trái cây tươi nhập khẩu, chính hãng từ nhà vườn uy tín.</p>
        </div>
        {error ? <p className="section-error">{error}</p> : null}
        {loading ? <p className="section-hint">Đang tải sản phẩm...</p> : null}
        {!loading && !products.length ? (
          <p className="section-hint">Chưa có sản phẩm nào phù hợp.</p>
        ) : (
          <div className="product-grid">
            {products.map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
        )}
      </section>

      <section className="cta-section">
        <div className="cta-card">
          <h3>Tăng tốc nội dung bán hàng với AI</h3>
          <p>
            Tự động tạo mô tả sản phẩm trái cây theo nhiều phong cách chỉ với vài thao tác đơn giản. Giúp gian hàng
            nổi bật và tiết kiệm thời gian.
          </p>
          <a className="primary-button" href="/ai">
            Khám phá trình tạo mô tả
          </a>
        </div>
      </section>
    </div>
  );
}
