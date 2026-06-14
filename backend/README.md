# RITE Auth Backend

A tiny Node.js + Express service that powers the **OTP + password login** for
the RITE Document Studio frontend. It runs **alongside** the existing Vite app
on a separate port.

```
┌───────────────────────────┐         ┌─────────────────────────────┐
│  Frontend (Vite, :5173)   │  HTTPS  │  Auth backend (Express :4000)│
│  src/components/LoginPage │  ────▶  │  /api/auth/send-otp          │
│  src/auth.ts (client)     │         │  /api/auth/verify-otp        │
│                           │         │  /api/auth/login-password    │
│                           │         │  /api/auth/reset-password    │
└───────────────────────────┘         └─────────────────────────────┘
                                          │            │
                                       Nodemailer   Fast2SMS
                                       (Gmail SMTP)  (SMS API)
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

## 2 · Allowed identities (hardcoded — only these can log in)

| Identity                     | Channel |
|------------------------------|---------|
| `riteeducational@gmail.com`  | Email   |
| `9812828132`                 | SMS     |
| `9354276055`                 | SMS     |

Anything else is rejected with `403`.

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

### `GMAIL_USER` + `GMAIL_APP_PASSWORD` — Gmail SMTP (email OTP)

1. Sign in to <https://myaccount.google.com/security> and enable **2-step verification**.
2. Open <https://myaccount.google.com/apppasswords>.
3. Create an app password named "RITE Studio". Copy the 16-character password.
4. Put your Gmail address into `GMAIL_USER` and the app password into `GMAIL_APP_PASSWORD` (no spaces).

### `FAST2SMS_API_KEY` + `FAST2SMS_SENDER_ID` — Fast2SMS (SMS OTP)

1. Sign up at <https://www.fast2sms.com/> and verify your account.
2. **Dev API** → copy your **Authorization Key** → paste into `FAST2SMS_API_KEY`.
3. **Sender ID** — leave as `FSTSMS` for Quick-SMS (no DLT registration), or
   put your own 6-character DLT-approved sender id once approved.

---

## 4 · Console-mode (no provider keys)

If you leave **both** `GMAIL_APP_PASSWORD` **and** `FAST2SMS_API_KEY` blank, the
backend runs in **console mode**: it prints the OTP to its terminal instead of
sending it. This lets you test the full login flow without obtaining any
provider keys.

You'll see lines like:

```
  📨  OTP for riteeducational@gmail.com  →  493012
```

The frontend's login page also tells you when an OTP went to the console.

---

## 5 · API

All endpoints accept and return JSON.

### `POST /api/auth/send-otp`
```json
{ "identity": "riteeducational@gmail.com" }
```
→ `{ ok: true, channel: "email" | "sms" | "console" }`

### `POST /api/auth/verify-otp`
```json
{ "identity": "9812828132", "otp": "493012" }
```
→ `{ ok: true, token: "<jwt>", identity: "9812828132" }`

### `POST /api/auth/login-password`
```json
{ "identity": "riteeducational@gmail.com", "password": "yourpassword" }
```
→ `{ ok: true, token: "<jwt>", identity: "…" }`

### `POST /api/auth/reset-password`
```json
{ "identity": "9354276055", "otp": "493012", "newPassword": "newpass" }
```
→ `{ ok: true, token: "<jwt>", identity: "…" }` (verifies OTP, sets/replaces password)

### `GET /api/auth/whoami`
Header: `Authorization: Bearer <jwt>`
→ `{ ok: true, identity: "…" }` or `401`.

---

## 6 · Security

- **OTP**: 6 digits, single use, 5-minute TTL, 5 attempts per OTP.
- **Rate limit**: `/send-otp` capped at 5 per 5 min per IP; `/verify-otp`,
  `/login-password`, `/reset-password` capped at 20 per 15 min per IP.
- **Passwords**: bcrypt (cost 10), persisted to `passwords.json` (gitignored).
- **Sessions**: JWT signed with `JWT_SECRET`, 7-day TTL.
- The backend NEVER returns OTPs in API responses.

---

## 7 · Deployment

The frontend reads the backend URL from the `VITE_AUTH_API` env var at build
time. To point production to a different backend host, set:

```
VITE_AUTH_API=https://auth.your-domain.com
```

Then `npm run build` in the frontend folder.

Otherwise, both the frontend and backend can sit on the same machine — the
frontend talks to `http://localhost:4000` by default.
