'use client';

import type { ReactNode } from 'react';

import { AuthProvider } from './AuthContext';
import { CartProvider } from './CartContext';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <CartProvider>{children}</CartProvider>
    </AuthProvider>
  );
}
