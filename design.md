# Design: Car Dealership Inventory System

This document covers *how it should behave and feel*: API conventions, data design, auth design, UI/UX, and the test design that drives TDD. See `architecture.md` for code structure and `requirements.md` for the full requirement list.

## 1. Design Principles

1. **Test-first:** every behavior is specified by a test before it exists.
2. **Thin controllers, rich services:** HTTP concerns stay at the edge; business rules live in services.
3. **Database enforces invariants:** `quantity >= 0`, unique email, and atomic purchase are guaranteed by the DB, not just by code.
4. **Consistent contracts:** one success shape, one error shape.
5. **Secure by default:** every vehicle route is protected; admin routes add a role check.

## 2. Data Design

### 2.1 Tables

**users**
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | default `gen_random_uuid()` |
| name | VARCHAR(100) | not null |
| email | VARCHAR(255) | unique, not null, stored lowercase |
| password_hash | VARCHAR(255) | not null |
| role | VARCHAR(10) | `user` or `admin`, CHECK constraint, default `user` |
| created_at | TIMESTAMPTZ | default now() |

**vehicles**
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | default `gen_random_uuid()` |
| make | VARCHAR(100) | not null |
| model | VARCHAR(100) | not null |
| category | VARCHAR(50) | not null (e.g. SUV, Sedan, Hatchback, Truck, EV) |
| price | NUMERIC(12,2) | CHECK `price >= 0` |
| quantity | INTEGER | CHECK `quantity >= 0`, default 0 |
| created_at / updated_at | TIMESTAMPTZ | |

**Indexes:** `vehicles(make)`, `vehicles(category)`, `vehicles(price)`; unique index on `users(email)`.

### 2.2 Categories
Free text validated against a fixed allow-list in the app layer (`Sedan`, `SUV`, `Hatchback`, `Truck`, `Coupe`, `Convertible`, `Van`, `Electric`), so the UI filter dropdown and the API agree.

### 2.3 Tables for proactive features

**purchases**
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| vehicle_id | UUID FK | references vehicles, `ON DELETE CASCADE` |
| user_id | UUID FK | references users |
| quantity | INTEGER | CHECK `quantity > 0` |
| unit_price | NUMERIC(12,2) | price at the time of sale |
| created_at | TIMESTAMPTZ | default now(); index on `(vehicle_id, created_at)` |

**watches**
| Column | Type | Notes |
|---|---|---|
| user_id | UUID FK | references users, `ON DELETE CASCADE` |
| vehicle_id | UUID FK | references vehicles, `ON DELETE CASCADE` |
| created_at | TIMESTAMPTZ | PK `(user_id, vehicle_id)` |

**notifications**
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| recipient_id | UUID FK | references users, `ON DELETE CASCADE` |
| type | VARCHAR(20) | CHECK in `LOW_STOCK`, `OUT_OF_STOCK`, `BACK_IN_STOCK` |
| vehicle_id | UUID FK | references vehicles, `ON DELETE CASCADE` |
| quantity | INTEGER | stock level when the event happened |
| read_at | TIMESTAMPTZ | null until read |
| resolved_at | TIMESTAMPTZ | admin alerts only; set when the vehicle is restocked |
| created_at | TIMESTAMPTZ | default now() |

**Indexes:** `notifications(recipient_id, read_at, created_at DESC)`; partial unique index on `(recipient_id, vehicle_id, type)` `WHERE resolved_at IS NULL AND type IN ('LOW_STOCK','OUT_OF_STOCK')`, which de-duplicates open alerts.

No free-text message is stored. The client builds the wording from `type`, the vehicle's make and model, and `quantity`.

## 3. API Design

### 3.1 Conventions
- JSON everywhere; `Content-Type: application/json`.
- Auth: JWT in an httpOnly session cookie (see `security.md`). State-changing requests must be `application/json` from an allow-listed origin.
- Money is returned as a number (e.g. `24999.99`).
- IDs are UUID strings.

### 3.2 Error format (all errors)
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [{ "field": "price", "message": "must be >= 0" }]
  }
}
```

| HTTP | code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | malformed or invalid payload / query |
| 401 | `UNAUTHENTICATED` | missing/invalid/expired token, bad credentials |
| 403 | `FORBIDDEN` | role insufficient |
| 404 | `NOT_FOUND` | vehicle id does not exist |
| 409 | `EMAIL_TAKEN` / `OUT_OF_STOCK` | uniqueness or stock conflict |
| 500 | `INTERNAL_ERROR` | unexpected (no internals leaked) |

### 3.3 Key payloads

**POST /api/auth/register**
```json
// request
{ "name": "Shane", "email": "shane@example.com", "password": "S3curePass!" }
// 201
{ "user": { "id": "…", "name": "Shane", "email": "shane@example.com", "role": "user" } }
```

**POST /api/auth/login**
```json
// request
{ "email": "shane@example.com", "password": "S3curePass!" }
// 200 + Set-Cookie: token=<jwt>; HttpOnly; Secure; SameSite=Strict
{ "user": { "id": "…", "name": "Shane", "email": "…", "role": "user" } }
```

**POST /api/vehicles**
```json
{ "make": "Toyota", "model": "Camry", "category": "Sedan", "price": 27999, "quantity": 5 }
```

**GET /api/vehicles/search?make=toyota&category=SUV&minPrice=10000&maxPrice=40000**
- `make`, `model`: case-insensitive partial match.
- `category`: exact (case-insensitive).
- `minPrice`, `maxPrice`: inclusive; `minPrice > maxPrice` is a 400.
- Returns `{ "data": [Vehicle...], "count": n }`.

**POST /api/vehicles/:id/purchase**
```json
// request (optional body)
{ "quantity": 1 }
// 200
{ "vehicle": { "id": "…", "quantity": 4, … } }
// 409
{ "error": { "code": "OUT_OF_STOCK", "message": "Vehicle is out of stock" } }
```

**POST /api/vehicles/:id/restock** (admin)
```json
{ "quantity": 10 }
```

### 3.4 Route order
Register `/api/vehicles/search` **before** `/api/vehicles/:id`.

### 3.5 Proactive inventory endpoints

**GET /api/notifications?unread=true&limit=20** (own notifications only)
```json
{
  "data": [
    {
      "id": "<uuid>", "type": "LOW_STOCK",
      "vehicle": { "id": "<uuid>", "make": "Toyota", "model": "Camry" },
      "quantity": 2, "readAt": null, "resolvedAt": null,
      "createdAt": "2026-10-24T14:30:00Z"
    }
  ],
  "unreadCount": 1
}
```

**POST /api/notifications/:id/read** returns 200 with the notification; 404 if it does not exist or belongs to someone else.
**POST /api/notifications/read-all** returns `{ "updated": 3 }`.

**POST /api/vehicles/:id/watch** returns `{ "watching": true }`. 409 `IN_STOCK` if the vehicle has stock; 409 `WATCH_LIMIT_REACHED` at 50 watches; repeat calls are idempotent.
**DELETE /api/vehicles/:id/watch** returns 204.

**GET /api/vehicles/forecast** (admin only)
```json
{
  "data": [
    { "vehicleId": "<uuid>", "avgDailySales": 0.8, "daysOfStockLeft": 2.5, "atRisk": true, "suggestedRestock": 22 }
  ],
  "windowDays": 30,
  "atRiskDays": 7
}
```

The forecast is a separate admin-only endpoint, not a field on the vehicle list, so regular users never receive sales data. Vehicle list and search responses gain one per-user field, `isWatching`.

Route order: `/api/vehicles/forecast` and `/api/vehicles/search` are registered before `/api/vehicles/:id`.

## 4. Authentication and Authorization Design

- **Registration:** validate → lowercase email → bcrypt hash (cost 12) → insert with role `user`.
- **Login:** find by email → compare hash (run a dummy compare when the email is unknown, to equalise timing) → sign JWT (HS256 pinned) → set the httpOnly cookie. Same 401 message whether the email or the password was wrong.
- **Session endpoints:** `GET /api/auth/me` restores the session on page load; `POST /api/auth/logout` clears the cookie.
- **Full security design** (SQLi, XSS, CSRF, rate limiting, headers): `security.md`.
- **JWT payload:** `{ sub: userId, role, iat, exp }`; expiry about 1h (configurable); secret from `JWT_SECRET`.
- **Middleware chain:** `authenticate` (verify cookie token → `req.user`) then `requireRole('admin')` where needed. `authenticate` is applied router-wide so routes are protected by default.
- **Admin bootstrap:** `npm run seed:admin` reads `ADMIN_EMAIL` / `ADMIN_PASSWORD` from env and upserts an admin. Public registration can never set a role.

## 5. Purchase Atomicity Design

A single conditional statement avoids read-then-write races:

```sql
UPDATE vehicles
SET quantity = quantity - $2, updated_at = now()
WHERE id = $1 AND quantity >= $2
RETURNING *;
```

- 1 row returned: success.
- 0 rows: a follow-up lookup distinguishes 404 (no such vehicle) from 409 (insufficient stock).
- The `CHECK (quantity >= 0)` constraint is a second safety net.

Restock is `UPDATE … SET quantity = quantity + $2 … RETURNING *`.

## 5A. Proactive Inventory Design

### Stock-change pipeline
Every change to a vehicle's quantity (purchase, restock, or a `PUT` that changes quantity) goes through one method, `applyStockChange`, inside a single database transaction:

1. Write the new quantity (purchases use the atomic conditional `UPDATE`).
2. For purchases, insert the `purchases` row.
3. Pass `{ vehicleId, before, after }` to the registered handlers: `LowStockAlertHandler` and `BackInStockHandler`.
4. Commit. If any step fails, everything rolls back, so alerts and stock can never disagree.

### Low-stock alerts (admins)
Threshold `T` is 3 (`LOW_STOCK_THRESHOLD`). State after the change: **out** if `after = 0`, **low** if `0 < after <= T`, **ok** otherwise.

| State after | Action |
|---|---|
| out | Create `OUT_OF_STOCK` for every admin; resolve open `LOW_STOCK` alerts |
| low, and quantity decreased | Create `LOW_STOCK` for every admin; resolve any open `OUT_OF_STOCK` |
| low, and quantity increased | Resolve open `OUT_OF_STOCK`; create nothing |
| ok | Resolve open `LOW_STOCK` and `OUT_OF_STOCK` |

Creation uses `INSERT ... ON CONFLICT DO NOTHING` against the partial unique index, so concurrent purchases cannot produce duplicates.

### Stock-out forecast (admins)
- `avgDailySales` = units purchased in the last 30 days / 30
- `daysOfStockLeft` = `quantity / avgDailySales`, rounded to 1 decimal; `null` when `avgDailySales` is 0
- `atRisk` = `daysOfStockLeft` is not null and <= 7
- `suggestedRestock` = `max(0, ceil(avgDailySales * 30) - quantity)` (covers 30 days)

Computed on read from one aggregate query over `purchases`, as a pure function with an injected clock so tests are deterministic. The seed script generates about 30 days of backdated purchases so the forecast and screenshots look realistic.

### Back-in-stock (users)
- A user can watch a vehicle only when its quantity is 0 (409 otherwise). Watches are one-shot and capped at 50 per user.
- When quantity goes from 0 to above 0, `BackInStockHandler` creates one `BACK_IN_STOCK` notification per watcher and deletes those watches, in the same transaction.

### Delivery
In-app only. The SPA polls `GET /api/notifications?unread=true` about every 30 seconds, pauses while the tab is hidden, and refetches on focus. Polling stays within the normal rate limits.

## 6. UI/UX Design

### 6.1 Visual direction
**Non-negotiable:** the app must read as a hand-built, professional operations dashboard (reference feel: Linear, Stripe Dashboard, Vercel), not as a generated template. Dense, calm and data-first: neutral surfaces, hairline borders, one restrained accent, tight typography. The data is the visual; decoration is minimal.

**Avoid these "AI look" tells:**
- Purple, indigo or blue gradients, gradient text, glow effects, glassmorphism, blurred blobs
- Emoji as icons or in headings; mixed icon styles
- Untouched Tailwind defaults (blue-500 buttons, gray-100 cards) and oversized `rounded-2xl` cards with heavy shadows
- A card grid for everything, big centred hero sections, "Welcome back" greetings
- Filler copy, lorem ipsum, placeholder data like "John Doe" or "Car 1", exclamation marks
- Everything centred, uniform spacing, no hierarchy

**Design tokens** (defined once as CSS variables and wired into `tailwind.config`; no ad-hoc colours in components):

| Token | Light | Dark |
|---|---|---|
| Page background | `#F6F6F4` | `#0E0F11` |
| Surface (panels, table) | `#FFFFFF` | `#16181B` |
| Border (hairline, 1px) | `#E5E5E1` | `#26292E` |
| Text | `#17181A` | `#ECECEA` |
| Muted text | `#6B6E74` | `#8D9096` |
| Accent (primary actions, focus ring) | `#0F6E73` | `#2FA3A8` |
| In stock | `#1B7F4B` | `#4BC187` |
| Low stock (<= 3) | `#A86400` | `#E0A03A` |
| Out of stock | `#B3261E` | `#F0736B` |

- **Typography:** one self-hosted family (e.g. Geist Sans or IBM Plex Sans, no third-party font CDN). Base 14px / 20px line height; page title 20px semibold; table header 12px medium, muted; prices and quantities use `tabular-nums` and are right-aligned.
- **Shape and depth:** 6px radius for inputs and buttons, 8px for panels, 12px max for drawers. Panels use borders, not shadows. Shadows only on floating layers (menus, drawer, toasts).
- **Spacing:** 4px grid; consistent 16 / 24px gutters; table rows 44px.
- **Icons:** one set (Lucide), 16px, 1.5px stroke. No emoji anywhere.
- **Motion:** 120 to 150ms ease-out on opacity and transform only; honour `prefers-reduced-motion`. No bounce, parallax or looping animation.
- **Copy:** sentence case, terse and specific ("Purchase", "Out of stock", "Couldn't save: price must be 0 or more").
- **Data:** the seed script loads ~30 realistic vehicles (real makes, models, categories, plausible prices and stock levels, a few at 0 and low stock) so screenshots look like a real dealership. Currency formatted with `Intl.NumberFormat` (configurable).
- **Quality gates:** WCAG AA contrast, axe-core clean, Lighthouse accessibility >= 95, visual check at 360 / 768 / 1280 / 1920 px, no layout shift on load, keyboard-operable everywhere.

### 6.2 Pages and routes

| Route | Page | Access |
|---|---|---|
| `/login` | Login form | public |
| `/register` | Register form | public |
| `/` | Dashboard: KPI strip, filters, vehicle table | authenticated |
| `/admin` (or inline controls) | Inventory management | admin |

### 6.3 Dashboard layout
- **App shell:** fixed left sidebar (224px, collapsible) with the wordmark and nav: *All vehicles*, *Low stock*, *Out of stock*, plus *At risk* for admins (saved filter views of the same table). Slim top bar with page breadcrumb and a notification bell with unread badge and a user menu (name, role, theme toggle, sign out). On mobile the sidebar becomes a slide-over.
- **Page header:** "Inventory" title with result count; primary action **Add vehicle**.
- **KPI strip:** four compact stat tiles with hairline borders: *Models*, *Units in stock*, *Inventory value*, *Out of stock*; admins also get a fifth tile, *At risk* (forecast, 7 days or fewer left). Derived from real data (list response or an optional stats endpoint), never hard-coded.
- **Toolbar:** search input (make / model), filter controls for category, price range (min to max) and stock status, active-filter chips, "Clear" action. Filters live in the URL.
- **Data table** (the centrepiece): sticky header, sortable columns (Vehicle, Category, Price, Stock), 44px rows, hover highlight, no zebra striping.
  - *Vehicle*: make and model in primary text.
  - *Category*: plain muted text.
  - *Price*: right-aligned, tabular numerals.
  - *Stock*: quantity plus a subtle status pill (In stock / Low / Out of stock).
  - *Actions*: **Purchase** secondary button per row, **disabled with tooltip when quantity is 0**; row overflow menu (Edit, Restock, Delete) where the role allows. Delete and Restock appear for admins only.
  - Footer: pagination with rows-per-page and range ("1 to 25 of 31").
- **Purchase flow:** small popover with quantity stepper and total, then confirm; row updates in place.
- **Notify me (users):** on a row with quantity 0, a **Notify me** secondary button sits beside the disabled Purchase button. After subscribing it reads **Watching** (click to stop). Toast: "You'll be notified when Toyota Camry is back in stock".
- **Notification bell (everyone):** top-bar bell with an unread count badge (hidden at 0, capped at "9+"). It opens a popover panel, newest first: vehicle name, short message, relative time, unread dot. Clicking an item marks it read and filters the table to that vehicle; "Mark all read" clears the badge. Admins see low-stock and out-of-stock alerts; users see back-in-stock notices. Resolved alerts carry a muted "Restocked" tag. Copy: "Toyota Camry: 2 left", "Toyota Camry is out of stock", "Toyota Camry is back in stock". Keyboard operable (focus trap, Esc closes), new items announced politely via `aria-live`.
- **Forecast (admins):** a sortable **Days left** column (tabular numerals, an em dash when there are no recent sales) with a subtle at-risk pill at 7 days or fewer. The restock drawer pre-fills the suggested quantity with a hint, "Suggested: 22 (covers 30 days of sales)", which the admin can overwrite.
- **Forms in a right-side drawer** (add / edit vehicle, restock), not a centred modal. Delete uses a small confirm dialog that names the vehicle.
- **Feedback:** compact toasts bottom-right for success and error; field-level errors inline.
- **Responsive:** below 768px the table becomes stacked rows (vehicle, price, stock, actions) and filters collapse behind a "Filters" button.
- **Auth pages:** a single quiet, centred 360px form on the page background with the wordmark above it. No illustrations, stock imagery or marketing copy.

### 6.4 States
- Loading: skeleton table rows.
- Empty: friendly "No vehicles match your filters" with a reset action.
- Error: inline banner with retry.
- Session expiry: redirect to `/login` with a message.
- Notifications: empty panel reads "No notifications"; failed polling is silent (no toast) and retried on the next interval.

### 6.5 Accessibility and responsiveness
- Labelled inputs, visible focus rings, sufficient contrast, keyboard-operable drawers and dialogs (focus trap, Esc to close), `aria-disabled` and `aria-live` for toasts.
- Mobile-first Tailwind breakpoints (`sm`, `md`, `lg`, `xl`).

### 6.6 Frontend state
- Auth context holds `{ user }` only. The token lives in an httpOnly cookie and is never readable by JavaScript; the session is restored via `GET /api/auth/me`.
- API client wrapper sends `credentials: 'include'` and handles 401 globally.
- `dangerouslySetInnerHTML` is banned; all vehicle text renders as text nodes.
- Server state via React Query (or simple hooks); filters held in URL query params so views are shareable.

## 7. Test Design (drives TDD)

### 7.1 Test pyramid
| Level | Scope | Tools |
|---|---|---|
| Unit | services, validators, middleware with mocked repositories | Jest/Vitest |
| Integration | routes + real test Postgres via Supertest | Jest + Supertest |
| Component | forms, vehicle table row, role-based UI | Vitest + RTL |
| Security | injection, XSS, authorization matrix, JWT tampering, CSRF, rate limits | Jest + Supertest (see `security.md` section 11) |

### 7.2 Backend red-green-refactor roadmap

| # | Feature | First failing tests (examples) |
|---|---|---|
| 1 | Register | creates user with hashed password; rejects duplicate email (409); rejects weak password; always role `user` |
| 2 | Login | sets httpOnly session cookie on valid creds; 401 on wrong password; 401 on unknown email |
| 3 | Auth middleware | 401 no token; 401 bad/expired token; attaches user on valid token |
| 4 | Role guard | 403 for `user`; passes for `admin` |
| 5 | Create vehicle | 201 valid; 400 negative price; 400 negative quantity; 401 unauthenticated |
| 6 | List vehicles | returns all; empty list; 401 unauthenticated |
| 7 | Search | by make; by model; by category; by price range; combined; invalid range 400; route not shadowed by `:id` |
| 8 | Update vehicle | updates fields; 404 unknown id; validation errors |
| 9 | Delete vehicle | 204 admin; 403 user; 404 unknown |
| 10 | Purchase | decrements quantity and records a purchase in the same transaction; 409 at zero; 404 unknown; **concurrent purchases of last unit: exactly one succeeds** |
| 11 | Restock | admin increases quantity; 403 user; 400 non-positive amount |
| 12 | Low-stock alerts | crossing the threshold creates one alert per admin; no duplicates on further purchases; at 0 creates `OUT_OF_STOCK` and resolves `LOW_STOCK`; restock above threshold resolves alerts; purchases that do not cross do nothing; **concurrent purchases crossing the threshold yield exactly one open alert per admin**; failure rolls back stock and alert together |
| 13 | Forecast | pure function: no sales gives `null`; known sales give expected days left; `atRisk` boundary at exactly 7 days; suggested restock never negative; purchases older than 30 days ignored; endpoint is admin-only and returns 403 for users |
| 14 | Watch | allowed only at quantity 0 (409 otherwise); idempotent; cap of 50; unwatch returns 204; 404 unknown vehicle |
| 15 | Back-in-stock | restock 0 to n notifies each watcher once and clears watches; `PUT` quantity 0 to n does the same; non-zero to non-zero notifies nobody; non-watchers get nothing |
| 16 | Notifications API | lists own only; `unread` filter; mark read; read-all; **another user's id returns 404 (no IDOR)**; `isWatching` correct on list and search |

### 7.3 Frontend tests
- Login/register: validation messages, submit calls the API, errors shown.
- Vehicle row: Purchase button disabled at quantity 0, enabled otherwise.
- Markup-like text in a vehicle name renders as plain text and creates no DOM elements.
- Admin controls rendered only for `role === 'admin'`.
- Filter inputs update the query.
- Notification bell shows the unread count, hides the badge at zero, and marks items read on click.
- Notify me / Watching toggles on out-of-stock rows; Days left column and At risk tile render for admins only.
- Restock drawer pre-fills the suggested quantity for admins.
- Polling pauses when the document is hidden (fake timers).

### 7.4 Test data
Factory helpers (`buildVehicle`, `buildUser`) and a DB reset between integration tests (truncate tables).

## 8. Commit Design

Sequence per feature:
```
test: add failing tests for <feature>        (red)
feat: implement <feature>                    (green)
refactor: extract <thing> from <feature>     (refactor)
```
AI-assisted commits carry the `Co-authored-by:` trailer after two blank lines.
