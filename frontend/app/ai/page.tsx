'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';

import { apiClient, resolveMediaUrl } from '../lib/api-client';
import { useAuth } from '../providers/AuthContext';

type DescriptionResponse = {
  description: string;
  history_id: string;
  timestamp: string;
  style: string;
  source: string;
  image_url?: string | null;
};

type HistoryItem = {
  id: string;
  timestamp: string;
  source: string;
  style: string;
  summary: string;
  full_description: string;
  image_url?: string | null;
};

const DEFAULT_STYLES = ['Tiếp thị', 'Chuyên nghiệp', 'Thân thiện', 'Kể chuyện'];

export default function AiGeneratorPage() {
  const { user } = useAuth();
  const [styles, setStyles] = useState<string[]>(DEFAULT_STYLES);
  const [selectedStyle, setSelectedStyle] = useState<string>(DEFAULT_STYLES[0]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [productInfo, setProductInfo] = useState('');
  const [result, setResult] = useState<DescriptionResponse | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStyles = async () => {
      try {
        const { data } = await apiClient.get('/api/styles');
        if (Array.isArray(data) && data.length) {
          setStyles(data);
          setSelectedStyle((current) => (data.includes(current) ? current : data[0]));
        }
      } catch (err) {
        console.error(err);
      }
    };
    void fetchStyles();
  }, []);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!user) {
        setHistory([]);
        return;
      }
      try {
        const { data } = await apiClient.get('/api/history');
        setHistory(data ?? []);
      } catch (err) {
        console.error(err);
      }
    };
    void fetchHistory();
  }, [user]);

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setImageFile(null);
      setImagePreview(null);
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setError(null);
  };

  const refreshHistory = async () => {
    if (!user) {
      return;
    }
    try {
      const { data } = await apiClient.get('/api/history');
      setHistory(data ?? []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleGenerateFromImage = async () => {
    if (!imageFile) {
      setError('Vui lòng chọn một hình ảnh.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', imageFile);
      formData.append('style', selectedStyle);
      const { data } = await apiClient.post<DescriptionResponse>('/api/descriptions/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(data);
      await refreshHistory();
    } catch (err: any) {
      const detail = err?.response?.data?.detail ?? 'Không thể tạo mô tả từ hình ảnh.';
      setError(typeof detail === 'string' ? detail : 'Đã xảy ra lỗi.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateFromText = async () => {
    if (!productInfo.trim()) {
      setError('Vui lòng nhập thông tin sản phẩm.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const { data } = await apiClient.post<DescriptionResponse>('/api/descriptions/text', {
        product_info: productInfo,
        style: selectedStyle,
      });
      setResult(data);
      await refreshHistory();
    } catch (err: any) {
      const detail = err?.response?.data?.detail ?? 'Không thể tạo mô tả từ văn bản.';
      setError(typeof detail === 'string' ? detail : 'Đã xảy ra lỗi.');
    } finally {
      setLoading(false);
    }
  };

  const resolvedResultImage = useMemo(() => resolveMediaUrl(result?.image_url ?? null), [result]);

  return (
    <div className="page-container ai-view">
      <section className="ai-hero">
        <div className="ai-hero__content">
          <span className="ai-hero__badge">AI mô tả Chợ Tốt+</span>
          <h1 className="ai-hero__title">Tăng tốc đăng tin với mô tả sản phẩm chuẩn marketplace</h1>
          <p className="ai-hero__subtitle">
            Tạo mô tả sinh động, nhất quán thương hiệu và tối ưu chuyển đổi chỉ với vài thao tác kéo thả hình ảnh hoặc nhập thông tin ngắn gọn.
          </p>
          <div className="ai-hero__actions">
            <button type="button" className="ai-hero__action" onClick={handleGenerateFromText} disabled={loading || !productInfo.trim()}>
              {loading ? 'Đang tạo mô tả...' : 'Tạo mô tả ngay'}
            </button>
            <span className="ai-hero__hint">Không cần cài đặt. Hoàn toàn miễn phí cho nhà bán Fruitify.</span>
          </div>
        </div>
        <ul className="ai-hero__list">
          <li>Tùy chọn phong cách mô tả theo kịch bản bán hàng của bạn.</li>
          <li>Đồng bộ lịch sử mô tả để tái sử dụng và chỉnh sửa nhanh.</li>
          <li>Tích hợp sẵn với giỏ hàng, đơn hàng và trang sản phẩm.</li>
        </ul>
      </section>

      <div className="generator-page">
        <section className="generator-panel card ai-generator">
          <header className="ai-generator__header">
            <h2>Trung tâm tạo mô tả</h2>
            <p className="ai-generator__subtitle">
              Chọn phong cách, tải hình hoặc nhập thông tin để AI gợi ý nội dung hấp dẫn, đúng chuẩn marketplace.
            </p>
          </header>
          <label className="form__label ai-generator__selector">
            Phong cách mô tả
            <select value={selectedStyle} onChange={(event) => setSelectedStyle(event.target.value)}>
              {styles.map((style) => (
                <option key={style} value={style}>
                  {style}
                </option>
              ))}
            </select>
          </label>
          <div className="ai-generator__grid">
            <div className="ai-generator__column">
              <span className="ai-generator__step">Bước 1</span>
              <h3>Tạo mô tả từ hình ảnh</h3>
              <p className="ai-generator__hint">Tải lên hình ảnh sản phẩm, AI sẽ tự động nhận diện điểm nổi bật.</p>
              <input className="ai-generator__file" type="file" accept="image/*" onChange={handleImageChange} />
              {imagePreview ? (
                <div className="media-preview">
                  <Image src={imagePreview} alt="Xem trước" fill className="preview-image" />
                </div>
              ) : (
                <p className="section-hint">Chọn ảnh sắc nét để có mô tả sống động nhất.</p>
              )}
              <button className="primary-button" type="button" onClick={handleGenerateFromImage} disabled={loading}>
                {loading ? 'Đang xử lý...' : 'Sinh mô tả từ ảnh'}
              </button>
            </div>
            <div className="ai-generator__column">
              <span className="ai-generator__step">Bước 2</span>
              <h3>Tạo mô tả từ thông tin</h3>
              <p className="ai-generator__hint">Nhập nhanh tên sản phẩm, nguồn gốc, hương vị, chương trình ưu đãi...</p>
              <textarea
                rows={6}
                value={productInfo}
                onChange={(event) => setProductInfo(event.target.value)}
                placeholder="Ví dụ: Xoài cát Hòa Lộc loại 1, canh tác hữu cơ, giao trong 2h tại TP.HCM..."
              />
              <button className="primary-button" type="button" onClick={handleGenerateFromText} disabled={loading}>
                {loading ? 'Đang xử lý...' : 'Sinh mô tả từ văn bản'}
              </button>
            </div>
          </div>
          {error ? <p className="section-error">{error}</p> : null}
        </section>

        {result ? (
          <section className="card result-panel ai-result">
            <div className="ai-result__header">
              <div>
                <h2>Kết quả mô tả</h2>
                <span className="chip">{result.style}</span>
              </div>
              <span className="section-hint">{new Date(result.timestamp).toLocaleString()}</span>
            </div>
            {resolvedResultImage ? (
              <div className="result-image">
                <Image src={resolvedResultImage} alt="Ảnh kết quả" width={960} height={720} />
              </div>
            ) : null}
            <p className="result-text">{result.description}</p>
            <div className="ai-result__actions">
              <button className="secondary-button" type="button" onClick={handleGenerateFromText} disabled={loading || !productInfo.trim()}>
                Tạo mô tả khác
              </button>
              <button className="primary-button" type="button" onClick={handleGenerateFromImage} disabled={loading || !imageFile}>
                Làm mới từ ảnh
              </button>
            </div>
          </section>
        ) : null}

        <section className="card history-panel ai-history">
          <div className="ai-history__header">
            <div>
              <h2>Lịch sử mô tả gần đây</h2>
              <p className="ai-history__subtitle">
                {user ? 'Quản lý kho nội dung để tái sử dụng trên các kênh bán hàng khác nhau.' : 'Đăng nhập để lưu và xem lại các mô tả đã tạo.'}
              </p>
            </div>
          </div>
          {!user ? (
            <p className="section-hint">Bạn cần đăng nhập để xem lịch sử.</p>
          ) : history.length === 0 ? (
            <p className="section-hint">Chưa có mô tả nào. Bắt đầu tạo ngay!</p>
          ) : (
            <div className="history-list">
              {history.map((item) => {
                const imageSrc = resolveMediaUrl(item.image_url ?? null);
                return (
                  <div key={item.id} className="history-item">
                    <strong>{new Date(item.timestamp).toLocaleString()}</strong>
                    <span className="chip">{item.style}</span>
                    {imageSrc ? (
                      <div className="history-thumb">
                        <Image src={imageSrc} alt="Ảnh mô tả" fill style={{ objectFit: 'cover' }} />
                      </div>
                    ) : null}
                    <p className="history-card__summary">{item.summary}</p>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
