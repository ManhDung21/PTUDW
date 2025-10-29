'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { AxiosError } from 'axios';

import { API_PREFIX, apiClient, setAuthToken } from '../lib/api-client';

type AuthUser = {
  id: string;
  email?: string | null;
  phone_number?: string | null;
  full_name?: string | null;
  role?: string | null;
};

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: { email: string; password: string; full_name?: string; phone_number?: string }) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function fromProfileResponse(data: any): AuthUser {
  return {
    id: data?.id ?? data?._id ?? '',
    email: data?.email ?? null,
    phone_number: data?.phone_number ?? null,
    full_name: data?.full_name ?? null,
    role: data?.role ?? null,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const assignToken = useCallback((value: string | null) => {
    setTokenState(value);
    setAuthToken(value);
    if (typeof window !== 'undefined') {
      if (value) {
        sessionStorage.setItem('token', value);
      } else {
        sessionStorage.removeItem('token');
      }
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!token) {
      setUser(null);
      return;
    }
    try {
      const { data } = await apiClient.get(`${API_PREFIX}/users/me`);
      setUser(fromProfileResponse(data));
      setError(null);
    } catch (err) {
      console.error('Failed to refresh profile', err);
      assignToken(null);
      setUser(null);
      setError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    }
  }, [token, assignToken]);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? sessionStorage.getItem('token') : null;
    if (stored) {
      assignToken(stored);
    } else {
      setLoading(false);
    }
  }, [assignToken]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setUser(null);
      return;
    }
    let active = true;
    (async () => {
      setLoading(true);
      await refreshProfile();
      if (active) {
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [token, refreshProfile]);

  const handleAuthError = useCallback((err: unknown) => {
    if ((err as AxiosError)?.response?.data && typeof (err as AxiosError).response?.data === 'object') {
      const data: any = (err as AxiosError).response?.data;
      if (typeof data.detail === 'string') {
        setError(data.detail);
        return;
      }
    }
    setError('Đã xảy ra lỗi. Vui lòng thử lại.');
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        setLoading(true);
        setError(null);
        let data: any | null = null;
        try {
          const response = await apiClient.post(`${API_PREFIX}/auth/login`, { email, password });
          data = response.data;
        } catch (innerErr) {
          const status = (innerErr as AxiosError)?.response?.status;
          if (status === 404) {
            const response = await apiClient.post('/auth/login', {
              identifier: email,
              password,
            });
            data = response.data;
          } else {
            throw innerErr;
          }
        }
        if (!data?.access_token) {
          throw new Error('Không nhận được token phản hồi từ máy chủ.');
        }
        assignToken(data.access_token);
        await refreshProfile();
      } catch (err) {
        console.error('Login failed', err);
        handleAuthError(err);
        assignToken(null);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [assignToken, refreshProfile, handleAuthError]
  );

  const register = useCallback(
    async (payload: { email: string; password: string; full_name?: string; phone_number?: string }) => {
      try {
        setLoading(true);
        setError(null);
        let data: any | null = null;
        const requestPayload = {
          email: payload.email,
          password: payload.password,
          full_name: payload.full_name,
          phone_number: payload.phone_number,
        };
        try {
          const response = await apiClient.post(`${API_PREFIX}/auth/register`, requestPayload);
          data = response.data;
        } catch (innerErr) {
          const status = (innerErr as AxiosError)?.response?.status;
          if (status === 404) {
            const response = await apiClient.post('/auth/register', {
              identifier: payload.email,
              password: payload.password,
            });
            data = response.data;
          } else {
            throw innerErr;
          }
        }
        if (!data?.access_token) {
          throw new Error('Không nhận được token phản hồi từ máy chủ.');
        }
        assignToken(data.access_token);
        await refreshProfile();
      } catch (err) {
        console.error('Register failed', err);
        handleAuthError(err);
        assignToken(null);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [assignToken, refreshProfile, handleAuthError]
  );

  const logout = useCallback(() => {
    assignToken(null);
    setUser(null);
    setError(null);
  }, [assignToken]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, token, loading, error, login, register, logout, refreshProfile }),
    [user, token, loading, error, login, register, logout, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
