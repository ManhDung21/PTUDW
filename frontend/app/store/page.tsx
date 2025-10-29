'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [keywordDraft, setKeywordDraft] = useState('');
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
    const keywordParam = searchParams.get('keyword') ?? searchParams.get('q') ?? '';
    const categoryParam = searchParams.get('category');
    setKeyword(keywordParam);
    setKeywordDraft(keywordParam);
    setSelectedCategory(categoryParam && categoryParam.length ? categoryParam : null);
  }, [searchParams]);

  useEffect(() => {
    let active = true;
    const fetchProducts = async () => {
      try {
        setLoading(true);
        setError(null);
        const params: Record<string, unknown> = {
          limit: 16,
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

  const updateSearchParams = (nextKeyword: string, nextCategory: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextKeyword) {
      params.set('keyword', nextKeyword);
    } else {
      params.delete('keyword');
    }
    if (nextCategory) {
      params.set('category', nextCategory);
    } else {
      params.delete('category');
    }
    const query = params.toString();
    router.push(`/store${query ? `?${query}` : ''}`, { scroll: false });
  };

  const handleKeywordSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = keywordDraft.trim();
    setKeyword(value);
    updateSearchParams(value, selectedCategory);
  };

  const handleSelectCategory = (categoryId: string | null) => {
    setSelectedCategory(categoryId);
    updateSearchParams(keyword.trim(), categoryId);
  };

  const greeting = useMemo(() => {
    if (!user) {
      return 'Tìm kiếm mọi loại trái cây, thực phẩm sạch từ nhà vườn uy tín.';
    }
    return `Xin chào ${user.full_name || user.email || user.phone_number}, chọn ngay những sản phẩm phù hợp nhất cho gia đình bạn.`;
  }, [user]);

  const quickCategories = useMemo(() => categories.slice(0, 4), [categories]);

  return (
    <div className="marketplace">
      <section className="marketplace-hero">
        <div className="marketplace-hero__info">
          <h1>Chợ trái cây mỗi ngày</h1>
          <p>{greeting}</p>
          <form className="marketplace-hero__search" onSubmit={handleKeywordSubmit} role="search">
            <input
              type="search"
              placeholder="Tìm kiếm: Táo Envy, Cam Mỹ, Bưởi da xanh..."
              value={keywordDraft}
              onChange={(event) => setKeywordDraft(event.target.value)}
            />
            <button type="submit">Tìm kiếm</button>
          </form>
          {quickCategories.length ? (
            <div className="marketplace-hero__tags">
              <span>Gợi ý nhanh:</span>
              {quickCategories.map((category) => (
                <button
                  key={category._id}
                  type="button"
                  className="hero-tag"
                  onClick={() => handleSelectCategory(category._id)}
                >
                  {category.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="marketplace-hero__highlights">
          <div className="hero-highlight">
            <span className="hero-highlight__title">Đăng tin trong 1 phút</span>
            <span className="hero-highlight__desc">Tạo gian hàng bán trái cây nhanh chóng, quản lý đơn tiện lợi.</span>
          </div>
          <div className="hero-highlight">
            <span className="hero-highlight__title">Kiểm duyệt rõ ràng</span>
            <span className="hero-highlight__desc">Tin đăng được kiểm tra kĩ, đảm bảo nguồn gốc sản phẩm.</span>
          </div>
          <div className="hero-highlight">
            <span className="hero-highlight__title">Hỗ trợ xuyên suốt</span>
            <span className="hero-highlight__desc">Đội ngũ sẵn sàng tư vấn, giải đáp mọi thắc mắc 24/7.</span>
          </div>
        </div>
      </section>

      <section className="marketplace-categories">
        <div className="marketplace-categories__header">
          <h2>Danh mục nổi bật</h2>
          <button
            type="button"
            className={`category-toggle ${selectedCategory === null ? 'is-active' : ''}`}
            onClick={() => handleSelectCategory(null)}
          >
            Tất cả sản phẩm
          </button>
        </div>
        <div className="marketplace-categories__grid">
          {categories.map((category) => {
            const isActive = selectedCategory === category._id;
            return (
              <button
                type="button"
                key={category._id}
                className={`category-card ${isActive ? 'is-active' : ''}`}
                onClick={() => handleSelectCategory(isActive ? null : category._id)}
              >
                <span className="category-card__badge">{category.name.charAt(0).toUpperCase()}</span>
                <span className="category-card__name">{category.name}</span>
                <span className="category-card__cta">Xem tin</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="marketplace-listings">
        <div className="marketplace-listings__header">
          <div>
            <h2>Tin đăng mới nhất</h2>
            {selectedCategory ? (
              <p className="marketplace-listings__filter">
                Đang xem danh mục: <strong>{categories.find((item) => item._id === selectedCategory)?.name}</strong>
              </p>
            ) : (
              <p className="marketplace-listings__filter">Hiển thị các sản phẩm đang bán với giá cập nhật liên tục.</p>
            )}
          </div>
          {keyword ? <span className="marketplace-listings__keyword">Từ khóa: “{keyword}”</span> : null}
        </div>
        {error ? <p className="section-error">{error}</p> : null}
        {loading ? <p className="section-hint">Đang tải sản phẩm...</p> : null}
        {!loading && !products.length ? (
          <p className="section-hint">Chưa có sản phẩm nào phù hợp.</p>
        ) : (
          <div className="product-grid product-grid--list">
            {products.map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
        )}
      </section>

      <section className="marketplace-cta">
        <div className="cta-card cta-card--marketplace">
          <h3>Bán hàng hiệu quả hơn với AI</h3>
          <p>
            Tự động tạo mô tả sản phẩm trái cây theo nhiều phong cách, giúp tin đăng nổi bật và thu hút khách hàng ngay
            khi lên sóng.
          </p>
          <a className="primary-button" href="/ai">
            Khám phá ngay
          </a>
        </div>
      </section>
    </div>
  );
}
