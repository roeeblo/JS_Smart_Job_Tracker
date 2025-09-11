// server/index.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");
const multer = require("multer");
const { parse } = require("csv-parse");

// fetch shim ל-Node < 18
const fetch =
  global.fetch ||
  ((...args) => import("node-fetch").then(({ default: f }) => f(...args)));

const {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} = require("./jwt");

const app = express();

/* =======================
   CORS
   ======================= */
const rawOrigins =
  process.env.CORS_ORIGIN ||
  "http://localhost:5173,http://127.0.0.1:5173,http://sjt.local,http://localhost:3000";
const allowlist = rawOrigins.split(",").map((s) => s.trim()).filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (allowlist.includes(origin)) return cb(null, true);
      return cb(new Error(`Not allowed by CORS: ${origin}`));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);
app.use(express.json());

/* =======================
   DB
   ======================= */
const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  database: process.env.DB_NAME || "smart_job_tracker",
  max: 10,
  connectionTimeoutMillis: 2000,
});

async function ensureSchema() {
  try {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id text;`);
  } catch {}
  try {
    await pool.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_key ON users(google_id) WHERE google_id IS NOT NULL;`
    );
  } catch {}
}
ensureSchema().catch((e) => console.error("ensureSchema error:", e));

async function isDbHealthy(timeoutMs = 1500) {
  try {
    await Promise.race([
      pool.query("SELECT 1"),
      new Promise((_, rej) => setTimeout(() => rej(new Error("db timeout")), timeoutMs)),
    ]);
    return true;
  } catch {
    return false;
  }
}

/* =======================
   Auth middleware
   ======================= */
function requireAuth(req, res, next) {
  const auth = req.headers["authorization"] || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: "No token" });
  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.uid;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

/* =======================
   Health
   ======================= */
app.get("/health", async (_req, res) => {
  const dbOk = await isDbHealthy();
  res.json({ ok: true, db: dbOk });
});

/* =======================
   GOOGLE OAUTH (STATELESS)
   ======================= */
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const CLIENT_URL = (process.env.CLIENT_URL || "http://localhost:5173").replace(/\/$/, "");

// נשתמש ב-ENV אם הוגדר; אחרת נבנה דינאמית מהבקשה (מביא יציבות גם כשעובדים על פורטים/דומיינים שונים מקומית)
function getRedirectUri(req) {
  const fromEnv = (process.env.GOOGLE_REDIRECT_URI || "").trim();
  return fromEnv || `${req.protocol}://${req.get("host")}/auth/google/callback`;
}

const STATE_SIGNING_SECRET =
  process.env.OAUTH_STATE_SECRET || process.env.REFRESH_TOKEN_SECRET || "change-me-state";

function signState(payload = {}) {
  const data = { n: crypto.randomBytes(8).toString("hex"), ...payload };
  return jwt.sign(data, STATE_SIGNING_SECRET, {
    expiresIn: "10m",
    issuer: "sjt-api",
    audience: "google-oauth",
  });
}

function verifyState(token) {
  return jwt.verify(token, STATE_SIGNING_SECRET, {
    issuer: "sjt-api",
    audience: "google-oauth",
  });
}

function buildGoogleAuthURL(redirectUri, state) {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "select_account",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// התחלת OAuth
app.get("/auth/google", (req, res) => {
  const redirectUri = getRedirectUri(req);
  const state = signState({ r: "login" });
  const url = buildGoogleAuthURL(redirectUri, state);
  res.redirect(url);
});

// חזרת OAuth
app.get("/auth/google/callback", async (req, res) => {
  try {
    const { code, state, error, error_description } = req.query || {};

    // אם גוגל מחזירה שגיאה—נחזיר אותה כמו שהיא, כדי שתדע מה לא תקין (client id, redirect uri וכו')
    if (error) {
      return res
        .status(400)
        .send(`Google OAuth error: ${error}${error_description ? " - " + error_description : ""}`);
    }

    if (!code || !state) {
      console.error("OAuth callback missing params:", req.originalUrl);
      return res.status(400).send("Missing code/state");
    }

    // אימות state (JWT ללא קוקיז)
    try {
      verifyState(String(state));
    } catch (e) {
      return res.status(400).send("OAuth state invalid");
    }

    const redirectUri = getRedirectUri(req);

    // החלפת code לטוקנים
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: String(code),
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri, // חייב להיות זהה בדיוק למה ששימש בשלב הראשון
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const txt = await tokenRes.text();
      console.error("token exchange failed:", txt);
      return res.status(401).send("Google token exchange failed");
    }
    const tokens = await tokenRes.json(); // { id_token, access_token, ... }

    // אימות id_token
    const infoRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tokens.id_token)}`
    );
    if (!infoRes.ok) return res.status(401).send("Invalid Google id_token");
    const info = await infoRes.json();

    if (info.email_verified !== "true" && info.email_verified !== true) {
      return res.status(403).send("Google email not verified");
    }

    const googleId = info.sub;
    const email = info.email;
    const name = info.name || email.split("@")[0];

    // upsert משתמש
    let userRow;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const byGoogle = await client.query("SELECT * FROM users WHERE google_id = $1", [googleId]);
      if (byGoogle.rows[0]) {
        userRow = byGoogle.rows[0];
      } else {
        const byEmail = await client.query("SELECT * FROM users WHERE email = $1", [email]);
        if (byEmail.rows[0]) {
          const upd = await client.query(
            `UPDATE users
               SET google_id = $1,
                   name = COALESCE(NULLIF(name, ''), $2)
             WHERE id = $3
           RETURNING *`,
            [googleId, name, byEmail.rows[0].id]
          );
          userRow = upd.rows[0];
        } else {
          const ins = await client.query(
            `INSERT INTO users (name, email, google_id)
             VALUES ($1,$2,$3)
           RETURNING *`,
            [name, email, googleId]
          );
          userRow = ins.rows[0];
        }
      }

      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }

    const accessToken = signAccessToken({ uid: userRow.id });
    const refreshToken = signRefreshToken({ uid: userRow.id });

    // מחזירים ל־SPA עם hash
    const redirect = new URL(`${CLIENT_URL}/oauth/callback`);
    redirect.hash = new URLSearchParams({
      accessToken,
      refreshToken,
      name: userRow.name || "",
      email: userRow.email || "",
    }).toString();

    res.redirect(redirect.toString());
  } catch (e) {
    console.error("OAuth callback error:", e);
    res.status(500).send("Auth error");
  }
});

// יציאה לוגית (קליינט מוחק לוקאלית)
app.post("/auth/logout", (_req, res) => res.json({ ok: true }));

/* =======================
   JWT utils
   ======================= */
app.post("/refresh", (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) return res.status(400).json({ error: "refreshToken required" });
  try {
    const payload = verifyRefreshToken(refreshToken);
    const accessToken = signAccessToken({ uid: payload.uid });
    res.json({ accessToken });
  } catch {
    return res.status(401).json({ error: "Invalid refresh token" });
  }
});

app.get("/profile", requireAuth, (req, res) => {
  res.json({ message: "Protected route", userId: req.userId });
});

/* =======================
   Jobs CRUD + Imports (ללא שינוי לוגי)
   ======================= */
app.get("/jobs", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, user_id, company, role, status, source, location, notes
         FROM job_applications
        WHERE user_id = $1
     ORDER BY id DESC`,
      [req.userId]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/jobs", requireAuth, async (req, res) => {
  const { company, role, status, source, location, notes } = req.body || {};
  if (!company || !role) return res.status(400).json({ error: "company and role are required" });
  try {
    const { rows } = await pool.query(
      `INSERT INTO job_applications (user_id, company, role, status, source, location, notes)
       VALUES ($1,$2,$3,COALESCE($4,'applied'),$5,$6,$7)
   RETURNING id, user_id, company, role, status, source, location, notes`,
      [req.userId, company, role, status || null, source || null, location || null, notes || null]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put("/jobs/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const fields = ["company", "role", "status", "source", "location", "notes"];
  const updates = [];
  const values = [];
  fields.forEach((f) => {
    if (f in req.body) {
      updates.push(`${f}=$${updates.length + 3}`);
      values.push(req.body[f]);
    }
  });
  if (updates.length === 0) return res.status(400).json({ error: "No fields to update" });

  try {
    const q = `UPDATE job_applications SET ${updates.join(", ")} WHERE id=$1 AND user_id=$2
               RETURNING id, user_id, company, role, status, source, location, notes`;
    const { rows } = await pool.query(q, [id, req.userId, ...values]);
    if (!rows[0]) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/jobs/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  try {
    const { rowCount } = await pool.query(
      "DELETE FROM job_applications WHERE id=$1 AND user_id=$2",
      [id, req.userId]
    );
    if (!rowCount) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const allowedStatuses = new Set([
  "applied",
  "interview",
  "test",
  "home test",
  "test 2",
  "offer",
  "accepted",
  "rejected",
]);

app.post("/import/json", requireAuth, async (req, res) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!items.length) return res.status(400).json({ error: "items array is required" });

    const normalized = items
      .map((r) => ({
        company: (r.company || "").toString().trim(),
        role: (r.role || "").toString().trim(),
        status: ((r.status || "applied") + "").toLowerCase().trim(),
        source: (r.source || "LinkedIn").toString().trim(),
        location: (r.location || "").toString().trim(),
        notes: (r.notes || "").toString().trim(),
      }))
      .filter((r) => r.company && r.role);

    if (!normalized.length) return res.status(400).json({ error: "no valid items" });

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      let inserted = 0;
      const insertedItems = [];
      for (const r of normalized) {
        const status = allowedStatuses.has(r.status) ? r.status : "applied";
        const { rows: one } = await client.query(
          `INSERT INTO job_applications (user_id, company, role, status, source, location, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, user_id, company, role, status, source, location, notes`,
          [req.userId, r.company, r.role, status, r.source || null, r.location || null, r.notes || null]
        );
        inserted++;
        insertedItems.push(one[0]);
      }
      await client.query("COMMIT");
      return res.json({ ok: true, inserted, insertedItems });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/import/csv", requireAuth, upload.single("file"), async (req, res) => {
  if (!req.file)
    return res.status(400).json({ error: 'file is required (multipart/form-data, field name "file")' });

  try {
    const text = req.file.buffer.toString("utf8");
    const rows = [];
    await new Promise((resolve, reject) => {
      parse(text, { columns: true, skip_empty_lines: true, trim: true, bom: true })
        .on("data", (record) => rows.push(record))
        .on("end", resolve)
        .on("error", reject);
    });

    if (!rows.length) return res.status(400).json({ error: "CSV has no rows" });

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      let inserted = 0;
      const items = [];
      for (const r of rows) {
        const company = r.company?.toString().trim();
        const role = r.role?.toString().trim();
        if (!company || !role) continue;

        const status = (r.status || "applied").toString().trim().toLowerCase();
        const safeStatus = allowedStatuses.has(status) ? status : "applied";
        const source = r.source?.toString().trim() || null;
        const location = r.location?.toString().trim() || null;
        const notes = r.notes?.toString() || null;

        const { rows: one } = await client.query(
          `INSERT INTO job_applications (user_id, company, role, status, source, location, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, user_id, company, role, status, source, location, notes`,
          [req.userId, company, role, safeStatus, source, location, notes]
        );
        items.push(one[0]);
        inserted++;
      }
      await client.query("COMMIT");
      res.json({ ok: true, inserted, items });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* =======================
   Start
   ======================= */
const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log(`API on http://localhost:${port}`));
