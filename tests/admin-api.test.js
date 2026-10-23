// Every mutation in this suite is restricted to a newly generated test database.
// Never load .env or derive a connection from MONGODB_URL: that may name a store.
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { mkdtemp, mkdir, readdir, rm } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { after, before, beforeEach, describe, test } = require('node:test');

function isolatedTestUri(input, databaseName) {
  let uri;
  try { uri = new URL(input); } catch { throw new Error('Set TEST_MONGODB_URL to an isolated MongoDB test URI.'); }
  if (!['mongodb:', 'mongodb+srv:'].includes(uri.protocol)
    || !/^uwa_admin_test_[a-z\d_-]{1,40}$/i.test(decodeURIComponent(uri.pathname.slice(1)))) {
    throw new Error('TEST_MONGODB_URL must name a database beginning with uwa_admin_test_; real store databases are forbidden.');
  }
  assert.match(databaseName, /^uwa_admin_test_[a-f\d]{16}$/);
  uri.pathname = `/${databaseName}`;
  return uri.toString();
}

const databaseName = `uwa_admin_test_${randomBytes(8).toString('hex')}`;
const mongoUri = isolatedTestUri(process.env.TEST_MONGODB_URL, databaseName);
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = `isolated-integration-${randomBytes(32).toString('hex')}`;
// A future accidental startup import must still be unable to reach the real store.
process.env.MONGODB_URL = mongoUri;

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const sharp = require('sharp');
const { createApp } = require('../app');
const User = require('../models/userModel');
const Product = require('../models/productModel');

const password = 'Synthetic-Test-Password-2026!';
let app;
let uploadDirectory;
let admin;
let user;
let adminToken;
let userToken;
let png;
let jpeg;
let webp;

function assertIsolatedConnection() {
  assert.equal(mongoose.connection.name, databaseName, 'Refusing to operate outside this run’s isolated test database.');
  assert.match(databaseName, /^uwa_admin_test_[a-f\d]{16}$/);
}

function sign(userId, claims = {}, options = {}) {
  return jwt.sign({ id: String(userId), ...claims }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h', ...options });
}

function api(method, url, token) {
  const operation = request(app)[method](url).timeout({ response: 8000, deadline: 15000 });
  if (token) operation.set('Authorization', `Bearer ${token}`);
  return operation;
}

function product(overrides = {}) {
  return {
    title: 'Synthetic Studio Headphones', slug: 'synthetic-studio-headphones',
    description: 'Only created in an isolated integration-test database.',
    price: 125.5, category: 'Audio', brand: 'Synthetic Test Brand', color: 'Yellow', quantity: 8,
    images: ['/redmi.jpg', 'https://images.example.test/headphones.jpg'], ...overrides,
  };
}

async function insertMixedLegacyProducts() {
  assertIsolatedConnection();
  const variants = [
    {},
    { price: 10, quantity: 0 },
    { category: undefined, brand: undefined, description: undefined },
    { category: null, brand: ['Legacy', 'Brand'], color: null },
    { title: undefined },
    { title: { legacy: 'An object rather than a title' } },
    { price: null },
    { price: '19.95' },
    { price: 'unavailable' },
    { quantity: null },
    { quantity: '4' },
    { quantity: 'unknown', images: '/redmi.jpg' },
  ];
  const records = [];
  for (const [index, fields] of variants.entries()) {
    const record = {
      ...product({ title: `Synthetic Mixed Legacy ${index + 1}`, slug: `synthetic-mixed-legacy-${index + 1}` }),
      _id: new mongoose.Types.ObjectId(), sold: 0, ratings: [],
      createdAt: new Date('2020-01-01T00:00:00Z'), updatedAt: new Date('2020-01-01T00:00:00Z'),
      ...fields,
    };
    for (const key of Object.keys(record)) if (record[key] === undefined) delete record[key];
    // Model validation is intentionally bypassed only in this guarded test DB to
    // represent historical records which can predate the current required fields.
    await Product.collection.insertOne(record);
    records.push(record);
  }
  return records;
}

function withoutUpdateTime(record) {
  const copy = { ...record };
  delete copy.updatedAt;
  return copy;
}

function idOf(value) { return String(value._id || value.id); }

function assertSafeUser(value) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    assert.ok(!['password', 'refreshtoken', 'passwordresettoken', 'passwordresetexpires', '__v', 'cart', 'address', 'wishlist'].includes(key.toLowerCase()), `Private user field leaked: ${key}`);
    assertSafeUser(child);
  }
}

async function files() { return (await readdir(uploadDirectory)).sort(); }

function binaryParser(response, callback) {
  const chunks = [];
  response.on('data', chunk => chunks.push(chunk));
  response.on('end', () => callback(null, Buffer.concat(chunks)));
  response.on('error', callback);
}

function oversizedPixelPng(source) {
  // A tiny PNG with an oversized IHDR avoids allocating a huge image for this check.
  const image = Buffer.from(source);
  image.writeUInt32BE(100000, 16);
  image.writeUInt32BE(100000, 20);
  let crc = 0xffffffff;
  for (const byte of image.subarray(12, 29)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  image.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 29);
  return image;
}

describe('secure admin API against a disposable isolated MongoDB database', { concurrency: false, timeout: 180000 }, () => {
  before(async () => {
    assert.equal(mongoose.connection.readyState, 0, 'Importing createApp must not connect to MongoDB.');
    uploadDirectory = await mkdtemp(path.join(os.tmpdir(), 'uwa-admin-test-'));
    await mongoose.connect(mongoUri, { dbName: databaseName, serverSelectionTimeoutMS: 5000 });
    assertIsolatedConnection();
    await Promise.all([User.init(), Product.init()]);
    app = createApp({ uploadDirectory, logging: false });
    png = await sharp({ create: { width: 3, height: 2, channels: 3, background: '#f8d434' } }).png().toBuffer();
    jpeg = await sharp(png).withMetadata({ exif: { IFD0: { Copyright: 'SYNTHETIC TEST METADATA' } } }).jpeg().toBuffer();
    webp = await sharp(png).webp().toBuffer();
  });

  beforeEach(async () => {
    assertIsolatedConnection();
    await Promise.all([User.deleteMany({}), Product.deleteMany({})]);
    await rm(uploadDirectory, { recursive: true, force: true });
    await mkdir(uploadDirectory, { recursive: true });
    [admin, user] = await User.create([
      { firstname: 'Synthetic', lastname: 'Administrator', email: 'admin@example.test', mobile: '+12025550101', password, role: 'admin' },
      { firstname: 'Synthetic', lastname: 'Shopper', email: 'shopper@example.test', mobile: '+12025550102', password, role: 'user' },
    ]);
    adminToken = sign(admin._id);
    userToken = sign(user._id);
  });

  after(async () => {
    try {
      if (mongoose.connection.readyState === 1) {
        assertIsolatedConnection();
        await mongoose.connection.dropDatabase();
      }
    } finally {
      await mongoose.disconnect();
      if (uploadDirectory) await rm(uploadDirectory, { recursive: true, force: true });
    }
  });

  test('test database guard refuses existing application or default database names', () => {
    for (const uri of [undefined, '', 'mongodb://127.0.0.1:27017/uwa_db', 'mongodb://127.0.0.1:27017/test', 'mongodb://127.0.0.1:27017/', 'https://example.test/uwa_admin_test_safe']) {
      assert.throws(() => isolatedTestUri(uri, databaseName));
    }
    const safe = new URL(isolatedTestUri('mongodb://127.0.0.1:27017/uwa_admin_test_requested', databaseName));
    assert.equal(safe.pathname, `/${databaseName}`);
    assert.notEqual(safe.pathname, '/uwa_admin_test_requested');
  });

  test('current-user authentication rejects missing, malformed, expired and wrongly signed tokens', async () => {
    await api('get', '/api/user/me').expect(401);
    for (const token of [
      'not-a-jwt',
      sign(user._id, {}, { expiresIn: -1 }),
      jwt.sign({ id: String(user._id) }, 'synthetic-wrong-secret', { algorithm: 'HS256' }),
      jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET, { algorithm: 'HS384' }),
      sign('not-a-mongodb-id'),
    ]) await api('get', '/api/user/me', token).expect(401);
    await request(app).get('/api/user/me').set('Authorization', 'Bearer').expect(401);
    await request(app).get('/api/user/me').set('Authorization', `Basic ${userToken}`).expect(401);
    const current = await api('get', '/api/user/me', userToken).expect(200);
    assert.equal(current.body.role, 'user');
    assert.equal(idOf(current.body), String(user._id));
    assertSafeUser(current.body);
  });

  test('authorization uses current database roles and blocked/deleted account state', async () => {
    const forgedAdminClaim = sign(user._id, { role: 'admin' });
    await api('get', '/api/admin/products', forgedAdminClaim).expect(403);
    await User.updateOne({ _id: admin._id }, { $set: { role: 'user' } });
    await api('get', '/api/admin/products', adminToken).expect(403);
    const current = await api('get', '/api/user/me', adminToken).expect(200);
    assert.equal(current.body.role, 'user');
    await User.updateOne({ _id: admin._id }, { $set: { role: 'admin', isBlocked: true } });
    await api('get', '/api/user/me', adminToken).expect(403);
    await api('get', '/api/admin/products', adminToken).expect(403);
    await api('post', '/api/user/login').send({ email: admin.email, password }).expect(403);
    await User.deleteOne({ _id: admin._id });
    await api('get', '/api/user/me', adminToken).expect(401);
    await api('get', '/api/admin/products', adminToken).expect(401);
  });

  test('registration cannot grant administrator privileges and user responses omit credentials', async () => {
    const registered = await api('post', '/api/user/register').send({
      firstname: 'Synthetic', lastname: 'Registrant', email: 'registrant@example.test', mobile: '+12025550103', password,
      role: 'admin', isBlocked: true, refreshToken: 'DO_NOT_PERSIST_TEST_REFRESH',
      passwordResetToken: 'DO_NOT_PERSIST_TEST_RESET', cart: [{ injected: true }],
    }).expect(200);
    assertSafeUser(registered.body);
    const stored = await User.findOne({ email: 'registrant@example.test' }).lean();
    assert.equal(stored.role, 'user');
    assert.equal(stored.isBlocked, false);
    assert.notEqual(stored.refreshToken, 'DO_NOT_PERSIST_TEST_REFRESH');
    assert.equal(stored.passwordResetToken, undefined);
    assert.deepEqual(stored.cart, []);
    const login = await api('post', '/api/user/login').send({ email: stored.email, password, role: 'admin' }).expect(200);
    assert.equal(login.body.role, 'user');
    assert.equal(typeof login.body.token, 'string');
    assertSafeUser(login.body);
    await api('get', '/api/admin/products', login.body.token).expect(403);
    await api('post', '/api/user/login').send({ email: stored.email, password: 'wrong-test-password' }).expect(401);
    const current = await api('get', '/api/user/me', login.body.token).expect(200);
    assert.equal(current.body.role, 'user');
    assertSafeUser(current.body);
  });

  test('existing bcrypt 5 password hashes remain usable with the upgraded authentication dependency', async () => {
    // Generated with bcrypt 5.1.1 from the synthetic `password` fixture above.
    const legacyHash = '$2b$10$/fE/EbgcFf2JtwqEVjF.JOP53ylyQLH4iOLVz.XbnjRDK.NOT/nXC';
    await User.collection.insertOne({
      firstname: 'Synthetic', lastname: 'Legacy', email: 'legacy@example.test', mobile: '+12025550104',
      password: legacyHash, role: 'user', isBlocked: false,
    });
    const login = await api('post', '/api/user/login').send({ email: 'legacy@example.test', password }).expect(200);
    assert.equal(login.body.email, 'legacy@example.test');
    assertSafeUser(login.body);
    await api('get', '/api/user/me', login.body.token).expect(200);
  });

  test('non-admin users cannot mutate products, upload images or use protected legacy user routes', async () => {
    const record = await Product.create(product());
    for (const token of [undefined, userToken]) {
      const expected = token ? 403 : 401;
      await api('get', '/api/admin/products', token).expect(expected);
      for (const base of ['/api/admin/products', '/api/product']) {
        await api('post', base, token).send(product({ slug: 'unauthorized-create' })).expect(expected);
        await api('put', `${base}/${record.id}`, token).send({ price: 1 }).expect(expected);
        await api('delete', `${base}/${record.id}`, token).expect(expected);
      }
      await api('post', '/api/admin/uploads', token).attach('images', png, { filename: 'test.png', contentType: 'image/png' }).expect(expected);
      await api('get', '/api/user/all-Users', token).expect(expected);
      await api('delete', `/api/user/${admin.id}`, token).expect(expected);
    }
    const unchanged = await Product.findById(record._id).lean();
    assert.equal(unchanged.price, 125.5);
    assert.equal(await Product.countDocuments(), 1);
    assert.deepEqual(await files(), []);
  });

  test('product creation rejects missing required fields, unsafe numbers and mass-assignment operators', async () => {
    for (const field of ['title', 'description', 'price', 'category', 'brand', 'color', 'quantity']) {
      const incomplete = product();
      delete incomplete[field];
      await api('post', '/api/admin/products', adminToken).send(incomplete).expect(400);
    }
    for (const invalid of [
      { title: '   ' }, { price: -1 }, { price: '12.50' }, { quantity: -1 }, { quantity: 1.5 },
      { quantity: '3' }, { slug: { $ne: '' } }, { $set: { price: 1 } },
      { sold: 999 }, { _id: String(new mongoose.Types.ObjectId()) },
    ]) await api('post', '/api/admin/products', adminToken).send(product(invalid)).expect(400);
    assert.equal(await Product.countDocuments(), 0);
  });

  test('custom and generated slugs are respected and duplicate slugs produce a conflict', async () => {
    const created = await api('post', '/api/admin/products', adminToken).send(product({ slug: 'A Custom Slug' })).expect(201);
    assert.equal(created.body.slug, 'a-custom-slug');
    await api('post', '/api/admin/products', adminToken).send(product({ slug: 'a-custom-slug', title: 'Another Synthetic Product' })).expect(409);
    const changedTitle = await api('patch', `/api/admin/products/${idOf(created.body)}`, adminToken).send({ title: 'A Different Synthetic Title' }).expect(200);
    assert.equal(changedTitle.body.slug, 'a-custom-slug');
    const generated = product({ title: 'Synthetic Auto Slug' });
    delete generated.slug;
    const auto = await api('post', '/api/admin/products', adminToken).send(generated).expect(201);
    assert.equal(auto.body.slug, 'synthetic-auto-slug');
    await api('put', `/api/admin/products/${idOf(auto.body)}`, adminToken).send({ slug: 'a-custom-slug' }).expect(409);
  });

  test('administrator CRUD and stock changes are immediately reflected by public storefront endpoints', async () => {
    const created = await api('post', '/api/admin/products', adminToken).send(product()).expect(201);
    const id = idOf(created.body);
    assert.match(id, /^[a-f\d]{24}$/);
    const publicDetail = await api('get', `/api/product/${id}`).expect(200);
    assert.equal(idOf(publicDetail.body), id);
    assert.deepEqual(publicDetail.body.images, product().images);
    const changed = await api('put', `/api/admin/products/${id}`, adminToken).send({ price: 150, quantity: 0, title: 'Updated Synthetic Headphones' }).expect(200);
    assert.equal(changed.body.slug, product().slug);
    const publicListing = await api('get', '/api/product').query({ limit: 100 }).expect(200);
    const visible = publicListing.body.data.products.find(entry => idOf(entry) === id);
    assert.equal(visible.title, 'Updated Synthetic Headphones');
    assert.equal(visible.price, 150);
    assert.equal(visible.quantity, 0);
    const detailAfterStockChange = await api('get', `/api/product/${id}`).expect(200);
    assert.equal(detailAfterStockChange.body.quantity, 0);
    await api('delete', `/api/admin/products/${id}`, adminToken).expect(200);
    await api('get', `/api/product/${id}`).expect(404);
    await api('get', `/api/admin/products/${id}`, adminToken).expect(404);
    const afterDelete = await api('get', '/api/product').expect(200);
    assert.ok(!afterDelete.body.data.products.some(entry => idOf(entry) === id));
    await api('delete', `/api/admin/products/${id}`, adminToken).expect(404);
  });

  test('partial edits preserve older incomplete metadata and all unrelated product fields', async () => {
    const legacy = product({ slug: 'synthetic-incomplete-legacy', sold: 7, ratings: [{ star: 4 }], images: ['/redmi.jpg', { url: 'https://images.example.test/legacy.jpg' }] });
    delete legacy.category;
    delete legacy.brand;
    const inserted = await Product.collection.insertOne({ ...legacy, createdAt: new Date(), updatedAt: new Date() });
    const id = String(inserted.insertedId);
    const edited = await api('patch', `/api/admin/products/${id}`, adminToken).send({ price: 42, quantity: 4 }).expect(200);
    assert.equal(edited.body.price, 42);
    assert.equal(edited.body.quantity, 4);
    const stored = await Product.findById(id).lean();
    assert.equal(stored.category, undefined);
    assert.equal(stored.brand, undefined);
    for (const field of ['title', 'slug', 'description', 'color', 'sold', 'images', 'ratings']) assert.deepEqual(stored[field], legacy[field]);
    await api('patch', `/api/admin/products/${id}`, adminToken).send({ quantity: -1 }).expect(400);
    assert.equal((await Product.findById(id).lean()).quantity, 4);
  });

  test('admin reads retain all twelve mixed legacy identities without rewriting original database values', async () => {
    const records = await insertMixedLegacyProducts();
    const originals = await Product.collection.find({}).sort({ _id: 1 }).toArray();
    const listing = await api('get', '/api/admin/products', adminToken).query({ limit: 12, sort: '_id' }).expect(200);
    assert.equal(listing.body.total, 12);
    assert.equal(listing.body.products.length, 12);
    assert.equal(listing.body.totalPages, 1);
    assert.deepEqual(listing.body.products.map(idOf), originals.map(idOf));
    const complete = listing.body.products.find(entry => idOf(entry) === String(records[0]._id));
    assert.equal(complete.title, records[0].title);
    assert.equal(complete.price, records[0].price);
    assert.equal(complete.quantity, records[0].quantity);
    assert.deepEqual(complete.images, records[0].images);
    for (const index of [4, 5, 8, 11]) {
      const detail = await api('get', `/api/admin/products/${records[index]._id}`, adminToken).expect(200);
      assert.equal(idOf(detail.body), String(records[index]._id));
    }
    // Mongoose may cast values in the wire response. Compare the raw collection
    // before/after instead: viewing the catalog must never repair data implicitly.
    assert.deepEqual(await Product.collection.find({}).sort({ _id: 1 }).toArray(), originals);
  });

  test('unrelated partial updates preserve malformed legacy titles, prices, stock and image storage', async () => {
    const records = await insertMixedLegacyProducts();
    for (const index of [4, 5, 8, 11]) {
      const original = await Product.collection.findOne({ _id: records[index]._id });
      const updated = await api('patch', `/api/admin/products/${records[index]._id}`, adminToken).send({ color: 'Updated blue' }).expect(200);
      assert.equal(idOf(updated.body), String(records[index]._id));
      assert.equal(updated.body.color, 'Updated blue');
      const stored = await Product.collection.findOne({ _id: records[index]._id });
      assert.deepEqual(withoutUpdateTime(stored), { ...withoutUpdateTime(original), color: 'Updated blue' });
    }
    assert.equal(await Product.collection.countDocuments(), 12);
  });

  test('legacy read compatibility keeps strict changed-field and new-product validation', async () => {
    const records = await insertMixedLegacyProducts();
    const id = records[11]._id;
    const original = await Product.collection.findOne({ _id: id });
    for (const invalid of [
      { price: -1 }, { price: '9.99' }, { price: null },
      { quantity: -1 }, { quantity: 1.5 }, { quantity: '4' }, { quantity: null },
      { title: '' }, { title: { invalid: true } }, { category: '' }, { brand: null },
      { description: '' }, { color: [] }, { slug: '' }, { images: 'not-an-array' },
    ]) {
      await api('patch', `/api/admin/products/${id}`, adminToken).send(invalid).expect(400);
      assert.deepEqual(await Product.collection.findOne({ _id: id }), original);
    }
    for (const invalid of [{ title: null }, { description: null }, { category: null }, { brand: [] }, { color: '' }, { price: null }, { quantity: null }]) {
      await api('post', '/api/admin/products', adminToken).send(product(invalid)).expect(400);
    }
    await api('patch', `/api/admin/products/${id}`, adminToken).send({ title: 'Explicitly Repaired Synthetic Product', price: 55, quantity: 7 }).expect(200);
    const repaired = await Product.collection.findOne({ _id: id });
    assert.deepEqual(withoutUpdateTime(repaired), {
      ...withoutUpdateTime(original), title: 'Explicitly Repaired Synthetic Product', price: 55, quantity: 7,
    });
    assert.equal(await Product.collection.countDocuments(), 12);
  });

  test('admin catalog supports search, stock filters, sorting, pagination and truthful inventory summaries', async () => {
    await Product.create([
      product({ title: 'Alpha Headphones', slug: 'alpha-headphones', price: 20, quantity: 0 }),
      product({ title: 'Beta Speaker', slug: 'beta-speaker', price: 40, quantity: 3 }),
      product({ title: 'Gamma Laptop', slug: 'gamma-laptop', category: 'Technology', price: 900, quantity: 9 }),
    ]);
    const first = await api('get', '/api/admin/products', adminToken).query({ sort: '-price', page: 1, limit: 2 }).expect(200);
    assert.deepEqual(first.body.products.map(entry => entry.title), ['Gamma Laptop', 'Beta Speaker']);
    assert.equal(first.body.total, 3);
    assert.equal(first.body.totalPages, 2);
    assert.deepEqual(first.body.summary, { totalProducts: 3, inStock: 2, lowStock: 1, outOfStock: 1, totalUnits: 12 });
    assert.deepEqual([...first.body.categories].sort(), ['Audio', 'Technology']);
    const second = await api('get', '/api/admin/products', adminToken).query({ sort: '-price', page: 2, limit: 2 }).expect(200);
    assert.deepEqual(second.body.products.map(entry => entry.title), ['Alpha Headphones']);
    const filtered = await api('get', '/api/admin/products', adminToken).query({ q: 'speaker', category: 'Audio', stock: 'low-stock' }).expect(200);
    assert.deepEqual(filtered.body.products.map(entry => entry.title), ['Beta Speaker']);
    assert.equal(filtered.body.total, 1);
    assert.equal(filtered.body.summary.totalProducts, 3);
    const literalSearch = await api('get', '/api/admin/products', adminToken).query({ q: '.*' }).expect(200);
    assert.equal(literalSearch.body.total, 0);
    assert.equal(literalSearch.body.totalPages, 0);
    const beyondLastPage = await api('get', '/api/admin/products', adminToken).query({ page: 99, limit: 2 }).expect(200);
    assert.deepEqual(beyondLastPage.body.products, []);
    for (const query of [{ page: 0 }, { limit: 101 }, { stock: 'unknown' }, { sort: 'password' }, { q: 'x'.repeat(121) }, { 'category[$ne]': '' }]) {
      await api('get', '/api/admin/products', adminToken).query(query).expect(400);
    }
  });

  test('product image references accept local paths and HTTPS URLs but reject executable or ambiguous sources', async () => {
    for (const reference of ['http://images.example.test/a.jpg', '//images.example.test/a.jpg', 'data:image/svg+xml,<svg/>', '/\\outside.jpg', 'javascript:alert(1)']) {
      await api('post', '/api/admin/products', adminToken).send(product({ images: [reference] })).expect(400);
    }
    const created = await api('post', '/api/admin/products', adminToken).send(product()).expect(201);
    assert.deepEqual(created.body.images, product().images);
  });

  test('JPEG, PNG and WebP uploads are re-encoded to safe files and retrievable without authentication', async () => {
    const uploaded = await api('post', '/api/admin/uploads', adminToken)
      .attach('images', jpeg, { filename: '../../synthetic-exif.jpg', contentType: 'image/jpeg' })
      .attach('images', png, { filename: 'synthetic.png', contentType: 'image/png' })
      .attach('images', webp, { filename: 'synthetic.webp', contentType: 'image/webp' }).expect(201);
    assert.equal(uploaded.body.images.length, 3);
    assert.equal((await files()).length, 3);
    for (const image of uploaded.body.images) {
      assert.match(image.url, /^\/uploads\/[a-f\d-]+\.webp$/i);
      assert.ok(!image.url.includes('synthetic'));
      const served = await api('get', image.url).buffer(true).parse(binaryParser).expect(200);
      assert.match(served.headers['content-type'], /^image\/webp\b/);
      const metadata = await sharp(served.body).metadata();
      assert.equal(metadata.format, 'webp');
      assert.equal(metadata.width, 3);
      assert.equal(metadata.height, 2);
      assert.equal(metadata.exif, undefined);
    }
    const created = await api('post', '/api/admin/products', adminToken).send(product({ images: uploaded.body.images.map(image => image.url) })).expect(201);
    const visible = await api('get', `/api/product/${idOf(created.body)}`).expect(200);
    assert.deepEqual(visible.body.images, uploaded.body.images.map(image => image.url));
    const outsideUploadRoot = await api('get', '/uploads/%2e%2e/package.json');
    assert.ok([403, 404].includes(outsideUploadRoot.status));
  });

  test('SVG, corrupt and spoofed uploads are rejected and mixed batches leave no files behind', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="3" height="2"><script>syntheticTest()</script></svg>');
    for (const candidate of [
      { bytes: svg, name: 'unsafe.svg', type: 'image/svg+xml' },
      { bytes: svg, name: 'spoofed.png', type: 'image/png' },
      { bytes: Buffer.from('<html>synthetic test</html>'), name: 'spoofed.jpg', type: 'image/jpeg' },
      { bytes: png.subarray(0, 15), name: 'truncated.png', type: 'image/png' },
    ]) {
      const rejected = await api('post', '/api/admin/uploads', adminToken).attach('images', candidate.bytes, { filename: candidate.name, contentType: candidate.type });
      assert.ok([400, 413, 415, 422].includes(rejected.status), `Unsafe upload returned ${rejected.status}`);
      assert.deepEqual(await files(), []);
    }
    const rejectedBatch = await api('post', '/api/admin/uploads', adminToken)
      .attach('images', png, { filename: 'valid.png', contentType: 'image/png' })
      .attach('images', svg, { filename: 'spoofed.png', contentType: 'image/png' });
    assert.ok([400, 413, 415, 422].includes(rejectedBatch.status));
    assert.deepEqual(await files(), []);
  });

  test('upload byte, pixel and file-count limits reject abusive input without partial writes', async () => {
    const tooLarge = await api('post', '/api/admin/uploads', adminToken)
      .attach('images', Buffer.alloc(5 * 1024 * 1024 + 1), { filename: 'oversized.png', contentType: 'image/png' });
    assert.ok([400, 413, 415, 422].includes(tooLarge.status));
    assert.deepEqual(await files(), []);
    const tooManyPixels = await api('post', '/api/admin/uploads', adminToken)
      .attach('images', oversizedPixelPng(png), { filename: 'pixel-limit.png', contentType: 'image/png' });
    assert.ok([400, 413, 415, 422].includes(tooManyPixels.status));
    assert.deepEqual(await files(), []);
    let batch = api('post', '/api/admin/uploads', adminToken);
    for (let index = 0; index < 9; index++) batch = batch.attach('images', png, { filename: `test-${index}.png`, contentType: 'image/png' });
    const tooMany = await batch;
    assert.ok([400, 413, 415, 422].includes(tooMany.status));
    assert.deepEqual(await files(), []);
    await api('post', '/api/admin/uploads', adminToken).attach('avatar', png, { filename: 'test.png', contentType: 'image/png' }).expect(400);
    assert.deepEqual(await files(), []);
  });

  test('legacy product mutations use the same validation, authorization and duplicate-slug safeguards', async () => {
    await api('post', '/api/product', adminToken).send(product({ quantity: -1 })).expect(400);
    const created = await api('post', '/api/product', adminToken).send(product()).expect(201);
    const id = idOf(created.body);
    await api('post', '/api/product', adminToken).send(product()).expect(409);
    await api('put', `/api/product/${id}`, adminToken).send({ $set: { quantity: 0 } }).expect(400);
    await api('put', `/api/product/${id}`, adminToken).send({ quantity: 2 }).expect(200);
    assert.equal((await Product.findById(id).lean()).quantity, 2);
    await api('put', '/api/product/not-an-id', adminToken).send({ quantity: 2 }).expect(400);
    await api('delete', '/api/product/not-an-id', adminToken).expect(400);
    await api('delete', `/api/product/${id}`, adminToken).expect(200);
    assert.equal(await Product.countDocuments(), 0);
  });

  test('profile and password workflows keep responses safe and do not rehash unchanged passwords', async () => {
    const previousHash = user.password;
    user.firstname = 'Renamed';
    await user.save();
    assert.equal(user.password, previousHash);
    const profile = await api('put', '/api/user/edit-user', userToken).send({ firstname: 'Updated', role: 'admin', isBlocked: true }).expect(200);
    assertSafeUser(profile.body);
    const stored = await User.findById(user._id).lean();
    assert.equal(stored.role, 'user');
    assert.equal(stored.isBlocked, false);
    await api('post', '/api/user/login').send({ email: user.email, password }).expect(200);
    const changedPassword = 'Synthetic-New-Password-2026!';
    const changed = await api('put', '/api/user/password', userToken).send({ password: changedPassword }).expect(200);
    assertSafeUser(changed.body);
    await api('post', '/api/user/login').send({ email: user.email, password }).expect(401);
    const login = await api('post', '/api/user/login').send({ email: user.email, password: changedPassword }).expect(200);
    assertSafeUser(login.body);
  });

  test('refresh and logout preserve the existing cookie-based authentication workflow', async () => {
    const session = request.agent(app);
    const login = await session.post('/api/user/login').send({ email: user.email, password }).expect(200);
    assertSafeUser(login.body);
    assert.ok(login.headers['set-cookie'].some(cookie => cookie.startsWith('refreshToken=') && /HttpOnly/i.test(cookie)));
    const refreshed = await session.get('/api/user/refresh').expect(200);
    assert.equal(typeof refreshed.body.accessToken, 'string');
    await api('get', '/api/user/me', refreshed.body.accessToken).expect(200);
    await session.post('/api/user/logout').expect(204);
    await session.get('/api/user/refresh').expect(401);
    assert.equal((await User.findById(user._id).lean()).refreshToken, '');
  });
});
