import { expect, test, type Page, type Route } from '@playwright/test';
import type { Product } from '../lib/types';

// Synthetic records exist only in intercepted browser requests. No database is seeded.
const headphones: Product = {
  _id: '000000000000000000000001', title: 'Test Studio Headphones', slug: 'test-studio-headphones',
  description: 'Synthetic audio product for browser tests.', price: 120, category: 'Audio',
  brand: 'Test Brand', quantity: 4, color: 'Black', images: ['/editorial/headphones.jpg'],
};
const speaker: Product = {
  ...headphones, _id: '000000000000000000000002', title: 'Test Desk Speaker',
  slug: 'test-desk-speaker', price: 60, quantity: 0,
};
const laptop: Product = {
  ...headphones, _id: '000000000000000000000003', title: 'Test Travel Laptop',
  slug: 'test-travel-laptop', description: 'Synthetic technology product for browser tests.',
  category: 'Technology', price: 900, quantity: 3,
};
const products = [headphones, speaker, laptop];
const password = 'OnlyForBrowserTests8!';
const mobile = '+12025550123';
const token = `test.${Buffer.from(JSON.stringify({ exp: 4_102_444_800 })).toString('base64url')}.test`;
const account = {
  _id: '000000000000000000000010', firstname: 'Test', lastname: 'Shopper',
  email: 'shopper@example.test', token,
  password: 'TEST_PASSWORD_HASH_DO_NOT_PERSIST', refreshToken: 'TEST_REFRESH_DO_NOT_PERSIST',
};

type MockOptions = {
  catalog?: (route: Route) => Promise<void>;
  detail?: (route: Route, id: string) => Promise<void>;
  user?: (route: Route, action: string) => Promise<void>;
};

async function mockStore(page: Page, options: MockOptions = {}) {
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/product') {
      if (options.catalog) return options.catalog(route);
      return route.fulfill({ json: { data: { products } } });
    }
    if (path.startsWith('/api/product/')) {
      const id = path.slice('/api/product/'.length);
      if (options.detail) return options.detail(route, id);
      const product = products.find(value => value._id === id);
      return route.fulfill({ status: product ? 200 : 404, json: product || { message: 'Not found' } });
    }
    if (path.startsWith('/api/user/')) {
      if (options.user) return options.user(route, path.slice('/api/user/'.length));
      return route.fulfill({ status: 503, json: { message: 'Authentication is mocked in browser tests.' } });
    }
    // An unexpected API request must never fall through to the real backend.
    return route.fulfill({ status: 404, json: { message: 'No browser-test handler configured.' } });
  });
}

async function addHeadphones(page: Page) {
  await page.goto('/products');
  await page.getByRole('button', { name: `Add ${headphones.title} to bag`, exact: true }).click();
  await expect(page.getByRole('link', { name: 'Shopping Bag, 1 item', exact: true })).toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}

test('homepage displays an honest empty collection without fabricated products', async ({ page }) => {
  await mockStore(page, { catalog: route => route.fulfill({ json: { data: { products: [] } } }) });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Good finds/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'The collection is taking shape.' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Add .+ to bag$/ })).toHaveCount(0);
  await expect(page.getByText('Editorial inspiration · explore current availability in the collection')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('homepage can recover from a product API failure', async ({ page }) => {
  let available = false;
  await mockStore(page, { catalog: route => available
    ? route.fulfill({ json: { data: { products } } })
    : route.fulfill({ status: 503, json: { message: 'Synthetic test outage' } }) });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Let’s try that again.' })).toBeVisible();
  available = true;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('heading', { name: headphones.title })).toBeVisible();
});

test('loading products are communicated until the response arrives', async ({ page }) => {
  let release: (() => void) | undefined;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await mockStore(page, { catalog: async route => { await gate; await route.fulfill({ json: { data: { products } } }); } });
  await page.goto('/products');
  await expect(page.getByRole('status', { name: 'Loading products' })).toBeVisible();
  release?.();
  await expect(page.getByRole('heading', { name: headphones.title })).toBeVisible();
  await expect(page.getByRole('status', { name: 'Loading products' })).toHaveCount(0);
});

test('malformed product responses show a recoverable error instead of broken shopping controls', async ({ page }) => {
  const malformed = { ...headphones, images: 'invalid product image data' };
  await mockStore(page, {
    catalog: route => route.fulfill({ json: { data: { products: [malformed] } } }),
    detail: route => route.fulfill({ json: malformed }),
  });
  await page.goto('/products');
  await expect(page.getByRole('heading', { name: 'Let’s try that again.' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Add .+ to bag$/ })).toHaveCount(0);
  await page.goto(`/products/${headphones._id}`);
  await expect(page.getByText('This product’s information is temporarily unavailable.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await expect(page.getByRole('button', { name: /add to bag/i })).toHaveCount(0);
});

test('catalog search, category, stock, price and sorting work together', async ({ page }) => {
  await mockStore(page);
  await page.goto('/products');
  const cards = page.locator('article').filter({ has: page.getByRole('heading', { level: 3 }) });
  await expect(cards).toHaveCount(3);
  const sort = page.getByRole('combobox', { name: 'Sort by', exact: true });
  await expect(sort).toBeVisible();
  await sort.selectOption('price-asc');
  await expect(cards.first().getByRole('heading')).toHaveText(speaker.title);
  await page.getByRole('button', { name: 'Audio', exact: true }).click();
  await expect(cards).toHaveCount(2);
  await page.getByRole('button', { name: /^Filters/ }).click();
  // This filter is controlled by the URL; wait for the router transition.
  await page.getByLabel('In stock only').click();
  await expect(page.getByLabel('In stock only')).toBeChecked();
  await expect(cards).toHaveCount(1);
  await expect(cards.getByRole('heading')).toHaveText(headphones.title);
  await page.getByLabel('Maximum price').fill('100');
  await expect(page.getByRole('heading', { name: 'No finds this time.' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(cards).toHaveCount(3);
  await page.getByRole('searchbox', { name: 'Search products' }).fill('studio');
  await page.getByRole('searchbox', { name: 'Search products' }).press('Enter');
  await expect(cards).toHaveCount(1);
  await expect(cards.getByRole('heading')).toHaveText(headphones.title);
  await expect(page).toHaveURL(/q=studio/);
  await page.reload();
  await expect(cards).toHaveCount(1);
});

test('sold-out products cannot be added to the bag', async ({ page }) => {
  await mockStore(page);
  await page.goto('/products');
  await expect(page.getByRole('button', { name: `Add ${speaker.title} to bag`, exact: true })).toBeDisabled();
  await page.goto(`/products/${speaker._id}`);
  await expect(page.getByRole('heading', { name: speaker.title, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /sold out|out of stock/i })).toBeDisabled();
});

test('product details add a real API product to a persistent, editable bag', async ({ page }) => {
  await mockStore(page);
  await page.goto(`/products/${headphones._id}`);
  await expect(page.getByRole('heading', { name: headphones.title, exact: true })).toBeVisible();
  await page.getByRole('main').getByRole('button', { name: /add to bag/i }).click();
  await page.getByRole('link', { name: 'Shopping Bag, 1 item', exact: true }).click();
  await expect(page.getByRole('heading', { name: headphones.title, exact: true })).toBeVisible();
  const increase = page.getByRole('button', { name: `Increase quantity of ${headphones.title}`, exact: true });
  await increase.click();
  await expect(page.getByLabel('Quantity: 2', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Quantity: 2', { exact: true })).toBeVisible();
  await increase.click();
  await increase.click();
  await expect(increase).toBeDisabled();
  await page.getByRole('button', { name: `Decrease quantity of ${headphones.title}`, exact: true }).click();
  await expect(page.getByLabel('Quantity: 3', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: `Remove ${headphones.title} from bag`, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your bag is waiting.' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Your bag is waiting.' })).toBeVisible();
});

test('adding beyond available stock keeps the bag count and communicates the limit', async ({ page }) => {
  await mockStore(page);
  await page.goto(`/products/${headphones._id}`);
  for (let count = 1; count < headphones.quantity; count++) {
    await page.getByRole('button', { name: 'Increase quantity', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Add to bag', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Shopping Bag, 4 items', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Added to your bag', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: `Your bag already has all available ${headphones.title}.` })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add to bag', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Shopping Bag, 4 items', exact: true })).toBeVisible();
  await page.goto('/products');
  const quickAdd = page.getByRole('button', { name: `Add ${headphones.title} to bag`, exact: true });
  await quickAdd.click();
  await expect(quickAdd).toBeVisible();
  await expect(page.getByRole('button', { name: `${headphones.title} added to bag`, exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Shopping Bag, 4 items', exact: true })).toBeVisible();
});

test('invalid saved account and bag data do not prevent anonymous shopping', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(({ savedAccount, savedProduct }) => {
    sessionStorage.setItem('uwa.account.v1', JSON.stringify(savedAccount));
    localStorage.setItem('uwa.cart.v1', JSON.stringify([{ product: savedProduct, quantity: 1 }]));
  }, { savedAccount: { ...account, firstname: { invalid: true } }, savedProduct: { ...headphones, price: 'invalid' } });
  await mockStore(page);
  await page.goto('/account');
  await expect(page.getByRole('heading', { name: 'Your space at UWA.' })).toBeVisible();
  await page.goto('/cart');
  await expect(page.getByRole('heading', { name: 'Your bag is waiting.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Shopping Bag, 0 items', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('missing product details offer a route back to shopping', async ({ page }) => {
  await mockStore(page);
  await page.goto('/products/000000000000000000000099');
  await expect(page.getByRole('heading', { name: /not found|couldn.t find|no longer|unavailable|isn.t here/i })).toBeVisible();
  await expect(page.getByRole('main').getByRole('link', { name: /collection|shop|browse/i }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /add to bag/i })).toHaveCount(0);
});

test('checkout checks current stock and prices and never claims payment is available', async ({ page }) => {
  await mockStore(page, { detail: route => route.fulfill({ json: { ...headphones, price: 135, quantity: 1 } }) });
  await addHeadphones(page);
  await page.goto('/cart');
  await page.getByRole('button', { name: `Increase quantity of ${headphones.title}`, exact: true }).click();
  await page.getByRole('link', { name: 'Review checkout', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Online checkout is not available yet.' })).toBeVisible();
  await expect(page.getByText('Price updated from $120.00 to $135.00 per item.', { exact: true })).toBeVisible();
  await expect(page.getByText('Only 1 item is currently available.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Update quantity to 1', exact: true }).click();
  await expect(page.getByText('Only 1 item is currently available.', { exact: true })).toHaveCount(0);
  const summary = page.getByRole('complementary', { name: 'Bag review' });
  await expect(summary.getByText('$135.00', { exact: true })).toHaveCount(2);
  await expect(page.getByRole('button', { name: /pay|place order|complete order/i })).toHaveCount(0);
  await expect(page.getByRole('textbox')).toHaveCount(0);
});

test('checkout does not invent a total when a product cannot be verified', async ({ page }) => {
  let recover = false;
  await mockStore(page, { detail: route => recover
    ? route.fulfill({ json: headphones })
    : route.fulfill({ status: 503, json: { message: 'Synthetic test outage' } }) });
  await addHeadphones(page);
  await page.goto('/checkout');
  await expect(page.getByText('We couldn’t check this product. Refresh availability to try again.')).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Bag review' }).getByText('Unavailable', { exact: true })).toBeVisible();
  recover = true;
  await page.getByRole('button', { name: 'Refresh availability', exact: true }).click();
  await expect(page.getByText('Prices and stock have been checked. Items are not reserved.')).toBeVisible();
});

test('checkout handles deleted products without keeping an invented subtotal', async ({ page }) => {
  await mockStore(page, { detail: route => route.fulfill({ status: 404, json: { message: 'Not found' } }) });
  await addHeadphones(page);
  await page.goto('/checkout');
  await expect(page.getByText('This product is no longer available.', { exact: true })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Bag review' }).getByText('Unavailable', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: `Remove ${headphones.title} from bag`, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your next find is out there.' })).toBeVisible();
});

test('login retains only account fields and logout clears the local session', async ({ page }) => {
  let logoutRequested = false;
  await mockStore(page, { user: async (route, action) => {
    if (action === 'login') {
      expect(route.request().postDataJSON()).toEqual({ email: account.email, password });
      return route.fulfill({ json: account });
    }
    if (action === 'logout') { logoutRequested = true; return route.fulfill({ json: { message: 'Logged out' } }); }
    return route.fulfill({ status: 404, json: {} });
  } });
  await page.goto('/signin');
  await page.getByLabel('Email address', { exact: true }).fill(account.email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole('heading', { name: 'Hello, Test.' })).toBeVisible();
  const storage = await page.evaluate(() => JSON.stringify({ ...sessionStorage, ...localStorage }));
  expect(storage).not.toContain(account.password);
  expect(storage).not.toContain(account.refreshToken);
  expect(storage).not.toContain(password);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Hello, Test.' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/signin$/);
  expect(logoutRequested).toBe(true);
  await page.goto('/account');
  await expect(page.getByRole('heading', { name: 'Your space at UWA.' })).toBeVisible();
});

test('invalid login and unexpected error responses display safe, useful messages', async ({ page }) => {
  let status = 401;
  await mockStore(page, { user: route => route.fulfill({ status, json: { message: status === 401 ? 'Invalid Credentials' : 'TEST_INTERNAL_BACKEND_DETAILS' } }) });
  await page.goto('/signin');
  await page.getByLabel('Email address', { exact: true }).fill(account.email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('That email and password don’t match. Check your details and try again.');
  status = 500;
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('Sign in is temporarily unavailable. Please try again later.');
  await expect(page.getByText('TEST_INTERNAL_BACKEND_DETAILS')).toHaveCount(0);
});

test('a malformed successful login response never marks a customer as signed in', async ({ page }) => {
  await mockStore(page, { user: route => route.fulfill({ json: { ...account, firstname: [] } }) });
  await page.goto('/signin');
  await page.getByLabel('Email address', { exact: true }).fill(account.email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('We couldn’t verify your sign in. Please try again later.');
  await page.goto('/account');
  await expect(page.getByRole('heading', { name: 'Your space at UWA.' })).toBeVisible();
});

test('registration validates matching passwords and confirms only an actual API success', async ({ page }) => {
  let registrationCount = 0;
  await mockStore(page, { user: async (route, action) => {
    expect(action).toBe('register');
    registrationCount++;
    expect(route.request().postDataJSON()).toEqual({ firstname: 'Test', lastname: 'Shopper', email: account.email, mobile, password });
    return route.fulfill({ json: account });
  } });
  await page.goto('/signup');
  await page.getByLabel('First name', { exact: true }).fill('Test');
  await page.getByLabel('Last name', { exact: true }).fill('Shopper');
  await page.getByLabel('Email address', { exact: true }).fill(account.email);
  await page.getByLabel('Mobile number', { exact: true }).fill(mobile);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password', { exact: true }).fill('DifferentPassword8!');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('Your passwords don’t match. Please try again.');
  expect(registrationCount).toBe(0);
  await page.getByLabel('Confirm password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your account is ready.' })).toBeVisible();
  expect(registrationCount).toBe(1);
  expect(await page.evaluate(() => JSON.stringify({ ...sessionStorage, ...localStorage }))).not.toContain(account.password);
  await page.goto('/account');
  await expect(page.getByRole('heading', { name: 'Your space at UWA.' })).toBeVisible();
});

test('header search works by keyboard and Escape restores focus', async ({ page }) => {
  await mockStore(page);
  await page.goto('/');
  const openSearch = page.getByRole('button', { name: 'Open search', exact: true });
  await openSearch.click();
  await expect(page.getByRole('searchbox', { name: 'What are you looking for?' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(openSearch).toBeFocused();
  await openSearch.press('Enter');
  await page.getByRole('searchbox', { name: 'What are you looking for?' }).fill('headphones');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/products\?q=headphones$/);
  await expect(page.getByRole('heading', { name: headphones.title, exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: laptop.title, exact: true })).toHaveCount(0);
});

test('mobile menu is operable with keyboard and closes on navigation', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'The menu is displayed at mobile widths.');
  await mockStore(page);
  await page.goto('/');
  const toggle = page.getByRole('button', { name: 'Open menu', exact: true });
  await toggle.click();
  await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(toggle).toBeFocused();
  await toggle.press('Enter');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: /Discover/ })).toBeFocused();
  await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: /Shop all/ }).click();
  await expect(page).toHaveURL(/\/products$/);
  await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toHaveCount(0);
});

test('key shopping and account pages fit the viewport', async ({ page }) => {
  await mockStore(page);
  await addHeadphones(page);
  for (const path of ['/', '/products', `/products/${headphones._id}`, '/signin', '/signup', '/cart', '/checkout', '/account', '/about', '/contact']) {
    await page.goto(path);
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
});

test('tablet catalog remains usable without horizontal page scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await mockStore(page);
  await page.goto('/products');
  await page.getByRole('button', { name: /^Filters/ }).click();
  await expect(page.getByLabel('Minimum price')).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Sort by', exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.goto('/signup');
  await expect(page.getByRole('button', { name: 'Create account', exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
