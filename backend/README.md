# RITE Auth Backend

A tiny Node.js + Express service that powers **email + password login** for
the RITE Document Studio frontend. It runs **alongside** the existing Vite app
on a separate port.

```
┌───────────────────────────┐         ┌─────────────────────────────┐
│  Frontend (Vite, :5173)   │  HTTPS  │  Auth backend (Express :4000)│
│  src/components/LoginPage │  ────▶  │  /api/auth/register          │
│  src/auth.ts (client)     │         │  /api/auth/login             │
│                           │         │  /api/auth/whoami            │
└───────────────────────────┘         └─────────────────────────────┘
                                          │
                                          ▼
                                  Postgres (auth_passwords)
                                  or passwords.json (dev fallback)
```

---

## 1 · Setup

```powershell
cd "E:\centre software\backend"
npm install
copy .env.example .env       # then edit `.env`
npm start                    # listens on http://localhost:4000
```

In a separate terminal:

```powershell
cd "E:\centre software"
npm run dev                  # the frontend on http://localhost:5173
```

Open the frontend, you'll be sent to the **Login** page.

---

## 2 · Registration

Anyone can register with a valid email and a password (minimum 6 characters).
Passwords are bcrypt-hashed (10 rounds) before being stored. On successful
registration the server returns a JWT and the user is signed in immediately.

---

## 3 · Environment keys (`.env`)

### `PORT` — listen port

Default `4000`. Change if 4000 is taken.

### `CORS_ORIGIN` — frontend origin

Default `http://localhost:5173`. Set to your prod origin when deploying.

### `JWT_SECRET` — session signing key

Long random string. Generate with:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### `DATABASE_URL` — Postgres connection string (optional in dev)

Where shared records and passwords are persisted. If left blank, `/api/sync/*`
returns 503 and passwords are kept in `passwords.json` (development only).

---

## 4 · Endpoints

| Method | Path                       | Body                       | Returns                          |
|--------|----------------------------|----------------------------|----------------------------------|
| POST   | `/api/auth/register`       | `{ email, password }`      | `{ ok, token, identity }`        |
| POST   | `/api/auth/login`          | `{ email, password }`      | `{ ok, token, identity }`        |
| GET    | `/api/auth/whoami`         | —  (Bearer token header)   | `{ ok, identity }`               |
| GET    | `/api/sync/pull?since=...` | —  (Bearer token header)   | sync payload                     |
| POST   | `/api/sync/push`           | sync payload (Bearer)      | `{ ok, applied, skipped }`       |
| GET    | `/api/health`              | —                          | `{ ok, db }`                     |

### Error codes (HTTP 400/401/403/409/500)

- `invalid_email` — email is missing or malformed.
- `missing_password` — password not provided.
- `weak_password` — password under 6 characters.
- `email_already_exists` — register called for an existing user.
- `user_not_found` — login called for an unknown email.
- `wrong_password` — login password didn't match.
- `missing_token` / `invalid_token` — JWT issues on protected routes.
- `database_not_configured` — `/api/sync/*` called without `DATABASE_URL`.

---

## 5 · Rate limits

`/api/auth/register` and `/api/auth/login` share one limiter: **20 requests per
15 minutes per IP**. Tune it in `server.js` (`authLimiter`).

---

## 6 · Storage

- **With `DATABASE_URL`**: passwords go to the `auth_passwords` table
  (`identity TEXT PRIMARY KEY`, `hash TEXT`, `updated_at BIGINT`).
- **Without `DATABASE_URL`**: passwords go to `backend/passwords.json` next to
  this file (dev only — `.gitignore` it before committing).

On first boot, if Postgres is configured and `auth_passwords` is empty, the
server auto-migrates the rows from `passwords.json` so existing users don't
get locked out.
