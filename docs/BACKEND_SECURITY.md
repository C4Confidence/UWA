# Backend security and deployment boundaries

The administrator dashboard is based on the premium storefront commit `a5e4a92c2453da94bf255980adcd619af15dbbec`. That storefront originally retained the legacy backend; this branch intentionally changes its authorization, validation, uploads, and error handling. Existing MongoDB model fields and indexes are preserved. Setup does not create or promote a real administrator, seed products, or migrate existing records.

## Security changes implemented

| Area | Current behavior | Implementation |
| --- | --- | --- |
| Administrator authorization | Every admin catalog route, legacy product mutation, and upload requires an authenticated, unblocked database user whose current role is `admin`. JWT role claims and browser state do not grant privileges. | `middlewares/authMiddleware.js`, `routes/adminProductRoute.js`, `routes/productRoute.js`, `routes/uploadRoute.js` |
| JWT verification | Bearer headers must contain exactly one token. Verification explicitly permits HS256, validates the account ID, and rejects invalid, expired, deleted-user, and newly typed refresh tokens. Missing/invalid authentication returns 401; blocked accounts and insufficient roles return 403. | `middlewares/authMiddleware.js`, `config/jwtToken.js`, `config/refreshToken.js` |
| Safe current user | `GET /api/user/me` returns a direct object containing `_id`, `id`, names, email, database role, and blocked status. It never returns password hashes, refresh/reset tokens, cart, addresses, or wishlist. | `routes/authRoute.js`, `controller/userCtrl.js` |
| Registration and accounts | Registration allowlists identity/contact/password fields and always assigns `role: "user"` and `isBlocked: false`. Profile updates cannot change privileges. User listing, lookup, deletion, blocking, and unblocking require administrator authorization; every user response uses an explicit safe projection. | `controller/userCtrl.js`, `routes/authRoute.js` |
| Credential input | Account fields must be bounded strings before entering database queries. New passwords require at least eight characters and at most 72 UTF-8 bytes, avoiding bcrypt truncation. Existing bcrypt password hashes remain compatible with the upgraded library. The password hook no longer rehashes unchanged passwords and generates salts asynchronously. | `controller/userCtrl.js`, `models/userModel.js` |
| Refresh and logout | Refresh verifies the matched account, checks blocked status, rotates the stored refresh token, and issues an access token for that user's ID. Cookies use consistent names/paths, HttpOnly, SameSite=Lax, and Secure in production. Logout revokes the matching stored refresh token and clears current and legacy root-scoped cookies. | `controller/userCtrl.js` |
| Product writes and reads | Product mutations allow only catalog fields, validate required strings and finite non-negative prices/integer stock, preserve explicitly supplied slugs, and return 409 for duplicate slugs. Partial edits do not replace unrelated legacy metadata. Filtering, projections, sorting, and pagination use explicit allowlists and bounded values. | `controller/productCtrl.js`, `utils/productValidation.js` |
| Upload validation | Authorization precedes multipart parsing. A request accepts at most eight JPEG/PNG/WebP files, each at most 5 MiB. Content signatures must match the declared supported type; images are fully decoded, checked for dimensions/pixels/animation, stripped of metadata, resized when needed, and re-encoded to WebP. SVG and malformed/spoofed files are rejected. Concurrent upload work is bounded. | `routes/uploadRoute.js` |
| Upload publication | Verified batches use generated UUID filenames and exclusive staged writes; failed batches are rolled back. Public `/uploads` serving denies dotfiles and directory indexes, sets `nosniff` and a restrictive asset CSP, and serves immutable filenames. Next.js rewrites make those assets accessible on the storefront origin. | `services/imageStorage.js`, `app.js`, `frontend/next.config.mjs` |
| Error and startup handling | Public errors omit stacks, database internals, credentials, and filesystem paths. Validation, conflict, missing-resource, authentication, and size failures receive appropriate HTTP statuses. Cookies/user documents are not logged. The API awaits MongoDB before listening; startup failures are redacted. | `middlewares/errorHandler.js`, `app.js`, `config/dbConnect.js`, `index.js` |

## Tests and database isolation

`app.js` exports `createApp({ uploadDirectory, logging, trustProxy })` without loading `.env`, connecting to MongoDB, or opening a port. This lets integration tests use an explicitly isolated connection and temporary image directory.

`tests/admin-api.test.js` requires `TEST_MONGODB_URL` to name a database beginning with `uwa_admin_test_`; it refuses normal application/default names. Each execution substitutes a fresh random `uwa_admin_test_<random>` database, creates only synthetic accounts/products, checks the connected database before destructive operations, and removes that generated database and its temporary images afterward. It never loads the normal application `.env` or uses the store's `MONGODB_URL` as a test connection.

Example, against a dedicated local test MongoDB service:

```bash
TEST_MONGODB_URL=mongodb://127.0.0.1:27017/uwa_admin_test_requested \
  node --test tests/admin-api.test.js
```

The suite covers authentication failures and database role changes, blocked/deleted accounts, registration privilege escalation, safe responses, existing bcrypt hash compatibility, unauthorized legacy/admin mutations, product CRUD/stock synchronization, legacy metadata preservation, search/pagination, duplicate slugs, image references, real image decoding/upload/retrieval, upload limits, profile/password behavior, and refresh/logout.

`frontend/tests/admin.spec.ts` uses intercepted API responses and synthetic browser fixtures to exercise access gates, forms, image controls, errors, confirmations, keyboard focus, and mobile layouts. These fixtures are not inserted into MongoDB. Browser tests complement the real API integration suite; mocked requests alone do not establish backend authorization or database correctness. See the main README for frontend startup, TypeScript/lint/build checks, and Playwright commands.

## Remaining concrete limitations

### Sessions, account recovery, and existing data

- The existing optional `mobile` field retains its non-sparse unique index. Multiple accounts omitting mobile can still conflict. The storefront currently requires mobile during registration. Changing that index or existing values requires a separately reviewed migration.
- Access tokens retain their existing one-day lifetime. Logout clears the browser session and revokes the stored refresh token, but does not immediately revoke every already-issued access JWT. Blocking/deleting an account and changing its role take effect on the next authenticated request because the database is checked each time. Password changes revoke refresh tokens and reject access tokens from earlier seconds; JWT issuance timestamps have second precision, so a token issued during the same second can survive that cutoff. A per-session revocation mechanism is a separate improvement.
- Legacy signed JWTs without a `type` claim remain accepted to preserve existing sessions until their original expiry. Historically, access and refresh JWTs shared the same untyped format, so an untyped legacy refresh JWT can also satisfy the legacy access-token check while valid. Newly issued tokens distinguish access from refresh. A deliberate `JWT_SECRET` rotation invalidates all historical tokens and signs every account out; perform it as an owner-approved rollout operation, never silently during setup.
- Before integration, the owner should audit existing administrator roles: this branch prevents new registration privilege escalation, but cannot establish whether historical roles were legitimately granted. No existing roles or accounts are changed automatically.
- The storefront retains its access token in `sessionStorage`. This avoids persistence across independent browser sessions, but any successful same-origin script injection can read it. There is no implemented server-side access-token revocation list, MFA, invitation/provisioning UI, or account recovery/email delivery flow. Importing `crypto` fixes the existing password-reset helper dependency; it does not implement a usable password-reset service.
- Legacy `GET /api/user/logout` remains available for compatibility; a POST alias is also provided. Cross-site browser requests to refresh/logout are rejected when their Fetch Metadata header identifies them as cross-site. Keep the SameSite cookie policy and deployment origins consistent; review a dedicated CSRF/session design if cookie-authenticated write operations are added later.
- Administrator actions are authorized but do not have a dedicated audit trail, approval workflow, or edit-conflict/version check. Product IDs and untouched fields are preserved; simultaneous updates to the same field can still overwrite one another. Database backups and an operational recovery process remain necessary.

### Rate limits and proxy trust

Login/refresh allow 30 failed attempts per IP in 15 minutes; registration allows 20 requests per IP per hour. The default `express-rate-limit` store is process memory: counters reset on restart and are not shared across replicas. Configure a shared store and edge-level request/upload quotas for a multi-instance deployment. Upload concurrency limits are also per router/process and do not replace infrastructure bandwidth, memory, or disk quotas.

`TRUST_PROXY` defaults to false. Explicit trusted proxy address/CIDR rules or a verified fixed hop count may be configured; the value `true` is rejected by startup. Configure this for the actual network path so clients cannot spoof the rate-limit identity. With no proxy trust, requests forwarded by the local Next.js server may share its backend IP and therefore its limit. Numeric hop counts are safe only when every permitted route has the expected trusted proxy chain.

### HTTPS, browser policies, and image storage

- Production requires HTTPS and `NODE_ENV=production` so refresh cookies use Secure. Keep the Express service behind the intended application/proxy boundary, restrict database access, and configure trusted proxies explicitly. Never disable TLS or package-integrity checks to solve setup failures.
- The frontend has `nosniff`, frame-denial, and referrer headers. The restrictive CSP attached to uploaded assets protects those asset responses; it is not a complete storefront script CSP. A nonce-aware application CSP, including the exact approved image/CDN origins, remains a deployment integration task. Keep secrets out of `NEXT_PUBLIC_*`, repository files, logs, screenshots, and browser fixtures.
- Development uploads can use local filesystem storage. Under `NODE_ENV=production`, upload writes fail closed unless `UPLOAD_STORAGE=filesystem` and an absolute `UPLOAD_DIR` are configured. That directory must actually be a persistent mounted volume with suitable access controls, capacity monitoring, and backups; setting an absolute path alone does not create durability.
- For object storage/CDN integration, implement the `writeBatch(verifiedWebpBuffers) -> [{ url }]` adapter in `services/imageStorage.js` using deployment-provided credentials with minimum write permissions. Configure the persistent bucket/container, region/endpoint, public HTTPS delivery origin, and retention/backups outside source control. `UPLOAD_PUBLIC_BASE_URL` can advertise a configured HTTPS image delivery origin; it does not upload files to an object-storage provider by itself.
- Uploaded product images are intentionally public. Do not upload private documents. Removing references or deleting a product does not delete image files because other products may share them. Cancelled drafts can leave unreferenced uploaded assets; a separately reviewed retention/garbage-collection process is needed before large-scale use.
- Existing root-relative image paths and HTTPS URLs remain supported. External image availability and privacy are controlled by those hosts. Keep optimizer `IMAGE_HOSTS` limited to approved hosts; no arbitrary remote image is fetched by the Express upload handler.

## Dependency audit

At this review, `npm audit --json` against the API lockfile reports **0 vulnerabilities**, and `npm audit --omit=dev --json` against the frontend lockfile also reports **0**. The backend dependencies were updated and existing bcrypt 5 hashes are covered by a compatibility regression test.

The full frontend development dependency audit currently reports **5 high-severity dependency entries** in the ESLint chain (`eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` → `micromatch` → `braces`). They stem from the [braces stack-exhaustion advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). This is a development tooling chain, not five independently established production exploits. Review a supported patched resolution before accepting attacker-controlled glob patterns into tooling. Re-run both full and runtime audits when dependencies change; zero reported advisories is not proof of application security.

The dashboard exposes catalog and inventory facts only. Orders, payments, revenue, shipping, tax, inventory reservations, and a server-persisted shopping cart are not implemented and are not represented as working capabilities.
