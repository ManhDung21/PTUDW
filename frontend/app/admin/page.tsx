"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import axios from "axios";

import { API_PREFIX, apiClient } from "../lib/api-client";
import { useAuth } from "../providers/AuthContext";

type AdminUser = {
  _id: string;
  email?: string | null;
  phone_number?: string | null;
  role: string;
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

type SellerRow = {
  _id: string;
  shop_name: string;
  status: string;
  user_id: string;
  created_at?: string | null;
  updated_at?: string | null;
  verification_notes?: string | null;
};

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

function errorMessage(err: unknown) {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data as Record<string, unknown> | undefined;
    if (detail) {
      if (typeof detail.detail === "string") return detail.detail;
      if (typeof detail.message === "string") return detail.message;
    }
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return "Da xay ra loi";
}

const SELLER_STATUS_OPTIONS = [
  { value: "all", label: "Tat ca" },
  { value: "pending", label: "Cho duyet" },
  { value: "approved", label: "Da duyet" },
  { value: "rejected", label: "Tu choi" },
  { value: "suspended", label: "Tam dung" },
];

const ROLE_OPTIONS = [
  { value: "buyer", label: "Buyer" },
  { value: "seller", label: "Seller" },
  { value: "admin", label: "Admin" },
];

type UserEditState = {
  role: string;
  is_active: boolean;
};

export default function AdminDashboardPage(): JSX.Element | null {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [userEdits, setUserEdits] = useState<Record<string, UserEditState>>({});

  const [sellerStatus, setSellerStatus] = useState("pending");
  const [sellers, setSellers] = useState<SellerRow[]>([]);
  const [sellersError, setSellersError] = useState<string | null>(null);
  const [loadingPage, setLoadingPage] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!user) {
      router.push("/auth/login");
      return;
    }
    if ((user.role || '').toLowerCase() !== "admin") {
      router.push("/store");
      return;
    }

    const load = async () => {
      setLoadingPage(true);
      try {
        const [usersRes, sellersRes] = await Promise.allSettled([
          apiClient.get(`${API_PREFIX}/admin/users`),
          apiClient.get(`${API_PREFIX}/admin/sellers`, {
            params: sellerStatus === "all" ? {} : { status: sellerStatus },
          }),
        ]);

        if (usersRes.status === "fulfilled") {
          setUsers(usersRes.value.data ?? []);
          setUsersError(null);
        } else {
          setUsers([]);
          setUsersError(errorMessage(usersRes.reason));
        }

        if (sellersRes.status === "fulfilled") {
          const mapped = (sellersRes.value.data ?? []).map((item: any) => ({
            _id: item._id,
            shop_name: item.shop_name,
            status: item.status,
            user_id: item.user_id,
            created_at: item.created_at,
            updated_at: item.updated_at,
            verification_notes: item.verification_notes,
          }));
          setSellers(mapped);
          setSellersError(null);
        } else {
          setSellers([]);
          setSellersError(errorMessage(sellersRes.reason));
        }
      } finally {
        setLoadingPage(false);
      }
    };

    void load();
  }, [loading, user, router, sellerStatus]);

  const handleRoleChange = (userId: string, role: string) => {
    setUserEdits((prev) => ({
      ...prev,
      [userId]: {
        role,
        is_active: prev[userId]?.is_active ?? users.find((u) => u._id === userId)?.is_active ?? true,
      },
    }));
  };

  const handleActiveToggle = (userId: string) => {
    setUserEdits((prev) => ({
      ...prev,
      [userId]: {
        role: prev[userId]?.role ?? users.find((u) => u._id === userId)?.role ?? "buyer",
        is_active: !(prev[userId]?.is_active ?? users.find((u) => u._id === userId)?.is_active ?? true),
      },
    }));
  };

  const handleSaveUser = async (userId: string) => {
    const edit = userEdits[userId];
    if (!edit) {
      return;
    }
    try {
      await apiClient.put(`${API_PREFIX}/admin/users/${userId}/role`, {
        role: edit.role,
        is_active: edit.is_active,
      });
      setActionMessage("Cap nhat tai khoan thanh cong.");
      setUserEdits((prev) => {
        const copy = { ...prev };
        delete copy[userId];
        return copy;
      });
      const { data } = await apiClient.get(`${API_PREFIX}/admin/users`);
      setUsers(data ?? []);
    } catch (err) {
      setActionMessage(errorMessage(err));
    }
  };

  const updateSellerStatus = async (sellerId: string, status: string, notes?: string) => {
    try {
      await apiClient.put(`${API_PREFIX}/admin/sellers/${sellerId}/status`, {
        status,
        verification_notes: notes ?? null,
      });
      setActionMessage("Cap nhat trang thai seller thanh cong.");
      const res = await apiClient.get(`${API_PREFIX}/admin/sellers`, {
        params: sellerStatus === "all" ? {} : { status: sellerStatus },
      });
      const mapped = (res.data ?? []).map((item: any) => ({
        _id: item._id,
        shop_name: item.shop_name,
        status: item.status,
        user_id: item.user_id,
        created_at: item.created_at,
        updated_at: item.updated_at,
        verification_notes: item.verification_notes,
      }));
      setSellers(mapped);
    } catch (err) {
      setActionMessage(errorMessage(err));
    }
  };

  if (!user) {
    return null;
  }

  const pendingEdits = Object.keys(userEdits);

  return (
    <div className="page-container admin-dashboard">
      <div className="panel-heading">
        <div>
          <h1>Admin portal</h1>
          <p>Quan ly nguoi dung va ho so seller.</p>
        </div>
        <div className="panel-controls">
          <Link className="link-button" href="/store">
            Quay ve cua hang
          </Link>
        </div>
      </div>

      {actionMessage ? <p className="section-hint">{actionMessage}</p> : null}
      {loadingPage ? <p className="section-hint">Dang tai du lieu quan tri...</p> : null}

      <section className="panel">
        <div className="panel-heading">
          <h2>Ho so seller</h2>
          <select value={sellerStatus} onChange={(event) => setSellerStatus(event.target.value)}>
            {SELLER_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        {sellersError ? <p className="section-error">{sellersError}</p> : null}
        {!sellers.length && !sellersError ? <p className="section-hint">Khong co seller phu hop.</p> : null}
        {sellers.length ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Shop</th>
                <th>Trang thai</th>
                <th>Ngay tao</th>
                <th>Ghi chu</th>
                <th>Thao tac</th>
              </tr>
            </thead>
            <tbody>
              {sellers.map((seller) => (
                <tr key={seller._id}>
                  <td>{seller.shop_name}</td>
                  <td>{seller.status}</td>
                  <td>{formatDate(seller.created_at)}</td>
                  <td>{seller.verification_notes || '-'}</td>
                  <td>
                    <div className="table-actions">
                      <button className="primary-button" type="button" onClick={() => updateSellerStatus(seller._id, 'approved')}>
                        Duyet
                      </button>
                      <button className="secondary-button" type="button" onClick={() => updateSellerStatus(seller._id, 'rejected')}>
                        Tu choi
                      </button>
                      <button className="secondary-button" type="button" onClick={() => updateSellerStatus(seller._id, 'suspended')}>
                        Tam dung
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>Quan ly nguoi dung</h2>
          {pendingEdits.length ? <span className="section-hint">Co {pendingEdits.length} thay doi chua luu.</span> : null}
        </div>
        {usersError ? <p className="section-error">{usersError}</p> : null}
        {!users.length && !usersError ? <p className="section-hint">Chua co nguoi dung.</p> : null}
        {users.length ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>So dien thoai</th>
                <th>Vai tro</th>
                <th>Trang thai</th>
                <th>Ngay tao</th>
                <th>Thao tac</th>
              </tr>
            </thead>
            <tbody>
              {users.map((item) => {
                const edit = userEdits[item._id];
                const roleValue = edit?.role ?? item.role;
                const activeValue = edit?.is_active ?? item.is_active;
                return (
                  <tr key={item._id}>
                    <td>{item.email || '-'}</td>
                    <td>{item.phone_number || '-'}</td>
                    <td>
                      <select value={roleValue} onChange={(event) => handleRoleChange(item._id, event.target.value)}>
                        {ROLE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <label className="toggle">
                        <input type="checkbox" checked={activeValue} onChange={() => handleActiveToggle(item._id)} />
                        <span>{activeValue ? 'Hoat dong' : 'Bi khoa'}</span>
                      </label>
                    </td>
                    <td>{formatDate(item.created_at)}</td>
                    <td>
                      <button className="primary-button" type="button" onClick={() => handleSaveUser(item._id)} disabled={!userEdits[item._id]}>
                        Luu
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : null}
      </section>
    </div>
  );
}
