import { expect, test } from '@playwright/test';
import { getCatalog, getFeatured, getProduct, isProduct, normalizeProduct } from '../lib/api';
import type { Product } from '../lib/types';

// Synthetic wire records reproduce the real id-only API contract, not database fixtures.
const id = '507f1f77bcf86cd799439011';
const wireProduct = {
  id,
  title: 'Normalization test product',
  slug: 'normalization-test-product',
  description: 'Used only in intercepted test responses.',
  price: 125.5,
  quantity: 4,
  category: 'Audio',
  brand: 'Test brand',
  color: 'Yellow',
  images: [{ url: 'https://example.test/product.jpg', public_id: 'test-image' }],
  ratings: [{ star: 4 }],
  createdAt: '2026-10-01T00:00:00.000Z',
} satisfies Omit<Product, '_id'> & { id: string; createdAt: string };

const originalFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = originalFetch; });

function respondWith(...responses: unknown[]) {
  const requested: string[] = [];
  globalThis.fetch = async input => {
    requested.push(String(input));
    if (!responses.length) throw new Error('Unexpected test API request');
    return new Response(JSON.stringify(responses.shift()), {
      headers: { 'Content-Type': 'application/json' },
    });
  };
  return requested;
}

function envelope(products: unknown[]) {
  return { status: 'success', results: products.length, data: { products } };
}

test('normalization creates canonical _id while preserving all wire fields without mutation', () => {
  const original = structuredClone(wireProduct);
  const normalized = normalizeProduct(wireProduct);
  expect(normalized).toEqual({ ...original, _id: id });
  expect(normalized).not.toBe(wireProduct);
  expect(wireProduct).toEqual(original);
  expect(wireProduct).not.toHaveProperty('_id');
  expect(isProduct(wireProduct)).toBe(false);
  expect(isProduct(normalized)).toBe(true);
});

test('legacy _id remains authoritative and id-only aliases use the same validation', () => {
  const { id: alias, ...fields } = wireProduct;
  const legacy = { ...fields, _id: alias };
  expect(normalizeProduct(legacy)).toEqual(legacy);
  expect(normalizeProduct({ ...wireProduct, _id: '507f1f77bcf86cd799439012' }))
    .toEqual({ ...wireProduct, _id: '507f1f77bcf86cd799439012' });
  expect(normalizeProduct({ ...wireProduct, _id: null })).toEqual({ ...wireProduct, _id: id });
  expect(normalizeProduct({ ...wireProduct, _id: 'invalid-existing-id' })).toBeNull();
  expect(normalizeProduct({ ...wireProduct, id: id.toUpperCase() })?._id).toBe(id.toUpperCase());
});

const invalidRecords: [string, unknown][] = [
  ['null', null],
  ['an array', []],
  ['a primitive', 'not a product'],
  ['a missing identifier', { ...wireProduct, id: undefined }],
  ['a short identifier', { ...wireProduct, id: '507f1f77' }],
  ['a non-hex identifier', { ...wireProduct, id: 'z'.repeat(24) }],
  ['a numeric identifier', { ...wireProduct, id: 123 }],
  ['a missing title', { ...wireProduct, title: undefined }],
  ['a missing description', { ...wireProduct, description: undefined }],
  ['a string price', { ...wireProduct, price: '125.5' }],
  ['a negative price', { ...wireProduct, price: -1 }],
  ['a non-finite price', { ...wireProduct, price: Number.POSITIVE_INFINITY }],
  ['a negative stock quantity', { ...wireProduct, quantity: -1 }],
  ['a fractional stock quantity', { ...wireProduct, quantity: 1.5 }],
  ['a malformed images field', { ...wireProduct, images: {} }],
  ['a malformed color', { ...wireProduct, color: [] }],
];

for (const [description, record] of invalidRecords) {
  test(`normalization rejects ${description} instead of inventing product fields`, () => {
    expect(normalizeProduct(record)).toBeNull();
  });
}

const incompleteLabels: [string, unknown][] = [
  ['missing', undefined],
  ['null', null],
  ['empty', ''],
  ['whitespace-only', ' \n\t '],
  ['numeric', 123],
  ['boolean', false],
  ['array', ['Audio']],
  ['object', { name: 'Audio' }],
];

for (const [description, value] of incompleteLabels) {
  test(`normalization labels ${description} category and brand without changing commercial fields`, () => {
    const raw = { ...wireProduct, category: value, brand: value };
    const original = structuredClone(raw);
    expect(normalizeProduct(raw)).toEqual({
      ...original, _id: id, category: 'Uncategorized', brand: 'Unknown brand',
    });
    expect(raw).toEqual(original);
  });
}

test('normalization preserves already-valid category and brand strings exactly', () => {
  const raw = { ...wireProduct, category: ' Audio ', brand: ' Test brand ' };
  expect(normalizeProduct(raw)).toEqual({ ...raw, _id: id });
});

test('ten-product catalog retains eight valid records and two incomplete category/brand records', async () => {
  const records = Array.from({ length: 10 }, (_, index) => ({
    ...wireProduct, id: (index + 1).toString(16).padStart(24, '0'),
  }));
  const incomplete = [
    ...records.slice(0, 8),
    { ...records[8], category: undefined, brand: null },
    { ...records[9], category: {}, brand: '   ' },
  ];
  const original = structuredClone(incomplete);
  respondWith(envelope(incomplete));
  const products = await getCatalog();
  expect(products).toHaveLength(10);
  expect(products.slice(0, 8)).toEqual(records.slice(0, 8).map(record => ({ ...record, _id: record.id })));
  expect(products.slice(8)).toEqual(records.slice(8).map(record => ({
    ...record, _id: record.id, category: 'Uncategorized', brand: 'Unknown brand',
  })));
  expect(incomplete).toEqual(original);
});

test('catalog accepts data.products with mixed aliases and deduplicates normalized identities across pages', async () => {
  const firstPage = Array.from({ length: 100 }, (_, index) => ({
    ...wireProduct, id: (index + 1).toString(16).padStart(24, '0'),
  }));
  const requested = respondWith(
    envelope(firstPage),
    envelope([{ ...wireProduct, _id: firstPage[0].id }, wireProduct]),
  );
  const products = await getCatalog();
  expect(products).toHaveLength(101);
  expect(products.every(isProduct)).toBe(true);
  expect(products[0]._id).toBe(firstPage[0].id);
  expect(products.at(-1)).toEqual({ ...wireProduct, _id: id });
  expect(requested).toEqual(['/api/product?limit=100&sort=_id', '/api/product?limit=100&sort=_id&page=2']);
});

test('featured products normalize the same data.products wire envelope', async () => {
  respondWith(envelope([wireProduct]));
  expect(await getFeatured()).toEqual([{ ...wireProduct, _id: id }]);
});

test('individual product reads normalize raw id-only responses and retain null/not-found behavior', async () => {
  const requested = respondWith(wireProduct, null);
  expect(await getProduct(id)).toEqual({ ...wireProduct, _id: id });
  expect(await getProduct(id)).toBeNull();
  expect(await getProduct('not-an-object-id')).toBeNull();
  expect(requested).toEqual([`/api/product/${id}`, `/api/product/${id}`]);
});

test('collection helpers keep safe products while rejecting unsafe records and unsafe details', async () => {
  const invalid = { ...wireProduct, id: 'invalid' };
  respondWith(envelope([wireProduct, invalid]), envelope([invalid, wireProduct]), invalid);
  expect(await getCatalog()).toEqual([{ ...wireProduct, _id: id }]);
  expect(await getFeatured()).toEqual([{ ...wireProduct, _id: id }]);
  await expect(getProduct(id)).rejects.toThrow('This product’s information is temporarily unavailable.');
});

test('featured and detail reads use the same metadata fallbacks and preserve product data', async () => {
  const incomplete = { ...wireProduct, category: null, brand: false };
  const normalized = { ...wireProduct, _id: id, category: 'Uncategorized', brand: 'Unknown brand' };
  respondWith(envelope([incomplete]), incomplete);
  expect(await getFeatured()).toEqual([normalized]);
  expect(await getProduct(id)).toEqual(normalized);
});

test('metadata fallbacks do not rescue unsafe identity, price, quantity, description or images', async () => {
  const incomplete = { ...wireProduct, category: null, brand: null };
  for (const patch of [{ id: 'invalid' }, { price: '125.5' }, { quantity: -1 }, { description: {} }, { images: {} }]) {
    const raw = { ...incomplete, ...patch };
    expect(normalizeProduct(raw)).toBeNull();
    respondWith(envelope([wireProduct, raw]), raw);
    expect(await getCatalog()).toEqual([{ ...wireProduct, _id: id }]);
    await expect(getProduct(id)).rejects.toThrow('This product’s information is temporarily unavailable.');
  }
});

test('catalog pagination continues after a full raw page of unsafe records', async () => {
  const unsafe = Array.from({ length: 100 }, () => ({ ...wireProduct, price: -1 }));
  const requested = respondWith(envelope(unsafe), envelope([wireProduct]));
  expect(await getCatalog()).toEqual([{ ...wireProduct, _id: id }]);
  expect(requested).toHaveLength(2);
  expect(requested[1]).toContain('page=2');
});

test('catalog keeps valid earlier pages when the final page has only unsafe records', async () => {
  const firstPage = Array.from({ length: 100 }, (_, index) => ({
    ...wireProduct, id: (index + 1).toString(16).padStart(24, '0'),
  }));
  respondWith(envelope(firstPage), envelope([{ ...wireProduct, price: -1 }]));
  expect(await getCatalog()).toEqual(firstPage.map(record => ({ ...record, _id: record.id })));
});

test('nonempty catalog and featured responses with no safe products remain explicit errors', async () => {
  const invalid = { ...wireProduct, quantity: -1 };
  respondWith(envelope([invalid]), envelope([invalid]));
  await expect(getCatalog()).rejects.toThrow('Some product information is unavailable.');
  await expect(getFeatured()).rejects.toThrow('The collection is temporarily unavailable.');
});

test('all-unsafe catalog pages ending in a 404 still report unavailable product information', async () => {
  const invalidPage = envelope(Array.from({ length: 100 }, () => ({ ...wireProduct, quantity: -1 })));
  let page = 0;
  globalThis.fetch = async () => new Response(JSON.stringify(++page === 1 ? invalidPage : {}), {
    status: page === 1 ? 200 : 404,
    headers: { 'Content-Type': 'application/json' },
  });
  await expect(getCatalog()).rejects.toThrow('Some product information is unavailable.');
  expect(page).toBe(2);
});

test('collection helpers reject a broken products envelope but still accept an empty collection', async () => {
  respondWith({ data: { products: {} } }, { products: [wireProduct] }, envelope([]));
  await expect(getCatalog()).rejects.toThrow('The collection is temporarily unavailable.');
  await expect(getFeatured()).rejects.toThrow('The collection is temporarily unavailable.');
  expect(await getCatalog()).toEqual([]);
});
