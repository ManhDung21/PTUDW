"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import axios from "axios";

import { API_PREFIX, apiClient } from "../lib/api-client";
import { useAuth } from "../providers/AuthContext";

type SellerSummary = {
  total_orders: number;
  pending_orders: number;
  processing_orders: number;
  cancelled_orders: number;
  completed_orders: number;
  revenue_total: number;
  revenue_this_month: number;
  orders_today: number;
  low_stock_items: number;
};

type SellerProfile = {
  _id: string;
  shop_name: string;
  slug: string;
  status: string;
  description?: string | null;
  logo_url?: string | null;
  cover_image_url?: string | null;
  verification_notes?: string | null;
  updated_at?: string | null;
};

type SellerSummaryResponse = {
  seller: SellerProfile;
  summary: SellerSummary;
};

type SellerProduct = {
  _id: string;
  name: string;
  status: string;
  base_price: number | null;
  updated_at?: string | null;
  thumbnail_url?: string | null;
};

type SellerOrder = {
  _id: string;
  order_code: string;
  total_amount: number;
  payment_status: string;
  fulfillment_status: string;
  created_at: string;
};

function formatCurrency(value: number | null | undefined) {
  if (value == null) {
    return "-";
  }
  return value.toLocaleString("vi-VN", { style: "currency", currency: "VND" });
}

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("vi-VN");
}

function toErrorMessage(err: unknown) {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data as Record<string, unknown> | undefined;
    if (detail) {
      if (typeof detail.detail === "string") {
        return detail.detail;
      }
      if (typeof detail.message === "string") {
        return detail.message;
      }
    }
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "Da xay ra loi";
}

export default function SellerDashboardPage(): JSX.Element | null {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SellerSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [products, setProducts] = useState<SellerProduct[]>([]);
  const [productError, setProductError] = useState<string | null>(null);
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!user) {
      router.push("/auth/login");
      return;
    }
    const role = (user.role || "").toLowerCase();
    if (role !== "seller") {
      router.push("/store");
      return;
    }

    const fetchData = async () => {
      setPageLoading(true);
      try {
        const [profileRes, summaryRes, productRes, orderRes] = await Promise.allSettled([
          apiClient.get(`${API_PREFIX}/sellers/me`),
          apiClient.get<SellerSummaryResponse>(`${API_PREFIX}/sellers/dashboard/summary`),
          apiClient.get(`${API_PREFIX}/sellers/me/products`, { params: { limit: 6 } }),
          apiClient.get(`${API_PREFIX}/orders/seller`, { params: { limit: 6 } }),
        ]);

        if (profileRes.status === "fulfilled") {
          setProfile(profileRes.value.data);
          setProfileError(null);
        } else {
          setProfile(null);
          setProfileError(toErrorMessage(profileRes.reason));
        }

        if (summaryRes.status === "fulfilled") {
          setSummary(summaryRes.value.data.summary);
          setSummaryError(null);
        } else {
          setSummary(null);
          setSummaryError(toErrorMessage(summaryRes.reason));
        }

        if (productRes.status === "fulfilled") {
          const list = (productRes.value.data?.items ?? []).slice(0, 6).map((item: any) => ({
            _id: item._id,
            name: item.name,
            status: item.status,
            base_price: item.base_price ?? null,
            updated_at: item.updated_at,
            thumbnail_url: item.thumbnail_url,
          }));
          setProducts(list);
          setProductError(null);
        } else {
          setProducts([]);
          setProductError(toErrorMessage(productRes.reason));
        }

        if (orderRes.status === "fulfilled") {
          const list = (orderRes.value.data?.items ?? []).slice(0, 6).map((item: any) => ({
            _id: item._id,
            order_code: item.order_code,
            total_amount: item.total_amount,
            payment_status: item.payment_status,
            fulfillment_status: item.fulfillment_status,
            created_at: item.created_at,
          }));
          setOrders(list);
          setOrdersError(null);
        } else {
          setOrders([]);
          setOrdersError(toErrorMessage(orderRes.reason));
        }
      } finally {
        setPageLoading(false);
      }
    };

    void fetchData();
  }, [loading, user, router]);

  if (!user) {
    return null;
  }

  const metricCards = useMemo(() => {
    if (!summary) {
      return [] as { label: string; value: string }[];
    }
    return [
      { label: "Tong doanh thu", value: formatCurrency(summary.revenue_total) },
      { label: "Doanh thu thang nay", value: formatCurrency(summary.revenue_this_month) },
      { label: "Don hang hom nay", value: summary.orders_today.toString() },
      { label: "Don dang xu ly", value: summary.processing_orders.toString() },
      { label: "Don cho xac nhan", value: summary.pending_orders.toString() },
      { label: "San pham sap het hang", value: summary.low_stock_items.toString() },
    ];
  }, [summary]);

  return (
    <div className="page-container seller-dashboard">
      <div className="panel-heading">
        <div>
          <h1>Seller portal</h1>
          {profile ? <p>{profile.description || 'Quan ly shop cua ban va don hang tai day.'}</p> : null}
        </div>
        <div className="panel-controls">
          <Link className="primary-button" href="/store">
            Xem cua hang
          </Link>
        </div>
      </div>

      {profileError ? <p className="section-error">{profileError}</p> : null}
      {summaryError ? <p className="section-error">{summaryError}</p> : null}

      {profile && (
        <section className="seller-status">
          <div className="status-pill">
            Trang thai: <span className={`status-pill__value status-${profile.status}`}>{profile.status}</span>
          </div>
          {profile.verification_notes ? <p className="section-hint">Ghi chu: {profile.verification_notes}</p> : null}
        </section>
      )}

      {pageLoading ? <p className="section-hint">Dang tai thong tin bang dieu khien...</p> : null}

      {metricCards.length ? (
        <section className="metrics-grid">
          {metricCards.map((metric) => (
            <div key={metric.label} className="metric-card">
              <span className="metric-card__label">{metric.label}</span>
              <strong className="metric-card__value">{metric.value}</strong>
            </div>
          ))}
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-heading">
          <h2>Don hang gan day</h2>
          <Link className="link-button" href="/orders">
            Quan ly don hang
          </Link>
        </div>
        {ordersError ? <p className="section-error">{ordersError}</p> : null}
        {!orders.length && !ordersError ? <p className="section-hint">Chua co don hang nao.</p> : null}
        {orders.length ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Ma don</th>
                <th>Ngay tao</th>
                <th>Thanh toan</th>
                <th>Giao hang</th>
                <th>Tong tien</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order._id}>
                  <td>{order.order_code}</td>
                  <td>{formatDate(order.created_at)}</td>
                  <td>{order.payment_status}</td>
                  <td>{order.fulfillment_status}</td>
                  <td>{formatCurrency(order.total_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>San pham cua ban</h2>
          <Link className="link-button" href="/store">
            Xem tat ca san pham
          </Link>
        </div>
        {productError ? <p className="section-error">{productError}</p> : null}
        {!products.length && !productError ? <p className="section-hint">Chua co san pham nao.</p> : null}
        {products.length ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Ten san pham</th>
                <th>Trang thai</th>
                <th>Gia co ban</th>
                <th>Cap nhat</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product._id}>
                  <td>{product.name}</td>
                  <td>{product.status}</td>
                  <td>{formatCurrency(product.base_price)}</td>
                  <td>{formatDate(product.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>
    </div>
  );
}
