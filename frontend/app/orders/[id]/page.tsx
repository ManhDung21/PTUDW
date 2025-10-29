'use client';

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

  return (
    <div className="page-container">
      <div className="order-detail">
        <header className="order-detail__header">
          <div>
            <h1>{order.order_code}</h1>
            <p>{new Date(order.created_at).toLocaleString()}</p>
          </div>
          <div className="order-detail__status">
            <span className="chip">Thanh toán: {order.payment_status}</span>
            <span className="chip">Giao hàng: {order.fulfillment_status}</span>
          </div>
        </header>
        <section className="order-detail__section">
          <h2>Sản phẩm</h2>
          <ul className="order-detail__items">
            {order.items.map((item, index) => (
              <li key={`${order._id}-${index}`}>
                <span>{item.product_name}</span>
                <span>
                  {item.quantity} x {item.total_amount.toLocaleString('vi-VN')}đ
                </span>
              </li>
            ))}
          </ul>
          <div className="order-detail__total">
            <span>Tổng thanh toán</span>
            <strong>{order.total_amount.toLocaleString('vi-VN')}đ</strong>
          </div>
        </section>
        <section className="order-detail__section">
          <h2>Địa chỉ giao hàng</h2>
          <p>
            {order.address_snapshot.recipient_name} • {order.address_snapshot.phone_number}
          </p>
          <p>
            {order.address_snapshot.address_line}, {order.address_snapshot.ward}, {order.address_snapshot.district},{' '}
            {order.address_snapshot.province}, {order.address_snapshot.country}
          </p>
          {order.note ? <p>Ghi chú: {order.note}</p> : null}
        </section>
        <section className="order-detail__section">
          <h2>Tiến trình đơn hàng</h2>
          <ul className="order-timeline">
            {order.timeline.map((entry, index) => (
              <li key={`${entry.status}-${index}`}>
                <strong>{entry.status}</strong>
                <span>{new Date(entry.created_at).toLocaleString()}</span>
                {entry.note ? <p>{entry.note}</p> : null}
              </li>
            ))}
          </ul>
        </section>
        <section className="order-detail__section">
          <h2>Tro chuyen voi nguoi ban</h2>
          {chatError ? <p className="section-error">{chatError}</p> : null}
          {!threadId ? (
            <p className="section-hint">Dang chuan bi phong chat...</p>
          ) : (
            <div className="chat-panel">
              <div className="chat-panel__messages">
                {chatMessages.length === 0 ? (
                  <p className="section-hint">Hay gui tin nhan dau tien cho nguoi ban.</p>
                ) : (
                  chatMessages.map((message) => {
                    const isOwn = message.sender_id === user.id;
                    return (
                      <div key={message._id} className={`chat-bubble ${isOwn ? 'chat-bubble--self' : ''}`}>
                        <div className="chat-bubble__body">{message.content}</div>
                        <span className="chat-bubble__meta">{new Date(message.created_at).toLocaleString()}</span>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
              <form className="chat-panel__form" onSubmit={handleSendMessage}>
                <input
                  type="text"
                  placeholder={chatReady ? 'Nhap tin nhan...' : 'Dang ket noi...'}
                  value={messageInput}
                  onChange={(event) => setMessageInput(event.target.value)}
                  disabled={!chatReady}
                />
                <button className="primary-button" type="submit" disabled={!chatReady || !messageInput.trim()}>
                  Gui
                </button>
              </form>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
