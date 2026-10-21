'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUpRight, Boxes, ChevronLeft, ChevronRight, Filter, LoaderCircle, Package, Pencil, Plus, RefreshCw, Search, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { adminFetch, getAdminCatalog, saveAdminProduct, type AdminCatalog, type AdminProduct } from '@/lib/admin-api';
import { money } from '@/lib/api';
import { useAdmin } from './admin-shell';
import { AdminDialog, AdminError, AdminThumbnail, StockBadge, formatCount } from './admin-common';

const stockOptions = [{ value: '', label: 'All availability' }, { value: 'in-stock', label: 'In stock' }, { value: 'low-stock', label: 'Low stock' }, { value: 'out-of-stock', label: 'Out of stock' }];

export function CatalogView({ inventory = false }: { inventory?: boolean }) {
  const { token, catalogVersion, refreshCatalog, handleError, notify } = useAdmin();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [stock, setStock] = useState(stockOptions.some(option => option.value === searchParams.get('stock')) ? searchParams.get('stock') || '' : '');
  const [sort, setSort] = useState(inventory ? 'quantity,title' : '-updatedAt');
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [data, setData] = useState<AdminCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState<{ product: AdminProduct; mode: 'delete' | 'stock' } | null>(null);
  const [quantity, setQuantity] = useState('');
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const [mutationError, setMutationError] = useState('');

  useEffect(() => {
    const nextQuery = search.trim();
    if (nextQuery === query) return;
    const timer = setTimeout(() => { setQuery(nextQuery); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [search, query]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    const params = new URLSearchParams({ page: String(page), limit: '12', sort });
    if (query) params.set('q', query);
    if (category) params.set('category', category);
    if (stock) params.set('stock', stock);
    getAdminCatalog(params, token, controller.signal).then(result => {
      if (page > Math.max(1, result.totalPages)) { setPage(Math.max(1, result.totalPages)); return; }
      setData(result);
    }).catch(failure => { if (!controller.signal.aborted && !handleError(failure)) setError(failure instanceof Error ? failure.message : 'The collection could not be loaded.'); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, query, category, stock, sort, page, reload, catalogVersion, handleError]);

  const filtered = !!query || !!category || !!stock;
  function clearFilters() { setSearch(''); setQuery(''); setCategory(''); setStock(''); setPage(1); }
  function openDialog(product: AdminProduct, mode: 'delete' | 'stock') { setMutationError(''); setQuantity(String(product.quantity)); setDialog({ product, mode }); }

  async function mutate() {
    if (!dialog || busy.current) return;
    const nextQuantity = Number(quantity);
    if (dialog.mode === 'stock' && (!quantity.trim() || !Number.isSafeInteger(nextQuantity) || nextQuantity < 0)) { setMutationError('Enter a whole number of zero or more.'); return; }
    busy.current = true; setPending(true); setMutationError('');
    try {
      if (dialog.mode === 'delete') await adminFetch(`/api/admin/products/${dialog.product._id}`, token, { method: 'DELETE' });
      else await saveAdminProduct({ quantity: nextQuantity }, token, dialog.product._id);
      notify(dialog.mode === 'delete' ? 'Product deleted from the catalog.' : 'Stock quantity updated.');
      setDialog(null); refreshCatalog();
    } catch (failure) { if (!handleError(failure)) setMutationError(failure instanceof Error ? failure.message : 'The update could not be saved. Please try again.'); }
    finally { busy.current = false; setPending(false); }
  }

  return <>
    <div className="adm-page-heading"><div><p className="adm-page-eyebrow">Your collection, considered</p><h1>{inventory ? 'Inventory' : 'Products'}<span className="adm-title-dot">.</span></h1><p className="adm-muted">{inventory ? 'Keep the good things in stock. Every quantity, in one place.' : 'A home for every good find. Curate, refine and keep it fresh.'}</p></div><Link className="adm-button adm-button-primary" href="/admin/products/new"><Plus size={18} aria-hidden="true" />Add product</Link></div>
    {inventory && data && <div className="adm-inventory-cards"><button className={`adm-mini-stat ${!stock ? 'is-selected' : ''}`} onClick={() => { setStock(''); setPage(1); }}><Boxes size={20} aria-hidden="true" /><span>Total units<strong>{formatCount(data.summary.totalUnits)}</strong></span><ArrowRight size={17} aria-hidden="true" /></button><button className={`adm-mini-stat ${stock === 'low-stock' ? 'is-selected' : ''}`} onClick={() => { setStock('low-stock'); setPage(1); }}><span className="adm-stat-indicator is-amber" /><span>Running low<strong>{formatCount(data.summary.lowStock)}</strong></span><ArrowRight size={17} aria-hidden="true" /></button><button className={`adm-mini-stat ${stock === 'out-of-stock' ? 'is-selected' : ''}`} onClick={() => { setStock('out-of-stock'); setPage(1); }}><span className="adm-stat-indicator is-red" /><span>Out of stock<strong>{formatCount(data.summary.outOfStock)}</strong></span><ArrowRight size={17} aria-hidden="true" /></button></div>}
    <section className="adm-panel adm-catalog-panel" aria-label={inventory ? 'Inventory management' : 'Product management'}>
      <div className="adm-catalog-heading"><div><h2>{inventory ? 'Stock overview' : 'Your products'}{data && <span className="adm-count-tag">{formatCount(data.total)}</span>}</h2><p className="adm-muted">{inventory ? 'Low stock means 1–5 units available.' : 'Manage the details that make your collection.'}</p></div><button type="button" className="adm-icon-button" onClick={() => setReload(value => value + 1)} disabled={loading} aria-label="Refresh product catalog"><RefreshCw size={17} className={loading ? 'spin' : ''} aria-hidden="true" /></button></div>
      <div className="adm-toolbar"><div className="adm-search"><Search size={18} aria-hidden="true" /><label className="adm-visually-hidden" htmlFor="adm-search">Search products</label><input id="adm-search" type="search" placeholder="Search by name, slug or brand…" value={search} maxLength={120} onChange={event => setSearch(event.target.value)} />{search && <button type="button" className="adm-icon-button" aria-label="Clear search" onClick={() => setSearch('')}><X size={15} aria-hidden="true" /></button>}</div><div className="adm-filter-select"><Filter size={15} aria-hidden="true" /><label className="adm-visually-hidden" htmlFor="adm-category">Filter by category</label><select id="adm-category" value={category} onChange={event => { setCategory(event.target.value); setPage(1); }}><option value="">All categories</option>{data?.categories.map(value => <option key={value} value={value}>{value}</option>)}</select></div><div className="adm-filter-select"><label className="adm-visually-hidden" htmlFor="adm-stock">Filter by availability</label><select id="adm-stock" value={stock} onChange={event => { setStock(event.target.value); setPage(1); }}>{stockOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div><div className="adm-filter-select"><ArrowDown size={15} aria-hidden="true" /><label className="adm-visually-hidden" htmlFor="adm-sort">Sort products</label><select id="adm-sort" value={sort} onChange={event => { setSort(event.target.value); setPage(1); }}><option value="-updatedAt">Recently updated</option><option value="-createdAt">Newest first</option><option value="title">Name: A–Z</option><option value="-title">Name: Z–A</option><option value="price">Price: low to high</option><option value="-price">Price: high to low</option><option value="quantity,title">Stock: low to high</option><option value="-quantity,title">Stock: high to low</option></select></div></div>
      {filtered && <div className="adm-filter-summary"><span><SlidersHorizontal size={14} aria-hidden="true" />Filters applied{query ? ` · “${query}”` : ''}{stock ? ` · ${stockOptions.find(option => option.value === stock)?.label}` : ''}{category ? ` · ${category}` : ''}</span><button className="adm-text-button" type="button" onClick={clearFilters}>Clear all</button></div>}
      {error ? <AdminError message={error} retry={() => setReload(value => value + 1)} /> : loading && !data ? <div className="adm-table-skeleton" role="status" aria-label="Loading products">{[1, 2, 3, 4, 5].map(row => <div className="adm-skeleton-row" key={row}><span /><span /><span /></div>)}</div> : data && !data.products.length ? <div className="adm-empty-state"><span className="adm-state-icon"><Package size={30} strokeWidth={1.25} aria-hidden="true" /></span><h2>{filtered ? 'No products match just yet.' : 'A fresh beginning.'}</h2><p className="adm-muted">{filtered ? 'Try a different search or adjust your filters.' : 'Your catalog is ready for its first good find.'}</p>{filtered ? <button type="button" className="adm-button adm-button-secondary" onClick={clearFilters}>Clear filters</button> : <Link href="/admin/products/new" className="adm-button adm-button-primary"><Plus size={17} aria-hidden="true" />Add your first product</Link>}</div> : <>
        <div className={`adm-table-scroll ${loading ? 'adm-is-refreshing' : ''}`} aria-busy={loading}><table className="adm-product-table"><caption className="adm-visually-hidden">{inventory ? 'Product inventory and stock controls' : 'Products with prices, availability and management actions'}</caption><thead><tr><th scope="col">Product</th><th scope="col">Category / Brand</th><th scope="col">Price</th><th scope="col">Availability</th><th scope="col" className="adm-actions-column">Actions</th></tr></thead><tbody>{data?.products.map(product => <tr key={product._id}><td><div className="adm-table-product"><AdminThumbnail src={product.images[0]} title={product.title} /><div><Link className="adm-product-title" href={`/admin/products/${product._id}/edit`}>{product.title}</Link><span className="adm-product-slug">{product.slug || 'Slug not set'}</span></div></div></td><td><span className={!product.category ? 'adm-missing-data' : ''}>{product.category || 'Category not set'}</span><span className="adm-table-secondary">{product.brand || 'Brand not set'}</span></td><td className="adm-price-cell">{money(product.price)}</td><td><StockBadge quantity={product.quantity} /><span className="adm-table-secondary">{formatCount(product.quantity)} {product.quantity === 1 ? 'unit' : 'units'}</span></td><td><div className="adm-row-actions">{inventory && <button className="adm-stock-action" type="button" onClick={() => openDialog(product, 'stock')} aria-label={`Update stock for ${product.title}`}><Boxes size={16} aria-hidden="true" /><span>Update stock</span></button>}<Link className="adm-icon-button" href={`/admin/products/${product._id}/edit`} aria-label={`Edit ${product.title}`}><Pencil size={16} aria-hidden="true" /></Link><Link className="adm-icon-button" href={`/products/${product._id}`} target="_blank" rel="noopener noreferrer" aria-label={`View ${product.title} in storefront (opens in new tab)`}><ArrowUpRight size={17} aria-hidden="true" /></Link>{!inventory && <button type="button" className="adm-icon-button adm-icon-danger" aria-label={`Delete ${product.title}`} onClick={() => openDialog(product, 'delete')}><Trash2 size={16} aria-hidden="true" /></button>}</div></td></tr>)}</tbody></table></div>
        <div className="adm-pagination"><p className="adm-muted" aria-live="polite">{loading && <LoaderCircle size={13} className="spin" aria-hidden="true" />}{data ? `${formatCount((data.page - 1) * data.limit + 1)}–${formatCount(Math.min(data.page * data.limit, data.total))} of ${formatCount(data.total)} products` : 'Loading products'}</p><div><button className="adm-icon-button" type="button" aria-label="Previous page" disabled={loading || page <= 1} onClick={() => setPage(value => value - 1)}><ChevronLeft size={18} aria-hidden="true" /></button><span>Page {page} of {Math.max(1, data?.totalPages || 1)}</span><button className="adm-icon-button" type="button" aria-label="Next page" disabled={loading || page >= (data?.totalPages || 1)} onClick={() => setPage(value => value + 1)}><ChevronRight size={18} aria-hidden="true" /></button></div></div>
      </>}
    </section>
    <p className="adm-catalog-footnote">Changes are saved to the live catalog only when you confirm them.</p>
    {dialog && <AdminDialog title={dialog.mode === 'delete' ? 'Remove this good find?' : 'Update stock quantity'} confirmLabel={dialog.mode === 'delete' ? 'Delete product' : 'Save stock'} pending={pending} destructive={dialog.mode === 'delete'} onConfirm={() => void mutate()} onClose={() => { if (!pending) setDialog(null); }}>
      <div className="adm-dialog-product"><AdminThumbnail src={dialog.product.images[0]} title={dialog.product.title} /><div><strong>{dialog.product.title}</strong><p className="adm-muted">{dialog.product.slug || 'No slug'}</p></div></div>
      {dialog.mode === 'delete' ? <p className="adm-muted">This permanently removes the product from the catalog and storefront. This action can’t be undone. Uploaded image files are kept.</p> : <><div className="adm-field"><label htmlFor="adm-stock-quantity">Available units</label><input id="adm-stock-quantity" type="number" min="0" step="1" required value={quantity} onChange={event => setQuantity(event.target.value)} disabled={pending} /><p className="adm-field-help">Only this product’s stock quantity will change. Current stock: {formatCount(dialog.product.quantity)}.</p></div></>}
      {mutationError && <p className="adm-notice adm-notice-error" role="alert">{mutationError}</p>}
    </AdminDialog>}
  </>;
}
