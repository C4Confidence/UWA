import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CatalogView } from '@/components/admin/catalog-view';

export const metadata: Metadata = { title: 'Products' };
export default function AdminProductsPage() { return <Suspense fallback={<p className="adm-muted" role="status">Loading your collection…</p>}><CatalogView /></Suspense>; }
