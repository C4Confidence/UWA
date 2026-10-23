import { expect, test, type Page, type Request } from '@playwright/test';

// All records and credentials in this file are synthetic browser fixtures.
// Every API request is intercepted; no development or user database is touched.
const token = `test.${Buffer.from(JSON.stringify({ exp: 4_102_444_800 })).toString('base64url')}.test`;
const account = { _id: '000000000000000000000020', firstname: 'Test', lastname: 'Curator', email: 'curator@example.test', token };
const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jk8sAAAAASUVORK5CYII=', 'base64');

interface FixtureProduct {
  _id: string;
  title: string;
  slug: string;
  description: string;
  price: number;
  category: string;
  brand: string;
  color: string;
  quantity: number;
  images: (string | { url: string; [key: string]: unknown })[];
  createdAt: string;
  updatedAt: string;
}

function fixtures(): FixtureProduct[] {
  return Array.from({ length: 16 }, (_, index) => ({
    _id: (index + 1).toString(16).padStart(24, '0'),
    title: index === 0 ? 'Test Desk Speaker' : `Test Product ${String(index + 1).padStart(2, '0')}`,
    slug: index === 0 ? 'test-desk-speaker' : `test-product-${index + 1}`,
    description: 'An isolated browser-test product, never inserted into MongoDB.',
    price: 40 + index * 10,
    category: index % 2 ? 'Home' : 'Audio',
    brand: 'Browser Test Brand',
    color: 'Black',
    quantity: index === 0 ? 0 : index < 4 ? 3 : 12,
    images: ['/editorial/headphones.jpg'],
    createdAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
    updatedAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
  }));
}

interface RecordedRequest {
  method: string;
  path: string;
  query: URLSearchParams;
  body: Record<string, unknown> | null;
  authorization: string | undefined;
  contentType: string | undefined;
  rawBody: string;
}

function record(request: Request): RecordedRequest {
  const url = new URL(request.url());
  let body: Record<string, unknown> | null = null;
  if (request.headers()['content-type']?.includes('application/json')) body = request.postDataJSON();
  return { method: request.method(), path: url.pathname, query: url.searchParams, body, authorization: request.headers().authorization, contentType: request.headers()['content-type'], rawBody: request.postData() || '' };
}

async function mockAdmin(page: Page, options: { signedIn?: boolean; role?: string; meStatus?: number; products?: FixtureProduct[] } = {}) {
  const state = {
    products: structuredClone(options.products || fixtures()),
    meStatus: options.meStatus || 200,
    role: options.role || 'admin',
    catalogStatus: 200,
    mutationStatus: 200,
    holdMutation: null as Promise<void> | null,
    requests: [] as RecordedRequest[],
  };
  if (options.signedIn !== false) await page.addInitScript((user) => sessionStorage.setItem('uwa.account.v1', JSON.stringify(user)), account);
  await page.route('**/uploads/**', route => route.fulfill({ contentType: 'image/png', body: tinyPng }));
  await page.route('**/api/**', async route => {
    const request = record(route.request());
    state.requests.push(request);
    const { path, method, query, body } = request;
    if (path === '/api/user/me') return route.fulfill({ status: state.meStatus, json: state.meStatus === 200 ? { ...account, token: undefined, role: state.role } : { message: 'TEST_PRIVATE_AUTH_DETAILS' } });
    if (path === '/api/user/logout') return route.fulfill({ status: 204 });
    if (path.startsWith('/api/admin/') && method !== 'GET') {
      if (state.holdMutation) await state.holdMutation;
      if (state.mutationStatus !== 200) return route.fulfill({ status: state.mutationStatus, json: { message: 'TEST_PRIVATE_DATABASE_DETAILS' } });
    }
    if (path === '/api/admin/uploads' && method === 'POST') return route.fulfill({ json: { images: [{ url: '/uploads/test-a.webp' }, { url: '/uploads/test-b.webp' }] } });
    if (path === '/api/admin/products' && method === 'GET') {
      if (state.catalogStatus !== 200) return route.fulfill({ status: state.catalogStatus, json: { message: 'TEST_PRIVATE_DATABASE_DETAILS' } });
      let products = [...state.products];
      const search = (query.get('q') || '').toLowerCase();
      if (search) products = products.filter(product => `${product.title} ${product.slug} ${product.brand}`.toLowerCase().includes(search));
      if (query.get('category')) products = products.filter(product => product.category === query.get('category'));
      if (query.get('stock') === 'in-stock') products = products.filter(product => product.quantity > 0);
      if (query.get('stock') === 'low-stock') products = products.filter(product => product.quantity > 0 && product.quantity <= 5);
      if (query.get('stock') === 'out-of-stock') products = products.filter(product => product.quantity === 0);
      const sorting = (query.get('sort') || '-updatedAt').split(',');
      products.sort((left, right) => {
        for (const sort of sorting) {
          const descending = sort.startsWith('-');
          const key = (descending ? sort.slice(1) : sort) as keyof FixtureProduct;
          const a = left[key]; const b = right[key];
          const comparison = typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b));
          if (comparison) return descending ? -comparison : comparison;
        }
        return 0;
      });
      const limit = Number(query.get('limit') || 12);
      const pageNumber = Number(query.get('page') || 1);
      return route.fulfill({ json: {
        products: products.slice((pageNumber - 1) * limit, pageNumber * limit),
        page: pageNumber, limit, total: products.length, totalPages: Math.ceil(products.length / limit),
        summary: {
          totalProducts: state.products.length,
          inStock: state.products.filter(product => product.quantity > 0).length,
          lowStock: state.products.filter(product => product.quantity > 0 && product.quantity <= 5).length,
          outOfStock: state.products.filter(product => product.quantity === 0).length,
          totalUnits: state.products.reduce((total, product) => total + product.quantity, 0),
        }, categories: [...new Set(state.products.map(product => product.category).filter(Boolean))],
      } });
    }
    if (path === '/api/admin/products' && method === 'POST') {
      if (state.products.some(product => product.slug === body?.slug)) return route.fulfill({ status: 409, json: { message: 'TEST_PRIVATE_DATABASE_DETAILS' } });
      const product = { ...fixtures()[0], ...body, _id: '000000000000000000000099' } as FixtureProduct;
      state.products.push(product);
      return route.fulfill({ status: 201, json: product });
    }
    const match = /^\/api\/admin\/products\/([a-f\d]{24})$/.exec(path);
    if (match) {
      const index = state.products.findIndex(product => product._id === match[1]);
      if (index < 0) return route.fulfill({ status: 404, json: { message: 'Not found' } });
      if (method === 'GET') return route.fulfill({ json: state.products[index] });
      if (method === 'PATCH' || method === 'PUT') {
        state.products[index] = { ...state.products[index], ...body } as FixtureProduct;
        return route.fulfill({ json: state.products[index] });
      }
      if (method === 'DELETE') { state.products.splice(index, 1); return route.fulfill({ status: 204 }); }
    }
    // Unexpected API operations are rejected here instead of reaching a real server.
    return route.fulfill({ status: 404, json: { message: 'No isolated browser-test handler configured.' } });
  });
  return state;
}

async function fillProduct(page: Page, slug = 'new-browser-test-product') {
  await page.getByLabel('Product title', { exact: false }).fill('New Browser Test Product');
  await page.getByLabel('Product slug', { exact: false }).fill(slug);
  await page.getByLabel('Description', { exact: false }).fill('Synthetic product submitted only to an intercepted API.');
  await page.getByLabel('Brand', { exact: false }).fill('Test Brand');
  await page.getByLabel('Category', { exact: false }).fill('Audio');
  await page.getByLabel('Color', { exact: false }).fill('Yellow');
  await page.getByRole('spinbutton', { name: 'Price', exact: true }).fill('129.50');
  await page.getByLabel('Stock quantity', { exact: false }).fill('8');
}

async function expectNoOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
}

// Raw legacy fixtures deliberately bypass the valid-product helper above.
// Unknown API paths still terminate in mockAdmin; they never reach a database.
async function mockRawCatalog(page: Page, records: unknown[], summary: { totalProducts: number; inStock: number; lowStock: number; outOfStock: number; totalUnits: number }) {
  await mockAdmin(page);
  const state = { records: structuredClone(records), summary: { ...summary }, requests: [] as RecordedRequest[] };
  await page.route('**/api/admin/products**', async route => {
    const request = record(route.request());
    state.requests.push(request);
    if (request.path === '/api/admin/products' && request.method === 'GET') {
      const limit = Number(request.query.get('limit') || 12);
      const pageNumber = Number(request.query.get('page') || 1);
      return route.fulfill({ json: {
        products: state.records.slice((pageNumber - 1) * limit, pageNumber * limit),
        page: pageNumber, limit, total: state.records.length, totalPages: Math.ceil(state.records.length / limit),
        summary: state.summary, categories: ['Audio'],
      } });
    }
    const match = /^\/api\/admin\/products\/([a-f\d]{24})$/i.exec(request.path);
    if (match) {
      const index = state.records.findIndex(value => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
        const product = value as Record<string, unknown>;
        return (product._id ?? product.id) === match[1];
      });
      if (index < 0) return route.fulfill({ status: 404, json: { message: 'Synthetic record not found' } });
      if (request.method === 'GET') return route.fulfill({ json: state.records[index] });
      if (request.method === 'PATCH') {
        state.records[index] = { ...(state.records[index] as Record<string, unknown>), ...request.body };
        return route.fulfill({ json: state.records[index] });
      }
    }
    return route.fulfill({ status: 405, json: { message: 'No raw-fixture mutation handler configured' } });
  });
  return state;
}

test('anonymous visitors must sign in before administrator functionality is shown', async ({ page }) => {
  const state = await mockAdmin(page, { signedIn: false });
  await page.goto('/admin/products');
  await expect(page.getByRole('heading', { name: 'Your workspace awaits.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toHaveAttribute('href', '/signin?next=%2Fadmin%2Fproducts');
  await expect(page.getByRole('table')).toHaveCount(0);
  expect(state.requests.filter(request => request.path.startsWith('/api/admin/'))).toHaveLength(0);
});

test('the database role from current-user lookup rejects a signed-in non-admin', async ({ page }) => {
  const state = await mockAdmin(page, { role: 'user' });
  await page.goto('/admin/products/new');
  await expect(page.getByRole('heading', { name: 'This space is for administrators.' })).toBeVisible();
  await expect(page.getByLabel('Product title', { exact: false })).toHaveCount(0);
  expect(state.requests.find(request => request.path === '/api/user/me')?.authorization).toBe(`Bearer ${token}`);
  expect(state.requests.filter(request => request.path.startsWith('/api/admin/'))).toHaveLength(0);
});

test('an expired server session shows sign in instead of trusting the stored account', async ({ page }) => {
  const state = await mockAdmin(page, { meStatus: 401 });
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Your workspace awaits.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible();
  expect(state.requests.filter(request => request.path.startsWith('/api/admin/'))).toHaveLength(0);
});

test('overview displays actual catalog totals without invented order or revenue cards', async ({ page }) => {
  const state = await mockAdmin(page);
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Welcome back, Test.' })).toBeVisible();
  const cards = page.locator('.adm-stat-card');
  await expect(cards).toHaveCount(4);
  await expect(cards.filter({ hasText: 'Total products' }).locator('strong')).toHaveText('16');
  await expect(cards.filter({ hasText: 'In stock' }).locator('strong')).toHaveText('15');
  await expect(cards.filter({ hasText: 'Low stock' }).locator('strong')).toHaveText('3');
  await expect(cards.filter({ hasText: 'Out of stock' }).locator('strong')).toHaveText('1');
  await expect(cards.filter({ hasText: /orders|revenue|sales/i })).toHaveCount(0);
  expect(state.requests.find(request => request.path === '/api/admin/products')?.authorization).toBe(`Bearer ${token}`);
  await expectNoOverflow(page);
});

test('product table requests server search, sort, filters and pagination', async ({ page }) => {
  const state = await mockAdmin(page);
  await page.goto('/admin/products');
  const rows = page.getByRole('table').locator('tbody tr');
  await expect(rows).toHaveCount(12);
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(rows).toHaveCount(4);
  await expect(page.getByText('Page 2 of 2', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Previous page', exact: true }).click();
  await page.getByRole('combobox', { name: 'Sort products', exact: true }).selectOption('title');
  await expect(rows.first().locator('.adm-product-title')).toHaveText('Test Desk Speaker');
  await page.getByRole('searchbox', { name: 'Search products', exact: true }).fill('Desk Speaker');
  await expect(rows).toHaveCount(1);
  await page.getByRole('combobox', { name: 'Filter by category', exact: true }).selectOption('Audio');
  await page.getByRole('combobox', { name: 'Filter by availability', exact: true }).selectOption('out-of-stock');
  await expect(rows.first()).toContainText('Test Desk Speaker');
  await expect.poll(() => state.requests.some(request => request.query.get('q') === 'Desk Speaker' && request.query.get('category') === 'Audio' && request.query.get('stock') === 'out-of-stock' && request.query.get('sort') === 'title')).toBe(true);
  await page.getByRole('button', { name: 'Clear all', exact: true }).click();
  await expect(rows).toHaveCount(12);
  await expectNoOverflow(page);
});

test('create validates fields, handles duplicate slugs safely and submits an explicit authenticated product', async ({ page }) => {
  const state = await mockAdmin(page);
  await page.goto('/admin/products/new');
  await page.getByRole('button', { name: 'Create product', exact: true }).first().click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('A few details need your attention');
  expect(state.requests.filter(request => request.method === 'POST')).toHaveLength(0);
  await fillProduct(page, fixtures()[0].slug);
  await page.getByRole('button', { name: 'Create product', exact: true }).first().click();
  await expect(page.getByText('This slug is already in use.', { exact: true })).toBeVisible();
  await expect(page.getByText('TEST_PRIVATE_DATABASE_DETAILS')).toHaveCount(0);
  await page.getByLabel('Product slug', { exact: false }).fill('new-browser-test-product');
  await page.getByRole('button', { name: 'Create product', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Your product is in.' })).toBeVisible();
  const posts = state.requests.filter(request => request.method === 'POST' && request.path === '/api/admin/products');
  expect(posts).toHaveLength(2);
  expect(posts[1].authorization).toBe(`Bearer ${token}`);
  expect(posts[1].body).toEqual({ title: 'New Browser Test Product', slug: 'new-browser-test-product', description: 'Synthetic product submitted only to an intercepted API.', price: 129.5, brand: 'Test Brand', category: 'Audio', color: 'Yellow', quantity: 8, images: [] });
});

test('images preview before real upload, support primary and order controls, and save URL references', async ({ page }) => {
  const state = await mockAdmin(page);
  await page.goto('/admin/products/new');
  await fillProduct(page);
  await page.locator('#product-image-files').setInputFiles([
    { name: 'first.png', mimeType: 'image/png', buffer: tinyPng },
    { name: 'second.png', mimeType: 'image/png', buffer: tinyPng },
  ]);
  await expect(page.getByText('Not uploaded', { exact: true })).toHaveCount(2);
  await expect(page.getByRole('img', { name: 'Selected file first.png', exact: true })).toBeVisible();
  expect(state.requests.filter(request => request.path === '/api/admin/uploads')).toHaveLength(0);
  await expect(page.getByRole('button', { name: 'Create product', exact: true }).first()).toBeDisabled();
  await page.getByRole('button', { name: 'Upload 2 images', exact: true }).click();
  await expect(page.getByText('Not uploaded', { exact: true })).toHaveCount(0);
  const upload = state.requests.find(request => request.path === '/api/admin/uploads');
  expect(upload?.authorization).toBe(`Bearer ${token}`);
  expect(upload?.contentType).toContain('multipart/form-data; boundary=');
  expect(upload?.rawBody).toContain('name="images"');
  expect(upload?.rawBody).toContain('filename="first.png"');
  expect(upload?.rawBody).toContain('filename="second.png"');
  await page.getByRole('button', { name: 'Make image 2 primary', exact: true }).click();
  await expect(page.locator('.adm-image-source').first()).toHaveText('/uploads/test-b.webp');
  await page.getByRole('button', { name: 'Move image 1 later', exact: true }).click();
  await expect(page.locator('.adm-image-source').first()).toHaveText('/uploads/test-a.webp');
  await page.getByLabel('Or add an existing image', { exact: true }).fill('/editorial/headphones.jpg');
  await page.getByRole('button', { name: 'Add image', exact: true }).click();
  await page.getByRole('button', { name: 'Remove image 2 reference', exact: true }).click();
  await page.getByRole('button', { name: 'Make image 2 primary', exact: true }).click();
  await page.getByRole('button', { name: 'Create product', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Your product is in.' })).toBeVisible();
  expect(state.requests.find(request => request.method === 'POST' && request.path === '/api/admin/products')?.body?.images).toEqual(['/editorial/headphones.jpg', '/uploads/test-a.webp']);
});

test('editing an older record preserves missing fields and retained image metadata', async ({ page }) => {
  const products = fixtures();
  const legacyImage = { url: '/editorial/headphones.jpg', public_id: 'legacy-image-id', alt: 'Original catalog image', customMetadata: { source: 'legacy' } };
  products[0] = { ...products[0], category: '', brand: '', color: '', images: [legacyImage] };
  const state = await mockAdmin(page, { products });
  await page.goto(`/admin/products/${products[0]._id}/edit`);
  await expect(page.getByText('A little catalog housekeeping', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Brand', { exact: false })).toHaveValue('');
  await expect(page.getByLabel('Category', { exact: false })).toHaveValue('');
  await page.getByLabel('Stock quantity', { exact: false }).fill('7');
  await page.getByRole('button', { name: 'Save changes', exact: true }).first().click();
  await expect(page.getByText('Changes saved.', { exact: true })).toBeVisible();
  const patch = state.requests.find(request => request.method === 'PATCH');
  expect(patch?.body).toEqual({ quantity: 7 });
  expect(patch?.authorization).toBe(`Bearer ${token}`);
  expect(state.products[0]).toMatchObject({ category: '', brand: '', color: '', quantity: 7 });
  await page.getByLabel('Or add an existing image', { exact: true }).fill('/editorial/new-image.jpg');
  await page.getByRole('button', { name: 'Add image', exact: true }).click();
  await page.getByRole('button', { name: 'Make image 2 primary', exact: true }).click();
  await page.getByRole('button', { name: 'Save changes', exact: true }).first().click();
  await expect.poll(() => state.products[0].images).toEqual(['/editorial/new-image.jpg', legacyImage]);
  await expect(page.getByText('Changes saved.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save changes', exact: true }).first()).toBeDisabled();
  const patches = state.requests.filter(request => request.method === 'PATCH');
  expect(patches).toHaveLength(2);
  expect(patches[1].body).toEqual({ images: ['/editorial/new-image.jpg', legacyImage] });
  expect(state.products[0].images).toEqual(['/editorial/new-image.jpg', legacyImage]);
  await expectNoOverflow(page);
});

test('inventory stock confirmation traps keyboard focus while pending and patches only quantity', async ({ page }) => {
  const state = await mockAdmin(page);
  let release = () => {};
  state.holdMutation = new Promise<void>(resolve => { release = resolve; });
  await page.goto('/admin/inventory');
  const first = fixtures()[0];
  await page.getByRole('button', { name: `Update stock for ${first.title}`, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Update stock quantity' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Available units', { exact: true }).fill('9');
  const confirm = dialog.getByRole('button', { name: 'Save stock', exact: true });
  await confirm.focus();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Close dialog', exact: true })).toBeFocused();
  await confirm.click();
  await expect(dialog.getByRole('button', { name: 'Please wait…', exact: true })).toBeDisabled();
  await page.keyboard.press('Tab');
  await expect.poll(() => dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
  release();
  await expect(dialog).toHaveCount(0);
  expect(state.requests.find(request => request.method === 'PATCH')?.body).toEqual({ quantity: 9 });
  await expect(page.getByRole('row').filter({ hasText: first.title })).toContainText('9 units');
});

test('delete confirmation supports cancellation, Escape, focus return and a single confirmed mutation', async ({ page }) => {
  const state = await mockAdmin(page);
  const title = fixtures()[15].title;
  await page.goto('/admin/products');
  const remove = page.getByRole('button', { name: `Delete ${title}`, exact: true });
  await remove.click();
  let dialog = page.getByRole('dialog', { name: 'Remove this good find?' });
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(remove).toBeFocused();
  await remove.click();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  expect(state.requests.filter(request => request.method === 'DELETE')).toHaveLength(0);
  await remove.click();
  dialog = page.getByRole('dialog', { name: 'Remove this good find?' });
  await dialog.getByRole('button', { name: 'Delete product', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.adm-product-title').filter({ hasText: title })).toHaveCount(0);
  expect(state.requests.filter(request => request.method === 'DELETE')).toHaveLength(1);
  expect(state.products).toHaveLength(15);
});

test('catalog errors recover safely and a revoked administrator role stops a mutation', async ({ page }) => {
  const state = await mockAdmin(page);
  state.catalogStatus = 503;
  await page.goto('/admin/products');
  await expect(page.getByRole('heading', { name: 'A small interruption.' })).toBeVisible();
  await expect(page.getByText('TEST_PRIVATE_DATABASE_DETAILS')).toHaveCount(0);
  state.catalogStatus = 200;
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(12);
  state.mutationStatus = 403;
  await page.getByRole('button', { name: `Delete ${fixtures()[15].title}`, exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete product', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'This space is for administrators.' })).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(0);
  expect(state.products).toHaveLength(16);
});

test('mobile administrator navigation works with the keyboard and layouts avoid page overflow', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'The collapsed navigation is specific to mobile viewports.');
  await mockAdmin(page);
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Welcome back, Test.' })).toBeVisible();
  const menu = page.getByRole('button', { name: 'Open administrator menu', exact: true });
  await menu.focus();
  await page.keyboard.press('Enter');
  const navigation = page.getByRole('navigation', { name: 'Administrator navigation' });
  await expect(navigation).toBeVisible();
  const inventory = navigation.getByRole('link', { name: 'Inventory', exact: true });
  await inventory.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/admin\/inventory$/);
  await expect(page.getByRole('heading', { name: 'Inventory.', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open administrator menu', exact: true })).toHaveAttribute('aria-expanded', 'false');
  await expectNoOverflow(page);
  await page.goto('/admin/products/new');
  await expect(page.getByRole('heading', { name: 'Add a product.', exact: true })).toBeVisible();
  await expectNoOverflow(page);
});

test('mixed legacy reads preserve editable rows and API totals without inventing zero values', async ({ page }) => {
  const valid = fixtures().slice(0, 10).map(product => ({ ...product, quantity: 100 }));
  const missingId = '0000000000000000000000a1';
  const aliasId = '0000000000000000000000a2';
  const missing = { ...fixtures()[0], _id: missingId, title: undefined, price: undefined, quantity: undefined, category: [], brand: { legacy: true }, color: false };
  const alias = { ...fixtures()[1], _id: undefined, id: aliasId, title: 'Legacy API ID Alias', price: 'unknown', quantity: '100', category: 42, brand: false };
  const state = await mockRawCatalog(page, [missing, alias, ...valid], { totalProducts: 12, inStock: 10, lowStock: 0, outOfStock: 0, totalUnits: 1000 });
  await page.goto('/admin/products');
  const rows = page.getByRole('table').locator('tbody tr');
  await expect(rows).toHaveCount(12);
  const missingRow = rows.filter({ hasText: `ID: ${missingId}` });
  await expect(missingRow.getByRole('link', { name: 'Untitled product', exact: true })).toHaveAttribute('href', `/admin/products/${missingId}/edit`);
  await expect(missingRow).toContainText('Needs attention:');
  await expect(missingRow).toContainText('Review & repair');
  await expect(missingRow).toContainText('Unavailable');
  await expect(missingRow).toContainText('Stock unavailable');
  await expect(missingRow).not.toContainText('$0.00');
  await expect(missingRow).not.toContainText('Out of stock');
  await expect(missingRow).not.toContainText('0 units');
  await expect(rows.filter({ hasText: 'Legacy API ID Alias' }).getByRole('link', { name: 'Legacy API ID Alias', exact: true })).toHaveAttribute('href', `/admin/products/${aliasId}/edit`);
  await expect(page.getByText('Some catalog records need review.', { exact: true })).toBeVisible();
  await expect(page.getByText('Totals are reported by the API and may include incomplete legacy values.', { exact: true })).toBeVisible();
  await page.goto('/admin');
  await expect(page.locator('.adm-stat-card').filter({ hasText: 'Total products' }).locator('strong')).toHaveText('12');
  await expect(page.locator('.adm-units-total strong')).toHaveText('1,000');
  await expect(page.locator('.adm-recent-products').getByText('Untitled product', { exact: true })).toBeVisible();
  await expect(page.locator('.adm-recent-products').getByText('Price unavailable', { exact: false }).first()).toBeVisible();
  expect(state.requests.every(request => request.method === 'GET')).toBe(true);
  await expectNoOverflow(page);
});

test('unusable identities retain raw pagination and never masquerade as an empty catalog', async ({ page }) => {
  const unusable = Array.from({ length: 12 }, (_, index) => ({ ...fixtures()[0], _id: `invalid-id-${index}`, title: `Unusable record ${index + 1}` }));
  const valid = fixtures().slice(0, 2).map(product => ({ ...product, quantity: 100 }));
  const state = await mockRawCatalog(page, [...unusable, ...valid], { totalProducts: 14, inStock: 2, lowStock: 0, outOfStock: 0, totalUnits: 200 });
  await page.goto('/admin/products');
  await expect(page.getByRole('heading', { name: 'These records need review.', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'A fresh beginning.', exact: true })).toHaveCount(0);
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(0);
  await expect(page.getByText('Record 12:', { exact: false })).toBeVisible();
  await expect(page.getByText('1–12 of 14 products', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next page', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(2);
  await expect(page.getByText('Page 2 of 2', { exact: true })).toBeVisible();
  state.records = [{ title: 'No identity' }, null];
  state.summary = { totalProducts: 2, inStock: 0, lowStock: 0, outOfStock: 0, totalUnits: 0 };
  await page.goto('/admin/products');
  await expect(page.getByRole('heading', { name: 'These records need review.', exact: true })).toBeVisible();
  await expect(page.getByText('Some catalog records need review.', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'A fresh beginning.', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Next page', exact: true })).toBeDisabled();
  expect(state.requests.every(request => request.method === 'GET')).toBe(true);
});

test('legacy invalid numerics stay blank and omitted until explicitly repaired, including zero', async ({ page }) => {
  const id = '0000000000000000000000b1';
  const legacy = { ...fixtures()[0], _id: id, title: undefined, price: undefined, quantity: 'not recorded', category: 23, brand: { source: 'old' } };
  const state = await mockRawCatalog(page, [legacy], { totalProducts: 1, inStock: 0, lowStock: 0, outOfStock: 0, totalUnits: 0 });
  await page.goto(`/admin/products/${id}/edit`);
  const price = page.getByRole('spinbutton', { name: 'Price', exact: true });
  const quantity = page.getByRole('spinbutton', { name: 'Stock quantity', exact: true });
  await expect(price).toHaveValue('');
  await expect(quantity).toHaveValue('');
  await expect(page.locator('#price-stored-issue')).toContainText('Missing');
  await expect(page.locator('#quantity-stored-issue')).toContainText('Text: "not recorded"');
  await expect(page.locator('#brand-stored-issue')).toContainText('Object value');
  await page.getByRole('textbox', { name: 'Product title', exact: true }).fill('An explicitly repaired title');
  await page.getByRole('button', { name: 'Save changes', exact: true }).first().click();
  await expect.poll(() => state.requests.filter(request => request.method === 'PATCH').length).toBe(1);
  await expect(page.getByText('Changes saved.', { exact: true })).toBeVisible();
  expect(state.requests.find(request => request.method === 'PATCH')?.body).toEqual({ title: 'An explicitly repaired title' });
  await expect(price).toHaveValue('');
  await expect(quantity).toHaveValue('');
  await expect(page.getByText('This record still has stored details to review.', { exact: false })).toBeVisible();
  await price.fill('-2');
  await quantity.fill('1.5');
  await page.getByRole('button', { name: 'Save changes', exact: true }).first().click();
  await expect(page.getByText('Enter a valid price of zero or more.', { exact: true })).toBeVisible();
  await expect(page.getByText('Enter a whole stock quantity of zero or more.', { exact: true })).toBeVisible();
  expect(state.requests.filter(request => request.method === 'PATCH')).toHaveLength(1);
  await price.fill('0');
  await quantity.fill('0');
  await page.getByRole('button', { name: 'Save changes', exact: true }).first().click();
  await expect.poll(() => state.requests.filter(request => request.method === 'PATCH').length).toBe(2);
  await expect(page.getByRole('button', { name: 'Save changes', exact: true }).first()).toBeDisabled();
  expect(state.requests.filter(request => request.method === 'PATCH')[1].body).toEqual({ price: 0, quantity: 0 });
  expect(state.records[0]).toMatchObject({ price: 0, quantity: 0, category: 23, brand: { source: 'old' } });
});

test('damaged legacy galleries change only after explicit review, including an intentional empty replacement', async ({ page }) => {
  const id = '0000000000000000000000c1';
  const emptyId = '0000000000000000000000c2';
  const retainedImage = { url: '/editorial/headphones.jpg', public_id: 'original-image', alt: 'Keep this metadata' };
  const state = await mockRawCatalog(page, [
    { ...fixtures()[0], _id: id, images: [retainedImage, 'javascript:invalid', { url: '/api/private' }] },
    { ...fixtures()[1], _id: emptyId, images: ['javascript:invalid'] },
  ], { totalProducts: 2, inStock: 1, lowStock: 1, outOfStock: 1, totalUnits: 3 });
  await page.goto(`/admin/products/${id}/edit`);
  const confirmation = page.getByRole('checkbox', { name: 'I reviewed the safe image references and want to replace the stored gallery.', exact: true });
  await expect(confirmation).not.toBeChecked();
  await expect(page.locator('.adm-image-card')).toHaveCount(1);
  await page.getByRole('textbox', { name: 'Product title', exact: true }).fill('Only the title changes');
  await page.getByRole('button', { name: 'Save changes', exact: true }).first().click();
  await expect.poll(() => state.requests.filter(request => request.method === 'PATCH').length).toBe(1);
  await expect(page.getByText('Changes saved.', { exact: true })).toBeVisible();
  expect(state.requests.find(request => request.method === 'PATCH')?.body).toEqual({ title: 'Only the title changes' });
  await page.getByLabel('Or add an existing image', { exact: true }).fill('/editorial/new-safe-image.jpg');
  await page.getByRole('button', { name: 'Add image', exact: true }).click();
  await page.getByRole('button', { name: 'Save changes', exact: true }).first().click();
  await expect(page.getByText('Review and confirm replacement of the stored gallery before saving image changes.', { exact: true })).toBeVisible();
  expect(state.requests.filter(request => request.method === 'PATCH')).toHaveLength(1);
  await confirmation.check();
  await page.getByRole('button', { name: 'Save changes', exact: true }).first().click();
  await expect.poll(() => state.requests.filter(request => request.method === 'PATCH').length).toBe(2);
  await expect(confirmation).toHaveCount(0);
  expect(state.requests.filter(request => request.method === 'PATCH')[1].body).toEqual({ images: [retainedImage, '/editorial/new-safe-image.jpg'] });
  await page.goto(`/admin/products/${emptyId}/edit`);
  await expect(page.locator('.adm-image-card')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save changes', exact: true }).first()).toBeDisabled();
  await confirmation.check();
  await expect(page.getByRole('button', { name: 'Save changes', exact: true }).first()).toBeEnabled();
  await page.getByRole('button', { name: 'Save changes', exact: true }).first().click();
  await expect.poll(() => state.requests.filter(request => request.method === 'PATCH').length).toBe(3);
  expect(state.requests.filter(request => request.method === 'PATCH')[2].body).toEqual({ images: [] });
});
