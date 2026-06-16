/**
 * ─────────────────────────────────────────────────────────────────────────
 *  RITE — Email + Password authentication backend
 * ─────────────────────────────────────────────────────────────────────────
 *
 *  Endpoints (all JSON):
 *
 *    POST /api/auth/register        { email, password }
 *    POST /api/auth/login           { email, password }
 *    GET  /api/auth/whoami          (Authorization: Bearer <jwt>)
 *
 *  Passwords are bcrypt-hashed and persisted to Postgres (auth_passwords
 *  table) when DATABASE_URL is set, otherwise to passwords.json next to this
 *  file (development only). Sessions are issued as JWTs signed with
 *  JWT_SECRET and live for 7 days.
 */
const express       = require("express");
const cors          = require("cors");
const rateLimit     = require("express-rate-limit");
const jwt           = require("jsonwebtoken");
const bcrypt        = require("bcrypt");
const fs            = require("fs");
const path          = require("path");
const { Pool }      = require("pg");
require("dotenv").config();

// ─── Constants ──────────────────────────────────────────────────────
const PASSWORD_FILE      = path.join(__dirname, "passwords.json");
const JWT_TTL            = "7d";
const MIN_PASSWORD_LEN   = 6;
const BCRYPT_ROUNDS      = 10;

// ─── Helpers ────────────────────────────────────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isEmail(s) { return EMAIL_RE.test(String(s || "")); }
function normalizeEmail(s) { return String(s || "").trim().toLowerCase(); }

function loadPasswords() {
  try { return JSON.parse(fs.readFileSync(PASSWORD_FILE, "utf8")); } catch { return {}; }
}
function savePasswords(p) {
  fs.writeFileSync(PASSWORD_FILE, JSON.stringify(p, null, 2));
}

// ─── Postgres (records sync + passwords) ────────────────────────────
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
async function getPasswordRecord(email) {
  if (dbReady) {
    const r = await pool.query("SELECT hash FROM auth_passwords WHERE identity = $1", [email]);
    return r.rows[0] ? { hash: r.rows[0].hash } : null;
  }
  const all = loadPasswords();
  return all[email] || null;
}
async function setPasswordRecord(email, hash) {
  if (dbReady) {
    await pool.query(
      `INSERT INTO auth_passwords (identity, hash, updated_at) VALUES ($1, $2, $3)
       ON CONFLICT (identity) DO UPDATE
         SET hash = EXCLUDED.hash, updated_at = EXCLUDED.updated_at`,
      [email, hash, Date.now()],
    );
    return;
  }
  const all = loadPasswords();
  all[email] = { hash, updatedAt: Date.now() };
  savePasswords(all);
}

// ─── App ────────────────────────────────────────────────────────────
const app = express();
// Render / most cloud hosts terminate TLS at an edge proxy and pass the real
// client IP via X-Forwarded-For. Tell Express to trust the first hop so
// express-rate-limit can key on the real IP instead of throwing
// ERR_ERL_UNEXPECTED_X_FORWARDED_FOR.
app.set("trust proxy", 1);
app.use(express.json({ limit: "16kb" }));
app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:5173", credentials: false }));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });

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

function signToken(email) {
  return jwt.sign({ sub: email }, process.env.JWT_SECRET || "dev-secret", { expiresIn: JWT_TTL });
}

// ─── Auth routes ────────────────────────────────────────────────────
app.post("/api/auth/register", authLimiter, async (req, res) => {
  const email = normalizeEmail(req.body && req.body.email);
  const { password } = req.body || {};
  if (!email || !isEmail(email)) return res.status(400).json({ ok: false, error: "invalid_email" });
  if (!password) return res.status(400).json({ ok: false, error: "missing_password" });
  if (String(password).length < MIN_PASSWORD_LEN) {
    return res.status(400).json({ ok: false, error: "weak_password" });
  }
  try {
    const existing = await getPasswordRecord(email);
    if (existing) return res.status(409).json({ ok: false, error: "email_already_exists" });
    const hash = await bcrypt.hash(String(password), BCRYPT_ROUNDS);
    await setPasswordRecord(email, hash);
    const token = signToken(email);
    res.json({ ok: true, token, identity: email });
  } catch (err) {
    console.error("register failed:", err);
    res.status(500).json({ ok: false, error: "register_failed" });
  }
});

app.post("/api/auth/login", authLimiter, async (req, res) => {
  const email = normalizeEmail(req.body && req.body.email);
  const { password } = req.body || {};
  if (!email || !isEmail(email)) return res.status(400).json({ ok: false, error: "invalid_email" });
  if (!password) return res.status(400).json({ ok: false, error: "missing_password" });
  try {
    const rec = await getPasswordRecord(email);
    if (!rec) return res.status(400).json({ ok: false, error: "user_not_found" });
    const ok = await bcrypt.compare(String(password), rec.hash);
    if (!ok) return res.status(400).json({ ok: false, error: "wrong_password" });
    const token = signToken(email);
    res.json({ ok: true, token, identity: email });
  } catch (err) {
    console.error("login failed:", err);
    res.status(500).json({ ok: false, error: "login_failed" });
  }
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
  res.json({ ok: true, db: dbReady })
);

const PORT = Number(process.env.PORT) || 4000;
(async () => {
  try { await initSchema(); }
  catch (err) { console.error("⚠  initSchema failed:", err.message); }
  app.listen(PORT, () => {
    console.log(`\n  ✅  RITE auth backend listening on http://localhost:${PORT}\n`);
  });
})();
