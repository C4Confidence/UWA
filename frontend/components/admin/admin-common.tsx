'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Image as ImageIcon, LoaderCircle, RefreshCw, X } from 'lucide-react';
import type { AdminCatalog, AdminProduct } from '@/lib/admin-api';

export const formatCount = (number: number | null) => number === null ? 'Unavailable' : new Intl.NumberFormat('en').format(number);
export const productDisplayTitle = (product: AdminProduct) => product.title.trim() ? product.title : 'Untitled product';

export function StockBadge({ quantity }: { quantity: number | null }) {
  if (quantity === null) return <span className="adm-stock-badge is-unavailable">Stock unavailable</span>;
  return <span className={`adm-stock-badge ${quantity === 0 ? 'is-out' : quantity <= 5 ? 'is-low' : 'is-in'}`}><span />{quantity === 0 ? 'Out of stock' : quantity <= 5 ? 'Low stock' : 'In stock'}</span>;
}

export function ProductAttention({ product, linked = true }: { product: AdminProduct; linked?: boolean }) {
  if (!product.issues.length) return null;
  const content = <>Needs attention: {product.issues.map(issue => issue.field).join(', ')} <span>· Review &amp; repair</span></>;
  return linked ? <Link className="adm-record-attention" href={`/admin/products/${product._id}/edit`}>{content}</Link> : <span className="adm-record-attention">{content}</span>;
}

export function CatalogDataWarnings({ data }: { data: AdminCatalog }) {
  const hasLegacyIssues = data.products.some(product => product.issues.length > 0);
  if (!data.unavailableProducts.length && !data.summaryIssues.length && !hasLegacyIssues) return null;
  return <div className="adm-notice adm-notice-warning adm-data-warning" role="status"><AlertCircle size={18} aria-hidden="true" /><div><strong>Some catalog records need review.</strong><p>{data.unavailableProducts.length ? 'Available product records remain editable. Records without usable IDs are listed below.' : hasLegacyIssues ? 'Products marked “Needs attention” can be reviewed and repaired individually.' : 'Some catalog totals are unavailable while stock data needs review.'}</p>{hasLegacyIssues && <p>Totals are reported by the API and may include incomplete legacy values.</p>}{(data.unavailableProducts.length > 0 || data.summaryIssues.length > 0) && <ul>{data.unavailableProducts.map(item => <li key={item.position}>Record {item.position}: {item.reason}</li>)}{data.summaryIssues.map(issue => <li key={issue}>{issue}</li>)}</ul>}</div></div>;
}

export function AdminThumbnail({ src, title }: { src?: string; title: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [src]);
  return <div className="adm-product-thumbnail">{src && !failed
    // Product images may use administrator-provided HTTPS hosts or local upload paths.
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={src} alt={title} width={72} height={72} loading="lazy" onError={() => setFailed(true)} />
    : <ImageIcon size={22} strokeWidth={1.25} aria-label="No image available" />}</div>;
}

export function AdminError({ message, retry }: { message: string; retry?: () => void }) {
  return <div className="adm-error-state" role="alert"><span className="adm-state-icon"><AlertCircle size={27} strokeWidth={1.4} aria-hidden="true" /></span><h2>A small interruption.</h2><p className="adm-muted">{message}</p>{retry && <button type="button" className="adm-button adm-button-secondary" onClick={retry}><RefreshCw size={16} aria-hidden="true" />Try again</button>}</div>;
}

export function AdminDialog({ title, children, confirmLabel, pending, destructive = false, onConfirm, onClose }: { title: string; children: React.ReactNode; confirmLabel: string; pending: boolean; destructive?: boolean; onConfirm: () => void; onClose: () => void }) {
  const dialog = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cancel.current?.focus();
    return () => { document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus(); else document.querySelector<HTMLElement>('.adm-content h1')?.focus(); };
  }, []);
  useEffect(() => { if (pending) dialog.current?.focus(); }, [pending]);
  return <div className="adm-modal-backdrop" onClick={event => { if (event.target === event.currentTarget && !pending) onClose(); }}>
    <div className="adm-modal" role="dialog" aria-modal="true" aria-labelledby="adm-modal-title" ref={dialog} tabIndex={-1} onKeyDown={event => {
      if (event.key === 'Escape' && !pending) { event.stopPropagation(); onClose(); }
      if (event.key === 'Tab') {
        const elements = dialog.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]');
        if (!elements?.length) { event.preventDefault(); dialog.current?.focus(); return; }
        const first = elements[0]; const last = elements[elements.length - 1];
        if (document.activeElement === dialog.current || !dialog.current?.contains(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first).focus(); return; }
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }}>
      <form onSubmit={event => { event.preventDefault(); if (!pending) onConfirm(); }}>
        <div className="adm-modal-heading"><h2 id="adm-modal-title">{title}</h2><button className="adm-icon-button" type="button" onClick={onClose} disabled={pending} aria-label="Close dialog"><X size={20} aria-hidden="true" /></button></div>
        <div className="adm-modal-body">{children}</div>
        <div className="adm-modal-actions"><button ref={cancel} className="adm-button adm-button-secondary" type="button" onClick={onClose} disabled={pending}>Cancel</button><button className={`adm-button ${destructive ? 'adm-button-danger' : 'adm-button-primary'}`} type="submit" disabled={pending}>{pending && <LoaderCircle size={16} className="spin" aria-hidden="true" />}{pending ? 'Please wait…' : confirmLabel}</button></div>
      </form>
    </div>
  </div>;
}
