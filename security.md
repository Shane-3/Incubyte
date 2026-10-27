# Security: Car Dealership Inventory System

**Status: non-negotiable.** Security is a release gate, not a polish step. Every control below has an automated test or a CI check, and the security tests run with the normal suite.

## 1. Honest scope

No one can prove an application has "no flaws". What this spec does is:

1. Close every well-known vulnerability class (OWASP Top 10) with layered controls (defence in depth).
2. Prove each control with an automated test, so regressions are caught.
3. Add automated scanners (static analysis, dependency audit, secret scanning, dynamic baseline scan) to catch what review misses.
4. List residual risks openly (section 13).

## 2. Assets, actors, threats

| Asset | Threat |
|---|---|
| User credentials | brute force, credential stuffing, enumeration, theft via XSS |
| Session token | theft (XSS), forgery (JWT tampering), replay, CSRF |
| Inventory data | SQL injection, broken access control, mass assignment |
| Stock integrity | race conditions, negative or overflowing quantities |
| Availability | oversized payloads, unbounded queries, request floods |
| Source and secrets | leaked keys, vulnerable dependencies, secrets in logs, repo or AI chat logs |
| Business data and notifications | regular users reading admin-only sales data (forecast); reading or marking another user's notifications (IDOR); watch or notification flooding |

Actors: anonymous attacker, malicious registered user (tries to reach admin actions), malicious page on another origin (CSRF), compromised dependency.

## 3. OWASP Top 10 (2021) mapping

| Risk | Controls | Verified by |
|---|---|---|
| A01 Broken access control | Deny by default: auth middleware applied router-wide; `requireRole('admin')` on delete, restock and price changes; role re-checked from DB on admin actions; role never accepted from client input | Authorization matrix test (section 11.1) |
| A02 Cryptographic failures | bcrypt (cost 12) for passwords; strong random `JWT_SECRET` (>= 32 bytes) validated at boot; HTTPS + HSTS in production; `Secure` cookie | Config tests, cookie attribute tests |
| A03 Injection (SQL, XSS, command) | Parameterized queries only; allow-listed sort and filter fields; Zod allow-list validation; React output encoding; strict CSP | SQLi and XSS payload tests, ESLint rules, Semgrep |
| A04 Insecure design | Atomic stock update; DB `CHECK` constraints; admin bootstrap via seed only; threat model (this doc) | Concurrency test, constraint tests |
| A05 Security misconfiguration | `helmet`; CORS allow-list; no stack traces; `X-Powered-By` off; least-privilege DB role; env validation | Header tests, ZAP baseline |
| A06 Vulnerable components | Lockfile + `npm ci`; `npm audit` gate; Dependabot; minimal dependencies | CI |
| A07 Identification and auth failures | Rate limiting, generic login errors, timing equalisation, short JWT expiry, pinned algorithm, password rules | Auth security tests |
| A08 Software and data integrity | Signed JWT (HS256 pinned, `none` rejected); lockfile integrity; no unsafe deserialization; CI from clean checkout | JWT tampering tests |
| A09 Logging and monitoring failures | Structured logs with request IDs; log auth failures and 403s; never log passwords, tokens or full bodies | Log redaction test |
| A10 SSRF | App makes no outbound requests from user input | n/a (kept that way) |

## 4. Injection

### 4.1 SQL injection
- **Parameterized queries only** (`$1, $2, ...`). String concatenation or template literals inside SQL are forbidden and enforced by an ESLint rule plus a Semgrep rule.
- **Dynamic identifiers** (sort column, direction) come from a hard-coded allow-list map, never from raw input.
- **LIKE searches:** escape `%`, `_` and `\` in user input and use `ESCAPE '\'`, so users cannot craft wildcard-heavy patterns (also a DoS control).
- **IDs** are validated as UUIDs before reaching the repository; numeric inputs are parsed to numbers and range-checked.
- **DB role:** the app connects as a role with only `SELECT/INSERT/UPDATE/DELETE` on its tables (no DDL, no superuser). Migrations run under a separate role.
- **Error handling:** database errors are mapped (e.g. `23505` to 409) and never echoed to clients.

### 4.2 Cross-site scripting (XSS)
Defence in depth, because one layer is not enough:

1. **Output encoding by default:** React escapes text. `dangerouslySetInnerHTML`, `innerHTML` and `eval`-style APIs are banned via ESLint (`react/no-danger`, `no-eval`).
2. **Input allow-listing:** `make` and `model` match `^[\p{L}\p{N} .,'&()/+\-]{1,100}$`; `category` must be one of a fixed enum. Control characters and `<` `>` are rejected.
3. **No user-controlled URLs or HTML** are rendered (no image URL field unless validated to `https:` and CSP-allowed; not in scope by default).
4. **Strict CSP** on the frontend and API (section 7).
5. **Token not readable by JavaScript:** the session JWT lives in an `httpOnly` cookie, so even a successful XSS cannot exfiltrate it.
6. **API responses** are `application/json` with `X-Content-Type-Options: nosniff`.

### 4.3 Other injection
- No shell execution from request data; no `child_process`, no `eval`, no dynamic `require`.
- No NoSQL or ORM raw-query escape hatches.
- Log injection: strip CR/LF from logged user-controlled strings.

## 5. Authentication and session

| Concern | Decision |
|---|---|
| Password storage | bcrypt, cost 12; passwords capped at 72 bytes (bcrypt truncates beyond that); minimum 8 characters, check against a short common-password list |
| Login errors | One generic `401 Invalid email or password` for both wrong email and wrong password |
| Timing | For unknown emails, run a dummy bcrypt compare so response time does not reveal account existence |
| Brute force | Rate limit login by IP and by email; progressive delay after repeated failures |
| Registration | Always role `user`; schema rejects unknown fields (so `role` cannot be sent); rate limited. The `409 EMAIL_TAKEN` response reveals existence, which is accepted for usability and bounded by rate limiting |
| Token | JWT, **HS256 pinned** (verify with an explicit algorithm list; `none` rejected), claims `sub`, `role`, `iat`, `exp`; expiry 1h |
| Token transport | `Set-Cookie: token=<jwt>; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=3600` (`Secure` required in production) |
| Logout | `POST /api/auth/logout` clears the cookie |
| Session restore | `GET /api/auth/me` returns the current user (frontend cannot read the cookie) |
| Secrets | `JWT_SECRET` must be >= 32 random bytes; the server **refuses to start** in production with a missing, short or default secret |
| Admin creation | Seed script from env only; never through the API |

### 5.1 Why an httpOnly cookie instead of localStorage
`localStorage` is readable by any injected script, so a single XSS bug would leak every session. An httpOnly cookie removes that exposure. The trade-off is CSRF, handled in section 6. The kata's "token-based authentication (e.g. JWT)" requirement is still met: the cookie carries a JWT.

### 5.2 Deployment constraint
`SameSite=Strict` cookies only work when the frontend and API are the same site. In production, serve the API under the frontend's origin (e.g. a Vercel or Netlify rewrite of `/api/*` to the backend) so the browser sees one origin. That also removes the need for CORS. If a cross-site setup is unavoidable, use `SameSite=None; Secure` plus a double-submit CSRF token.

## 6. CSRF

Cookies are sent automatically, so state-changing requests are protected by three independent checks:

1. `SameSite=Strict` cookie.
2. **Origin check:** for `POST`, `PUT`, `PATCH`, `DELETE`, the `Origin` (or `Referer`) header must match the allow-listed frontend origin; otherwise 403.
3. **JSON only:** state-changing endpoints require `Content-Type: application/json`, which cross-site HTML forms cannot send without a CORS preflight (and preflights are denied for foreign origins).

`GET` endpoints never change state.

## 7. Headers, CORS, transport

**API (`helmet` + custom):**
- `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`
- `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains` (production)
- `Cache-Control: no-store` on auth and user-specific responses
- `X-Powered-By` removed
- CORS: exact-origin allow-list, `credentials: true`, no wildcard; disabled entirely when same-origin proxying is used

**Frontend (set via host headers, e.g. `vercel.json` / `_headers`):**
- `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`
- No inline scripts or inline styles; fonts and icons self-hosted (no third-party CDNs); no `unsafe-inline` or `unsafe-eval`.
- Same `nosniff`, `Referrer-Policy`, `Permissions-Policy` (camera, microphone, geolocation denied).

**Transport:** HTTPS only in production; HTTP redirects to HTTPS; database connections use TLS in production.

## 8. Access control, validation, business logic

### 8.1 Access control
- **Deny by default:** `router.use(authenticate)` on the vehicle router, so a new route is protected unless explicitly made public.
- `requireRole('admin')` on delete and restock, and on `PUT /api/vehicles/:id` when the body sets `price`. The role is read from the verified token, and for admin actions re-checked against the database (handles demoted users).
- Server enforces everything; hiding buttons in the UI is cosmetic only.

### 8.2 Validation (server-side, every input)
- Zod schemas for body, params and query; **`.strict()`** so unknown fields are rejected (blocks mass assignment: `id`, `role`, `createdAt` can never be set by clients).
- Limits: body <= 10 KB (`express.json({ limit })`), strings length-capped, `price` 0 to 99,999,999.99, `quantity` integer 0 to 100,000, `Number.isSafeInteger` checks, `minPrice <= maxPrice`.
- Money stored as `NUMERIC`, handled as strings or integers of minor units in code to avoid float errors.
- Pagination: `limit` capped at 100, default 25.

### 8.3 Business logic
- Purchase and restock are single atomic SQL statements (design.md section 5); DB `CHECK` constraints are the last line of defence.
- Purchase quantity bounded (1 to 10 per request).

### 8.4 Notifications, watches and forecast
- **Recipient scoping in SQL:** every notification query includes `WHERE recipient_id = $1` with the id from the verified token. Notification ids from the client are only ever used together with that condition; someone else's id returns 404, so existence is not revealed.
- **Forecast is admin-only:** sales velocity is business-sensitive, so `GET /api/vehicles/forecast` is behind `requireRole('admin')` and is not merged into the vehicle list.
- **No free-text content:** notifications store a `type` enum, a vehicle reference and a number. The client builds the wording and renders it as text, so there is no stored-XSS path through notifications.
- **Mass assignment:** clients cannot set `recipient_id`, `type`, `read_at` or `resolved_at`; there is no create-notification endpoint, and strict schemas reject unknown fields on the others.
- **Abuse limits:** at most 50 watches per user; fan-out per event is bounded by the number of admins; the watch and `read-all` endpoints have their own rate limit.
- **Integrity:** alerts are created inside the stock-change transaction, with a partial unique index preventing duplicates.

## 9. Abuse and availability

| Endpoint group | Limit (per IP, adjustable) |
|---|---|
| `POST /api/auth/login` | 5 / minute, plus per-email key |
| `POST /api/auth/register` | 10 / hour |
| `POST /api/vehicles/:id/watch`, `POST /api/notifications/read-all` | 30 / minute |
| Everything else under `/api` | 100 / minute |

Also: request timeouts, DB `statement_timeout`, pool size limits, and `trust proxy` configured correctly so rate limiting sees real client IPs.

## 10. Secrets, dependencies, logging

- `.env` is git-ignored; `.env.example` has placeholders only. A secret-scan (gitleaks) runs in pre-commit and CI.
- `npm ci` from a committed lockfile; `npm audit --audit-level=high` fails CI; Dependabot enabled; keep the dependency list small and well-known.
- Logs: structured, with request IDs; log login failures, 401s, 403s and validation spikes; **redact** passwords, tokens, cookies and `Authorization`; never log full request bodies.
- Errors: central handler returns the standard error shape; 500s return a generic message with the request ID only.
- **Practical warning for this kata:** `PROMPTS.md` must be raw, so never paste real secrets, `.env` contents or tokens into AI chats. If one slips in, rotate it immediately.

## 11. Security test suite

All run in CI. Test names should read like the threat.

### 11.1 Authorization matrix (table-driven)
Every endpoint x {anonymous, user, admin} with the expected status.

| Endpoint | anon | user | admin |
|---|---|---|---|
| `GET /api/vehicles`, `/search` | 401 | 200 | 200 |
| `POST /api/vehicles` | 401 | 201 | 201 |
| `PUT /api/vehicles/:id` (make, model, category, quantity) | 401 | 200 | 200 |
| `PUT /api/vehicles/:id` setting `price` | 401 | **403** | 200 |
| `POST /api/vehicles/:id/purchase` | 401 | 200 | 200 |
| `DELETE /api/vehicles/:id` | 401 | **403** | 204 |
| `POST /api/vehicles/:id/restock` | 401 | **403** | 200 |
| `GET /api/vehicles/forecast` | 401 | **403** | 200 |
| `POST` / `DELETE /api/vehicles/:id/watch` | 401 | 200 / 204 | 200 / 204 |
| `GET /api/notifications`, `POST /api/notifications/:id/read`, `POST /api/notifications/read-all` | 401 | 200 (own only) | 200 (own only) |

### 11.2 SQL injection
- Payloads in `make`, `model`, `category`, `minPrice`, `maxPrice`, sort params and `:id`: `' OR '1'='1`, `'; DROP TABLE vehicles; --`, `" OR ""="`, `1; SELECT pg_sleep(5)`, `%`, `_`, `\`.
- Assert: no 500, no timing delay, tables intact, literal matching only, invalid ids return 400.

### 11.3 XSS
- Store `<script>alert(1)</script>`, `<img src=x onerror=alert(1)>`, `"><svg onload=alert(1)>` as make and model: API rejects (allow-list) with 400.
- Frontend (RTL): any text containing markup characters from the API is rendered as a text node and creates no elements.
- Response header tests: CSP, `nosniff`, content type.
- Lint test: build fails on `dangerouslySetInnerHTML`.

### 11.4 Authentication and sessions
- `alg: none` token rejected; token signed with another secret rejected; tampered `role` claim rejected; expired token rejected.
- Cookie flags: `HttpOnly`, `SameSite=Strict`, `Secure` (in production mode), `Path`.
- Login: identical response body and similar timing for unknown email vs wrong password.
- Rate limit returns 429 after the threshold.
- Registration with `{"role":"admin"}` in the body is rejected (strict schema), and the created user is `user`.
- Boot test: production mode with a weak `JWT_SECRET` refuses to start.

### 11.5 CSRF
- State-changing request with a foreign `Origin` returns 403; with `Content-Type: text/plain` or form-encoded returns 415/400.

### 11.6 Input and business logic
- Oversized body returns 413; unknown fields return 400; negative or float quantity returns 400; `limit=100000` is clamped or rejected.
- Concurrent purchases of the last unit: exactly one 200, the rest 409.

### 11.7 Notifications, watches and forecast
- **IDOR:** user B listing notifications never sees user A's; marking user A's notification as read returns 404 and leaves it unread.
- **Forecast exposure:** a regular user gets 403 from the forecast endpoint, and no vehicle list or search response contains sales or forecast fields.
- **Mass assignment:** posting `recipientId`, `type` or `readAt` to any notification or watch endpoint is rejected or ignored.
- **Limits:** the 51st watch returns 409; watching an in-stock vehicle returns 409; the watch rate limit returns 429.
- **Concurrency:** parallel purchases that cross the low-stock threshold produce exactly one open alert per admin.
- **Rendering (RTL):** a vehicle name containing markup renders as plain text in the notification panel and creates no elements.

## 12. Automated tooling (CI)

| Tool | Purpose |
|---|---|
| ESLint (`eslint-plugin-security`, `react/no-danger`, `no-eval`) | unsafe patterns |
| Semgrep (`p/owasp-top-ten`, `p/typescript`, `p/react`) | SQLi, XSS, secrets, misconfig |
| CodeQL (GitHub) | deeper static analysis |
| `npm audit --audit-level=high` | vulnerable dependencies |
| gitleaks | secrets in commits |
| OWASP ZAP baseline scan (optional, against local compose stack) | dynamic header and misconfig checks |
| Tests with coverage | everything in section 11 |

## 13. Residual risks (stated openly)

- Stateless JWTs cannot be revoked before expiry; mitigated by a 1h lifetime. Refresh tokens and a server-side revocation list are out of scope.
- `409 EMAIL_TAKEN` allows email enumeration; bounded by rate limiting.
- No MFA, email verification or password reset.
- Rate limits are per instance (in-memory); a multi-instance deployment would need a shared store such as Redis.
- Hosting-provider security (platform account, DNS, TLS configuration) is outside the app's control.

## 14. Definition of done (security)

- [ ] All section 11 tests pass in CI
- [ ] ESLint, Semgrep, CodeQL, `npm audit` and gitleaks are clean
- [ ] Headers verified on both API and frontend (CSP, HSTS, nosniff, frame-ancestors)
- [ ] Cookie flags verified in production mode
- [ ] No `dangerouslySetInnerHTML`, raw SQL concatenation, or secrets in the repo
- [ ] README has a "Security" section summarising these controls and the residual risks
