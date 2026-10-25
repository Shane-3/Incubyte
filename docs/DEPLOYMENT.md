# Deploying Forecourt

This guide puts the app online on free tiers: **Vercel** for the frontend, **Render** for the API and **Neon** for PostgreSQL. It takes about 30 minutes. Other hosts work too, as long as the setup keeps the shape described below.

## How the pieces fit

```text
Browser ──► Vercel  https://<app>.vercel.app
              ├─ serves the React app (frontend/dist)
              └─ /api/*  ──rewrite──►  Render  https://<api>.onrender.com  ──►  Neon PostgreSQL
```

The browser only ever talks to the Vercel address. Vercel forwards `/api/*` to the API ([frontend/vercel.json](../frontend/vercel.json)). Keeping one origin matters for two reasons:

- **The session cookie** is `httpOnly`, `Secure` and `SameSite=Strict`. A browser won't send it to a different site.
- **Sign-in and every other change** must come from the address in `CORS_ORIGIN`, or the API answers 403.

Don't point the frontend straight at the Render URL; keep the rewrite.

## Before you start

- [ ] The repo is on GitHub and the CI checks pass.
- [ ] You have free accounts on [Neon](https://neon.tech), [Render](https://render.com) and [Vercel](https://vercel.com), each signed in with GitHub.
- [ ] Node.js 20+ is installed locally (needed for two one-off commands).

## 1. Create the database (Neon)

1. Create a project in Neon. Pick **PostgreSQL 17** and the region closest to your users.
2. Open **Connect** and copy the connection string with **connection pooling turned off**. That is the direct address, without `-pooler` in the host. It looks like:
   ```text
   postgresql://<user>:<password>@<endpoint>.<region>.aws.neon.tech/neondb?sslmode=require
   ```
3. Keep it private. It is your `DATABASE_URL`.

You don't need to create any tables. The API applies its migrations every time it starts.

## 2. Deploy the API (Render)

1. In Render, choose **New → Web Service** and connect the GitHub repo.
2. Use these settings:

   | Setting | Value |
   |---|---|
   | Root Directory | `backend` |
   | Runtime | Node |
   | Build Command | `npm ci --include=dev && npm run build` |
   | Start Command | `npm run migrate && npm run seed:admin && npm start` |
   | Instance Type | Free |
   | Health Check Path | leave empty |

   - **Build Command:** `--include=dev` is needed because the TypeScript compiler and the migration runner are dev dependencies, and npm skips those when `NODE_ENV=production`.
   - **Start Command:** on every start, this applies any new migrations and creates or updates the admin account, then starts the server.

3. Add these environment variables:

   | Key | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | the Neon connection string from step 1 |
   | `JWT_SECRET` | a new random secret (see below) |
   | `JWT_EXPIRES_IN` | `1h` |
   | `ADMIN_EMAIL` | the admin's email |
   | `ADMIN_PASSWORD` | a new strong password. Don't reuse your local one. |
   | `CORS_ORIGIN` | `https://example.vercel.app` for now. Step 5 replaces it. |
   | `TRUST_PROXY` | `2` |

   Generate the secret locally and paste the output:
   ```powershell
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

   - **`JWT_SECRET`:** the API refuses to start in production if the secret is shorter than 32 bytes or is the placeholder from `.env.example`.
   - **`TRUST_PROXY=2`:** requests pass through two proxies (Vercel, then Render), and the rate limits need the visitor's real IP address. If people start hitting "Too many requests" together, this value is wrong.
   - **`PORT`:** leave it out. Render sets it, and the API reads it.
   - **Node.js version:** comes from [backend/.node-version](../backend/.node-version) (22, the same as CI), so you don't need to set it.

4. Choose **Create Web Service** and wait for the deploy. The log should end with lines like:
   ```text
   applied  001_...sql        (first deploy only; later: "up to date")
   admin ready: <your admin email>
   API listening on http://localhost:10000 (production)
   ```
5. Copy the service URL, e.g. `https://forecourt-api.onrender.com`. To check it, open `https://forecourt-api.onrender.com/api/auth/me`. A JSON `401` response means the API and database are working.

## 3. Point the frontend at the API

In [frontend/vercel.json](../frontend/vercel.json), replace `YOUR-API-HOST` with your Render host, without `https://`:

```json
{ "source": "/api/(.*)", "destination": "https://forecourt-api.onrender.com/api/$1" },
```

Then commit and push:

```powershell
git add frontend/vercel.json
git commit -m "chore: point the frontend at the deployed API"
git push
```

## 4. Deploy the frontend (Vercel)

1. In Vercel, choose **Add New → Project** and import the repo.
2. Use these settings:

   | Setting | Value |
   |---|---|
   | Root Directory | `frontend` |
   | Framework Preset | Vite (detected) |
   | Build Command | `npm run build` |
   | Output Directory | `dist` |

3. **Environment variables:** none are needed. See [Demo access](#optional-demo-access-on-the-sign-in-page) if you want the admin login shown on the sign-in page.
4. Choose **Deploy**, then copy the production URL, e.g. `https://forecourt.vercel.app`.

Never upload a `frontend/dist` you built locally. It contains whatever is in your `.env.local`, including demo credentials. Let Vercel build from the repo.

## 5. Allow the frontend's address

1. In Render, open the service, then **Environment**. Set `CORS_ORIGIN` to the exact Vercel URL, e.g. `https://forecourt.vercel.app`, with `https` and no trailing slash.
2. Save. Render redeploys automatically.

Only that one address can sign in. Vercel preview deployments (the URLs with random suffixes) will get 403 on sign-in, which is expected. If you add a custom domain later, set `CORS_ORIGIN` to it.

## 6. Optional: load the demo inventory

This loads 32 vehicles in factory colours and 30 days of sales into the empty production database. Run it once, from your machine:

```powershell
cd backend
$env:DATABASE_URL = "<the Neon connection string>"
npm run seed:demo
Remove-Item Env:DATABASE_URL
```

The command uses your local `.env` for everything else. The connection string set in the shell takes priority over the one in `.env`. It only fills an empty inventory; `--replace` is refused when `NODE_ENV=production`.

## Optional: demo access on the sign-in page

To show the admin email and password under the sign-in form, add these to Vercel (**Settings → Environment Variables**, then redeploy):

| Key | Value |
|---|---|
| `VITE_DEMO_ADMIN_EMAIL` | the same as `ADMIN_EMAIL` on Render |
| `VITE_DEMO_ADMIN_PASSWORD` | the same as `ADMIN_PASSWORD` on Render |

**Anyone who opens the site can then sign in as admin** and change or delete the inventory. Only do this for a demo database you don't mind losing, and use a password you don't use anywhere else.

## 7. Check the deployment

Open the Vercel URL and work through this list:

- [ ] The sign-in page loads and the browser shows the padlock (HTTPS).
- [ ] Sign in as the admin. The inventory appears, along with **At risk** and **Purchases** in the sidebar.
- [ ] Reload the page. You stay signed in, so the cookie works through the rewrite.
- [ ] In a private window, register a new user and buy a vehicle. **Purchases** shows the sale for the admin.
- [ ] Sign out and sign in again.
- [ ] Security headers are present:
  ```powershell
  curl.exe -sI https://forecourt.vercel.app | findstr /i "content-security strict-transport x-frame"
  ```

## Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| Sign-in fails with a 403 or "Forbidden" | `CORS_ORIGIN` doesn't exactly match the address in the browser. Check `https`, no trailing slash, and that you're not on a preview URL. |
| Every API call returns 404 | `vercel.json` still says `YOUR-API-HOST`, or the change wasn't pushed. |
| First load after a while is slow or returns 502/504 | Render's free plan sleeps after 15 idle minutes and takes about a minute to wake. Open `<api-url>/api/auth/me` first, then retry. Before a demo, wake it a minute early. |
| Render deploy fails with `JWT_SECRET must be at least 32 bytes` | Generate the secret with the command in step 2. |
| Render build fails with ``npm ci` command can only install with an existing package-lock.json`` | **Root Directory** is empty, so Render built from the repo root. Set it to `backend` (Settings → Build & Deploy) and deploy again. |
| Render build fails with `tsc: not found` | The build command is missing `--include=dev`. |
| Render log shows `connect ETIMEDOUT` or an SSL error | `DATABASE_URL` is wrong, or missing `?sslmode=require`. Copy it again from Neon. |
| Signed in, but every reload goes back to sign-in | The site is opened through the Render URL, or over `http`. Use the Vercel `https` URL. |
| Everyone gets "Too many requests" at once | `TRUST_PROXY` doesn't match the number of proxies, so all visitors share one IP address. It should be `2` for Vercel plus Render. |

## Updating

Push to `main`. Render and Vercel both redeploy automatically, and Render applies any new migrations before the API starts.

To change the admin password, update `ADMIN_PASSWORD` on Render (and the demo variable on Vercel, if you set it). The next start applies it.

## Free-tier limits

- **Render Free:** sleeps when idle and allows 750 instance hours a month.
- **Neon Free:** 0.5 GB of storage, and suspends compute when idle, so the first query after a pause takes a moment.
- **Vercel Hobby:** for personal, non-commercial use.

These limits suit a portfolio or review demo. For real use, move to paid instances and set up backups in Neon.
