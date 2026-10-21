import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CatalogView } from '@/components/admin/catalog-view';

export const metadata: Metadata = { title: 'Inventory' };
export default function AdminInventoryPage() { return <Suspense fallback={<p className="adm-muted" role="status">Loading inventory…</p>}><CatalogView inventory /></Suspense>; }
