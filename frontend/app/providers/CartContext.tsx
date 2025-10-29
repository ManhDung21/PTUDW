'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { AxiosError } from 'axios';

import { API_PREFIX, apiClient } from '../lib/api-client';
import { useAuth } from './AuthContext';

export type CartItem = {
  item_id: string;
  product_id: string;
  variant_id?: string | null;
  product_name: string;
  variant_name?: string | null;
  thumbnail_url?: string | null;
  attributes: Record<string, string>;
  quantity: number;
  price: number;
  compare_at_price?: number | null;
  total_price: number;
  updated_at: string;
};

type CartState = {
  items: CartItem[];
  subtotal: number;
  total_items: number;
  updated_at: string | null;
};

type CartContextValue = {
  cart: CartState | null;
  loading: boolean;
  error: string | null;
  refreshCart: () => Promise<void>;
  addToCart: (productId: string, quantity?: number, variantId?: string | null) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

function normalizeCart(data: any): CartState {
  return {
    items: (data?.items ?? []).map((item: any) => ({
      item_id: item?.item_id ?? '',
      product_id: item?.product_id ?? '',
      variant_id: item?.variant_id ?? null,
      product_name: item?.product_name ?? '',
      variant_name: item?.variant_name ?? null,
      thumbnail_url: item?.thumbnail_url ?? null,
      attributes: item?.attributes ?? {},
      quantity: item?.quantity ?? 0,
      price: item?.price ?? 0,
      compare_at_price: item?.compare_at_price ?? null,
      total_price: item?.total_price ?? 0,
      updated_at: item?.updated_at ?? new Date().toISOString(),
    })),
    subtotal: data?.subtotal ?? 0,
    total_items: data?.total_items ?? (data?.items?.length ?? 0),
    updated_at: data?.updated_at ?? null,
  };
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { token, user, logout } = useAuth();
  const [cart, setCart] = useState<CartState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUnauthorized = useCallback(
    (err: unknown) => {
      if ((err as AxiosError)?.response?.status === 401) {
        logout();
        return true;
      }
      return false;
    },
    [logout]
  );

  const refreshCart = useCallback(async () => {
    if (!token || !user) {
      setCart(null);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const { data } = await apiClient.get(`${API_PREFIX}/cart`);
      setCart(normalizeCart(data));
    } catch (err) {
      console.error('Failed to fetch cart', err);
      if (!handleUnauthorized(err)) {
        setError('Không thể tải giỏ hàng.');
      }
      setCart(null);
    } finally {
      setLoading(false);
    }
  }, [token, user, handleUnauthorized]);

  useEffect(() => {
    if (!token || !user) {
      setCart(null);
      setLoading(false);
      return;
    }
    void refreshCart();
  }, [token, user, refreshCart]);

  const addToCart = useCallback(
    async (productId: string, quantity = 1, variantId?: string | null) => {
      if (!token || !user) {
        throw new Error('AUTH_REQUIRED');
      }
      try {
        setLoading(true);
        setError(null);
        const { data } = await apiClient.post(`${API_PREFIX}/cart/items`, {
          product_id: productId,
          variant_id: variantId ?? null,
          quantity,
        });
        setCart(normalizeCart(data));
      } catch (err) {
        console.error('Add to cart failed', err);
        if (!handleUnauthorized(err)) {
          const detail = (err as AxiosError)?.response?.data as any;
          if (detail?.detail && typeof detail.detail === 'string') {
            setError(detail.detail);
          } else {
            setError('Không thể thêm sản phẩm vào giỏ.');
          }
        }
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [token, user, handleUnauthorized]
  );

  const updateQuantity = useCallback(
    async (itemId: string, quantity: number) => {
      if (!token || !user) {
        throw new Error('AUTH_REQUIRED');
      }
      try {
        setLoading(true);
        const { data } = await apiClient.patch(`${API_PREFIX}/cart/items/${itemId}`, {
          quantity,
        });
        setCart(normalizeCart(data));
      } catch (err) {
        console.error('Update cart item failed', err);
        if (!handleUnauthorized(err)) {
          setError('Không thể cập nhật số lượng.');
        }
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [token, user, handleUnauthorized]
  );

  const removeItem = useCallback(
    async (itemId: string) => {
      if (!token || !user) {
        throw new Error('AUTH_REQUIRED');
      }
      try {
        setLoading(true);
        const { data } = await apiClient.delete(`${API_PREFIX}/cart/items/${itemId}`);
        setCart(normalizeCart(data));
      } catch (err) {
        console.error('Remove cart item failed', err);
        if (!handleUnauthorized(err)) {
          setError('Không thể xóa sản phẩm khỏi giỏ hàng.');
        }
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [token, user, handleUnauthorized]
  );

  const clearCart = useCallback(async () => {
    if (!token || !user) {
      throw new Error('AUTH_REQUIRED');
    }
    try {
      setLoading(true);
      const { data } = await apiClient.delete(`${API_PREFIX}/cart`);
      setCart(normalizeCart(data));
    } catch (err) {
      console.error('Clear cart failed', err);
      if (!handleUnauthorized(err)) {
        setError('Không thể làm trống giỏ hàng.');
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, [token, user, handleUnauthorized]);

  const value = useMemo<CartContextValue>(
    () => ({ cart, loading, error, refreshCart, addToCart, updateQuantity, removeItem, clearCart }),
    [cart, loading, error, refreshCart, addToCart, updateQuantity, removeItem, clearCart]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
}
