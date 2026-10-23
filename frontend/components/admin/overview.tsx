'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, ArrowUpRight, Boxes, CircleAlert, Image as ImageIcon, Package, Plus, RefreshCw, Sparkles } from 'lucide-react';
import { getAdminCatalog, type AdminCatalog } from '@/lib/admin-api';
import { money } from '@/lib/api';
import { useAdmin } from './admin-shell';
import { AdminError, AdminThumbnail, CatalogDataWarnings, ProductAttention, StockBadge, formatCount, productDisplayTitle } from './admin-common';

export function AdminOverview() {
  const { user, token, catalogVersion, handleError } = useAdmin();
  const [data, setData] = useState<AdminCatalog | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    getAdminCatalog(new URLSearchParams({ limit: '5', page: '1', sort: '-updatedAt' }), token, controller.signal)
      .then(setData).catch(failure => { if (!controller.signal.aborted && !handleError(failure)) setError(failure instanceof Error ? failure.message : 'The overview could not be loaded.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, catalogVersion, handleError, retry]);

  const stats = data ? [
    { label: 'Total products', value: data.summary.totalProducts, note: 'Across your collection', icon: Package, href: '/admin/products', style: 'adm-stat-dark' },
    { label: 'In stock', value: data.summary.inStock, note: 'Ready to discover', icon: Boxes, href: '/admin/inventory?stock=in-stock', style: 'adm-stat-green' },
    { label: 'Low stock', value: data.summary.lowStock, note: '1–5 units available', icon: CircleAlert, href: '/admin/inventory?stock=low-stock', style: 'adm-stat-amber' },
    { label: 'Out of stock', value: data.summary.outOfStock, note: 'Ready for a restock', icon: Package, href: '/admin/inventory?stock=out-of-stock', style: 'adm-stat-red' },
  ] : [];
  const total = data?.summary.totalProducts || 0;
  const healthy = data ? Math.max(0, data.summary.inStock - data.summary.lowStock) : 0;

  return <>
    <div className="adm-page-heading"><div><p className="adm-page-eyebrow">A little perspective</p><h1>Welcome back, {user.firstname}<span className="adm-title-dot">.</span></h1><p className="adm-muted">Here’s how your collection is looking. Let’s make good things happen.</p></div><button type="button" className="adm-button adm-button-secondary" onClick={() => setRetry(value => value + 1)} disabled={loading}><RefreshCw size={16} className={loading ? 'spin' : ''} aria-hidden="true" />Refresh</button></div>
    <section className="adm-welcome-banner"><div className="adm-welcome-copy"><p className="adm-page-eyebrow"><Sparkles size={14} aria-hidden="true" />Behind every good find</p><h2>A collection with<br />your point of view.</h2><p>Thoughtful details. Fresh perspectives.<br />Keep the UWA collection feeling like UWA.</p><Link href="/admin/products/new" className="adm-button adm-button-dark"><Plus size={17} aria-hidden="true" />Add something good</Link></div><div className="adm-banner-art" aria-hidden="true"><span className="adm-art-circle" /><span className="adm-art-square" /><span className="adm-art-star">✳</span><span className="adm-art-tag">GOOD<br />THINGS<br />INSIDE ↗</span></div><span className="adm-banner-index">THE CATALOG / YOUR CANVAS</span></section>
    {error ? <AdminError message={error} retry={() => setRetry(value => value + 1)} /> : <>
      <div className="adm-stats-grid" aria-label="Catalog totals">{data ? stats.map(stat => <Link href={stat.href} className={`adm-stat-card ${stat.style}`} key={stat.label}><div className="adm-stat-top"><span>{stat.label}</span><stat.icon size={19} strokeWidth={1.6} aria-hidden="true" /></div><strong>{formatCount(stat.value)}</strong><div className="adm-stat-bottom"><span>{stat.note}</span><ArrowUpRight size={17} aria-hidden="true" /></div></Link>) : [1, 2, 3, 4].map(value => <div className="adm-stat-card adm-stat-loading" key={value} aria-hidden="true"><span /><strong /><span /></div>)}</div>
      {data && <CatalogDataWarnings data={data} />}
      <div className="adm-overview-grid">
        <section className="adm-panel"><div className="adm-panel-heading"><div><p className="adm-page-eyebrow">The latest in your world</p><h2>Recently updated</h2></div><Link href="/admin/products" className="adm-text-link">All products <ArrowRight size={16} aria-hidden="true" /></Link></div>
          {loading && !data ? <div className="adm-table-skeleton" role="status" aria-label="Loading recent products">{[1, 2, 3].map(row => <div className="adm-skeleton-row" key={row}><span /><span /></div>)}</div> : data && !data.products.length && (data.total > 0 || data.unavailableProducts.length > 0) ? <div className="adm-empty-state"><span className="adm-state-icon"><CircleAlert size={28} strokeWidth={1.3} aria-hidden="true" /></span><h2>These records need review.</h2><p className="adm-muted">Recent product records couldn’t be displayed safely. Review their positions above and open the catalog to continue.</p><Link href="/admin/products" className="adm-button adm-button-secondary">Review the catalog <ArrowRight size={16} aria-hidden="true" /></Link></div> : !data?.products.length ? <div className="adm-empty-state"><span className="adm-state-icon"><Package size={28} strokeWidth={1.3} aria-hidden="true" /></span><h2>Your next chapter starts here.</h2><p className="adm-muted">Add your first product to bring the collection to life.</p><Link href="/admin/products/new" className="adm-button adm-button-primary"><Plus size={17} aria-hidden="true" />Create a product</Link></div> : <div className="adm-recent-products">{data.products.map(product => <Link href={`/admin/products/${product._id}/edit`} key={product._id} className="adm-recent-product"><AdminThumbnail src={product.images[0]} title={productDisplayTitle(product)} /><div className="adm-recent-copy"><strong>{productDisplayTitle(product)}</strong>{!product.title.trim() && <span className="adm-product-id">ID: {product._id}</span>}<span>{product.category.trim() ? product.category : 'Category not set'} · {product.price === null ? 'Price unavailable' : money(product.price)}</span><ProductAttention product={product} linked={false} /></div><StockBadge quantity={product.quantity} /><ArrowUpRight size={17} className="adm-recent-arrow" aria-hidden="true" /></Link>)}</div>}
        </section>
        <div className="adm-overview-side"><section className="adm-panel adm-stock-health"><div className="adm-panel-heading"><div><p className="adm-page-eyebrow">Room to grow</p><h2>Stock at a glance</h2></div><Boxes size={21} strokeWidth={1.5} aria-hidden="true" /></div><div className="adm-panel-body"><div className="adm-units-total"><strong>{data ? formatCount(data.summary.totalUnits) : '—'}</strong><span>units across your catalog</span></div><div className="adm-health-bar" role="img" aria-label={data ? `${healthy} products with more than five units, ${data.summary.lowStock} low stock, ${data.summary.outOfStock} out of stock` : 'Loading stock totals'}>{total > 0 ? <><span className="is-green" style={{ width: `${healthy / total * 100}%` }} /><span className="is-amber" style={{ width: `${(data?.summary.lowStock || 0) / total * 100}%` }} /><span className="is-red" style={{ width: `${(data?.summary.outOfStock || 0) / total * 100}%` }} /></> : <span className="is-empty" />}</div><div className="adm-health-legend"><span><i className="is-green" />Healthy stock</span><span><i className="is-amber" />Low stock</span><span><i className="is-red" />Out of stock</span></div><Link href="/admin/inventory" className="adm-button adm-button-secondary">Manage inventory <ArrowRight size={16} aria-hidden="true" /></Link></div></section>
          <section className="adm-quick-panel"><div className="adm-quick-icon"><ImageIcon size={22} strokeWidth={1.4} aria-hidden="true" /></div><h2>Details make<br />the difference.</h2><p>Give every product its best side. Add thoughtful descriptions and clear, considered imagery.</p><Link href="/admin/products" className="adm-text-link">Refine the collection <ArrowUpRight size={17} aria-hidden="true" /></Link></section>
        </div>
      </div>
      <p className="adm-catalog-footnote">Catalog totals include all products, across every category.</p>
    </>}
  </>;
}
