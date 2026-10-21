import { expect, test, type Page } from '@playwright/test';
import type { Product } from '../lib/types';

// These synthetic records only exist in intercepted HTTP responses. No database is seeded.
type ApiProduct = Omit<Product, '_id'> & { id: string };
const idProduct: ApiProduct = {
  id: '000000000000000000000101',
  title: 'Compatibility Test Headphones',
  slug: 'compatibility-test-headphones',
  description: 'A synthetic product used only in browser compatibility tests.',
  price: 149,
  quantity: 3,
  category: 'Audio',
  brand: 'Browser Test Brand',
  color: 'Yellow',
  images: ['/editorial/headphones.jpg'],
  ratings: [{ star: 4 }],
};

function legacyProduct(product: ApiProduct): Product {
  const { id, ...fields } = product;
  return { ...fields, _id: id };
}

async function interceptProducts(
  page: Page,
  entries: unknown[] = [idProduct],
  detail: () => unknown = () => idProduct,
) {
  const requestedIds: string[] = [];
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === 'GET' && path === '/api/product') {
      return route.fulfill({ json: { data: { products: entries } } });
    }
    if (route.request().method() === 'GET' && path.startsWith('/api/product/')) {
      requestedIds.push(path.slice('/api/product/'.length));
      return route.fulfill({ json: detail() });
    }
    // Never allow an unhandled API request to reach the real backend.
    return route.fulfill({ status: 404, json: { message: 'No compatibility-test response configured.' } });
  });
  return requestedIds;
}

test('collection renders the backend id-only product envelope with working product links', async ({ page }) => {
  await interceptProducts(page);
  await page.goto('/products');
  await expect(page.getByRole('heading', { name: idProduct.title, exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: `View ${idProduct.title}`, exact: true }))
    .toHaveAttribute('href', `/products/${idProduct.id}`);
  await expect(page.getByText('$149.00', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: `Add ${idProduct.title} to bag`, exact: true })).toBeEnabled();
  await expect(page.getByRole('heading', { name: 'Let’s try that again.' })).toHaveCount(0);
});

test('homepage features id-only products from the existing backend envelope', async ({ page }) => {
  await interceptProducts(page);
  await page.goto('/');
  const product = page.getByRole('heading', { name: idProduct.title, exact: true });
  await expect(product).toBeVisible();
  await expect(product.getByRole('link')).toHaveAttribute('href', `/products/${idProduct.id}`);
  await page.getByRole('button', { name: `Add ${idProduct.title} to bag`, exact: true }).click();
  await expect(page.getByRole('link', { name: 'Shopping Bag, 1 item', exact: true })).toBeVisible();
});

test('raw id-only details support a persistent bag and current checkout price and stock checks', async ({ page }) => {
  let current = idProduct;
  const requestedIds = await interceptProducts(page, [idProduct], () => current);
  await page.goto(`/products/${idProduct.id}`);
  await expect(page.getByRole('heading', { name: idProduct.title, exact: true })).toBeVisible();
  await expect(page.getByText(idProduct.description, { exact: true })).toBeVisible();
  await expect(page.getByText(idProduct.brand, { exact: true }).first()).toBeVisible();
  await expect(page.getByText(idProduct.color!, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Increase quantity', exact: true }).click();
  await page.getByRole('button', { name: 'Add to bag', exact: true }).click();
  await page.getByRole('link', { name: 'Shopping Bag, 2 items', exact: true }).click();
  await expect(page.getByRole('heading', { name: idProduct.title, exact: true })).toBeVisible();
  await expect(page.getByLabel('Quantity: 2', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Quantity: 2', { exact: true })).toBeVisible();

  current = { ...idProduct, price: 159, quantity: 1 };
  await page.getByRole('link', { name: 'Review checkout', exact: true }).click();
  await expect(page.getByText('Price updated from $149.00 to $159.00 per item.', { exact: true })).toBeVisible();
  await expect(page.getByText('Only 1 item is currently available.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Update quantity to 1', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Bag review' }).getByText('$159.00', { exact: true })).toHaveCount(2);
  await expect(page.getByRole('heading', { name: 'Online checkout is not available yet.' })).toBeVisible();
  expect(requestedIds.length).toBeGreaterThanOrEqual(2);
  expect(requestedIds.every(id => id === idProduct.id)).toBe(true);
});

test('legacy _id products still work through collection, details and add to bag', async ({ page }) => {
  const legacy = legacyProduct(idProduct);
  await interceptProducts(page, [legacy], () => legacy);
  await page.goto('/products');
  await page.getByRole('link', { name: `View ${idProduct.title}`, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/products/${legacy._id}$`));
  await expect(page.getByRole('heading', { name: idProduct.title, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add to bag', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Shopping Bag, 1 item', exact: true })).toBeVisible();
});

test('mixed id and _id collection records keep separate product identities in the bag', async ({ page }) => {
  const legacy = legacyProduct({ ...idProduct, title: 'Compatibility Test Legacy Headphones' });
  const modern = { ...idProduct, id: '000000000000000000000102', title: 'Compatibility Test Modern Headphones' };
  await interceptProducts(page, [legacy, modern]);
  await page.goto('/products');
  for (const product of [legacy, modern]) {
    await page.getByRole('button', { name: `Add ${product.title} to bag`, exact: true }).click();
  }
  await page.getByRole('link', { name: 'Shopping Bag, 2 items', exact: true }).click();
  for (const product of [legacy, modern]) {
    await expect(page.getByRole('heading', { name: product.title, exact: true })).toBeVisible();
  }
  await expect(page.getByLabel('Quantity: 1', { exact: true })).toHaveCount(2);
});

test('all ten safe products remain shoppable when two lack usable category and brand metadata', async ({ page }) => {
  const complete = Array.from({ length: 8 }, (_, index) => ({
    ...idProduct,
    id: (0x201 + index).toString(16).padStart(24, '0'),
    title: `Metadata Test Product ${index + 1}`,
    price: 21 + index,
  }));
  const missing = {
    ...idProduct, id: '000000000000000000000209', title: 'Metadata Test Product 9',
    price: 39, quantity: 2, category: undefined, brand: undefined,
  };
  const malformed = {
    ...idProduct, id: '000000000000000000000210', title: 'Metadata Test Product 10',
    price: 49, quantity: 5, category: null, brand: { invalid: true },
  };
  await interceptProducts(page, [...complete, missing, malformed], () => missing);
  await page.goto('/products');
  const titles = page.getByRole('heading', { level: 3, name: /^Metadata Test Product \d+$/ });
  await expect(titles).toHaveCount(10);
  await expect(page.getByRole('heading', { name: 'Let’s try that again.' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Audio', exact: true }).click();
  await expect(titles).toHaveCount(8);
  await page.getByRole('button', { name: 'Uncategorized', exact: true }).click();
  await expect(titles).toHaveCount(2);
  await expect(page.getByText('Unknown brand', { exact: true })).toHaveCount(2);
  await expect(page.getByText('$39.00', { exact: true })).toBeVisible();
  await expect(page.getByText('$49.00', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: `View ${missing.title}`, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/products/${missing.id}$`));
  await expect(page.getByRole('heading', { name: missing.title, level: 1, exact: true })).toBeVisible();
  await expect(page.getByText('Unknown brand', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Uncategorized', { exact: true })).toBeVisible();
  await expect(page.getByText('$39.00', { exact: true })).toBeVisible();
  const image = page.getByRole('img', { name: missing.title, exact: true });
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate(node => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Increase quantity', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Increase quantity', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Add to bag', exact: true }).click();
  await page.getByRole('link', { name: 'Shopping Bag, 2 items', exact: true }).click();
  await expect(page.getByRole('heading', { name: missing.title, exact: true })).toBeVisible();
  await expect(page.getByLabel('Quantity: 2', { exact: true })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Bag summary' }).getByText('$78.00', { exact: true })).toHaveCount(2);
  await page.reload();
  await expect(page.getByLabel('Quantity: 2', { exact: true })).toBeVisible();
});

test('unsafe records do not hide safe products in the featured collection or catalog', async ({ page }) => {
  const entries = [
    { ...idProduct, id: 'unsafe-identifier', title: 'Unsafe Identifier Test Product' },
    idProduct,
    { ...idProduct, id: '000000000000000000000301', title: 'Unsafe Price Test Product', price: -1 },
    { ...idProduct, id: '000000000000000000000302', title: 'Unsafe Stock Test Product', quantity: -1 },
    { ...idProduct, id: '000000000000000000000303', title: 'Unsafe Image Test Product', images: 'invalid' },
  ];
  await interceptProducts(page, entries);
  for (const path of ['/', '/products']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: idProduct.title, exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Add .+ to bag$/ })).toHaveCount(1);
    await expect(page.getByRole('heading', { name: /^Unsafe .+ Test Product$/ })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Let’s try that again.' })).toHaveCount(0);
  }
  await page.getByRole('button', { name: `Add ${idProduct.title} to bag`, exact: true }).click();
  await expect(page.getByRole('link', { name: 'Shopping Bag, 1 item', exact: true })).toBeVisible();
});

test('a product with blank or non-string merchandising metadata has useful featured and detail fallbacks', async ({ page }) => {
  const incomplete = { ...idProduct, category: ' \t ', brand: 0 };
  await interceptProducts(page, [incomplete], () => incomplete);
  await page.goto('/');
  const card = page.locator('article').filter({ has: page.getByRole('heading', { name: idProduct.title, exact: true }) });
  await expect(card).toBeVisible();
  await expect(card.getByText('Uncategorized', { exact: true })).toBeVisible();
  await expect(card.getByText('Unknown brand', { exact: true })).toBeVisible();
  await expect(card.getByText('$149.00', { exact: true })).toBeVisible();
  await card.getByRole('link', { name: `View ${idProduct.title}`, exact: true }).click();
  await expect(page.getByRole('heading', { name: idProduct.title, exact: true })).toBeVisible();
  await expect(page.getByText('Uncategorized', { exact: true })).toBeVisible();
  await expect(page.getByText('Unknown brand', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(idProduct.description, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add to bag', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Shopping Bag, 1 item', exact: true })).toBeVisible();
});

test('invalid id-only identifiers remain unavailable across collection, homepage and details', async ({ page }) => {
  const invalid = { ...idProduct, id: 'not-a-valid-product-id' };
  await interceptProducts(page, [invalid], () => invalid);
  for (const path of ['/products', '/']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: 'Let’s try that again.' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Add .+ to bag$/ })).toHaveCount(0);
  }
  await page.goto(`/products/${idProduct.id}`);
  await expect(page.getByText('This product’s information is temporarily unavailable.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add to bag', exact: true })).toHaveCount(0);
});

test('a valid id does not make malformed product prices safe to shop', async ({ page }) => {
  const invalid = { ...idProduct, price: 'free' };
  await interceptProducts(page, [invalid], () => invalid);
  await page.goto('/products');
  await expect(page.getByRole('heading', { name: 'Let’s try that again.' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Add .+ to bag$/ })).toHaveCount(0);
  await page.goto(`/products/${idProduct.id}`);
  await expect(page.getByText('This product’s information is temporarily unavailable.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add to bag', exact: true })).toHaveCount(0);
});
