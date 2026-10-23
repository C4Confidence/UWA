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

export interface AdminProductIssue {
  field: keyof ProductInput;
  message: string;
  storedValue: string;
}

// Reads must describe legacy records without making them valid write payloads.
export interface AdminProduct extends Omit<ProductInput, 'price' | 'quantity'> {
  _id: string;
  price: number | null;
  quantity: number | null;
  issues: AdminProductIssue[];
  imageEntries: AdminImageEntry[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CatalogSummary {
  totalProducts: number;
  inStock: number;
  lowStock: number;
  outOfStock: number;
  totalUnits: number | null;
}

export interface AdminCatalog {
  products: AdminProduct[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  summary: CatalogSummary;
  categories: string[];
  unavailableProducts: { position: number; reason: string }[];
  summaryIssues: string[];
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

function storedValue(value: unknown): string {
  if (value === undefined) return 'Missing';
  if (value === null) return 'null';
  if (typeof value === 'string') return `Text: ${JSON.stringify(value).slice(0, 160)}`;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return Array.isArray(value) ? 'Array value' : 'Object value';
}

function safeImageMetadata(value: unknown, depth = 0): boolean {
  if (depth > 4) return false;
  if (value === null || typeof value === 'boolean') return true;
  if (typeof value === 'string') return value.length <= 4096;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.length <= 32 && value.every(entry => safeImageMetadata(entry, depth + 1));
  if (!value || typeof value !== 'object') return false;
  const entries = Object.entries(value);
  return entries.length <= 20 && entries.every(([key, entry]) => !key.startsWith('$') && !key.includes('.') && !['__proto__', 'constructor', 'prototype'].includes(key) && safeImageMetadata(entry, depth + 1));
}

export function normalizeAdminProduct(value: unknown): AdminProduct {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AdminApiError('The record is not a product object.', 502);
  const product = value as Record<string, unknown>;
  const id = product._id ?? product.id;
  if (typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)) {
    throw new AdminApiError('The record has no valid product ID and cannot be edited safely.', 502);
  }
  const issues: AdminProductIssue[] = [];
  const issue = (field: keyof ProductInput, message: string) => issues.push({ field, message, storedValue: storedValue(product[field]) });
  const text = (key: 'title' | 'slug' | 'description' | 'brand' | 'category' | 'color', maximum: number) => {
    const value = product[key];
    if (typeof value !== 'string' || !value.trim() || value.trim().length > maximum) issue(key, `Enter ${key} as text between 1 and ${maximum.toLocaleString('en')} characters.`);
    return typeof value === 'string' ? value : '';
  };
  const title = text('title', 200);
  const slug = text('slug', 200);
  const description = text('description', 20000);
  const brand = text('brand', 120);
  const category = text('category', 120);
  const color = text('color', 120);
  const price = typeof product.price === 'number' && Number.isFinite(product.price) && product.price >= 0 && product.price <= Number.MAX_SAFE_INTEGER ? product.price : null;
  const quantity = typeof product.quantity === 'number' && Number.isSafeInteger(product.quantity) && product.quantity >= 0 ? product.quantity : null;
  if (price === null) issue('price', 'Enter a finite, non-negative price. The stored value has not been converted.');
  if (quantity === null) issue('quantity', 'Enter a non-negative whole stock quantity. The stored value has not been converted.');
  const imageEntries: AdminImageEntry[] = (Array.isArray(product.images) ? product.images : []).flatMap((image: unknown): AdminImageEntry[] => {
    const url = typeof image === 'string' ? image : image && typeof image === 'object' && !Array.isArray(image) && 'url' in image && typeof image.url === 'string' ? image.url : '';
    if (!url || !validImageReference(url)) return [];
    if (typeof image !== 'string' && (!safeImageMetadata(image) || JSON.stringify(image).length > 8192)) return [];
    return typeof image === 'string' ? [image] : [{ ...(image as Record<string, unknown>), url }];
  });
  if ((product.images !== undefined && !Array.isArray(product.images)) || (Array.isArray(product.images) && (product.images.length !== imageEntries.length || product.images.length > 32))) {
    issue('images', 'Some stored image data needs review. Only safe references are previewed; replacing the gallery requires your confirmation.');
  }
  const images = imageEntries.map(image => typeof image === 'string' ? image : image.url);
  return { _id: id, title, price, quantity, slug, description, brand, category, color, images, imageEntries, issues, createdAt: typeof product.createdAt === 'string' ? product.createdAt : undefined, updatedAt: typeof product.updatedAt === 'string' ? product.updatedAt : undefined };
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
  if (!data || !Array.isArray(data.products) || !data.summary || typeof data.summary !== 'object' || Array.isArray(data.summary) || !['page', 'limit', 'total', 'totalPages'].every(key => typeof data[key] === 'number' && Number.isSafeInteger(data[key]) && (data[key] as number) >= (key === 'page' || key === 'limit' ? 1 : 0)) || !Array.isArray(data.categories)) throw new AdminApiError('The catalog response is unavailable. Please try again.', 502);
  const summary = data.summary as Record<string, unknown>;
  if (!['totalProducts', 'inStock', 'lowStock', 'outOfStock'].every(key => typeof summary[key] === 'number' && Number.isSafeInteger(summary[key]) && (summary[key] as number) >= 0)) throw new AdminApiError('Catalog totals are unavailable. Please try again.', 502);
  const totalUnits = typeof summary.totalUnits === 'number' && Number.isSafeInteger(summary.totalUnits) && summary.totalUnits >= 0 ? summary.totalUnits : null;
  const products: AdminProduct[] = [];
  const unavailableProducts: AdminCatalog['unavailableProducts'] = [];
  const ids = new Set<string>();
  data.products.forEach((value: unknown, index: number) => {
    try {
      const product = normalizeAdminProduct(value);
      if (ids.has(product._id.toLowerCase())) throw new AdminApiError('The API returned a duplicate product ID; this row cannot be edited safely.', 502);
      ids.add(product._id.toLowerCase());
      products.push(product);
    } catch (error) {
      if (!(error instanceof AdminApiError)) throw error;
      unavailableProducts.push({ position: ((data.page as number) - 1) * (data.limit as number) + index + 1, reason: error.message });
    }
  });
  return { products, unavailableProducts, summaryIssues: totalUnits === null ? ['The API reported an invalid total unit count. It is unavailable until the stored stock data is reviewed.'] : [], page: data.page as number, limit: data.limit as number, total: data.total as number, totalPages: data.totalPages as number, summary: { totalProducts: summary.totalProducts as number, inStock: summary.inStock as number, lowStock: summary.lowStock as number, outOfStock: summary.outOfStock as number, totalUnits }, categories: data.categories.filter((value): value is string => typeof value === 'string' && !!value.trim()) };
}

export async function getAdminProduct(id: string, token: string, signal?: AbortSignal): Promise<AdminProduct> {
  if (!/^[a-f\d]{24}$/i.test(id)) throw new AdminApiError('This product could not be found.', 404);
  const product = normalizeAdminProduct(await adminFetch<unknown>(`/api/admin/products/${id}`, token, { signal }));
  if (product._id.toLowerCase() !== id.toLowerCase()) throw new AdminApiError('The response identifies a different product. Reload before making changes.', 502);
  return product;
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
  const product = normalizeAdminProduct(await adminFetch<unknown>(id ? `/api/admin/products/${id}` : '/api/admin/products', token, { method: id ? 'PATCH' : 'POST', body: JSON.stringify(payload) }));
  if (id && product._id.toLowerCase() !== id.toLowerCase()) throw new AdminApiError('The response identifies a different product. Reload before making changes.', 502);
  return product;
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
