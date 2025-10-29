'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '../providers/AuthContext';
import { useCart } from '../providers/CartContext';

type NavItem = { href: string; label: string };

const BASE_NAV: NavItem[] = [
  { href: '/store', label: 'Cửa hàng' },
  { href: '/cart', label: 'Giỏ hàng' },
  { href: '/orders', label: 'Đơn hàng' },
  { href: '/account', label: 'Tài khoản' },
  { href: '/ai', label: 'AI mô tả' },
];

const AUTH_NAV: NavItem[] = [
  { href: '/auth/login', label: 'Đăng nhập' },
  { href: '/auth/register', label: 'Đăng ký' },
];

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, loading } = useAuth();
  const { cart } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);

  const cartBadge = useMemo(() => cart?.total_items ?? 0, [cart]);

  const extraNav = useMemo<NavItem[]>(() => {
    if (!user) {
      return [];
    }
    const role = (user.role || '').toLowerCase();
    const items: NavItem[] = [];
    if (role === 'seller' || role === 'admin') {
      items.push({ href: '/seller', label: 'Seller portal' });
    }
    if (role === 'admin') {
      items.push({ href: '/admin', label: 'Admin portal' });
    }
    return items;
  }, [user]);

  const navItems = useMemo(() => [...BASE_NAV, ...extraNav], [extraNav]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link href="/store" className="brand">
          <span className="brand__logo">dY?S</span>
          <span className="brand__name">Fruitify</span>
        </Link>
        <button
          type="button"
          className="nav-toggle"
          aria-label="Toggle navigation"
          onClick={() => setMenuOpen((value) => !value)}
        >
          <span />
          <span />
          <span />
        </button>
        <nav className={`nav nav--desktop`}>
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link key={item.href} href={item.href} className={`nav__link ${isActive ? 'is-active' : ''}`}>
                {item.label}
                {item.href === '/cart' && cartBadge > 0 ? <span className="nav__badge">{cartBadge}</span> : null}
              </Link>
            );
          })}
        </nav>
        <div className="nav__actions">
          {loading ? (
            <span className="nav__hint">Đang tải...</span>
          ) : user ? (
            <div className="nav__user">
              <span className="nav__hint">{user.full_name || user.email || user.phone_number}</span>
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  logout();
                  router.push('/');
                }}
              >
                Đăng xuất
              </button>
            </div>
          ) : (
            AUTH_NAV.map((item) => (
              <Link key={item.href} href={item.href} className="nav__link">
                {item.label}
              </Link>
            ))
          )}
        </div>
      </div>
      <nav className={`nav-drawer ${menuOpen ? 'is-open' : ''}`} onClick={() => setMenuOpen(false)}>
        <div
          className="nav-drawer__content"
          onClick={(event) => {
            event.stopPropagation();
          }}
        >
          <div className="nav-drawer__header">
            <span className="nav-drawer__brand">Fruitify</span>
            <button type="button" className="nav-toggle nav-toggle--close" onClick={() => setMenuOpen(false)}>
              <span />
              <span />
              <span />
            </button>
          </div>
          <div className="nav-drawer__links">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link key={item.href} href={item.href} className={`nav__link ${isActive ? 'is-active' : ''}`}>
                  {item.label}
                  {item.href === '/cart' && cartBadge > 0 ? <span className="nav__badge">{cartBadge}</span> : null}
                </Link>
              );
            })}
          </div>
          <div className="nav-drawer__actions">
            {loading ? (
              <span className="nav__hint">Đang tải...</span>
            ) : user ? (
              <>
                <span className="nav__hint">{user.full_name || user.email || user.phone_number}</span>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => {
                    logout();
                    router.push('/');
                  }}
                >
                  Đăng xuất
                </button>
              </>
            ) : (
              AUTH_NAV.map((item) => (
                <Link key={item.href} href={item.href} className="primary-button nav-drawer__auth">
                  {item.label}
                </Link>
              ))
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}
