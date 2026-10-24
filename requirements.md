# Requirements: Car Dealership Inventory System

## 1. Purpose

A full-stack Car Dealership Inventory System built as a TDD kata. Users register and log in, browse and search vehicles, and purchase them. Admins manage inventory (add, update, delete, restock).

The kata evaluates the **process** as much as the product: TDD history, clean code, Git discipline, and transparent AI usage.

## 2. Scope

### In scope
- REST API with JWT authentication and role-based access (user / admin)
- Persistent database (not in-memory)
- React SPA with Tailwind, responsive and polished
- Automated tests (backend-first TDD), coverage report
- Proactive inventory intelligence: low-stock alerts, stock-out forecast, back-in-stock notifications (in-app)
- Documentation: README, test report, screenshots, My AI Usage, PROMPTS.md

### Out of scope
- Real payment processing (a "purchase" only decrements stock)
- Order history / invoices (optional stretch)
- Image uploads (optional stretch: image URL field)
- Email verification, password reset
- Email / push / SMS delivery of notifications (in-app only for now); per-vehicle alert thresholds

## 3. Stack (chosen)

| Layer | Choice |
|---|---|
| Backend | Node.js + TypeScript + Express |
| Database | PostgreSQL |
| Auth | JWT in an httpOnly cookie, bcrypt password hashing |
| Backend tests | Jest (or Vitest) + Supertest |
| Frontend | React + Vite + TypeScript, Tailwind CSS, HTML5/CSS3 |
| Frontend tests | Vitest + React Testing Library |
| VCS | Git, public repo (GitHub) |

## 4. Actors

- **Visitor:** can register and log in only.
- **User (role = `user`):** can view, search, add and update vehicles, and purchase.
- **Admin (role = `admin`):** everything a user can do, plus delete vehicles and restock.

## 5. Functional Requirements

### 5.1 Authentication
| ID | Requirement |
|---|---|
| FR-A1 | A visitor can register with email, password and name. |
| FR-A2 | Email must be unique and valid; password minimum 8 characters. |
| FR-A3 | Passwords are stored hashed (bcrypt), never in plain text. |
| FR-A4 | A registered user can log in and receives a signed JWT, set as an httpOnly, Secure, SameSite cookie. |
| FR-A5 | Invalid credentials return 401 with a generic message (no user enumeration). |
| FR-A6 | Registration always creates role `user`. Admins are created via a seed script or env bootstrap, never via public registration. |
| FR-A7 | Protected endpoints reject missing, malformed or expired tokens with 401. |
| FR-A8 | Admin-only endpoints reject non-admin users with 403. |
| FR-A9 | `POST /api/auth/logout` clears the session cookie. (Supporting endpoint beyond the kata's list.) |
| FR-A10 | `GET /api/auth/me` returns the current user so the SPA can restore the session. (Supporting endpoint beyond the kata's list.) |

### 5.2 Vehicles
| ID | Requirement |
|---|---|
| FR-V1 | Each vehicle has: unique `id`, `make`, `model`, `category`, `price`, `quantity`. |
| FR-V2 | An authenticated user can create a vehicle (`POST /api/vehicles`). |
| FR-V3 | An authenticated user can list all available vehicles (`GET /api/vehicles`). |
| FR-V4 | An authenticated user can search by make, model, category and price range (`GET /api/vehicles/search`). Filters are combinable and optional. |
| FR-V5 | An authenticated user can update a vehicle (`PUT /api/vehicles/:id`). |
| FR-V6 | Only an admin can delete a vehicle (`DELETE /api/vehicles/:id`). |
| FR-V7 | Validation: `price` >= 0, `quantity` is an integer >= 0, required strings non-empty. |
| FR-V8 | Unknown id returns 404. Invalid payload returns 400/422 with field-level errors. |

### 5.3 Inventory
| ID | Requirement |
|---|---|
| FR-I1 | `POST /api/vehicles/:id/purchase` decreases quantity by 1 (optional `quantity` in body, default 1) and records the purchase. |
| FR-I2 | Purchase fails with 409 if stock is insufficient; quantity never goes below zero. |
| FR-I3 | Purchase must be atomic and safe under concurrent requests. |
| FR-I4 | `POST /api/vehicles/:id/restock` (admin only) increases quantity by a positive integer. |
| FR-I5 | Restock with a non-positive or non-integer amount returns 400/422. |

### 5.4 Frontend
| ID | Requirement |
|---|---|
| FR-F1 | Register and login forms with validation and error display. |
| FR-F2 | Dashboard listing all vehicles in a sortable, paginated data table. |
| FR-F3 | Search and filter UI: make, model, category, min/max price. |
| FR-F4 | Purchase button on each vehicle, **disabled when quantity is 0**. |
| FR-F5 | Admin-only UI to add, edit, delete and restock vehicles. Hidden or disabled for regular users. |
| FR-F6 | Session held in an httpOnly cookie (JavaScript never reads the token); session restored via `GET /api/auth/me`; auto-logout on 401. |
| FR-F7 | Loading, empty and error states for all data views. |
| FR-F8 | Responsive layout (mobile, tablet, desktop). |

### 5.5 Proactive Inventory Intelligence
Three features that make the app tell people things before they have to look. Design in `design.md` section 5A.

| ID | Requirement |
|---|---|
| FR-P1 | Every successful purchase is recorded (vehicle, buyer, quantity, unit price, time) in the same transaction as the stock decrement. |
| FR-P2 | **Low-stock alert (admins).** When a purchase leaves a vehicle at or below the threshold (default 3, `LOW_STOCK_THRESHOLD`) and above zero, every admin receives a `LOW_STOCK` notification. At zero they receive `OUT_OF_STOCK`, which supersedes the low-stock alert. |
| FR-P3 | Alerts are de-duplicated: at most one open alert per admin, vehicle and type, even under concurrent purchases. Alerts resolve automatically when the vehicle is restocked above the threshold. |
| FR-P4 | **Stock-out forecast (admins).** `GET /api/vehicles/forecast` returns, per vehicle, average daily sales over the last 30 days, estimated days of stock left, an `atRisk` flag (days left <= 7) and a suggested restock quantity covering 30 days of sales. No sales in the window means no estimate (`null`) and no at-risk flag. |
| FR-P5 | Forecast data is admin-only; regular users never receive sales data. |
| FR-P6 | **Back-in-stock (users).** An authenticated user can watch an out-of-stock vehicle (`POST /api/vehicles/:id/watch`) and stop watching (`DELETE`). Watching an in-stock vehicle returns 409; watching twice is idempotent; at most 50 watches per user. |
| FR-P7 | When a vehicle's quantity goes from 0 to above 0 (restock or update), each watcher receives one `BACK_IN_STOCK` notification and their watch is removed. |
| FR-P8 | A user can list their own notifications (`GET /api/notifications`), mark one read, or mark all read. No user can see or change another user's notifications. |
| FR-P9 | Delivery is in-app only: the SPA polls for unread notifications about every 30 seconds (paused while the tab is hidden) and shows an unread badge. |
| FR-P10 | Vehicle list and search responses include `isWatching` for the current user. |
| FR-P11 | UI: notification bell with unread badge; admin "Days left" column, "At risk" KPI tile and sidebar view; suggested quantity pre-filled in the restock drawer; "Notify me" / "Watching" control on out-of-stock rows. |

## 6. Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-1 | **TDD:** tests written before implementation; Git history shows Red-Green-Refactor, especially for backend logic. |
| NFR-2 | **Coverage:** high, meaningful coverage (target >= 90% on backend services; critical paths 100%). |
| NFR-3 | **Clean code:** SOLID, clear naming, meaningful comments, small focused modules. |
| NFR-4 | **Security:** non-negotiable NN-2; full requirements in `security.md`. |
| NFR-5 | **Consistency:** uniform JSON error format across the API. |
| NFR-6 | **Portability:** runs locally with documented steps; Docker Compose for the database. |
| NFR-7 | **Usability:** visually appealing, accessible (labels, focus states, contrast). |
| NFR-8 | **Performance:** list and search endpoints indexed on common filters. Pagination optional but recommended. |

## 6A. Non-Negotiables

These override any trade-off elsewhere. A build that fails either one is not done.

### NN-1: Professional, non-generic UI
- The app must look like a hand-built, professional operations dashboard, not a generated template (no gradient-and-emoji "AI look", no default-framework styling).
- Dense, data-first layout: app shell with sidebar, KPI strip, filterable data table, side drawers for forms.
- Defined design tokens (colour, type, spacing, radius), one icon set, realistic data and terse, specific copy.
- Passes accessibility checks (WCAG AA contrast, keyboard operable, axe-core clean) and renders cleanly at 360 / 768 / 1280 / 1920 px.
- Full spec: `design.md` section 6.

### NN-2: Security with no known vulnerability classes
- Defence against the OWASP Top 10 classes, specifically SQL injection, XSS, CSRF, broken access control, broken authentication, mass assignment, security misconfiguration, vulnerable dependencies and secrets leakage.
- Every control has an automated test or CI check; security tests run with the normal suite.
- Full spec and test matrix: `security.md`.

## 7. API Contract (summary)

| Method | Path | Auth | Role | Success | Errors |
|---|---|---|---|---|---|
| POST | `/api/auth/register` | none | none | 201 | 400/422, 409 (email taken) |
| POST | `/api/auth/login` | none | none | 200 + session cookie | 400, 401, 429 |
| POST | `/api/auth/logout` | JWT | user+ | 204 | 401 |
| GET | `/api/auth/me` | JWT | user+ | 200 | 401 |
| POST | `/api/vehicles` | JWT | user+ | 201 | 400/422, 401 |
| GET | `/api/vehicles` | JWT | user+ | 200 | 401 |
| GET | `/api/vehicles/search` | JWT | user+ | 200 | 400, 401 |
| PUT | `/api/vehicles/:id` | JWT | user+ | 200 | 400/422, 401, 404 |
| DELETE | `/api/vehicles/:id` | JWT | admin | 204 | 401, 403, 404 |
| POST | `/api/vehicles/:id/purchase` | JWT | user+ | 200 | 400, 401, 404, 409 (out of stock) |
| POST | `/api/vehicles/:id/restock` | JWT | admin | 200 | 400/422, 401, 403, 404 |
| GET | `/api/vehicles/forecast` | JWT | admin | 200 | 401, 403 |
| POST | `/api/vehicles/:id/watch` | JWT | user+ | 200 | 401, 404, 409 (in stock / watch limit) |
| DELETE | `/api/vehicles/:id/watch` | JWT | user+ | 204 | 401, 404 |
| GET | `/api/notifications` | JWT | user+ (own only) | 200 | 401 |
| POST | `/api/notifications/:id/read` | JWT | user+ (own only) | 200 | 401, 404 |
| POST | `/api/notifications/read-all` | JWT | user+ (own only) | 200 | 401 |

Search query params: `make`, `model`, `category`, `minPrice`, `maxPrice`.

## 8. Data Requirements

**User:** `id`, `name`, `email` (unique), `passwordHash`, `role` (`user` | `admin`), `createdAt`.

**Vehicle:** `id`, `make`, `model`, `category`, `price`, `quantity`, `createdAt`, `updatedAt`.

**Purchase:** `id`, `vehicleId`, `userId`, `quantity`, `unitPrice`, `createdAt`.

**Watch:** `userId`, `vehicleId`, `createdAt`.

**Notification:** `id`, `recipientId`, `type` (`LOW_STOCK` | `OUT_OF_STOCK` | `BACK_IN_STOCK`), `vehicleId`, `quantity` (stock at the time), `readAt`, `resolvedAt`, `createdAt`.

## 9. Process Requirements

### 9.1 TDD
- Write a failing test (**red**), make it pass with minimal code (**green**), then clean up (**refactor**).
- Commit each phase separately where practical, e.g. `test: ...`, `feat: ...`, `refactor: ...`.
- Backend logic must be test-first. Frontend tests cover forms, disabled purchase button, role-based UI.

### 9.2 Git
- Conventional, descriptive commit messages; frequent small commits.
- Every AI-assisted commit ends with two blank lines then:
  `Co-authored-by: <AI Tool Name> <AI@users.noreply.github.com>`

### 9.3 AI usage transparency
- README contains a "My AI Usage" section: tools used, how they were used, reflection.
- Root `PROMPTS.md` holds raw, unedited chat logs or public chat links (no summaries).
- Be ready to discuss AI usage in the interview.
- No code copied from other repositories (plagiarism = rejection).

## 10. Deliverables Checklist

- [ ] Public Git repository
- [ ] README.md: project explanation
- [ ] README.md: backend and frontend setup instructions
- [ ] README.md: screenshots
- [ ] README.md: test report (results + coverage)
- [ ] README.md: "My AI Usage" section
- [ ] PROMPTS.md at repo root (raw logs)
- [ ] Commit history showing Red-Green-Refactor
- [ ] AI co-author trailers on AI-assisted commits
- [ ] (Optional) Deployed live app link

## 11. Acceptance Criteria

1. A new user can register, log in, see vehicles, search them, and buy one; stock decreases.
2. Buying a vehicle with quantity 0 is rejected by the API (409) and the button is disabled in the UI.
3. A non-admin gets 403 on delete and restock; the admin UI controls are not shown to them.
4. Two concurrent purchases of the last unit result in exactly one success.
5. `GET /api/vehicles/search?make=Toyota&minPrice=10000&maxPrice=30000` returns only matching vehicles.
6. All tests pass with one command per package; coverage report is generated.
7. The app can be set up and run locally by following the README alone.
8. When a purchase leaves a vehicle with 3 or fewer units, every admin gets exactly one low-stock notification (even with concurrent purchases); at 0 they get an out-of-stock one.
9. `GET /api/vehicles/forecast` returns days left, an at-risk flag and a suggested restock quantity for admins, and 403 for regular users.
10. A user who watches an out-of-stock vehicle gets one back-in-stock notification when it is restocked, and the watch is then cleared.
11. A user can never read or modify another user's notifications.
