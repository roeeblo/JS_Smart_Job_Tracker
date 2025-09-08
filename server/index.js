// server/index.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const { parse } = require("csv-parse");
const crypto = require("crypto");

const {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} = require("./jwt");

const { sendVerificationEmail } = require("./mailer");

const app = express();

/* =======================
   CORS
   ======================= */
const rawOrigins =
  process.env.CORS_ORIGIN ||
  "http://sjt.local,http://localhost:3000,http://localhost:5173";

const allowlist = rawOrigins
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    if (allowlist.includes(origin)) return cb(null, true);
    return cb(new Error(`Not allowed by CORS: ${origin}`));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json());

/* =======================
   Database
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
   Users (list for debug)
   ======================= */
app.get("/users", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, name, email, email_verified FROM users ORDER BY id DESC"
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* =======================
   Helpers: verification
   ======================= */
function newVerifyToken() {
  return crypto.randomBytes(32).toString("hex");
}

async function issueAndSendVerification(user) {
  const token = newVerifyToken();
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24h
  const { rows } = await pool.query(
    "UPDATE users SET verify_token=$1, verify_expires=$2 WHERE id=$3 RETURNING id,email",
    [token, expires.toISOString(), user.id]
  );
  const base = process.env.VERIFY_BASE_URL || "http://localhost:4000";
  const link = `${base}/verify?token=${encodeURIComponent(token)}`;
  await sendVerificationEmail(user.email, link);
  return rows[0];
}

/* =======================
   Register
   ======================= */
app.post("/users", async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: "name, email, password required" });
  }
  try {
    const password_hash = await bcrypt.hash(String(password), 10);
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash, email_verified)
       VALUES ($1, $2, $3, false)
       RETURNING id, name, email, email_verified`,
      [name, email, password_hash]
    );
    const user = rows[0];

    // שליחת מייל אימות
    try {
      await issueAndSendVerification(user);
    } catch (e) {
      console.error("Failed to send verification email:", e.message);
      // ממשיכים — המשתמש קיים, רק המייל נכשל; נקשר קישור בלוג.
    }

    res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
      message: "Registration successful. Please verify your email.",
    });
  } catch (e) {
    if (e.code === "23505") return res.status(409).json({ error: "Email already exists" });
    res.status(500).json({ error: e.message });
  }
});

/* =======================
   Verify link + resend
   ======================= */
app.get("/verify", async (req, res) => {
  const token = (req.query.token || "").toString();
  if (!token) return res.status(400).send("Missing token");

  try {
    const { rows } = await pool.query(
      `SELECT id, verify_expires, email_verified
         FROM users
        WHERE verify_token = $1`,
      [token]
    );
    const user = rows[0];
    if (!user) return res.status(400).send("Invalid token");

    if (user.email_verified) {
      // כבר מאומת — ננקה טוקן כדי לא לשמר אותו
      await pool.query(
        "UPDATE users SET verify_token=NULL, verify_expires=NULL WHERE id=$1",
        [user.id]
      );
      const redirect = (process.env.CLIENT_URL || "http://localhost:5173") + "/login?verified=1";
      return res.redirect(302, redirect);
    }

    const exp = user.verify_expires ? new Date(user.verify_expires) : null;
    if (!exp || exp.getTime() < Date.now()) {
      return res.status(400).send("Verification link expired. Please request a new one.");
    }

    await pool.query(
      "UPDATE users SET email_verified=true, verify_token=NULL, verify_expires=NULL WHERE id=$1",
      [user.id]
    );

    const redirect = (process.env.CLIENT_URL || "http://localhost:5173") + "/login?verified=1";
    return res.redirect(302, redirect);
  } catch (e) {
    console.error("Verify error:", e);
    return res.status(500).send("Server error");
  }
});

app.post("/verify/resend", async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: "email required" });

  try {
    const { rows } = await pool.query(
      "SELECT id, email, email_verified FROM users WHERE email=$1",
      [email]
    );
    const user = rows[0];
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.email_verified) {
      return res.json({ ok: true, message: "Already verified" });
    }

    await issueAndSendVerification(user);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* =======================
   Auth (login / refresh / profile)
   ======================= */
app.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "email and password required" });
  try {
    const { rows } = await pool.query("SELECT * FROM users WHERE email=$1", [email]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(String(password), user.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    if (!user.email_verified) {
      return res.status(403).json({ error: "Email not verified" });
    }

    const accessToken = signAccessToken({ uid: user.id });
    const refreshToken = signRefreshToken({ uid: user.id });

    res.json({
      user: { id: user.id, name: user.name, email: user.email },
      accessToken,
      refreshToken,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

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

app.get("/profile", (req, res) => {
  const auth = req.headers["authorization"] || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: "No token" });
  try {
    const payload = verifyAccessToken(token);
    res.json({ message: "Protected route", userId: payload.uid });
  } catch (err) {
    console.error("JWT verify error:", err.message);
    res.status(401).json({ error: "Invalid token" });
  }
});

/* =======================
   Jobs CRUD
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
  if (!company || !role) {
    return res.status(400).json({ error: "company and role are required" });
  }
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

/* =======================
   Import CSV/JSON (כמו שהיה)
   ======================= */
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

app.post("/import/json", requireAuth, async (req, res) => {
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

    if (!normalized.length) {
      return res.status(400).json({ error: "no valid items (missing company/role)" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const existing = new Map();
      {
        const { rows } = await client.query(
          `SELECT company, role, COALESCE(NULLIF(notes,''),'') AS notes
             FROM job_applications
            WHERE user_id = $1`,
          [req.userId]
        );
        for (const r of rows) {
          const keyCR = `${r.company.toLowerCase()}|${r.role.toLowerCase()}`;
          existing.set(`CR|${keyCR}`, true);
          if (r.notes) existing.set(`N|${r.notes}`, true);
        }
      }

      let inserted = 0;
      let skipped = 0;
      const insertedItems = [];
      const skippedItems = [];

      for (const r of normalized) {
        const status = allowedStatuses.has(r.status) ? r.status : "applied";
        const keyCR = `CR|${r.company.toLowerCase()}|${r.role.toLowerCase()}`;
        const keyN = r.notes ? `N|${r.notes}` : null;

        if (existing.has(keyCR) || (keyN && existing.has(keyN))) {
          skipped++;
          skippedItems.push({ reason: "duplicate", item: r });
          continue;
        }

        const { rows: one } = await client.query(
          `INSERT INTO job_applications (user_id, company, role, status, source, location, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           RETURNING id, user_id, company, role, status, source, location, notes`,
          [req.userId, r.company, r.role, status, r.source || null, r.location || null, r.notes || null]
        );

        existing.set(keyCR, true);
        if (keyN) existing.set(keyN, true);

        inserted++;
        insertedItems.push(one[0]);
      }

      await client.query("COMMIT");
      return res.json({ ok: true, inserted, skipped, insertedItems, skippedItems });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    console.error("JSON import error:", e);
    res.status(500).json({ error: e.message });
  }
});

app.post("/import/csv", requireAuth, upload.single("file"), async (req, res) => {
  if (!req.file)
    return res
      .status(400)
      .json({ error: 'file is required (multipart/form-data, field name "file")' });

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

  try {
    const text = req.file.buffer.toString("utf8");

    const rows = [];
    await new Promise((resolve, reject) => {
      parse(text, { columns: true, skip_empty_lines: true, trim: true, bom: true })
        .on("data", (record) => rows.push(record))
        .on("end", resolve)
        .on("error", reject);
    });

    if (rows.length === 0) return res.status(400).json({ error: "CSV has no rows" });

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
    console.error("CSV import error:", e);
    res.status(500).json({ error: e.message });
  }
});

/* =======================
   Global error handling
   ======================= */
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Server error" });
});

process.on("unhandledRejection", (r) => console.error("unhandledRejection:", r));
process.on("uncaughtException", (e) => console.error("uncaughtException:", e));

/* =======================
   Start
   ======================= */
const port = Number(process.env.PORT || 4000);
app.listen(port, () =>
  console.log(`Smart Job Tracker API listening on http://localhost:${port}`)
);
