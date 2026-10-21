import type { Metadata } from 'next';
import { AdminShell } from '@/components/admin/admin-shell';
import './admin.css';

export const metadata: Metadata = { title: { default: 'UWA Studio', template: '%s · UWA Studio' }, robots: { index: false, follow: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
