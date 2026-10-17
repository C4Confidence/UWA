# Existing backend issues to address separately

The frontend redesign restores the existing Express/MongoDB source without changing its API contracts, authentication implementation, database models, or stored records. The backend was restored from the previous `work` commit, `e4d347ad02773cda367683d38b9d4874c2193943`. Before committing, inherited trailing whitespace was removed from four controller/route files to pass Git's whitespace check; backend behavior was not changed. This is a source review, not a penetration test. These findings are outside the frontend redesign and require a separate backend change before public production use.

## Access control and sensitive data

| Priority | Source | Existing behavior and required follow-up |
| --- | --- | --- |
| Critical | `routes/authRoute.js:24`; `controller/userCtrl.js:149` | `DELETE /api/user/:id` has no authentication or authorization middleware. Require an authenticated, authorized actor and validate the target account before deletion. |
| Critical | `controller/userCtrl.js:17`; `models/userModel.js:27` | Registration passes the entire request body to `User.create`, including the schema's `role` and other sensitive fields. Use a server-controlled allowlist and assign privileges only through an authorized administration flow. |
| High | `routes/authRoute.js:20`; `controller/userCtrl.js:125` | `GET /api/user/all-Users` is public and returns full user documents, including password hashes and stored refresh tokens. Restrict access and return an explicit safe projection. |
| High | `controller/userCtrl.js:18`, `controller/userCtrl.js:112`, `controller/userCtrl.js:139`, `controller/userCtrl.js:176`, `controller/userCtrl.js:210`; `models/userModel.js:23`, `models/userModel.js:41` | Several registration/account responses serialize full user documents. Passwords and tokens are not excluded by the schema. Ensure sensitive fields never leave the API, including after password changes. |
| High | `controller/userCtrl.js:29`; `middlewares/authMiddleware.js:12` | Login and token verification do not reject `isBlocked` accounts. Enforce account status consistently on login and protected requests. |
| High | `controller/userCtrl.js:57`; `middlewares/authMiddleware.js:24` | Refresh handling logs cookie contents and administrator checks log the user document. Remove sensitive logs and review log access and retention. |

## Session and authentication correctness

| Priority | Source | Existing behavior and required follow-up |
| --- | --- | --- |
| High | `controller/userCtrl.js:36` | The refresh cookie has `httpOnly`, but does not explicitly set `secure`, `sameSite`, or a narrowly considered path. Define the production cookie and CSRF policy together with the actual deployment topology. |
| High | `controller/userCtrl.js:66` | Refresh issues a token using the `User` model's `_id` rather than the authenticated user's `_id`. The resulting token cannot identify the account correctly. The redesigned frontend does not rely on this endpoint. |
| Medium | `controller/userCtrl.js:79`, `controller/userCtrl.js:86` | Logout clears `RefreshToken` with different capitalization from the `refreshToken` cookie created at login. Correct the cookie name/options and verify expiry and revocation end to end. Existing logout does clear the stored database refresh token when the account is found. |
| Medium | `middlewares/authMiddleware.js:7` | A malformed authorization header beginning with `Bearer` but lacking a token never responds or calls `next`. A verified token for a deleted user is also not explicitly rejected before `next`. Validate the full header and account presence and return appropriate HTTP errors. |
| Medium | `index.js:14`; `controller/userCtrl.js:14`, `controller/userCtrl.js:28` | Authentication routes have no rate limiting, and input types/lengths are not explicitly validated before queries. Add request schemas, abuse protection, and safe authentication error semantics. |
| Medium | `models/userModel.js:54` | The password pre-save hook calls `next()` without returning when the password is unchanged, then continues to hash it. This risks double-hashing when an existing user document is saved for other reasons. Return early and test password lifecycle paths in a backend task. |
| Medium | `models/userModel.js:65` | Password reset helpers refer to `crypto` without importing Node's `crypto` module in the model. There is no reset route in the restored API; the redesign does not claim a working password reset flow. |

## Validation, errors, and operational behavior

| Priority | Source | Existing behavior and required follow-up |
| --- | --- | --- |
| High | `middlewares/errorHandler.js:14`; `controller/productCtrl.js:114` | API errors return stack traces or internal error messages. Provide safe public messages with correct HTTP status codes and retain details only in protected server logs. |
| Medium | `controller/productCtrl.js:62`, `controller/productCtrl.js:88` | Product filters and projections are built from arbitrary query parameters, and pagination is not bounded. Use an explicit filter/sort/projection allowlist, validate numeric ranges, and cap page size. |
| Medium | `controller/productCtrl.js:95` | Pagination checks total document count instead of filtered count and returns a 404 for `page=1` in an empty database. Establish a documented pagination/count contract; the frontend handles empty results without claiming catalog records exist. |
| Medium | `controller/productCtrl.js:26`; `controller/userCtrl.js:101` | Update operations do not enable Mongoose update validators. Validate allowed fields and values before writes and enforce schema validation in the update path. |
| Medium | `config/dbConnect.js:5`; `index.js:26` | The database connection is not awaited and success is logged before MongoDB confirms connectivity. The API can begin listening while its database is unavailable. Await connection and fail or report readiness accurately. |
| Medium | `models/userModel.js:18` | The optional `mobile` field has a non-sparse unique index. Multiple accounts omitting it can conflict under the existing index. Resolve desired account requirements and index migration separately without silently changing existing data. |

## Dependency audit

`npm audit --json` against the root API lockfile on 2026-10-16 reported 10 affected dependency entries: 2 critical, 4 high, 3 moderate, and 1 low. This includes transitive dependencies; counts do not indicate the number of independently exploitable application paths. No automatic dependency rewrites were applied.

| Dependency | Audit severity | Follow-up |
| --- | --- | --- |
| `mongoose` 8.7.0 (`package.json`) | Critical | Review [search injection](https://github.com/advisories/GHSA-vg7j-7cwx-8wgw) and [update-casting prototype pollution](https://github.com/advisories/GHSA-664h-wqgq-64gw) advisories alongside the API's query/update validation. |
| `tar` via `bcrypt` / `@mapbox/node-pre-gyp` | Critical | Review installation-time [archive path traversal](https://github.com/advisories/GHSA-34x7-hfp2-rc4v) and other archive parsing advisories. Use a supported bcrypt release and revalidate password compatibility. |
| `bcrypt`, `@mapbox/node-pre-gyp`, `express`, `path-to-regexp` | High | Review dependency chains and [routing regular expression denial of service](https://github.com/advisories/GHSA-37ch-88jc-xwx2). |
| `body-parser`, `morgan`, `qs` | Moderate | Review body/query parser denial of service and logging injection advisories. |
| `on-headers` | Low | Review [response header manipulation](https://github.com/advisories/GHSA-76c9-3jph-rj3q). |

Re-run `npm audit` when the backend remediation task begins because registry advisories and recommended versions change over time. Upgrade direct and transitive dependencies with regression tests rather than treating an audit count or an automatic fix as a completed remediation.

## Boundaries of this preview

- The API provides product reads, authenticated product administration, and user authentication/account routes. It has no order, payment, shipping, tax, inventory reservation, or persisted cart endpoint.
- The storefront cart is local to the browser. Checkout does not create an order, charge a payment, or report payment success.
- Existing MongoDB collections are reused without seeding or editing their records. No fake product records are introduced to populate the design.
- `.env` files and credentials must remain untracked. Configure `MONGODB_URL`, `JWT_SECRET`, and optionally `PORT` privately for local development. Rotate historical credentials if they were previously stored in repository history.
- Dependency versions were recovered from the validated onboarding tooling to make the legacy API reproducible. Review and upgrade backend dependencies in a separate compatibility/security task; a passing syntax or smoke check is not a security assessment.

Before public launch, resolve access-control and data-exposure findings first, then validate session handling, request validation, dependency advisories, and deployment configuration with dedicated regression tests.
