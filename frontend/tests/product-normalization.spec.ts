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
  ['a malformed category', { ...wireProduct, category: {} }],
  ['a malformed brand', { ...wireProduct, brand: null }],
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

test('collection helpers reject malformed records instead of silently returning a partial catalog', async () => {
  const invalid = { ...wireProduct, id: 'invalid' };
  respondWith(envelope([wireProduct, invalid]), envelope([invalid]), invalid);
  await expect(getCatalog()).rejects.toThrow('Some product information is unavailable.');
  await expect(getFeatured()).rejects.toThrow('The collection is temporarily unavailable.');
  await expect(getProduct(id)).rejects.toThrow('This product’s information is temporarily unavailable.');
});

test('collection helpers reject a broken products envelope but still accept an empty collection', async () => {
  respondWith({ data: { products: {} } }, { products: [wireProduct] }, envelope([]));
  await expect(getCatalog()).rejects.toThrow('The collection is temporarily unavailable.');
  await expect(getFeatured()).rejects.toThrow('The collection is temporarily unavailable.');
  expect(await getCatalog()).toEqual([]);
});
