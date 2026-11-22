# WhimsyMaya — Cloudflare-Native Full-Stack Work Management & Analyst Platform

**Tagline:** *Plan. Record. Analyse. Improve.*

WhimsyMaya is a full-stack SaaS productivity, daily planner, work journal, project & task management, analyst research desk, and performance analytics platform engineered to deploy entirely on **Cloudflare's Free Developer Services**:
- **Cloudflare Workers** (`worker/index.ts` powered by Hono under `/api/*`)
- **Cloudflare Workers Static Assets** (React 19 + TypeScript + Vite 8 + Tailwind CSS v4 SPA fallback)
- **Cloudflare D1** (`DB` binding — serverless SQLite database with 19 normalized tables & indexes)
- **Cloudflare R2** (`FILES` binding — zero-egress object storage for journal & research attachments)
- **Better Auth D1 Session Architecture** (PBKDF2-HMAC-SHA256 Web Crypto password hashing, SHA-256 session tokens in D1, HTTP-only SameSite cookies)
- **Cloudflare Turnstile** (Server-side bot protection on registration, login, and password reset endpoints)

---

## Zero-Key Initial Build & Development Preview Mode

WhimsyMaya is designed so you can **build, preview, export, and perform your initial Cloudflare deployment without entering any API keys, OAuth secrets, or email credentials**:
- When `BETTER_AUTH_SECRET` is not yet configured, WhimsyMaya automatically launches in **Development & Demo Preview Mode**, using clearly labelled, isolated demo records so you can test the Dashboard, Daily Planner, Kanban/List/Calendar Tasks, Projects, Work Journal, Analyst Desk, Track Record, Performance Analytics, Excel/CSV/PDF Report Exports, Team Management, and Settings.
- **No Compromised Production Security:** WhimsyMaya never uses a hardcoded production secret or a silent fallback signing key. Until `BETTER_AUTH_SECRET` is configured in Cloudflare Worker secrets, production multi-user database endpoints remain strictly locked (`503 Service Unavailable`).
- Navigate to **Settings & Integrations -> Future Integrations** inside the app at any time to review the live status of all 6 integrations:
  - `Better Auth — Not Configured`
  - `Google Login — Not Configured`
  - `Turnstile — Not Configured`
  - `Resend Email — Not Configured`
  - `Cloudflare D1 — Pending Setup`
  - `Cloudflare R2 — Pending Setup`

---

## Post-Deployment Checklist: Resources & Secrets to Configure Later

After your initial build and preview, configure the following Cloudflare resources and secrets when you are ready to enable production multi-user persistence:

| Integration / Resource | Environment Variable / Binding | Required For | Setup Command |
| :--- | :--- | :--- | :--- |
| **Cloudflare D1 Database** | Binding: `DB` (`whimsymaya-db`) | Production SQLite persistence (19 tables) | `npx wrangler d1 create whimsymaya-db` |
| **Cloudflare R2 Bucket** | Binding: `FILES` (`whimsymaya-files`) | Journal & Analyst file attachments | `npx wrangler r2 bucket create whimsymaya-files` |
| **Better Auth Secret** | `BETTER_AUTH_SECRET` | Unlocking production login, registration & D1 sessions | `npx wrangler secret put BETTER_AUTH_SECRET` |
| **Cloudflare Turnstile** | `VITE_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Optional bot protection on auth forms | `npx wrangler secret put TURNSTILE_SECRET_KEY` |
| **Google OAuth Login** | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional Google Sign-In | `npx wrangler secret put GOOGLE_CLIENT_ID` |
| **Resend Email** | `RESEND_API_KEY`, `EMAIL_FROM` | Optional password reset & invite emails | `npx wrangler secret put RESEND_API_KEY` |

---

## Step-by-Step Cloudflare Deployment Guide

### 1. Installing Dependencies

```bash
npm install
```

### 2. Testing Locally (No Credentials Required)

```bash
npm run dev
```

Open `http://localhost:3000` to explore WhimsyMaya in **Development & Demo Preview Mode**.

### 3. Building & Verifying the Application (No Credentials Required)

```bash
npm run build
npm run typecheck
```

### 4. Logging into Wrangler

```bash
npx wrangler login
```

### 5. Creating the Cloudflare D1 Database & Running Migrations

Create your D1 database:

```bash
npx wrangler d1 create whimsymaya-db
```

Copy the `database_id` from the terminal output into `wrangler.jsonc` under `d1_databases[0].database_id`, then apply the schema migrations locally and remotely:

```bash
npx wrangler d1 migrations apply whimsymaya-db --local
npx wrangler d1 migrations apply whimsymaya-db --remote
```

### 6. Creating the Cloudflare R2 Bucket

```bash
npx wrangler r2 bucket create whimsymaya-files
```

### 7. Deploying to Cloudflare Workers

```bash
npm run deploy
```

### 8. Enabling Production Authentication & Optional Integrations After Deployment

Once deployed, run the following commands whenever you are ready to activate production accounts and optional integrations:

```bash
# 1. Enable Better Auth production sessions (generate a random 32+ char secret)
npx wrangler secret put BETTER_AUTH_SECRET

# 2. (Optional) Enable Cloudflare Turnstile bot verification
npx wrangler secret put TURNSTILE_SECRET_KEY

# 3. (Optional) Enable Google OAuth 2.0
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET

# 4. (Optional) Enable Resend transactional emails for password resets
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put EMAIL_FROM
```
