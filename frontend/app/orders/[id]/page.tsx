'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { io, type Socket } from 'socket.io-client';

import { API_BASE_URL, API_PREFIX, apiClient } from '../../lib/api-client';
import { useAuth } from '../../providers/AuthContext';

type TimelineEntry = {
  status: string;
  note?: string | null;
  created_at: string;
};

type OrderResponse = {
  _id: string;
  order_code: string;
  total_amount: number;
  payment_status: string;
  fulfillment_status: string;
  note?: string | null;
  address_snapshot: Record<string, string>;
  items: Array<{
    product_name: string;
    quantity: number;
    total_amount: number;
  }>;
  timeline: TimelineEntry[];
  created_at: string;
};

type ChatMessage = {
  _id: string;
  thread_id: string;
  sender_id: string;
  message_type: string;
  content: string;
  created_at: string;
};

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, token, loading: authLoading } = useAuth();
  const [order, setOrder] = useState<OrderResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatReady, setChatReady] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    const fetchOrder = async () => {
      if (!user || !params.id) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const { data } = await apiClient.get(`${API_PREFIX}/orders/${params.id}`);
        setOrder(data);
      } catch (err) {
        console.error(err);
        setError('Không tìm thấy đơn hàng.');
      } finally {
        setLoading(false);
      }
    };
    void fetchOrder();
  }, [user, params.id]);

  useEffect(() => {
    const ensureChatThread = async () => {
      if (!user || !order || threadId) {
        return;
      }
      try {
        const { data } = await apiClient.post(`${API_PREFIX}/chat/threads`, { order_id: order._id });
        if (data?._id) {
          setThreadId(data._id);
          setChatMessages([]);
          setChatError(null);
        }
      } catch (err) {
        console.error(err);
        setChatError('Khong the chuan bi chat voi nguoi ban.');
      }
    };
    void ensureChatThread();
  }, [user, order, threadId]);

  useEffect(() => {
    if (!token || !threadId) {
      return;
    }
    const socket = io(API_BASE_URL, {
      path: '/ws/socket.io',
      transports: ['websocket'],
      auth: { token },
    });
    socketRef.current = socket;

    const handleConnect = () => {
      setChatReady(true);
      setChatError(null);
      socket.emit('chat:join', { thread_id: threadId });
    };
    const handleDisconnect = () => {
      setChatReady(false);
    };
    const handleJoined = (payload: { messages?: ChatMessage[] }) => {
      setChatMessages(payload?.messages ?? []);
    };
    const handleMessage = (message: ChatMessage) => {
      setChatMessages((prev) => [...prev, message]);
    };
    const handleError = (payload: { message?: string }) => {
      setChatError(payload?.message ?? 'Khong the gui/nhan tin nhan.');
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('chat:joined', handleJoined);
    socket.on('chat:message', handleMessage);
    socket.on('chat:error', handleError);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('chat:joined', handleJoined);
      socket.off('chat:message', handleMessage);
      socket.off('chat:error', handleError);
      socket.disconnect();
      socketRef.current = null;
      setChatReady(false);
    };
  }, [token, threadId]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  const handleSendMessage = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!socketRef.current || !threadId) {
      return;
    }
    const trimmed = messageInput.trim();
    if (!trimmed) {
      return;
    }
    setChatError(null);
    socketRef.current.emit('chat:send', {
      thread_id: threadId,
      content: trimmed,
      message_type: 'text',
    });
    setMessageInput('');
  };

  if (!user) {
    return null;
  }

  if (loading) {
    return <div className="page-container">Đang tải thông tin đơn hàng...</div>;
  }

  if (error || !order) {
    return <div className="page-container">{error ?? 'Không tìm thấy đơn hàng.'}</div>;
  }

  const formatStatusLabel = (status: string) => {
    const normalized = status ? status.toLowerCase() : '';
    if (['pending', 'processing', 'dang xu ly', 'đang xử lý'].includes(normalized)) {
      return 'Đang xử lý';
    }
    if (['shipping', 'shipped', 'đang giao', 'dang giao'].includes(normalized)) {
      return 'Đang giao';
    }
    if (['completed', 'delivered', 'hoan thanh', 'hoàn thành'].includes(normalized)) {
      return 'Hoàn thành';
    }
    if (['cancelled', 'canceled', 'da huy', 'đã hủy'].includes(normalized)) {
      return 'Đã hủy';
    }
    return status;
  };

  const getStatusTone = (status: string) => {
    const normalized = status ? status.toLowerCase() : '';
    if (['completed', 'delivered', 'hoan thanh', 'hoàn thành'].includes(normalized)) {
      return 'success';
    }
    if (['cancelled', 'canceled', 'da huy', 'đã hủy'].includes(normalized)) {
      return 'danger';
    }
    if (['shipping', 'shipped', 'đang giao', 'dang giao'].includes(normalized)) {
      return 'info';
    }
    return 'warning';
  };

  const productCount = order.items.reduce((sum, item) => sum + (item.quantity ?? 0), 0);
  const formattedTotal = order.total_amount.toLocaleString('vi-VN');
  const createdAt = new Date(order.created_at).toLocaleString('vi-VN');
  const statusLabel = formatStatusLabel(order.fulfillment_status);
  const paymentLabel = formatStatusLabel(order.payment_status);
  const statusTone = getStatusTone(order.fulfillment_status);

  return (
    <div className="page-container order-detail-view">
      <section className="dashboard-hero dashboard-hero--orders">
        <div className="dashboard-hero__content">
          <span className="dashboard-hero__badge">Chi tiết đơn hàng</span>
          <h1 className="dashboard-hero__title">{order.order_code}</h1>
          <p className="dashboard-hero__subtitle">Tạo ngày {createdAt}</p>
          <div className="dashboard-hero__actions dashboard-hero__actions--compact">
            <Link href="/orders" className="dashboard-hero__link">
              Quay lại danh sách
            </Link>
          </div>
        </div>
        <div className="dashboard-hero__stats">
          <div className="dashboard-hero__stat">
            <span className="dashboard-hero__stat-label">Trạng thái giao hàng</span>
            <span className={`order-chip order-chip--${statusTone}`}>{statusLabel}</span>
            <span className="dashboard-hero__stat-sub">Thanh toán: {paymentLabel}</span>
          </div>
          <div className="dashboard-hero__stat">
            <span className="dashboard-hero__stat-label">Tổng sản phẩm</span>
            <strong>{productCount}</strong>
            <span className="dashboard-hero__stat-sub">Số lượng đã đặt</span>
          </div>
          <div className="dashboard-hero__stat">
            <span className="dashboard-hero__stat-label">Giá trị đơn</span>
            <strong>{formattedTotal}đ</strong>
            <span className="dashboard-hero__stat-sub">Đã bao gồm khuyến mãi</span>
          </div>
        </div>
      </section>

      <div className="order-detail-grid">
        <div className="order-detail__main">
          <section className="info-card">
            <header className="info-card__header">
              <h2>Sản phẩm đã đặt</h2>
              <span className="info-card__meta">{order.items.length} dòng sản phẩm</span>
            </header>
            <ul className="order-detail__items">
              {order.items.map((item, index) => (
                <li key={`${order._id}-${index}`}>
                  <div>
                    <strong>{item.product_name}</strong>
                    <span className="order-detail__qty">Số lượng: {item.quantity}</span>
                  </div>
                  <span className="order-detail__price">{item.total_amount.toLocaleString('vi-VN')}đ</span>
                </li>
              ))}
            </ul>
            <div className="order-detail__total">
              <span>Tổng thanh toán</span>
              <strong>{formattedTotal}đ</strong>
            </div>
          </section>

          <section className="info-card">
            <header className="info-card__header">
              <h2>Địa chỉ giao hàng</h2>
            </header>
            <div className="info-card__body">
              <p className="info-card__highlight">
                {order.address_snapshot.recipient_name} • {order.address_snapshot.phone_number}
              </p>
              <p>
                {order.address_snapshot.address_line}, {order.address_snapshot.ward}, {order.address_snapshot.district},{' '}
                {order.address_snapshot.province}, {order.address_snapshot.country}
              </p>
              {order.note ? <p className="info-card__note">Ghi chú từ bạn: {order.note}</p> : null}
            </div>
          </section>

          <section className="info-card">
            <header className="info-card__header">
              <h2>Tiến trình đơn hàng</h2>
            </header>
            <ul className="order-timeline">
              {order.timeline.map((entry, index) => (
                <li key={`${entry.status}-${index}`}>
                  <strong>{entry.status}</strong>
                  <span>{new Date(entry.created_at).toLocaleString('vi-VN')}</span>
                  {entry.note ? <p>{entry.note}</p> : null}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="order-detail__side">
          <section className="info-card info-card--chat">
            <header className="info-card__header">
              <h2>Trò chuyện với người bán</h2>
              <p className="info-card__meta">Hỗ trợ giao hàng và thương lượng nhanh</p>
            </header>
            {chatError ? <p className="section-error">{chatError}</p> : null}
            {!threadId ? (
              <p className="section-hint">Đang chuẩn bị phòng chat...</p>
            ) : (
              <div className="chat-panel chat-panel--borderless">
                <div className="chat-panel__messages">
                  {chatMessages.length === 0 ? (
                    <p className="section-hint">Hãy gửi tin nhắn đầu tiên cho người bán.</p>
                  ) : (
                    chatMessages.map((message) => {
                      const isOwn = message.sender_id === user.id;
                      return (
                        <div key={message._id} className={`chat-bubble ${isOwn ? 'chat-bubble--self' : ''}`}>
                          <div className="chat-bubble__body">{message.content}</div>
                          <span className="chat-bubble__meta">{new Date(message.created_at).toLocaleString('vi-VN')}</span>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>
                <form className="chat-panel__form" onSubmit={handleSendMessage}>
                  <input
                    type="text"
                    placeholder={chatReady ? 'Nhập tin nhắn...' : 'Đang kết nối...'}
                    value={messageInput}
                    onChange={(event) => setMessageInput(event.target.value)}
                    disabled={!chatReady}
                  />
                  <button className="primary-button" type="submit" disabled={!chatReady || !messageInput.trim()}>
                    Gửi
                  </button>
                </form>
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
