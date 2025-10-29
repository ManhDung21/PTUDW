import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { AppProviders } from './providers';

export const metadata: Metadata = {
  title: 'Fruitify Commerce',
  description: 'Nền tảng thương mại điện tử trái cây tích hợp AI mô tả sản phẩm.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <AppProviders>
          <div className="app-shell">
            <Header />
            <main className="app-main">{children}</main>
            <Footer />
          </div>
        </AppProviders>
      </body>
    </html>
  );
}
