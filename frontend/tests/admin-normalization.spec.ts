import { expect, test } from '@playwright/test';
import { AdminApiError, getAdminCatalog, getAdminProduct, normalizeAdminProduct, saveAdminProduct } from '../lib/admin-api';

// Wire fixtures only: these tests replace fetch and never connect to MongoDB.
const id = '507f1f77bcf86cd799439011';
const product = {
  _id: id, title: 'Legacy test headphones', slug: 'legacy-test-headphones',
  description: 'Representative API data used only by regression tests.',
  price: 125.5, quantity: 100, category: 'Audio', brand: 'Test brand', color: 'Black',
  images: ['/redmi.jpg', { url: 'https://example.test/headphones.jpg', public_id: 'original-asset', metadata: { owner: 'test' } }],
  sold: 7, ratings: [{ star: 4 }], createdAt: '2026-10-01T00:00:00.000Z',
};
const params = new URLSearchParams({ page: '1', limit: '12' });
const originalFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = originalFetch; });

function envelope(products: unknown[], overrides: Record<string, unknown> = {}) {
  return {
    products, page: 1, limit: 12, total: products.length, totalPages: Math.ceil(products.length / 12),
    summary: { totalProducts: 12, inStock: 10, lowStock: 0, outOfStock: 0, totalUnits: 1000 },
    categories: ['Audio'], ...overrides,
  };
}

function respondWith(...responses: unknown[]) {
  const calls: { path: string; body: unknown }[] = [];
  globalThis.fetch = async (path, options) => {
    calls.push({ path: String(path), body: options?.body ? JSON.parse(String(options.body)) : null });
    if (!responses.length) throw new Error('Unexpected test API request');
    return new Response(JSON.stringify(responses.shift()), { headers: { 'Content-Type': 'application/json' } });
  };
  return calls;
}

test('the real flat admin envelope keeps all twelve identifiable records and API-reported totals', async () => {
  const records: Record<string, unknown>[] = Array.from({ length: 10 }, (_, index) => ({
    ...structuredClone(product), _id: (index + 1).toString(16).padStart(24, '0'),
  }));
  records.push(
    { ...product, _id: '000000000000000000000011', title: null, price: null, quantity: null, category: null },
    { ...product, _id: '000000000000000000000012', quantity: undefined, brand: { old: 'brand' } },
  );
  const snapshot = structuredClone(records);
  respondWith(envelope(records));
  const catalog = await getAdminCatalog(params, 'synthetic-token');
  expect(catalog.products).toHaveLength(12);
  expect(catalog.products.map(value => value._id)).toEqual(records.map(value => value._id));
  expect(catalog.products.slice(0, 10).every(value => value.price === 125.5 && value.quantity === 100)).toBe(true);
  expect(catalog.products[10]).toMatchObject({ title: '', price: null, quantity: null, category: '' });
  expect(catalog.products[11]).toMatchObject({ brand: '', quantity: null });
  expect(catalog.products[10].issues.map(issue => issue.field)).toEqual(expect.arrayContaining(['title', 'price', 'quantity', 'category']));
  expect(catalog.summary).toEqual({ totalProducts: 12, inStock: 10, lowStock: 0, outOfStock: 0, totalUnits: 1000 });
  expect(catalog.unavailableProducts).toEqual([]);
  expect(records).toEqual(snapshot);
});

test('valid values, IDs and compatible image objects are preserved exactly without mutating wire data', () => {
  const raw = structuredClone(product);
  const snapshot = structuredClone(raw);
  const normalized = normalizeAdminProduct(raw);
  expect(normalized).toMatchObject({ _id: id, title: product.title, price: 125.5, quantity: 100, imageEntries: product.images, issues: [] });
  expect(normalized.images).toEqual(['/redmi.jpg', 'https://example.test/headphones.jpg']);
  expect(normalized).not.toBe(raw);
  expect(raw).toEqual(snapshot);
  expect(normalizeAdminProduct({ ...product, title: ' Original title ', brand: ' Original brand ' })).toMatchObject({ title: ' Original title ', brand: ' Original brand ' });
});

test('id aliases use the same read normalization without replacing an authoritative invalid _id', async () => {
  const { _id, ...fields } = product;
  const raw = { ...fields, id: _id };
  expect(normalizeAdminProduct(raw)._id).toBe(id);
  expect(normalizeAdminProduct({ ...raw, _id: null })._id).toBe(id);
  expect(() => normalizeAdminProduct({ ...raw, _id: 'broken-id' })).toThrow('no valid product ID');
  respondWith(envelope([raw]), raw);
  expect((await getAdminCatalog(params, 'test')).products[0]._id).toBe(id);
  expect((await getAdminProduct(id, 'test'))._id).toBe(id);
});

const invalidNumbers: [string, unknown][] = [
  ['missing', undefined], ['null', null], ['numeric text', '100'], ['blank text', ''],
  ['boolean', false], ['object', { value: 100 }], ['array', [100]],
  ['negative', -1], ['infinite', Infinity], ['NaN', NaN], ['unsafe', Number.MAX_SAFE_INTEGER + 1],
];
for (const [name, value] of invalidNumbers) {
  test(`invalid ${name} commercial values stay unavailable instead of becoming zero`, () => {
    const raw = { ...product, price: value, quantity: value };
    const normalized = normalizeAdminProduct(raw);
    expect(normalized).toMatchObject({ _id: id, price: null, quantity: null });
    expect(normalized.issues.map(issue => issue.field)).toEqual(['price', 'quantity']);
    expect(raw.price).toBe(value);
    expect(raw.quantity).toBe(value);
  });
}

test('fractional stock is unavailable; legitimate zero and fractional prices keep their actual values', () => {
  expect(normalizeAdminProduct({ ...product, price: 19.95, quantity: 1.5 })).toMatchObject({ price: 19.95, quantity: null, issues: [expect.objectContaining({ field: 'quantity' })] });
  expect(normalizeAdminProduct({ ...product, price: 0, quantity: 0 })).toMatchObject({ price: 0, quantity: 0, issues: [] });
});

test('incomplete required text is repairable without substituting saved merchandising labels', () => {
  const normalized = normalizeAdminProduct({ ...product, title: null, description: [], category: { old: true }, brand: false, color: '', slug: undefined });
  expect(normalized).toMatchObject({ _id: id, title: '', description: '', category: '', brand: '', color: '', slug: '' });
  expect(normalized.issues.map(issue => issue.field)).toEqual(['title', 'slug', 'description', 'brand', 'category', 'color']);
  expect(normalized.issues.find(issue => issue.field === 'title')?.storedValue).toBe('null');
  expect(normalized.issues.find(issue => issue.field === 'slug')?.storedValue).toBe('Missing');
});

test('unsafe gallery entries are never previewed and are explicitly reported for review', () => {
  const raw = { ...product, images: [...product.images, 'javascript:alert(1)', '/%2e%2e/private.png', { url: '/safe.jpg', $operator: true }, null] };
  const snapshot = structuredClone(raw);
  const normalized = normalizeAdminProduct(raw);
  expect(normalized.imageEntries).toEqual(product.images);
  expect(normalized.issues).toEqual([expect.objectContaining({ field: 'images', message: expect.stringContaining('requires your confirmation') })]);
  expect(raw).toEqual(snapshot);
  expect(normalizeAdminProduct({ ...product, images: null }).issues.map(issue => issue.field)).toEqual(['images']);
  expect(normalizeAdminProduct({ ...product, images: undefined }).issues).toEqual([]);
});

test('one unusable record cannot reject safe or repairable neighbors, change total counts or renumber pagination', async () => {
  respondWith(envelope([product, null, { ...product, _id: 'unsafe-id' }, { ...product, _id: '507f1f77bcf86cd799439012', quantity: null }], {
    page: 2, total: 28, totalPages: 3,
  }));
  const catalog = await getAdminCatalog(params, 'test');
  expect(catalog.products).toHaveLength(2);
  expect(catalog.products[1].quantity).toBeNull();
  expect(catalog.unavailableProducts).toEqual([
    { position: 14, reason: 'The record is not a product object.' },
    { position: 15, reason: 'The record has no valid product ID and cannot be edited safely.' },
  ]);
  expect(catalog).toMatchObject({ page: 2, limit: 12, total: 28, totalPages: 3 });
});

test('an all-unusable page remains distinguishable from an empty catalog and retains later pages', async () => {
  respondWith(envelope(Array.from({ length: 12 }, () => ({ _id: 'invalid' })), { total: 13, totalPages: 2 }));
  const catalog = await getAdminCatalog(params, 'test');
  expect(catalog.products).toEqual([]);
  expect(catalog.unavailableProducts).toHaveLength(12);
  expect(catalog).toMatchObject({ total: 13, page: 1, totalPages: 2 });
});

test('duplicate identities cannot produce ambiguous edit actions', async () => {
  respondWith(envelope([product, { ...product, title: 'Duplicate wire record' }]));
  const catalog = await getAdminCatalog(params, 'test');
  expect(catalog.products).toHaveLength(1);
  expect(catalog.unavailableProducts).toEqual([{ position: 2, reason: expect.stringContaining('duplicate product ID') }]);
});

test('bad aggregate stock does not block repair or invent a total from the current page', async () => {
  for (const totalUnits of [null, -1, '1000', 1.5]) {
    respondWith(envelope([product], { summary: { totalProducts: 12, inStock: 10, lowStock: 0, outOfStock: 0, totalUnits } }));
    const catalog = await getAdminCatalog(params, 'test');
    expect(catalog.products).toHaveLength(1);
    expect(catalog.summary.totalUnits).toBeNull();
    expect(catalog.summaryIssues).toHaveLength(1);
    expect(catalog.summary.totalProducts).toBe(12);
  }
});

test('malformed envelopes and unauthorized responses remain explicit failures', async () => {
  for (const response of [null, [], { products: [] }, envelope([], { products: {} }), envelope([], { page: 0 }), envelope([], { summary: [] })]) {
    respondWith(response);
    await expect(getAdminCatalog(params, 'test')).rejects.toBeInstanceOf(AdminApiError);
  }
  globalThis.fetch = async () => new Response(JSON.stringify({ message: 'Private auth details' }), { status: 403 });
  await expect(getAdminCatalog(params, 'test')).rejects.toMatchObject({ status: 403, message: 'Administrator access is required for this action.' });
});

test('detail repair and partial saves omit untouched legacy fields and retain image metadata', async () => {
  const legacy = { ...product, title: null, price: null, quantity: null, category: null, brand: null };
  const calls = respondWith(legacy, { ...legacy, title: 'Explicit repaired title' }, { ...legacy, title: 'Explicit repaired title', quantity: 0 });
  const loaded = await getAdminProduct(id, 'test');
  expect(loaded).toMatchObject({ _id: id, price: null, quantity: null, title: '' });
  await saveAdminProduct({ title: 'Explicit repaired title' }, 'test', id);
  const repaired = await saveAdminProduct({ quantity: 0 }, 'test', id);
  expect(repaired.quantity).toBe(0);
  expect(calls.slice(1).map(call => call.body)).toEqual([{ title: 'Explicit repaired title' }, { quantity: 0 }]);
  respondWith({ ...product, images: [product.images[1], product.images[0]] });
  const saved = await saveAdminProduct({ images: ['https://example.test/headphones.jpg', '/redmi.jpg'] }, 'test', id, loaded.imageEntries);
  expect(saved.imageEntries).toEqual([product.images[1], product.images[0]]);
});

test('details and update responses cannot substitute another valid product identity', async () => {
  const differentProduct = { ...product, _id: '507f1f77bcf86cd799439099' };
  respondWith(differentProduct, differentProduct);
  await expect(getAdminProduct(id, 'test')).rejects.toThrow('identifies a different product');
  await expect(saveAdminProduct({ title: 'Explicit edit' }, 'test', id)).rejects.toThrow('identifies a different product');
  respondWith({ ...product, _id: id.toUpperCase() });
  expect((await getAdminProduct(id, 'test'))._id).toBe(id.toUpperCase());
});
