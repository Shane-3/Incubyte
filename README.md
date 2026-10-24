# Forecourt: Car Dealership Inventory System

A full-stack inventory system for a car dealership, built test-first as a TDD kata. People sign in, browse and search the lot, and buy vehicles; admins add, edit, restock and remove stock. On top of the kata's requirements it tells people things before they have to look: admins get low-stock and sold-out alerts and a stock-out forecast, and customers can ask to be told when a sold-out car is back.

![Admin dashboard at 1280 px](docs/screenshots/02-admin-1280.png)

## Contents

- [What it does](#what-it-does)
- [Screenshots](#screenshots)
- [Run it locally](#run-it-locally)
- [Tests and coverage](#tests-and-coverage)
- [API](#api)
- [How it is built](#how-it-is-built)
- [Security](#security)
- [Known limitations](#known-limitations)
- [My AI Usage](#my-ai-usage)

## What it does

| For | Feature |
|---|---|
| Everyone | Register, sign in (session in an httpOnly cookie), browse a sortable, paginated table, filter by make, model, category, price range and stock status (filters live in the URL) |
| Everyone | Buy a vehicle in a chosen colour from a popover with quantity and total; **Purchase** is disabled when stock is 0 |
| Everyone | **Colour variants**: every model (one auto-generated SKU, e.g. `TOY-CAMRY`) has paint colours with their own stock; open a vehicle to see it drawn in each colour |
| Everyone | Add and edit vehicles from a side drawer, with several colours (each with its own units) in one go; adding a make + model that already exists adds the colours (or more units of them) to that model |
| Everyone | **Notify me** on a sold-out vehicle; one in-app notice when it is back in stock |
| Admins | Restock a colour (pre-filled with the forecast's suggestion; sold-out rows offer Restock directly) and delete (with a confirmation that names the vehicle) |
| Admins | **Low-stock alerts** when a sale leaves 3 or fewer, and **sold-out alerts** at 0, de-duplicated and resolved automatically on restock |
| Admins | **Stock-out forecast**: average daily sales over 30 days, days of stock left, an *At risk* flag at 7 days or fewer, and a suggested restock quantity |

Every stock change runs through one transaction: a purchase, a restock, an edit that changes quantity, or adding a colour. That transaction locks the model row, moves the colour's stock and the model total together, records the sale, and raises or resolves alerts, so none of these can ever disagree. Concurrent purchases of the last unit produce exactly one sale.

Car pictures are built-in side-view illustrations for each body style (sedan, SUV, hatchback, pickup, coupe, convertible, van and electric), painted in each colour's hex. They are self-hosted SVG, so nothing is uploaded and the strict CSP still holds.

## Screenshots

| | |
|---|---|
| ![Sign in](docs/screenshots/01-sign-in.png) | ![Notifications](docs/screenshots/03-notifications.png) |
| Sign in | Admin notifications |
| ![At risk view](docs/screenshots/04-at-risk-view.png) | ![Restock drawer](docs/screenshots/05-restock-drawer.png) |
| At-risk view with days left | Restock pre-filled from the forecast |
| ![Dark theme](docs/screenshots/06-dark.png) | ![Out of stock, regular user](docs/screenshots/07-user-out-of-stock.png) |
| Dark theme | Regular user: sold-out view with Notify me |
| ![Purchase](docs/screenshots/08-purchase-popover.png) | ![Vehicle detail](docs/screenshots/09-vehicle-detail.png) |
| Purchase in a chosen colour | Vehicle detail: the car repainted per colour |
| ![Mobile](docs/screenshots/02-admin-360.png) | |
| 360 px (stacked rows, Sort by select) | |

## Run it locally

**Prerequisites:** Node.js 20+ and PostgreSQL 16+ (a local install, or `docker compose up -d` from the repo root, which starts dev Postgres on port 5434 and test Postgres on 5433).

### Backend (API on http://localhost:4000)

```bash
cd backend
cp .env.example .env        # then set DATABASE_URL, TEST_DATABASE_URL and a random JWT_SECRET
npm install
npm run db:create           # creates both databases if they don't exist
npm run migrate             # dev database (tests migrate the test database themselves)
npm run seed:admin          # admin from ADMIN_EMAIL / ADMIN_PASSWORD in .env
npm run seed:demo           # optional: 32 realistic vehicles in factory colours and 30 days of sales
                            # (npm run seed:demo -- --replace swaps an existing lot; accounts are kept)
npm run dev
```

Generate a secret with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. In production the server refuses to start with a secret shorter than 32 bytes or the placeholder from `.env.example`.

If you use `docker compose`, point the URLs at it: `postgres://postgres:postgres@localhost:5434/dealership` and `postgres://postgres:postgres@localhost:5433/dealership_test`.

### Frontend (http://localhost:5173)

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server proxies `/api` to the backend, so the browser sees one origin, as it would in production. Sign in with the admin from your `.env`, or create a regular account on the sign-up page.

## Tests and coverage

One command per package; the backend's integration tests need the test database from `TEST_DATABASE_URL`.

```bash
cd backend && npm test               # or npm run test:coverage
cd frontend && npm test              # or npm run test:coverage
```

Results on 2026-10-25:

| Package | Test files | Tests | Statements | Branches | Functions | Lines |
|---|---|---|---|---|---|---|
| Backend | 32 | 459 passed | 98.0% | 90.2% | 99.6% | 99.3% |
| Frontend | 10 | 112 passed | 90.9% | 86.8% | 88.8% | 93.1% |

What the backend suite covers:

- **Unit** (services, handlers, validators, middleware, config) with in-memory fakes injected through constructors.
- **Integration** against a real Postgres test database through Supertest, including:
  - 10 concurrent purchases of the last unit give exactly one 200 and nine 409s;
  - concurrent purchases crossing the low-stock threshold leave exactly one open alert per admin;
  - a failing alert handler rolls back both the stock change and the sale.
- **Security**: a 45-case authorization matrix (every endpoint × anonymous, user and admin), SQL-injection and LIKE-wildcard payloads, XSS payloads rejected at the API, JWT tampering (`alg: none`, foreign secret, edited role, expiry), cookie flags, CSRF origin and content-type checks, rate limits, IDOR on notifications, log redaction and boot-time secret checks.

The frontend suite uses React Testing Library with a fake API: forms and their validation, the disabled Purchase button, role-based controls, markup in names rendering as text, filters in the URL, drawers and dialogs, the notification bell, polling that pauses while the tab is hidden, and axe-core checks on every screen and dialog.

Both packages also run ESLint (with `eslint-plugin-security`, and `react/no-danger` on the frontend) with zero warnings, a Prettier check, a typecheck and `npm audit` in [CI](.github/workflows/ci.yml), alongside gitleaks, Semgrep and CodeQL jobs.

## API

All endpoints are JSON under `/api`. Errors share one shape: `{ "error": { "code", "message", "details"? } }`.

| Method | Path | Who | Notes |
|---|---|---|---|
| POST | `/auth/register` | anyone | always creates role `user` |
| POST | `/auth/login` | anyone | sets the session cookie |
| POST | `/auth/logout` | signed in | clears it |
| GET | `/auth/me` | signed in | restores the session in the SPA |
| GET | `/vehicles`, `/vehicles/search` | signed in | `make`, `model`, `colour`, `category`, `minPrice`, `maxPrice`, `stock`, `sort`, `order`, `limit`, `offset`; each vehicle has `sku` and `colours` |
| GET | `/vehicles/stats` | signed in | totals for the KPI strip |
| POST | `/vehicles` | signed in | optional `colour { name, hex }`, or `colours [{ name, hex, quantity }]` (up to 12, units totalling `quantity`); an existing make + model merges all of them in one change (200, `merged: true`), 409 `MODEL_EXISTS` if price or category differ |
| PUT | `/vehicles/:id` | signed in | quantity changes go through the stock pipeline |
| DELETE | `/vehicles/:id` | admin | |
| POST | `/vehicles/:id/purchase` | signed in | optional `{ quantity, colourId }` (quantity 1 to 10; without a colour, the best-stocked one); 409 when short |
| POST | `/vehicles/:id/restock` | admin | `{ quantity, colourId }` (the colour may be omitted for single-colour models) |
| GET | `/vehicles/forecast` | admin | |
| POST / DELETE | `/vehicles/:id/watch` | signed in | only on sold-out vehicles; 50 per user |
| GET | `/notifications` | signed in | own only; `unread`, `limit` |
| POST | `/notifications/:id/read`, `/notifications/read-all` | signed in | own only |

## How it is built

| Layer | Choices |
|---|---|
| Backend | Node.js, TypeScript, Express 5, PostgreSQL with `pg` and plain SQL migrations, Zod, bcrypt, jsonwebtoken, helmet, express-rate-limit |
| Frontend | React 18, Vite 7, TypeScript, Tailwind CSS v4 on design tokens, React Router 7, TanStack Query, Lucide icons, self-hosted IBM Plex Sans |
| Tests | Vitest, Supertest, React Testing Library, axe-core |

The backend has four layers: routes, controllers, services and repositories. Services depend on small interfaces (`IUserRepository`, `IStockRepository`, `ITokenService` and so on) injected in one composition root, `createApp`. That is what lets unit tests use fakes and integration tests use Postgres without touching the code under test.

New alert rules plug into the stock pipeline as `IStockChangeHandler`s; the purchase flow itself never changes. The full design is in [requirements.md](requirements.md), [design.md](design.md), [architecture.md](architecture.md) and [security.md](security.md).

The UI follows the dashboard brief in [design.md section 6](design.md):
- **Tokens only.** One set of design tokens as CSS variables (light, dark, and the system preference), with Tailwind's default palette removed so nothing off-token can creep in.
- **Calm layout.** Hairline borders instead of shadows, one accent colour, tabular figures for prices and quantities.
- **Readable status.** Stock status is a coloured dot plus a text label, so it never relies on colour alone.
- **Contrast.** Every text and background token pair was checked against WCAG AA by hand (axe cannot measure contrast in jsdom). In the dark theme, buttons on the accent colour use dark text, because white on that teal fails AA.

## Security

Security is a release gate here ([security.md](security.md)). In short:

- **Injection:** every SQL value is a bound parameter. Sort columns come from a fixed map, LIKE input is escaped, and ids are validated as UUIDs. ESLint bans string concatenation inside `query()`.
- **XSS:** strict allow-list validation of make and model (no `<`, `>`, quotes or control characters). React renders everything as text and `dangerouslySetInnerHTML` is banned by lint. Notifications store no free text. A strict CSP is set on the API and in the frontend host headers (`_headers` and `vercel.json`).
- **Sessions:**
  - The JWT lives in an `HttpOnly; SameSite=Strict; Path=/api` cookie, `Secure` in production. JavaScript never sees it.
  - HS256 is pinned; `alg: none` and tampered tokens are rejected.
  - Logins get one generic 401 with a timing-equalised check for unknown emails.
  - Registration can never set a role. Admins exist only through `npm run seed:admin`.
- **CSRF:** SameSite=Strict, an Origin/Referer allow-list on every POST, PUT, PATCH and DELETE, and JSON-only bodies (anything else gets 415).
- **Access control:** deny by default (routers authenticate first). Admin routes re-check the role in the database, so a demoted admin loses access immediately. Notifications are scoped to the recipient in SQL; another user's id returns 404.
- **Abuse:**
  - rate limits: 5 logins a minute per IP and per email, 10 registrations an hour, 30 watch or read-all requests a minute, 100 API requests a minute
  - a 10 KB body cap, a 5-second statement timeout, and capped page sizes
- **Operations:** structured JSON logs with a request id. Passwords, emails, cookies and tokens are never logged, and a 500 returns only the request id.

**Residual risks**, stated openly:
- Stateless JWTs can't be revoked before their 1-hour expiry.
- `409 EMAIL_TAKEN` reveals that an account exists; rate limiting bounds this.
- There is no MFA, email verification or password reset.
- Rate limits are per process; several instances would need a shared store.
- Locally the app connects as the `postgres` superuser. In production, run migrations as an owner role and the app as a role with only `SELECT/INSERT/UPDATE/DELETE` on its tables. That role isn't scripted yet.

## Known limitations

- **At risk view:** filtered in the browser over the first 100 vehicles (the API caps a page at 100). That's fine for a single lot; a bigger inventory would need a server-side forecast filter.
- **Days left column:** shown but not sortable, because sorting needs the forecast on the server.
- **Narrow screens:** below 768 px the table shows vehicle, price, stock and actions as stacked rows, sorted from a select. Category appears from 1024 px and Days left from 1024 px.
- **Notifications:** delivered in-app only, by polling every 30 seconds (no email, push or SSE).
- **Production deploy:** not done. Fill in the API host in `frontend/vercel.json` and set `TRUST_PROXY` behind the host's proxy.

## My AI Usage

> **Note to self (delete before submitting):** this section must be in your own words. The facts below are accurate; rewrite the reflection from your own experience.

**Tools:** Claude Code (Claude Opus 5.5), in VS Code. Raw session logs are in [PROMPTS.md](PROMPTS.md).

**How I used it:**

- **Specs first.** I wrote the four specification documents (requirements, design, architecture, security) and asked Claude to read them before any code was written.
- **Building in TDD cycles.** Claude worked through each feature as a red-green cycle: it wrote the failing tests, committed them, implemented until they passed, and committed again. Every AI-assisted commit carries a `Co-authored-by` trailer.
- **Fixing its own mistakes.** It caught and corrected some of its own errors along the way, and the history records them:
  - a broken red commit, redone before anything was pushed
  - a SQL placeholder mangled by a scripted edit, caught by a failing integration test
  - tests that passed before their feature existed, tightened so they meant something
- **Decisions I made.** I chose the stack, set up the local database, and decided on the security and UI non-negotiables.

**Reflection:** *(write in your own words, e.g. where AI sped you up, where you had to steer or correct it, what you checked yourself, and what you would do differently)*
