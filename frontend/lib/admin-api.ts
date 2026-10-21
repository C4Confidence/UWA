export interface AdminUser {
  _id: string;
  firstname: string;
  lastname: string;
  email: string;
  role: string;
}

export interface ProductInput {
  title: string;
  slug: string;
  description: string;
  price: number;
  brand: string;
  category: string;
  color: string;
  quantity: number;
  images: string[];
}

export type AdminImageEntry = string | { url: string; [key: string]: unknown };

export interface AdminProduct extends ProductInput {
  _id: string;
  imageEntries: AdminImageEntry[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CatalogSummary {
  totalProducts: number;
  inStock: number;
  lowStock: number;
  outOfStock: number;
  totalUnits: number;
}

export interface AdminCatalog {
  products: AdminProduct[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  summary: CatalogSummary;
  categories: string[];
}

export class AdminApiError extends Error {
  constructor(message: string, public status: number, public fields?: Record<string, string>) {
    super(message);
    this.name = 'AdminApiError';
  }
}

export function validImageReference(value: string): boolean {
  if (!value || value.length > 2048 || value !== value.trim() || /[\u0000-\u001f\u007f\\]/.test(value)) return false;
  if (value.startsWith('/')) {
    if (value.startsWith('//')) return false;
    let decoded = value.split(/[?#]/, 1)[0];
    try { for (let index = 0; index < 2; index++) decoded = decodeURIComponent(decoded); } catch { return false; }
    if (decoded.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(decoded) || decoded.split('/').some(part => part === '.' || part === '..')) return false;
    return !/^\/(api|_next|admin)(\/|$)/i.test(decoded);
  }
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; }
}

export function normalizeAdminProduct(value: unknown): AdminProduct {
  if (!value || typeof value !== 'object') throw new AdminApiError('This product’s information is unavailable. Please try again.', 502);
  const product = value as Record<string, unknown>;
  if (typeof product._id !== 'string' || !/^[a-f\d]{24}$/i.test(product._id) || typeof product.title !== 'string' || typeof product.price !== 'number' || !Number.isFinite(product.price) || typeof product.quantity !== 'number' || !Number.isInteger(product.quantity)) {
    throw new AdminApiError('This product’s information is incomplete. Please try again.', 502);
  }
  const text = (key: string) => typeof product[key] === 'string' ? product[key] as string : '';
  const imageEntries: AdminImageEntry[] = (Array.isArray(product.images) ? product.images : []).flatMap((image: unknown): AdminImageEntry[] => {
    const url = typeof image === 'string' ? image : image && typeof image === 'object' && 'url' in image && typeof image.url === 'string' ? image.url : '';
    if (!url || !validImageReference(url)) return [];
    return typeof image === 'string' ? [image] : [{ ...(image as Record<string, unknown>), url }];
  });
  const images = imageEntries.map(image => typeof image === 'string' ? image : image.url);
  return { _id: product._id, title: product.title, price: product.price, quantity: product.quantity, slug: text('slug'), description: text('description'), brand: text('brand'), category: text('category'), color: text('color'), images, imageEntries, createdAt: text('createdAt') || undefined, updatedAt: text('updatedAt') || undefined };
}

export async function adminFetch<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (options.signal?.aborted) controller.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, 25000);
  try {
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${token}`);
    if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
    const response = await fetch(path, { ...options, headers, signal: controller.signal, credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) {
      let body: Record<string, unknown> = {};
      try { const result: unknown = await response.json(); if (result && typeof result === 'object') body = result as Record<string, unknown>; } catch { /* A proxy may return HTML. Never expose its body. */ }
      const messages: Record<number, string> = {
        400: 'Some details need your attention. Check your entries and try again.',
        401: 'Your session has expired. Please sign in again.',
        403: 'Administrator access is required for this action.',
        404: 'This product could not be found. It may have been removed.',
        409: 'That slug is already in use. Choose a different slug.',
        413: 'These files are too large. Choose images smaller than 5 MB each.',
        415: 'Choose JPEG, PNG or WebP images.',
        429: 'Too many requests. Please wait a moment and try again.',
      };
      const fields: Record<string, string> = {};
      const validation = body.fields || body.errors;
      if (validation && typeof validation === 'object' && !Array.isArray(validation)) {
        for (const key of Object.keys(validation)) if (['title', 'slug', 'description', 'price', 'brand', 'category', 'color', 'quantity', 'images'].includes(key)) fields[key] = 'Please check this field.';
      }
      if (response.status === 409) fields.slug = 'This slug is already in use.';
      throw new AdminApiError(messages[response.status] || 'The catalog service is unavailable. Please try again shortly.', response.status, fields);
    }
    if (response.status === 204) return undefined as T;
    return await response.json() as T;
  } catch (error) {
    if (error instanceof AdminApiError) throw error;
    if (options.signal?.aborted) throw new DOMException('Request cancelled', 'AbortError');
    throw new AdminApiError(controller.signal.aborted ? 'The request took too long. Please try again.' : 'We couldn’t connect to the catalog service. Check your connection and try again.', 0);
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', abort);
  }
}

export async function getAdminCatalog(params: URLSearchParams, token: string, signal?: AbortSignal): Promise<AdminCatalog> {
  const data = await adminFetch<Record<string, unknown>>(`/api/admin/products?${params}`, token, { signal });
  if (!Array.isArray(data.products) || !data.summary || typeof data.summary !== 'object' || !['page', 'limit', 'total', 'totalPages'].every(key => typeof data[key] === 'number' && Number.isFinite(data[key])) || !Array.isArray(data.categories)) throw new AdminApiError('The catalog response is unavailable. Please try again.', 502);
  const summary = data.summary as Record<string, unknown>;
  if (!['totalProducts', 'inStock', 'lowStock', 'outOfStock', 'totalUnits'].every(key => typeof summary[key] === 'number' && Number.isFinite(summary[key]) && (summary[key] as number) >= 0)) throw new AdminApiError('Catalog totals are unavailable. Please try again.', 502);
  return { products: data.products.map(normalizeAdminProduct), page: data.page as number, limit: data.limit as number, total: data.total as number, totalPages: data.totalPages as number, summary: summary as unknown as CatalogSummary, categories: data.categories.filter((value): value is string => typeof value === 'string' && !!value) };
}

export async function getAdminProduct(id: string, token: string, signal?: AbortSignal): Promise<AdminProduct> {
  if (!/^[a-f\d]{24}$/i.test(id)) throw new AdminApiError('This product could not be found.', 404);
  return normalizeAdminProduct(await adminFetch<unknown>(`/api/admin/products/${id}`, token, { signal }));
}

export async function saveAdminProduct(input: Partial<ProductInput>, token: string, id?: string, originalImageEntries: readonly AdminImageEntry[] = []): Promise<AdminProduct> {
  const payload: Omit<Partial<ProductInput>, 'images'> & { images?: AdminImageEntry[] } = { ...input };
  if (input.images) {
    const remaining = [...originalImageEntries];
    payload.images = input.images.map(url => {
      const match = remaining.findIndex(entry => (typeof entry === 'string' ? entry : entry.url) === url);
      return match >= 0 ? remaining.splice(match, 1)[0] : url;
    });
  }
  return normalizeAdminProduct(await adminFetch<unknown>(id ? `/api/admin/products/${id}` : '/api/admin/products', token, { method: id ? 'PATCH' : 'POST', body: JSON.stringify(payload) }));
}

export async function uploadAdminImages(files: File[], token: string): Promise<string[]> {
  const body = new FormData();
  files.forEach(file => body.append('images', file));
  const result = await adminFetch<{ images?: unknown }>('/api/admin/uploads', token, { method: 'POST', body });
  if (!Array.isArray(result.images) || result.images.length !== files.length) throw new AdminApiError('The upload response could not be verified. Please try again.', 502);
  return result.images.map((entry: unknown) => {
    const url = entry && typeof entry === 'object' && 'url' in entry ? entry.url : entry;
    if (typeof url !== 'string' || !validImageReference(url)) throw new AdminApiError('An uploaded image path could not be verified.', 502);
    return url;
  });
}
