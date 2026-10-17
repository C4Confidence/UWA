# Redesign review

## Scope and preservation

- Repository: `C4Confidence/UWA`.
- Implementation branch: `feat/uwa-premium-redesign`, based on `uwa-codex-clean` at `81ac1e995610a2a18e11debea2967dd96294cf74`.
- The original backend’s 13 source files were restored from preserved `work` commit `e4d347ad02773cda367683d38b9d4874c2193943`. Only inherited trailing whitespace in four controller/route files was cleaned before committing. Models, route paths, and authentication behavior are unchanged.
- No product records were seeded or edited. A disposable account used for real authentication validation was removed; product/user counts returned to their starting values (0/0 in this local database).
- The implementation is isolated on a feature branch for review and testing. No merge into `main` or production deployment is included.

## Experience implemented

The shared yellow, charcoal, and warm-white design system includes local Geist typography, responsive navigation/search, mobile menu, real bag count, editorial homepage, catalog filters/search/sorting, genuine product details/image gallery, account forms, local cart, and checkout review. It includes keyboard focus, skip navigation, accessible input names, reduced motion, loading skeletons, recoverable errors, unavailable-image fallbacks, and intentional empty states.

Local images and allowlisted HTTPS image hosts use Next.js optimization; other HTTPS product images load directly in the browser. Original public product image paths are preserved. Local fonts avoid external font requests. Metadata includes page titles/descriptions, configurable canonical origin, an Open Graph image, robots policy, and sitemap.

The empty real catalog is shown honestly. Editorial images are labeled as inspiration. Checkout cannot place orders or charge payments. Account recovery, contact submission, OAuth, shipping/tax calculations, profile editing, and synchronized carts are not presented as working features.

## Verification

| Check | Outcome |
| --- | --- |
| Production Next.js build, static generation, lint, TypeScript | Passed with patched Next.js 15.5.28 |
| Backend source syntax checks | Passed |
| Frontend production dependency audit | Zero findings when checked |
| Full desktop/mobile Playwright suite | 41 passed; 1 intentional desktop skip for mobile-only menu |
| Affected-case rerun after accessible name fixes | 18 passed; zero failures |
| Real browser → Next proxy → Express/MongoDB | Registration, sign-in, session reload, sign-out passed; test account removed |
| Database preservation | Starting and ending product/user counts match |
| Accessibility review | axe WCAG 2 A/AA and 2.1 A/AA rules checked on eight pages in desktop/mobile; bag-name and mobile-sort issues fixed. Image-background contrast also visually reviewed. Automated checks are not a complete accessibility certification. |

Browser tests use intercepted synthetic responses only; they never seed MongoDB. Responsive checks include mobile, tablet, desktop, populated/empty bags, error states, and horizontal overflow. Tests also cover malformed API/storage data, stock limits, unavailable products, updated checkout prices, and curated authentication failures.

## Before any public launch

Review the separate [backend security report](BACKEND_SECURITY.md), especially access control and sensitive responses. Confirm store currency (the existing schema has no currency field), actual database connection, public site origin, catalog image hosts, support channel, and delivery/returns policy. Orders and payments require a separate backend implementation. A passing frontend preview does not resolve those backend limitations.

Use [the Ubuntu setup instructions](../README.md) to run the site locally. The cloud workspace has a local frontend preview on port 3000 and API on port 4000; no public production deployment was created.
