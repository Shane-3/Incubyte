# Architecture: Car Dealership Inventory System

## 1. System Overview

A classic three-tier web application:

```
┌──────────────────────┐   HTTPS / JSON    ┌──────────────────────────┐   SQL    ┌──────────────┐
│  React SPA (Vite)    │ ────────────────▶ │  Express API (TypeScript)│ ───────▶ │  PostgreSQL  │
│  Tailwind, React     │ ◀──────────────── │  JWT auth, services      │ ◀─────── │              │
│  Router, API client  │                   │                          │          │              │
└──────────────────────┘                   └──────────────────────────┘          └──────────────┘
```

- The frontend is a static bundle served separately (Vite dev server locally; Vercel/Netlify in production).
- The backend is a stateless REST API; all state lives in PostgreSQL.
- Authentication is stateless: a signed JWT carried in an httpOnly cookie.

## 2. Technology Stack

| Concern | Technology |
|---|---|
| Runtime / language | Node.js 20+, TypeScript |
| Web framework | Express |
| Database | PostgreSQL 16 (Docker Compose for local dev) |
| DB access | `pg` with a small repository layer (or Prisma / Drizzle as an alternative) |
| Validation | Zod |
| Auth and hardening | `jsonwebtoken`, `bcrypt`, `cookie-parser`, `helmet`, `express-rate-limit` |
| Backend tests | Jest (or Vitest), Supertest |
| Frontend | React 18, Vite, TypeScript, React Router, Tailwind CSS |
| Frontend tests | Vitest, React Testing Library |
| Lint / format | ESLint, Prettier |
| CI (optional) | GitHub Actions: lint, test, coverage |

## 3. Repository Layout

```
car-dealership/
├── README.md
├── PROMPTS.md
├── requirements.md
├── design.md
├── architecture.md
├── security.md
├── docker-compose.yml            # postgres (dev + test)
├── .github/workflows/ci.yml      # optional
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   ├── migrations/               # SQL migration files
│   ├── scripts/seed-admin.ts
│   ├── src/
│   │   ├── app.ts                # builds Express app (no listen) → easy to test
│   │   ├── server.ts             # listens on PORT
│   │   ├── config/               # env loading, constants
│   │   ├── db/                   # pool, migration runner
│   │   ├── routes/               # route definitions only
│   │   │   ├── auth.routes.ts
│   │   │   ├── vehicle.routes.ts
│   │   │   └── notification.routes.ts
│   │   ├── controllers/          # HTTP in/out, no business logic
│   │   ├── services/             # business rules
│   │   │   ├── auth.service.ts
│   │   │   ├── vehicle.service.ts
│   │   │   ├── stock-change.service.ts   # applyStockChange: stock write + handlers, one transaction
│   │   │   ├── forecast.service.ts       # pure forecast math, injected Clock
│   │   │   ├── notification.service.ts
│   │   │   └── watch.service.ts
│   │   ├── repositories/         # SQL only
│   │   │   ├── user.repository.ts
│   │   │   ├── vehicle.repository.ts
│   │   │   ├── purchase.repository.ts
│   │   │   ├── notification.repository.ts
│   │   │   └── watch.repository.ts
│   │   ├── middleware/           # authenticate, requireRole, validate, originCheck, rateLimit, errorHandler
│   │   ├── handlers/             # LowStockAlertHandler, BackInStockHandler (StockChangeHandler)
│   │   ├── validators/           # Zod schemas
│   │   ├── errors/               # AppError subclasses (NotFound, OutOfStock, …)
│   │   └── types/
│   └── tests/
│       ├── unit/                 # services/middleware with mocked repos
│       ├── integration/          # routes + real test DB
│       └── helpers/              # factories, db reset, auth helpers
└── frontend/
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── .env.example              # VITE_API_URL
    └── src/
        ├── main.tsx / App.tsx
        ├── api/                  # fetch client + typed endpoint functions
        ├── context/              # AuthContext
        ├── hooks/                # useVehicles, useAuth, useToast, useNotifications (polling), useForecast (admin)
        ├── components/           # AppShell, Sidebar, KpiStrip, Toolbar, VehicleTable, VehicleRow, VehicleForm, Drawer, Toast, NotificationBell, NotificationPanel, DaysLeft, WatchButton
        ├── pages/                # LoginPage, RegisterPage, DashboardPage
        ├── routes/               # ProtectedRoute, AdminRoute
        └── __tests__/
```

## 4. Backend Architecture

### 4.1 Layers

```
HTTP request
   │
   ▼
Route  ──▶  Middleware (authenticate → requireRole → validate)
   │
   ▼
Controller      parses request, calls service, shapes response
   │
   ▼
Service         business rules (stock checks, hashing, token issuing)
   │
   ▼
Repository      parameterized SQL only
   │
   ▼
PostgreSQL
```

Errors thrown anywhere are `AppError` subclasses; one central `errorHandler` middleware maps them to the standard JSON error format.

### 4.2 SOLID mapping

| Principle | How it is applied |
|---|---|
| **S**ingle Responsibility | Routes route, controllers translate HTTP, services hold rules, repositories run SQL. |
| **O**pen/Closed | New roles or filters are added by extending validators/specs, not by editing core flow. Error handling is extended by adding `AppError` subclasses. |
| **L**iskov | Repository interfaces can be swapped for in-memory fakes in unit tests without changing service behavior. |
| **I**nterface Segregation | Small interfaces: `IVehicleRepository`, `IUserRepository`, `IPasswordHasher`, `ITokenService`. |
| **D**ependency Inversion | Services depend on those interfaces, injected via constructors (a simple composition root in `app.ts`). |

### 4.3 Dependency injection

`createApp({ userRepo, vehicleRepo, hasher, tokens })` builds the app from injected dependencies, so unit tests pass fakes and integration tests pass real Postgres-backed repositories.

### 4.4 Request flow examples

**Purchase**
```
POST /api/vehicles/:id/purchase
 → authenticate (JWT) → validate(params, body)
 → VehicleController.purchase
 → VehicleService.purchase(id, qty)
 → VehicleRepository.decrementStock(id, qty)   // UPDATE … WHERE quantity >= qty RETURNING *
     ├─ row returned → 200 { vehicle }
     └─ no row → findById: missing → NotFoundError (404) | present → OutOfStockError (409)
```

**Admin delete**
```
DELETE /api/vehicles/:id
 → authenticate → requireRole('admin') → VehicleController.remove → VehicleService.remove → repo.delete → 204
```

### 4.5 Auth architecture

```
Register: validate → email exists? → hash(password) → insert(role='user') → 201
Login:    find by email → compare hash (dummy compare if unknown) → sign JWT {sub, role, exp} → Set-Cookie (HttpOnly, Secure, SameSite=Strict) → 200 {user}
Request:  cookie token → verify signature (HS256 pinned) + expiry → req.user = {id, role}
Mutation: Origin allow-list check + JSON content-type required (CSRF defence)
```

JWT secret and expiry come from environment variables. Admins come only from the seed script.

### 4.6 Configuration (`.env.example`)

```
PORT=4000
DATABASE_URL=postgres://postgres:postgres@localhost:5432/dealership
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5433/dealership_test
JWT_SECRET=change-me
JWT_EXPIRES_IN=1h
BCRYPT_ROUNDS=12
LOW_STOCK_THRESHOLD=3
FORECAST_WINDOW_DAYS=30
FORECAST_AT_RISK_DAYS=7
MAX_WATCHES_PER_USER=50
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=ChangeMe123!
CORS_ORIGIN=http://localhost:5173
```

### 4.7 Proactive inventory pipeline

```
purchase | restock | PUT with quantity
        │
        ▼
VehicleService ──▶ StockChangeService.applyStockChange(vehicleId, change)    (ONE DB transaction)
                     ├─ VehicleRepository      conditional UPDATE (atomic)
                     ├─ PurchaseRepository     INSERT purchase (purchases only)
                     └─ StockChangeHandler[]   (Open/Closed: add rules without touching this flow)
                          ├─ LowStockAlertHandler   → NotificationRepository (INSERT ... ON CONFLICT DO NOTHING, resolve)
                          └─ BackInStockHandler     → WatchRepository + NotificationRepository
        commit, or roll everything back

GET /api/vehicles/forecast → ForecastService (pure math over a purchases aggregate, injected Clock)
GET /api/notifications     → NotificationService (recipient-scoped queries only)
SPA polls GET /api/notifications?unread=true about every 30s (paused when the tab is hidden)
```

- `StockChangeHandler` is a small interface (`handle(event, tx)`); handlers are injected in the composition root, so unit tests use fakes and new alert rules need no change to the purchase flow.
- `Clock` is injected into `ForecastService` so tests control "now".
- Recipient scoping happens in SQL (`WHERE recipient_id = $1`, taken from the verified token), never from client input.

## 5. Database Architecture

- Schema managed by versioned SQL migrations (`001_create_users.sql`, `002_create_vehicles.sql`, `003_indexes.sql`, `004_create_purchases.sql`, `005_create_watches_notifications.sql`).
- Invariants enforced at DB level: `CHECK (quantity >= 0)`, `CHECK (price >= 0)`, `UNIQUE (email)`, role `CHECK`.
- Concurrency: stock changes use single-statement atomic updates (no read-modify-write in application code). Alert de-duplication uses a partial unique index with `ON CONFLICT DO NOTHING`, so concurrent purchases cannot create duplicate alerts.
- Separate test database (own container/port); tables truncated between integration tests.

```
users (id PK, name, email UNIQUE, password_hash, role, created_at)
vehicles (id PK, make, model, category, price, quantity, created_at, updated_at)
purchases (id PK, vehicle_id FK, user_id FK, quantity, unit_price, created_at)
watches (user_id FK, vehicle_id FK, created_at, PK(user_id, vehicle_id))
notifications (id PK, recipient_id FK, type, vehicle_id FK, quantity, read_at, resolved_at, created_at)
```

## 6. Frontend Architecture

### 6.1 Structure
- **Pages** compose **components**; **hooks** encapsulate data fetching; the **api** module is the only place that calls `fetch`.
- **AuthContext** exposes `user`, `login`, `logout`; the session is an httpOnly cookie, so no token or other sensitive data is kept in `localStorage`.
- **ProtectedRoute** redirects unauthenticated users to `/login`; **AdminRoute** (or conditional rendering) gates admin UI.
- A central API client sends credentials with each request and, on 401, clears auth and redirects.

### 6.2 Component tree

```
<App>
 ├─ <AuthProvider>
 │   ├─ /login     → <LoginPage>
 │   ├─ /register  → <RegisterPage>
 │   └─ /          → <ProtectedRoute>
 │        └─ <DashboardPage>
 │             ├─ <AppShell> (sidebar + topbar + <NotificationBell>)
 │             ├─ <KpiStrip> + <Toolbar>
 │             ├─ <VehicleTable>
 │             │    └─ <VehicleRow>  (Purchase / <WatchButton>; <DaysLeft> for admins; Edit/Restock/Delete via row menu)
 │             └─ <Drawer> → <VehicleForm> | <RestockForm>   (+ <ConfirmDelete> dialog)
 └─ <ToastProvider>
```

### 6.3 Styling
Tailwind configured from the design tokens in `design.md` section 6.1 (CSS variables for light and dark themes; the default Tailwind palette is not used directly). Self-hosted font, a single icon set (Lucide), no inline styles (required by the strict CSP). Small set of reusable primitives (Button, Input, Select, Badge, Table, Drawer) so spacing, radius and typography stay consistent.

## 7. Testing Architecture

| Layer | Isolation | DB |
|---|---|---|
| Unit (services, middleware) | Fake repos injected | none |
| Integration (API) | Real app via Supertest | Real Postgres test DB |
| Frontend component | Mocked API module | none |

- `app.ts` exports the app without calling `listen`, so Supertest can drive it directly.
- Coverage via `jest --coverage` / `vitest --coverage`; the summary goes into the README test report.
- Concurrency test: fire N parallel purchase requests against quantity = 1 and assert exactly one 200 and the rest 409.
- Alert and forecast logic is unit-tested with fake handlers and a fake `Clock`; integration tests cover the transaction (rollback on handler failure) and concurrent purchases crossing the threshold (exactly one open alert per admin).

## 8. Security Architecture

**Non-negotiable. The full spec, OWASP mapping and test matrix are in `security.md`.** Summary of how it shapes the architecture:

- **Injection:** parameterized queries only in the repository layer; allow-listed sort fields; LIKE escaping; least-privilege DB role. Strict Zod allow-list validation on every input.
- **XSS:** React output encoding, `dangerouslySetInnerHTML` banned by lint, strict CSP on frontend and API, session token in an httpOnly cookie.
- **CSRF:** SameSite=Strict cookie, Origin allow-list check, JSON-only mutations. Production serves the API same-origin via a proxy or rewrite.
- **Access control:** deny by default (router-wide `authenticate`), `requireRole('admin')` on delete and restock with a DB re-check, strict schemas to block mass assignment.
- **Auth hardening:** bcrypt cost 12, generic login errors, timing equalisation, rate limits, pinned JWT algorithm, boot-time secret validation.
- **Platform:** `helmet`, no stack traces, redacted logs, CI with ESLint security rules, Semgrep, CodeQL, `npm audit` and gitleaks.

## 9. Local Development and Deployment

### Local
```
docker compose up -d            # postgres (dev + test)
cd backend && npm i && npm run migrate && npm run seed:admin && npm run dev
cd frontend && npm i && npm run dev
```

### Test
```
cd backend && npm test -- --coverage
cd frontend && npm test -- --coverage
```

### Optional deployment
| Part | Target |
|---|---|
| Frontend | Vercel or Netlify, with `/api/*` rewritten to the backend so the browser sees one origin (see `security.md` section 5.2) |
| Backend | Render / Railway / Fly.io |
| Database | Managed Postgres (Neon, Supabase Postgres, Railway) |

## 10. Documentation and Process Artifacts

| Artifact | Purpose |
|---|---|
| `README.md` | Overview, setup, screenshots, test report, **My AI Usage** |
| `PROMPTS.md` | Raw, unedited AI chat logs or links (append as you go) |
| `requirements.md` | What must be built |
| `design.md` | Behavior, contracts, UX, test plan |
| `architecture.md` | Structure, layers, tech, deployment |
| `security.md` | Threat model, controls, security test matrix, CI checks |
| Git history | Red-Green-Refactor commits with `Co-authored-by:` trailers on AI-assisted ones |

## 11. Key Decisions and Trade-offs

| Decision | Rationale | Alternative |
|---|---|---|
| Express + TypeScript | Familiar, minimal, easy DI | NestJS (more structure, more boilerplate) |
| PostgreSQL | Real relational DB, strong constraints, atomic updates | SQLite (simpler, weaker concurrency story) |
| Repository + service layers | Clean SOLID story; unit tests without a DB | Direct SQL in controllers (faster, less testable) |
| Atomic conditional `UPDATE` for purchase | Correct under concurrency, single round-trip | Row locking with `SELECT … FOR UPDATE` |
| Admin via seed script | Prevents privilege escalation through the public API | Role field in the register body (insecure) |
| Zod validation | Typed schemas shared between validation and types | class-validator, Joi |
| Alerts as stock-change handlers in the same transaction | Alerts can never disagree with stock; new rules plug in without touching the purchase flow | Background job or DB triggers (eventual consistency, harder to test) |
| Polling for in-app notifications | Simple, works with cookie auth and proxies, easy to test | SSE / WebSockets (more infrastructure, more attack surface) |
| Forecast computed on read | No extra state to keep in sync; pure function is trivially testable | Materialised stats table |
