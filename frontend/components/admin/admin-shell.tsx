'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ArrowRight, ArrowUpRight, Boxes, Check, LayoutDashboard, LoaderCircle, LogOut, Menu, Package, Plus, ShieldCheck, ShieldX, X } from 'lucide-react';
import { useStore } from '@/components/store-provider';
import { adminFetch, AdminApiError, type AdminUser } from '@/lib/admin-api';

interface AdminContextValue {
  user: AdminUser;
  token: string;
  catalogVersion: number;
  refreshCatalog: () => void;
  handleError: (error: unknown) => boolean;
  notify: (message: string) => void;
}

const AdminContext = createContext<AdminContextValue | null>(null);
export function useAdmin() {
  const value = useContext(AdminContext);
  if (!value) throw new Error('Administrator session is required.');
  return value;
}

const navigation = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/products', label: 'Products', icon: Package },
  { href: '/admin/products/new', label: 'Add product', icon: Plus },
  { href: '/admin/inventory', label: 'Inventory', icon: Boxes },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { account, ready, signOut } = useStore();
  const pathname = usePathname();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [status, setStatus] = useState<'loading' | 'allowed' | 'unauthorized' | 'denied' | 'error'>('loading');
  const [retry, setRetry] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [catalogVersion, setCatalogVersion] = useState(0);
  const [notice, setNotice] = useState('');
  const token = account?.token || '';
  const refreshCatalog = useCallback(() => setCatalogVersion(value => value + 1), []);
  const notify = useCallback((message: string) => setNotice(message), []);
  const handleError = useCallback((error: unknown) => {
    if (error instanceof AdminApiError && (error.status === 401 || error.status === 403)) {
      setUser(null);
      setStatus(error.status === 401 ? 'unauthorized' : 'denied');
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    if (!ready) return;
    setUser(null);
    if (!token) { setStatus('unauthorized'); return; }
    const controller = new AbortController();
    setStatus('loading');
    adminFetch<AdminUser>('/api/user/me', token, { signal: controller.signal })
      .then(current => {
        if (controller.signal.aborted) return;
        if (!current || current.role !== 'admin') { setStatus('denied'); return; }
        if (typeof current._id !== 'string' || typeof current.firstname !== 'string' || typeof current.lastname !== 'string' || typeof current.email !== 'string') { setStatus('error'); return; }
        setUser(current);
        setStatus('allowed');
      })
      .catch(error => { if (!controller.signal.aborted && !handleError(error)) setStatus('error'); });
    return () => controller.abort();
  }, [ready, token, retry, handleError]);

  useEffect(() => { setMobileOpen(false); }, [pathname]);
  useEffect(() => {
    if (!mobileOpen) return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setMobileOpen(false); document.getElementById('adm-menu-toggle')?.focus(); } };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [mobileOpen]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 5500); return () => clearTimeout(timer); }, [notice]);

  const context = useMemo(() => user && token ? { user, token, catalogVersion, refreshCatalog, handleError, notify } : null, [user, token, catalogVersion, refreshCatalog, handleError, notify]);

  if (!ready || status === 'loading') return <div className="adm-gate"><Link className="adm-wordmark" href="/">uwa<span>STUDIO</span></Link><LoaderCircle size={30} className="spin" aria-hidden="true" /><h1>Opening your workspace.</h1><p className="adm-muted" role="status">Verifying administrator access…</p></div>;

  if (status !== 'allowed' || !context) return (
    <div className="adm-gate">
      <Link className="adm-wordmark" href="/">uwa<span>STUDIO</span></Link>
      <div className="adm-gate-icon"><ShieldX size={35} strokeWidth={1.3} aria-hidden="true" /></div>
      <p className="adm-page-eyebrow">UWA Studio / Private workspace</p>
      <h1>{status === 'denied' ? 'This space is for administrators.' : status === 'error' ? 'Let’s try that again.' : 'Your workspace awaits.'}</h1>
      <p className="adm-muted">{status === 'denied' ? 'Your account doesn’t have administrator access. Product management is available only to authorized UWA administrators.' : status === 'error' ? 'We couldn’t verify your account right now. Check your connection and try again.' : 'Sign in with an authorized administrator account to manage the UWA collection.'}</p>
      <div className="adm-inline-actions">
        {status === 'error' ? <button className="adm-button adm-button-primary" onClick={() => setRetry(value => value + 1)}>Try again <ArrowRight size={17} aria-hidden="true" /></button> : <Link href={`/signin?next=${encodeURIComponent(pathname)}`} className="adm-button adm-button-primary">{status === 'denied' ? 'Use another account' : 'Sign in'}<ArrowRight size={17} aria-hidden="true" /></Link>}
        <Link href="/" className="adm-button adm-button-secondary">Back to the storefront</Link>
      </div>
      {status === 'denied' && account && <button className="adm-button adm-button-ghost" onClick={() => void signOut()}>Sign out of this account</button>}
    </div>
  );

  return (
    <AdminContext.Provider value={context}>
      <div className="adm-app">
        <aside className={`adm-sidebar ${mobileOpen ? 'adm-sidebar-open' : ''}`}>
          <Link className="adm-wordmark" href="/admin" aria-label="UWA Studio overview">uwa<span>STUDIO</span></Link>
          <div className="adm-sidebar-section">Workspace</div>
          <nav id="adm-navigation" aria-label="Administrator navigation">
            {navigation.map(item => {
              const active = item.href === '/admin' ? pathname === item.href : item.href === '/admin/products' ? pathname === item.href || /^\/admin\/products\/[^/]+\/edit$/.test(pathname) : pathname === item.href;
              return <Link key={item.href} href={item.href} className={`adm-nav-link ${active ? 'is-active' : ''}`} aria-current={active ? 'page' : undefined}><item.icon size={19} strokeWidth={1.65} aria-hidden="true" />{item.label}{active && <span className="adm-nav-dot" />}</Link>;
            })}
          </nav>
          <div className="adm-sidebar-bottom"><div className="adm-sidebar-note"><ShieldCheck size={19} aria-hidden="true" /><span>Made for the people<br />behind the good things.</span></div><Link href="/" className="adm-store-link">View storefront <ArrowUpRight size={17} aria-hidden="true" /></Link><button className="adm-store-link" type="button" onClick={() => void signOut()}>Sign out <LogOut size={16} aria-hidden="true" /></button></div>
        </aside>
        <div className="adm-workspace">
          <header className="adm-topbar">
            <div className="adm-topbar-left"><button id="adm-menu-toggle" type="button" className="adm-icon-button adm-menu-toggle" aria-label={mobileOpen ? 'Close administrator menu' : 'Open administrator menu'} aria-expanded={mobileOpen} aria-controls="adm-navigation" onClick={() => setMobileOpen(!mobileOpen)}>{mobileOpen ? <X size={22} /> : <Menu size={22} />}</button><span className="adm-topbar-label">UWA / <strong>Catalog workspace</strong></span></div>
            <div className="adm-admin-identity"><span className="adm-admin-avatar" aria-hidden="true">{user?.firstname.slice(0, 1).toUpperCase() || 'A'}</span><span><strong>{user?.firstname} {user?.lastname}</strong><small>Administrator</small></span><span className="adm-online-dot" aria-label="Administrator verified" /></div>
          </header>
          <div className="adm-content">{children}</div>
          <div className="adm-workspace-footer"><span>UWA Studio</span><span>Good things, thoughtfully managed.</span></div>
        </div>
        <div className={`adm-toast ${notice ? 'is-visible' : ''}`} role="status" aria-live="polite"><Check size={18} aria-hidden="true" />{notice}</div>
      </div>
    </AdminContext.Provider>
  );
}
