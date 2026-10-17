# UWA — Everyday, upgraded.

A responsive Next.js storefront using UWA’s existing Express/MongoDB API. The redesign starts from `uwa-codex-clean` (`81ac1e995610a2a18e11debea2967dd96294cf74`) on `feat/uwa-premium-redesign`.

The clean base contained only `.gitignore` and `frontend/next-env.d.ts`. The original backend source was recovered with only trailing whitespace cleanup from the preserved `work` commit (`e4d347ad02773cda367683d38b9d4874c2193943`); local Geist fonts and product/editorial assets were reused. Historical `.env` files and committed dependencies were not restored.

## Test only the new frontend against your existing API

Keep your locally working `uwa-redesign` checkout and backend untouched. Clone this feature branch into a separate folder, and run only its frontend against your existing Express API on port 5001:

```bash
git clone --single-branch --branch feat/uwa-premium-redesign \
  https://github.com/C4Confidence/UWA.git UWA-redesign-test
cd UWA-redesign-test
npm ci --prefix frontend
API_ORIGIN=http://127.0.0.1:5001 npm run dev --prefix frontend -- --port 3001
```

Open port **3001** in your laptop browser. Your existing API keeps its current database connection and credentials; the new frontend does not need a root `.env` or another backend process for this test. It calls your real API, so browsing reads your existing catalog, and account actions use that backend. Do not copy this branch's backend over your working backend before comparing and reviewing any differences.

The complete application setup below is for running this branch's own backend separately, if and when desired.

## Run locally on Ubuntu

Use Node.js **22 LTS or 24**, npm, and MongoDB. If bcrypt must compile locally, install build tools with `sudo apt-get install build-essential python3`. Docker is an optional way to run MongoDB; an existing MongoDB instance also works.

From the repository root:

```bash
npm ci
npm ci --prefix frontend
```

Create a private `.env` from `.env.example` if one does not already exist. Set `MONGODB_URL`, `PORT=4000`, and a strong `JWT_SECRET`. This command creates a local-development file only when it is missing, without displaying the secret:

```bash
node <<'NODE'
const fs = require('node:fs');
const crypto = require('node:crypto');
if (!fs.existsSync('.env')) {
  fs.writeFileSync('.env', 'MONGODB_URL=mongodb://127.0.0.1:27017/uwa_db\nPORT=4000\nJWT_SECRET=' + crypto.randomBytes(48).toString('hex') + '\n', { mode: 0o600 });
}
NODE
```

Point `MONGODB_URL` at the intended existing database to use its product records and accounts. Setup does not seed, migrate, drop, or overwrite collections. Keep `.env` private and untracked.

If you need a local MongoDB instead, and Docker is installed and running:

```bash
docker run -d --name uwa-mongo \
  -p 127.0.0.1:27017:27017 \
  -v uwa-mongo-data:/data/db \
  mongo@sha256:0032d2ca20db5fa34926f196c8a43b74e34ed239a7f2453ff1505b6f12ba8ea6
```

On subsequent runs use `docker start uwa-mongo`. If MongoDB is already listening on port 27017, reuse it instead of launching another container. Use `sudo docker` if your local Docker installation requires it. In the prepared cloud workspace, the existing container is named `uwa-onboarding-mongo`.

Start the API in one terminal:

```bash
npm run dev
```

Start the storefront in another:

```bash
npm run dev --prefix frontend
```

The storefront listens on port **3000** and the API on **4000**. Open port 3000 in your local browser. Next.js proxies `/api/*` to Express, preserving its existing endpoint paths and allowing same-origin authentication cookies. MongoDB must be reachable; the legacy API’s startup message alone does not prove connectivity.

Frontend settings are documented in `frontend/.env.example`. Create an ignored `frontend/.env.local` only if overriding defaults, then restart Next.js:

| Setting | Default / purpose |
| --- | --- |
| `API_ORIGIN` | `http://127.0.0.1:4000`; server-side API proxy target |
| `NEXT_PUBLIC_STORE_CURRENCY` | `USD`; display convention only, **not currency conversion**. The existing Product model has no currency field; confirm the correct currency before public launch. |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000`; replace with the actual public origin before launch for canonical metadata and sitemap |
| `IMAGE_HOSTS` | `res.cloudinary.com,images.unsplash.com`; trusted HTTPS hosts for image optimization. Add the actual catalog image host if needed. Other HTTPS images load directly in the browser. |

No Redis, email provider, payment key, or new external account is required by the checked-in workflow.

## Review the design

- `/`: yellow-and-black hero, genuine featured products or an intentional empty state, editorial collections, brand story.
- `/products`: real catalog, search, category and stock filters, price range, sorting, loading/error/empty states.
- `/products/<MongoDB product ID>`: real product details, image gallery, actual price/stock, quantity selection, add to bag.
- `/signin`, `/signup`, `/account`: existing account APIs, safe response handling, session-only login. Registration collects the existing supported mobile field to avoid the legacy non-sparse unique mobile-index issue.
- `/cart`: browser-persisted bag, quantity controls, removal, subtotal.
- `/checkout`: rechecks current product prices/stock and explains that online checkout is unavailable.
- `/about`, `/contact`, `/forgot`: brand story and honest shopping/account information; no unconnected forms or simulated recovery.

The current local database has no product records. Its empty state is deliberate. Editorial photographs are inspiration, not purchasable product records or an availability guarantee. Existing products appear automatically when using a database that contains them.

The bag belongs to this browser/device and does not sync through an account. Access tokens are held in memory and session storage for this existing API; sensitive registration documents are discarded. The frontend does not rely on the broken refresh endpoint. Password reset, contact submission, orders, payment, shipping, taxes, reservation, OAuth, and account editing are not implemented by the existing backend, so the site does not simulate them.

## Checks and production-mode preview

```bash
npm run check
npm run lint --prefix frontend
npm run typecheck --prefix frontend
npm run build --prefix frontend
```

Stop the frontend development server before building; development and production use the same `.next` directory. With the API still running, preview the built site locally:

```bash
npm run start --prefix frontend
```

The frontend uses patched Next.js 15.5.28 and a pinned PostCSS override. A production build includes linting and type checking. The frontend production dependency audit passed without findings during implementation; run `cd frontend && npm audit --omit=dev` to check current advisories.

Browser tests require a separately running storefront on port 3000. From `frontend`:

```bash
npx playwright install chromium
npm run test:e2e
```

On Ubuntu, `npx playwright install --with-deps chromium` can install browser system dependencies if needed. The configuration automatically uses `/usr/bin/chromium` when installed, and supports `PLAYWRIGHT_CHROMIUM_EXECUTABLE` and `PLAYWRIGHT_BASE_URL` overrides.

Tests intercept API calls with clearly synthetic test-only fixtures. They **do not insert fake products or accounts into MongoDB**. Coverage includes catalog loading/retry/search/filter/sort, product detail, cart persistence/stock limits, checkout updates/unavailable states, account form validation/session sanitization, keyboard navigation, and responsive overflow.

## Backend boundaries

The API source, models, and endpoints are unchanged. Existing security and dependency problems are documented separately in [docs/BACKEND_SECURITY.md](docs/BACKEND_SECURITY.md). This preview must not be treated as production security approval. The feature branch is for review and testing; no merge into `main` or production deployment is part of this work.
