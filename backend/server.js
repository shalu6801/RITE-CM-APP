/**
 * ─────────────────────────────────────────────────────────────────────────
 *  RITE — OTP / Login backend
 * ─────────────────────────────────────────────────────────────────────────
 *
 *  Endpoints (all JSON):
 *
 *    POST /api/auth/send-otp        { identity }
 *    POST /api/auth/verify-otp      { identity, otp }
 *    POST /api/auth/login-password  { identity, password }
 *    POST /api/auth/reset-password  { identity, otp, newPassword }
 *    GET  /api/auth/whoami          (Authorization: Bearer <jwt>)
 *
 *  OTPs are stored in-memory with a 5-min expiry, single-use, 5-attempt cap.
 *  Passwords are bcrypt-hashed and persisted to passwords.json next to this
 *  file. Sessions are issued as JWTs signed with JWT_SECRET.
 *
 *  When neither GMAIL_APP_PASSWORD nor FAST2SMS_API_KEY is set, the server
 *  drops into "console mode" — it prints OTPs to your terminal instead of
 *  sending them. Great for local development. NEVER ship to production
 *  without a real provider configured.
 */
const express       = require("express");
const cors          = require("cors");
const rateLimit     = require("express-rate-limit");
const jwt           = require("jsonwebtoken");
const bcrypt        = require("bcrypt");
const nodemailer    = require("nodemailer");
const fs            = require("fs");
const path          = require("path");
const crypto        = require("crypto");
const { Pool }      = require("pg");
require("dotenv").config();

// ─── Constants ──────────────────────────────────────────────────────
const ALLOWED_IDENTITIES = new Set([
  "riteeducational@gmail.com",
  "9812828132",
  "9354276055",
]);
const OTP_TTL_MS         = 5 * 60 * 1000;       // 5 minutes
const OTP_MAX_ATTEMPTS   = 5;
const PASSWORD_FILE      = path.join(__dirname, "passwords.json");
const JWT_TTL            = "7d";

// ─── Helpers ────────────────────────────────────────────────────────
function isEmail(s)      { return /@/.test(s); }
function isPhone(s)      { return /^[6-9]\d{9}$/.test(s); }
function normalizeIdentity(s) { return String(s || "").trim().toLowerCase(); }
function generateOtp()   { return String(crypto.randomInt(100000, 1000000)); }   // 6 digits

function loadPasswords() {
  try { return JSON.parse(fs.readFileSync(PASSWORD_FILE, "utf8")); } catch { return {}; }
}
function savePasswords(p) {
  fs.writeFileSync(PASSWORD_FILE, JSON.stringify(p, null, 2));
}

// ─── Providers ──────────────────────────────────────────────────────
const emailReady = !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
const smsReady   = !!process.env.FAST2SMS_API_KEY;
const consoleMode = !emailReady && !smsReady;

if (consoleMode) {
  console.warn("⚠  No provider configured — running in CONSOLE MODE.");
  console.warn("    OTPs will be printed to this terminal. Configure GMAIL_APP_PASSWORD");
  console.warn("    and/or FAST2SMS_API_KEY in backend/.env to enable real delivery.");
}

let mailer = null;
if (emailReady) {
  mailer = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

async function sendEmailOtp(to, otp) {
  if (!mailer) throw new Error("Email provider not configured.");
  await mailer.sendMail({
    from: `RITE CM APP <${process.env.GMAIL_USER}>`,
    to,
    subject: "Your OTP for RITE CM APP",
    text:
      `Your one-time password is ${otp}.\n` +
      `It expires in 5 minutes and can be used only once.\n\n` +
      `If you did not request this, please ignore.`,
    html:
      `<p>Your one-time password is <strong style="font-size:1.4em;letter-spacing:.15em">${otp}</strong>.</p>` +
      `<p>It expires in 5 minutes and can be used only once.</p>` +
      `<p style="color:#888">If you did not request this, please ignore.</p>`,
  });
}

async function sendSmsOtp(phone, otp) {
  if (!smsReady) throw new Error("SMS provider not configured.");
  const params = new URLSearchParams({
    authorization: process.env.FAST2SMS_API_KEY,
    sender_id: process.env.FAST2SMS_SENDER_ID || "FSTSMS",
    message: `Your RITE CM APP OTP is ${otp}. Valid for 5 minutes. Do not share.`,
    language: "english",
    route: "q",
    numbers: phone,
  });
  const res = await fetch(`https://www.fast2sms.com/dev/bulkV2?${params}`);
  const json = await res.json();
  if (!json.return) throw new Error("Fast2SMS error: " + JSON.stringify(json));
}

async function dispatchOtp(identity, otp) {
  if (consoleMode) {
    console.log(`\n  📨  OTP for ${identity}  →  ${otp}\n`);
    return { channel: "console" };
  }
  if (isEmail(identity)) {
    if (!emailReady) { console.log(`(no email provider) ${identity} → ${otp}`); return { channel: "console" }; }
    await sendEmailOtp(identity, otp);
    return { channel: "email" };
  }
  if (isPhone(identity)) {
    if (!smsReady) { console.log(`(no sms provider) ${identity} → ${otp}`); return { channel: "console" }; }
    await sendSmsOtp(identity, otp);
    return { channel: "sms" };
  }
  throw new Error("Unrecognised identity format.");
}

// ─── Postgres (records sync) ────────────────────────────────────────
const dbReady = !!process.env.DATABASE_URL;
const pool = dbReady
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: /render\.com|amazonaws|sslmode=require/i.test(process.env.DATABASE_URL || "")
        ? { rejectUnauthorized: false }
        : false,
    })
  : null;

// Frontend table name (camelCase, JSON key) → SQL table name.
const SYNC_TABLES = {
  students:     "students",
  settings:     "settings",
  courses:      "courses",
  simpleMaster: "simple_master",
};

async function initSchema() {
  if (!dbReady) {
    console.warn("⚠  DATABASE_URL not set — /api/sync/* will return 503 (auth still works).");
    console.warn("    Passwords will be read from passwords.json (development only).");
    return;
  }
  for (const table of Object.values(SYNC_TABLES)) {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${table} (
        sync_id    TEXT PRIMARY KEY,
        data       JSONB NOT NULL,
        updated_at BIGINT NOT NULL,
        deleted    BOOLEAN NOT NULL DEFAULT FALSE
      )
    `);
    await pool.query(
      `CREATE INDEX IF NOT EXISTS ${table}_updated_at_idx ON ${table}(updated_at)`
    );
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_passwords (
      identity   TEXT PRIMARY KEY,
      hash       TEXT NOT NULL,
      updated_at BIGINT NOT NULL
    )
  `);
  // One-time best-effort migration: if the legacy passwords.json file exists
  // next to this server and the auth_passwords table is empty, lift its rows
  // into Postgres so users don't get locked out after the first deploy.
  try {
    const r = await pool.query("SELECT COUNT(*)::int AS n FROM auth_passwords");
    if (r.rows[0].n === 0 && fs.existsSync(PASSWORD_FILE)) {
      const legacy = loadPasswords();
      const now = Date.now();
      for (const [identity, rec] of Object.entries(legacy)) {
        if (!rec || !rec.hash) continue;
        await pool.query(
          `INSERT INTO auth_passwords (identity, hash, updated_at) VALUES ($1, $2, $3)
           ON CONFLICT (identity) DO NOTHING`,
          [identity, rec.hash, rec.updatedAt || now],
        );
      }
      console.log(`  ✅  Migrated ${Object.keys(legacy).length} password(s) from passwords.json into Postgres.`);
    }
  } catch (err) {
    console.warn("⚠  passwords.json migration skipped:", err.message);
  }
  console.log(`  ✅  Postgres ready — ${Object.keys(SYNC_TABLES).length} sync tables + auth_passwords.`);
}

// ─── Password storage (Postgres in prod, JSON file in dev) ──────────
async function getPasswordRecord(identity) {
  if (dbReady) {
    const r = await pool.query("SELECT hash FROM auth_passwords WHERE identity = $1", [identity]);
    return r.rows[0] ? { hash: r.rows[0].hash } : null;
  }
  const all = loadPasswords();
  return all[identity] || null;
}
async function setPasswordRecord(identity, hash) {
  if (dbReady) {
    await pool.query(
      `INSERT INTO auth_passwords (identity, hash, updated_at) VALUES ($1, $2, $3)
       ON CONFLICT (identity) DO UPDATE
         SET hash = EXCLUDED.hash, updated_at = EXCLUDED.updated_at`,
      [identity, hash, Date.now()],
    );
    return;
  }
  const all = loadPasswords();
  all[identity] = { hash, updatedAt: Date.now() };
  savePasswords(all);
}

// ─── OTP store (in-memory) ──────────────────────────────────────────
const otpStore = new Map();   // identity → { hash, expiry, attempts }

function setOtp(identity, otp) {
  otpStore.set(identity, {
    hash: bcrypt.hashSync(otp, 8),
    expiry: Date.now() + OTP_TTL_MS,
    attempts: 0,
  });
}
function consumeOtp(identity, otp) {
  const rec = otpStore.get(identity);
  if (!rec) return { ok: false, reason: "no_otp" };
  if (Date.now() > rec.expiry) { otpStore.delete(identity); return { ok: false, reason: "expired" }; }
  if (rec.attempts >= OTP_MAX_ATTEMPTS) { otpStore.delete(identity); return { ok: false, reason: "too_many_attempts" }; }
  rec.attempts += 1;
  if (!bcrypt.compareSync(String(otp), rec.hash)) return { ok: false, reason: "wrong_otp" };
  otpStore.delete(identity);   // single use
  return { ok: true };
}

// ─── App ────────────────────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: "16kb" }));
app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:5173", credentials: false }));

const otpLimiter = rateLimit({ windowMs: 5 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false });
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });

function requireAllowed(req, res) {
  const id = normalizeIdentity(req.body && req.body.identity);
  if (!id || !ALLOWED_IDENTITIES.has(id)) {
    res.status(403).json({ ok: false, error: "Identity not allowed." });
    return null;
  }
  return id;
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token  = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return res.status(401).json({ ok: false, error: "missing_token" });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "dev-secret");
    req.identity = payload.sub;
    next();
  } catch {
    res.status(401).json({ ok: false, error: "invalid_token" });
  }
}

function requireDb(_req, res, next) {
  if (!dbReady) return res.status(503).json({ ok: false, error: "database_not_configured" });
  next();
}

// ─── Routes ─────────────────────────────────────────────────────────
app.post("/api/auth/send-otp", otpLimiter, async (req, res) => {
  const identity = requireAllowed(req, res); if (!identity) return;
  const otp = generateOtp();
  setOtp(identity, otp);
  try {
    const result = await dispatchOtp(identity, otp);
    res.json({ ok: true, channel: result.channel });
  } catch (err) {
    otpStore.delete(identity);
    res.status(502).json({ ok: false, error: "Could not deliver OTP. " + err.message });
  }
});

app.post("/api/auth/verify-otp", loginLimiter, (req, res) => {
  const identity = requireAllowed(req, res); if (!identity) return;
  const { otp } = req.body || {};
  const r = consumeOtp(identity, otp);
  if (!r.ok) return res.status(400).json({ ok: false, error: r.reason });
  const token = jwt.sign({ sub: identity }, process.env.JWT_SECRET || "dev-secret", { expiresIn: JWT_TTL });
  res.json({ ok: true, token, identity });
});

app.post("/api/auth/login-password", loginLimiter, async (req, res) => {
  const identity = requireAllowed(req, res); if (!identity) return;
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ ok: false, error: "missing_password" });
  const rec = await getPasswordRecord(identity);
  if (!rec) return res.status(400).json({ ok: false, error: "no_password_set" });
  const ok = await bcrypt.compare(String(password), rec.hash);
  if (!ok) return res.status(400).json({ ok: false, error: "wrong_password" });
  const token = jwt.sign({ sub: identity }, process.env.JWT_SECRET || "dev-secret", { expiresIn: JWT_TTL });
  res.json({ ok: true, token, identity });
});

app.post("/api/auth/reset-password", loginLimiter, async (req, res) => {
  const identity = requireAllowed(req, res); if (!identity) return;
  const { otp, newPassword } = req.body || {};
  if (!newPassword || String(newPassword).length < 6) {
    return res.status(400).json({ ok: false, error: "weak_password" });
  }
  const r = consumeOtp(identity, otp);
  if (!r.ok) return res.status(400).json({ ok: false, error: r.reason });
  const hash = await bcrypt.hash(String(newPassword), 10);
  await setPasswordRecord(identity, hash);
  const token = jwt.sign({ sub: identity }, process.env.JWT_SECRET || "dev-secret", { expiresIn: JWT_TTL });
  res.json({ ok: true, token, identity });
});

app.get("/api/auth/whoami", (req, res) => {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return res.status(401).json({ ok: false });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "dev-secret");
    res.json({ ok: true, identity: payload.sub });
  } catch {
    res.status(401).json({ ok: false });
  }
});

// ─── Sync routes (records, settings, courses, master) ──────────────
// Larger body limit here — records contain base64 photos.
const syncJson = express.json({ limit: "20mb" });

app.get("/api/sync/pull", requireAuth, requireDb, async (req, res) => {
  const since = Number(req.query.since) || 0;
  const out = { serverTime: Date.now() };
  try {
    for (const [key, table] of Object.entries(SYNC_TABLES)) {
      const r = await pool.query(
        `SELECT sync_id, data, updated_at, deleted FROM ${table} WHERE updated_at > $1`,
        [since],
      );
      out[key] = r.rows.map((row) => ({
        syncId:    row.sync_id,
        data:      row.data,
        updatedAt: Number(row.updated_at),
        deleted:   row.deleted,
      }));
    }
    res.json({ ok: true, ...out });
  } catch (err) {
    console.error("sync/pull failed:", err);
    res.status(500).json({ ok: false, error: "pull_failed" });
  }
});

app.post("/api/sync/push", requireAuth, requireDb, syncJson, async (req, res) => {
  const body = req.body || {};
  let applied = 0, skipped = 0;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const [key, table] of Object.entries(SYNC_TABLES)) {
      const items = Array.isArray(body[key]) ? body[key] : [];
      for (const item of items) {
        if (!item || typeof item.syncId !== "string" || typeof item.updatedAt !== "number") {
          skipped++; continue;
        }
        const r = await client.query(
          `INSERT INTO ${table} (sync_id, data, updated_at, deleted)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (sync_id) DO UPDATE
             SET data       = EXCLUDED.data,
                 updated_at = EXCLUDED.updated_at,
                 deleted    = EXCLUDED.deleted
             WHERE EXCLUDED.updated_at >= ${table}.updated_at`,
          [item.syncId, item.data ?? {}, item.updatedAt, !!item.deleted],
        );
        if (r.rowCount > 0) applied++; else skipped++;
      }
    }
    await client.query("COMMIT");
    res.json({ ok: true, applied, skipped, serverTime: Date.now() });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("sync/push failed:", err);
    res.status(500).json({ ok: false, error: "push_failed" });
  } finally {
    client.release();
  }
});

app.get("/api/health", (_req, res) =>
  res.json({ ok: true, mode: consoleMode ? "console" : "live", db: dbReady })
);

const PORT = Number(process.env.PORT) || 4000;
(async () => {
  try { await initSchema(); }
  catch (err) { console.error("⚠  initSchema failed:", err.message); }
  app.listen(PORT, () => {
    console.log(`\n  ✅  RITE auth backend listening on http://localhost:${PORT}`);
    console.log(`     Allowed identities: ${[...ALLOWED_IDENTITIES].join(", ")}\n`);
  });
})();
