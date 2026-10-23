# UWA Studio: isolated administrator preview

This branch, `feat/uwa-admin-dashboard`, starts at `a5e4a92` on `feat/uwa-premium-redesign`. It adds product administration to the existing application. It does not merge, deploy, seed the existing catalog, or create a real administrator. Product and user schema fields/indexes remain unchanged. The password-save hook is corrected without rewriting stored password hashes.

## Ubuntu: keep both existing applications running

Use Node.js 22 LTS or 24 and the MongoDB already running on port 27017. These commands create a **third checkout**; leave `~/UWA`, `~/UWA-redesign-test`, ports 5001/3001 and their environment files alone.

```bash
cd ~
git clone --single-branch --branch feat/uwa-admin-dashboard \
  https://github.com/C4Confidence/UWA.git UWA-admin-test
cd ~/UWA-admin-test
npm ci
npm ci --prefix frontend
```

Create a private configuration for a new, empty database. The exclusive file write fails if `.env` already exists, rather than overwriting it. Do not copy the working backend's database URI here.

```bash
node <<'NODE'
const fs = require('node:fs');
const crypto = require('node:crypto');
fs.writeFileSync('.env', [
  'MONGODB_URL=mongodb://127.0.0.1:27017/uwa_admin_test_laptop',
  'PORT=5002',
  'JWT_SECRET=' + crypto.randomBytes(48).toString('hex'),
  '',
].join('\n'), { flag: 'wx', mode: 0o600 });
NODE
npm run dev
```

In a second terminal:

```bash
cd ~/UWA-admin-test
API_ORIGIN=http://127.0.0.1:5002 \
NEXT_PUBLIC_SITE_URL=http://localhost:3002 \
npm run dev --prefix frontend -- --port 3002
```

Open `http://localhost:3002/admin`. This uses the new API on **5002**, with its own **uwa_admin_test_laptop** database. The empty catalog is intentional. Create only clearly identified test records in this database. No automatic copying, seeding, or migration runs. For production-mode testing, stop the frontend, then supply the same `API_ORIGIN` and `NEXT_PUBLIC_SITE_URL` when running `npm run build --prefix frontend` and `npm run start --prefix frontend -- --port 3002`. Restart/rebuild Next.js after changing its API target.

### Explicitly authorize a disposable test administrator

Registration always creates a regular user. In this isolated frontend, register a disposable account with your own password and unique test mobile number, then sign out. Only if you deliberately want to test administration, run the following **manually** in MongoDB Shell. It refuses any other database, asks for the exact test email, and promotes only that existing account. This is not an application startup step or an administrator-management API.

```bash
mongosh 'mongodb://127.0.0.1:27017/uwa_admin_test_laptop'
```

```javascript
if (db.getName() !== 'uwa_admin_test_laptop') throw new Error('Wrong database');
const testEmail = passwordPrompt('Exact disposable test account email (matching its original casing): ').trim();
if (!testEmail.includes('@')) throw new Error('An exact email is required');
db.users.updateOne({ email: testEmail, role: 'user' }, { $set: { role: 'admin' } });
```

Verify one matched/modified record, then sign in again at port 3002. No administrator email/password is built into the application. To revoke this sandbox account later, use the same guarded database and exact email with `$set: { role: 'user' }`. There is no real-account promotion tool in this branch. Do not point the admin sandbox at your existing database before reviewing the changes and deliberately planning integration.

## What to review

- `/admin`: real catalog totals, stock counts and recent products; no order or revenue analytics.
- `/admin/products`: debounced search, category/stock filters, stable sorting, pagination, thumbnails, edit links and confirmed deletion.
- `/admin/products/new` and `/admin/products/<id>/edit`: required fields, unique slugs, saved/unsaved feedback, actionable errors, multiple-image gallery.
- `/admin/inventory`: stock filters, low stock (1–5), out of stock (0), and confirmed quantity-only updates.
- Storefront `/products` and `/products/<id>`: after a successful admin save, navigate/reload to read the updated API data. Already-open tabs require refresh; this is not a realtime subscription. The browser bag keeps its existing local behavior and checkout rechecks current prices/stock.

Older missing category/brand values are labeled for display. The editor leaves their inputs empty and patches only changed fields, so an unrelated title/stock change does not persist invented labels. Product IDs, sold counts, ratings and other unmanaged fields are retained. New products must supply the existing model's required title, slug, description, price, brand, category, color and quantity. Prices are numeric in the existing store currency; no conversion occurs.

### Reviewing incomplete legacy records

The original admin reader required every row to have a string `_id`/title, a finite numeric price and an integer quantity. `products.map(normalizeAdminProduct)` propagated one failed row as a whole-page error. An overview requesting only five recent products could still display database totals while the twelve-row Products page failed. Representative regression fixtures reproduce the failure with null/missing quantities, null titles/prices and `id` aliases; they are not a diagnosis of any particular private laptop record. Missing category/brand alone was already tolerated.

The admin read model now separates incomplete stored data from strictly validated write payloads:

- Products with a usable MongoDB ID remain visible and editable. A valid `id` alias is accepted when `_id` is absent; an invalid authoritative `_id` is never replaced with another identity.
- Rows show **Needs attention** and the affected fields. Untitled records show their original ID. The editor shows the stored value/type alongside the field. Invalid price/stock displays as **Unavailable**, with a blank repair input; it is never coerced from text, clamped, or replaced with zero.
- Each save includes only explicitly changed fields. An unrelated edit preserves incomplete fields and stored images. Entering a legitimate zero explicitly sends zero. New records and changed values still pass strict frontend and existing backend validation; there are no automatic repairs or database migrations.
- Unsafe image references are not previewed. Replacing a damaged gallery requires explicit confirmation, including when removing all unsupported entries. Compatible existing image objects retain their metadata.
- Non-product records, unusable IDs and duplicate wire identities are reported with their API result positions instead of hiding other products. No unsafe edit links are created. Server totals and pagination remain intact, including a page with no editable rows; use the next page or inspect the reported records separately.
- Stock summaries remain API-reported, rather than being recalculated from one page. Invalid total-unit values show unavailable and a warning. Detail/update responses for a different product ID are rejected.

No backend application code, model schema or existing records changed for this compatibility fix. The API regressions use twelve raw legacy fixtures in a freshly generated test database, compare stored values before/after reads and partial edits, and verify that invalid writes are still rejected. Frontend tests cover mixed records, diagnostics, repair forms, gallery confirmation, and navigation past unusable pages.

Compatibility-fix validation passed: backend syntax, TypeScript, zero-warning ESLint, production build, **21 isolated API tests**, **48 admin normalization executions**, **31 admin browser executions**, and **139 existing storefront/normalization executions**. Two mobile-only scenarios intentionally skip the desktop project. Browser requests are intercepted; database mutation tests use only their own generated test database. Pull this feature branch and restart/rebuild the frontend to test the fix; no database migration or backend application update is required.

## Images and persistence

Choose JPEG, PNG or WebP files, inspect local previews, and explicitly upload before saving a product. Limits are eight files per request, 5 MiB per file, 40 megapixels and 12,000 pixels per side. The API checks declared type and signature, fully decodes and re-encodes static images to metadata-free WebP, scales to at most 2048 pixels, and chooses random filenames. SVG, animations, corrupt images and mismatched types are rejected. At most two upload requests per API process are processed concurrently.

New paths such as `/uploads/<random-id>.webp` are served by Express and proxied through Next.js at `/uploads/*`. Existing `/redmi.jpg` and HTTPS references still work. Choose a primary image (first array entry), reorder, or remove references; only URLs/paths and compatible existing image entries are stored in MongoDB. Removing a reference **does not delete a shared file**. An upload abandoned before saving can leave an unreferenced file; authenticated cleanup/retention tooling is a future operational task.

| Backend setting | Purpose |
| --- | --- |
| `MONGODB_URL` | Required private MongoDB URI. Use the isolated database above for testing. |
| `JWT_SECRET` | Required private random secret, at least 32 bytes; do not reuse a published example. |
| `PORT` | Defaults to 4000; use 5002 for this sandbox. |
| `UPLOAD_DIR` | Development default `var/uploads` (ignored by Git). Use an absolute path for production. |
| `UPLOAD_STORAGE=filesystem` | Explicit production opt-in, only with an absolute persistent `UPLOAD_DIR`. Otherwise production upload writes return 503. |
| `UPLOAD_PUBLIC_BASE_URL` | Optional HTTPS storage URL prefix, without credentials/query/hash. It must map to the same stored objects, e.g. `https://assets.example.com/uploads`. |
| `TRUST_PROXY` | Optional exact trusted proxy addresses/CIDRs or hop count. Default false; broad `true` is rejected. Match actual topology for rate limits/cookies. |
| `NODE_ENV=production` | Secure refresh cookies, safe production behavior and explicit upload persistence requirement. Serve over HTTPS. |

An ephemeral container directory is not durable storage. For deployment, provision and back up a persistent mounted volume, set `UPLOAD_STORAGE=filesystem` and absolute `UPLOAD_DIR`, and ensure all API instances read the same storage. Serve that volume through this API or a correctly configured HTTPS asset origin. A future S3-compatible adapter can implement the existing `writeBatch(buffers) -> [{url}]` storage boundary using private server credentials, immutable object names and complete-batch failure cleanup. This branch implements filesystem storage; it does not claim an installed object-storage service. Set `IMAGE_HOSTS` in Next.js to trusted image/CDN hosts for optimization. Other permitted HTTPS references use the existing browser-image fallback.

## API and authorization

All administrative product reads/writes and uploads require an access bearer token. The API reloads the user from MongoDB for every request and checks `role === 'admin'` and the blocked status. A client-stored role only controls navigation hints. Missing/invalid/expired/deleted sessions receive 401; regular or blocked accounts receive 403. The dashboard checks `/api/user/me` and handles revocation on subsequent requests. Merely typing `/admin` or forging a token role cannot authorize API access.

| Route | Behavior |
| --- | --- |
| `GET /api/user/me` | Authenticated safe current-user projection. |
| `GET /api/admin/products` | Admin list with `q`, `category`, `stock`, `sort`, `page`, `limit` (maximum 100), real pagination/categories/global stock summary. |
| `GET /api/admin/products/:id` | Admin editable product. |
| `POST /api/admin/products` | Validate and create product. |
| `PATCH` or `PUT /api/admin/products/:id` | Allowlisted partial update with validators; conflicting slug returns 409. |
| `DELETE /api/admin/products/:id` | Delete confirmed product. |
| `POST /api/admin/uploads` | Authenticated multipart field `images`; returns `{images:[{url}]}`. |

Existing `/api/product` public response envelopes, ID normalization and legacy product mutation URLs remain supported. Legacy mutations are protected with the same database-backed admin checks. Registration cannot grant privileges; user listings/deletion are restricted and user responses omit password hashes, refresh tokens and reset tokens. See [BACKEND_SECURITY.md](BACKEND_SECURITY.md) for security changes and remaining operational work.

## Automated checks

```bash
npm run check
TEST_MONGODB_URL=mongodb://127.0.0.1:27017/uwa_admin_test_integration NODE_ENV=test npm test
npm run typecheck --prefix frontend
npm run lint --prefix frontend
API_ORIGIN=http://127.0.0.1:5002 npm run build --prefix frontend
```

The API suite refuses database names outside `uwa_admin_test_*`, creates a fresh random-suffixed database for every run, and drops only that generated database. It imports the application without loading `.env` or starting the ordinary server. It uses generated test credentials, its own upload directory and disposable records; it never uses `MONGODB_URL` from the working application. MongoDB must be running for these tests.

With the built frontend running on 3002:

```bash
cd frontend
npx playwright install --with-deps chromium
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3002 npm run test:e2e
```

Browser tests intercept all API calls with synthetic responses and cover the admin interface plus existing storefront regressions on desktop/mobile. They do not write to MongoDB. The separate API suite covers real isolated persistence, authorization, refresh/logout, validation, slug conflicts, image bytes/retrieval and public storefront responses. Run `npm audit --omit=dev` in both root and frontend for current advisories; a clean audit is not a production security assessment.

There are no order, payment, persisted-cart, email/password-reset or administrator-provisioning workflows. There is no production deployment or database migration in this branch.

## Review screenshots and verified results

These screenshots use clearly named **Test Preview** records in a disposable test database, not the store's ten products. They were captured from the real Next.js frontend and Express API; the test database/accounts/uploads were removed afterward.

- [Desktop overview](screenshots/overview-desktop.png)
- [Desktop products](screenshots/products-desktop.png)
- [Product editor and uploaded image](screenshots/editor-desktop.png)
- [Mobile inventory](screenshots/inventory-mobile.png)

Initial dashboard validation (before the legacy compatibility fix above): backend syntax, TypeScript, zero-warning ESLint and the production build passed. The isolated API suite passed all 18 tests. Frontend checks passed 139 storefront/normalization executions and 23 admin executions; the two mobile-only scenarios intentionally skip their desktop project. An existing storefront test now waits for detail navigation before checking its metadata, avoiding a catalog/detail locator race. Repeated browser testing also caught and fixed an initial search timer that could reset a quick page change.

A separate real browser/API run verified login and database role lookup, real image upload and decoding through Next.js, product creation, storefront/bag visibility, product editing, mobile stock updates reflected in the storefront, confirmed deletion, regular-user denial and authorization revocation after a database role change. No runtime JavaScript errors or page overflow were observed. A public hosted preview is not deployed; use the isolated Ubuntu workflow above to review interactively.
