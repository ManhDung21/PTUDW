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
    <div className="page-container">
      <div className="generator-page">
        <section className="generator-panel card">
          <h1>Trình tạo mô tả AI</h1>
          <p className="panel-subtitle">
            Tải ảnh hoặc nhập thông tin sản phẩm để AI Fruitify gợi ý mô tả phù hợp với phong cách bạn chọn.
          </p>
          <label className="form__label">
            Phong cách mô tả
            <select value={selectedStyle} onChange={(event) => setSelectedStyle(event.target.value)}>
              {styles.map((style) => (
                <option key={style} value={style}>
                  {style}
                </option>
              ))}
            </select>
          </label>
          <div className="generator-grid">
            <div className="generator-column">
              <h2>1. Mô tả từ hình ảnh</h2>
              <input type="file" accept="image/*" onChange={handleImageChange} />
              {imagePreview ? (
                <div className="media-preview">
                  <Image src={imagePreview} alt="Xem trước" fill className="preview-image" />
                </div>
              ) : (
                <p className="section-hint">Chọn ảnh sản phẩm để bắt đầu.</p>
              )}
              <button className="primary-button" type="button" onClick={handleGenerateFromImage} disabled={loading}>
                {loading ? 'Đang xử lý...' : 'Tạo mô tả từ ảnh'}
              </button>
            </div>
            <div className="generator-column">
              <h2>2. Mô tả từ văn bản</h2>
              <textarea
                rows={6}
                value={productInfo}
                onChange={(event) => setProductInfo(event.target.value)}
                placeholder="Ví dụ: Táo Fuji nhập khẩu Nhật Bản, quả to, màu đỏ tươi, vị ngọt giòn..."
              />
              <button className="primary-button" type="button" onClick={handleGenerateFromText} disabled={loading}>
                {loading ? 'Đang xử lý...' : 'Tạo mô tả từ văn bản'}
              </button>
            </div>
          </div>
          {error ? <p className="section-error">{error}</p> : null}
        </section>

        {result ? (
          <section className="card result-panel">
            <div className="panel-heading">
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
          </section>
        ) : null}

        <section className="card history-panel">
          <div className="panel-heading">
            <div>
              <h2>Lịch sử mô tả</h2>
              <p className="panel-subtitle">
                {user ? 'Những mô tả gần đây của bạn sẽ được lưu tự động.' : 'Đăng nhập để lưu lịch sử mô tả của bạn.'}
              </p>
            </div>
          </div>
          {!user ? (
            <p className="section-hint">Bạn cần đăng nhập để xem lịch sử.</p>
          ) : history.length === 0 ? (
            <p className="section-hint">Chưa có lịch sử nào.</p>
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
