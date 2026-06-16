# Deployment Guide — RITE Document Studio

A step-by-step recipe for putting the app online with multi-device sync. The
codebase is already wired for this: every Dexie write is mirrored to Postgres
via `/api/sync/push`, every page load (and every 30 s) pulls remote changes,
and passwords live in Postgres so they survive a backend restart.

This guide assumes the **free tiers** of Neon (database), Render (backend) and
Vercel (frontend). You can swap any one for a paid host later without touching
code.

---

## Architecture in 30 seconds

```
                          ┌────────────────────────┐
   Browser (any device)   │  Vercel — static React │   ┌─────────────────┐
   https://yourdomain.com │  build (this repo /)   │──▶│  Render — Node  │
                          │  IndexedDB (Dexie)     │   │  backend/       │──▶ Neon Postgres
                          └────────────────────────┘   │  /api/auth/*    │     (sync tables +
                                                       │  /api/sync/*    │      auth_passwords)
                                                       └─────────────────┘
```

Every device keeps a full local copy in IndexedDB. Sync flow:
1. **Push** every dirty row to Postgres.
2. **Pull** rows changed since `lastPulledAt`.
3. Soft-delete tombstones propagate so a delete on device A removes the row on device B.

Conflict policy: **last-write-wins per row** based on `updatedAt`.

---

## What You Get Out of the Box

- Multi-device sync for students, courses, settings, simpleMaster.
- Soft-delete tombstones across devices.
- Passwords stored in Postgres (restart-safe).
- One-time auto-migration from `passwords.json` → Postgres on first boot.
- 30 s background sync, plus sync on window focus and `online` events.

---

## Step 1 — PostgreSQL on Neon (free, forever)

1. Visit https://neon.tech → Sign up (Google / GitHub).
2. **Create Project** → name: `rite-studio` → region closest to your users (Singapore for India).
3. Open the project dashboard → **Connection Details** → copy the **Pooled** connection URL. It looks like:
   ```
   postgresql://user:pass@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```
4. Keep that URL handy — you'll paste it into Render in Step 2.

---

## Step 2 — Backend on Render (free tier)

### 2.1 Push the repo to GitHub (skip if already on GitHub)

```powershell
cd "E:\centre software"
git init
git add .
git commit -m "Initial commit"
# Create an empty repo on GitHub, then:
git remote add origin https://github.com/USERNAME/rite-studio.git
git push -u origin main
```

> `backend/.env` is already in `.gitignore` — secrets won't be pushed.

### 2.2 Create the Render service

1. https://render.com → Sign up → **New +** → **Web Service** → connect the GitHub repo.
2. **Settings**:
   - **Name**: `rite-backend`
   - **Region**: Singapore
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
3. **Environment** → **Add Environment Variable** (one row each):

| Key | Value |
|---|---|
| `PORT` | `4000` |
| `CORS_ORIGIN` | `https://your-domain.com` *(update after Step 4)* |
| `JWT_SECRET` | run `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` and paste the output |
| `DATABASE_URL` | the Neon URL from Step 1 |

4. Click **Create Web Service**. Wait 2–3 min for the first deploy.
5. Render assigns a public URL like `https://rite-backend.onrender.com`.
6. Verify in a browser:
   ```
   https://rite-backend.onrender.com/api/health
   ```
   Expected response: `{"ok":true,"db":true}`

> **Heads up — Render free tier sleeps after 15 min of no traffic.** The first request after that takes ~30 s to wake. For an active centre, upgrade to the $7/month Starter plan (no sleep).

---

## Step 3 — Frontend on Vercel (free)

1. https://vercel.com → Sign up → **Add New** → **Project** → pick the same repo.
2. **Settings**:
   - **Framework Preset**: Vite (auto-detected)
   - **Root Directory**: leave blank (`./`)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. **Environment Variables**:

| Key | Value |
|---|---|
| `VITE_AUTH_API` | `https://rite-backend.onrender.com` *(your Render URL from Step 2)* |

4. **Deploy**. ~1 minute. You'll get a URL like `https://rite-studio-xxxx.vercel.app`.

---

## Step 4 — Custom Domain

### 4.1 Point your domain at Vercel

1. Vercel project → **Settings** → **Domains** → **Add** → enter `yourdomain.com`.
2. Vercel will show the DNS record(s) you need to add. Usually:
   - **A record**: `@` → `76.76.21.21`
   - **CNAME**: `www` → `cname.vercel-dns.com`
3. Open your domain registrar's DNS panel (GoDaddy / Hostinger / Namecheap / etc.) and add the records Vercel asks for.
4. Wait 5–30 min for DNS propagation. Vercel will issue an SSL certificate automatically.
5. `https://yourdomain.com` should now load the app.

### 4.2 Update backend CORS

Render → `rite-backend` → **Environment** → edit `CORS_ORIGIN`:

```
CORS_ORIGIN=https://yourdomain.com
```

Save → backend auto-redeploys. After this, the frontend on your custom domain
will be able to call the backend without CORS errors.

---

## Step 5 — Smoke Test

1. Open `https://yourdomain.com` and log in (e.g. `riteeducational@gmail.com`). Take the OTP from your inbox.
2. Add a student record.
3. Open the same URL on a **second computer / different browser** and log in with the same identity.
4. Wait up to 30 s, or just refocus the window — the student row should appear.
5. Delete a row on one device → it should disappear on the other.

If sync looks stuck, open DevTools → Network and watch for `/api/sync/push` and `/api/sync/pull`. 401 means the JWT expired (7-day TTL) — re-login.

---

## Operational Notes

### Password migration
The first time the backend boots with `DATABASE_URL` set, it copies any existing
`backend/passwords.json` entries into the `auth_passwords` Postgres table. Watch
for this line in the Render logs:

```
✅  Migrated 3 password(s) from passwords.json into Postgres.
```

After that, `passwords.json` is no longer the source of truth — Postgres is.

### Known limitations (MVP)
- **Serial-number race**: two users saving at the same instant can grab the same
  `RITE-2026-0042`. Have one user issue serials at a time, or move to a
  server-side serial endpoint when this starts mattering.
- **Settings last-write-wins**: two users changing print calibration at the same
  time means one set of changes is lost. Settings change rarely, so this is fine
  for now.

### Backups
Neon's free tier includes 7-day point-in-time recovery. For an extra safety
net, dump weekly:

```sql
\COPY students TO 'students-backup.csv' WITH CSV HEADER;
```

### Cost Summary

| Service | Tier | Cost |
|---|---|---|
| Neon Postgres | Free (0.5 GB) | ₹0 / month |
| Render Backend | Free (sleeps) | ₹0 / month |
| Render Backend | Starter (no sleep) | ~₹600 / month |
| Vercel Frontend | Free (100 GB bandwidth) | ₹0 / month |
| Domain | `.com` on GoDaddy | ~₹900 / year |

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| `Network error — is the auth backend running?` | Render free instance asleep | Wait ~30 s and retry. Consider Starter plan. |
| Login fails with "CORS error" in console | `CORS_ORIGIN` ≠ exact frontend URL | Update Render env var to include the exact `https://` URL, no trailing slash. |
| Sync looks stuck | JWT expired (>7 days) | Re-login; new token issued. |
| Backend deploy fails | `DATABASE_URL` missing or wrong | Verify Neon URL, ensure `sslmode=require` is in the URL. |
| `/api/sync/*` returns 503 | `DATABASE_URL` not set | Add it in Render env vars. |
| OTPs not arriving | Gmail app password wrong / Fast2SMS key invalid | Check Render logs; backend falls back to "console mode" if both are missing. |

---

## Files Changed (so you know where to look)

- `src/db.ts` — schema v4, sync hooks, soft-delete helpers
- `src/sync.ts` — **new** — push/pull client + background loop
- `src/types.ts` — `SyncFields` mixed into every table interface
- `src/App.tsx` — start/stop sync on login, refresh settings on pull
- `src/store.ts` — soft-delete in `deleteRecord`, new `reloadSettings` action
- `src/components/*.tsx` — 6 files now filter `deleted` rows out of live queries
- `backend/server.js` — `auth_passwords` table, one-time migration, Postgres-backed password helpers

---

## Next Steps Worth Considering

- **Server-side serial allocation** to eliminate the duplicate-regNo race.
- **Per-user identities** instead of three shared logins — useful for audit
  trail ("who edited this record?").
- **Realtime push** (WebSocket/SSE) to drop the 30 s sync window.
- **Render Starter plan** ($7/mo) once the centre relies on the app daily.
