require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");
const multer = require("multer");
const { parse } = require("csv-parse");

const {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} = require("./jwt");

const app = express();

const DEFAULT_CORS_ORIGINS =
  "http://localhost:5173,http://127.0.0.1:5173,http://sjt.local,http://localhost:3000";
const PASSWORD_MIN_LENGTH = 6;
const ALLOWED_STATUSES = new Set([
  "applied",
  "interview",
  "test",
  "home test",
  "test 2",
  "offer",
  "accepted",
  "rejected",
]);

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  database: process.env.DB_NAME || "smart_job_tracker",
  max: 10,
  connectionTimeoutMillis: 2000,
});

function parseOriginAllowlist(raw = "") {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function createCorsOptions() {
  const rawOrigins = process.env.CORS_ORIGIN || DEFAULT_CORS_ORIGINS;
  const allowlist = parseOriginAllowlist(rawOrigins);
  return {
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (allowlist.includes(origin)) return cb(null, true);
      return cb(new Error(`Not allowed by CORS: ${origin}`));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  };
}

function parseBearerToken(authHeader = "") {
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
}

function sanitizeUser(row) {
  return { id: row.id, name: row.name, email: row.email };
}

function createAuthPayload(userId) {
  return { uid: userId };
}

function createAuthResponse(userRow) {
  return {
    user: sanitizeUser(userRow),
    accessToken: signAccessToken(createAuthPayload(userRow.id)),
    refreshToken: signRefreshToken(createAuthPayload(userRow.id)),
  };
}

async function ensureSchema() {
  try {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text;`);
  } catch {}
}

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

function requireAuth(req, res, next) {
  const token = parseBearerToken(req.headers["authorization"] || "");
  if (!token) return res.status(401).json({ error: "No token" });
  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.uid;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

function validateCredentialsInput({ name, email, password }, requireName = false) {
  if (requireName && !String(name || "").trim()) return "Name is required";
  if (!String(email || "").trim()) return "Email is required";
  if (!String(password || "").trim()) return "Password is required";
  if (String(password).length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  }
  return null;
}

async function findUserByEmail(email) {
  const { rows } = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
  return rows[0] || null;
}

async function createUserWithPassword({ name, email, password }) {
  const passwordHash = await bcrypt.hash(password, 10);
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password_hash)
     VALUES ($1,$2,$3)
     RETURNING id, name, email`,
    [name.trim(), email.trim().toLowerCase(), passwordHash]
  );
  return rows[0];
}

async function verifyUserPassword(userRow, plainPassword) {
  if (!userRow?.password_hash) return false;
  return bcrypt.compare(plainPassword, userRow.password_hash);
}

function normalizeImportItems(items = []) {
  return items
    .map((r) => ({
      company: (r.company || "").toString().trim(),
      role: (r.role || "").toString().trim(),
      status: ((r.status || "applied") + "").toLowerCase().trim(),
      source: (r.source || "LinkedIn").toString().trim(),
      location: (r.location || "").toString().trim(),
      notes: (r.notes || "").toString().trim(),
    }))
    .filter((r) => r.company && r.role);
}

function normalizeStatus(value = "") {
  const status = String(value || "applied").trim().toLowerCase();
  return ALLOWED_STATUSES.has(status) ? status : "applied";
}

async function insertJob(client, userId, job) {
  const { rows } = await client.query(
    `INSERT INTO job_applications (user_id, company, role, status, source, location, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
 RETURNING id, user_id, company, role, status, source, location, notes`,
    [userId, job.company, job.role, job.status, job.source, job.location, job.notes]
  );
  return rows[0];
}

async function insertJobsBatch(userId, jobs) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const insertedItems = [];
    for (const job of jobs) {
      const inserted = await insertJob(client, userId, job);
      insertedItems.push(inserted);
    }
    await client.query("COMMIT");
    return insertedItems;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function parseCsvRows(fileBuffer) {
  const text = fileBuffer.toString("utf8");
  const rows = [];
  await new Promise((resolve, reject) => {
    parse(text, { columns: true, skip_empty_lines: true, trim: true, bom: true })
      .on("data", (record) => rows.push(record))
      .on("end", resolve)
      .on("error", reject);
  });
  return rows;
}

function mapCsvRowToJob(row) {
  return {
    company: row.company?.toString().trim() || "",
    role: row.role?.toString().trim() || "",
    status: normalizeStatus(row.status),
    source: row.source?.toString().trim() || null,
    location: row.location?.toString().trim() || null,
    notes: row.notes?.toString() || null,
  };
}

function registerCoreMiddleware() {
  app.use(cors(createCorsOptions()));
  app.use(express.json());
}

function registerHealthRoutes() {
  app.get("/health", async (_req, res) => {
    const dbOk = await isDbHealthy();
    res.json({ ok: true, db: dbOk });
  });
}

function registerAuthRoutes() {
  app.post("/users", async (req, res) => {
    const { name, email, password } = req.body || {};
    const inputError = validateCredentialsInput({ name, email, password }, true);
    if (inputError) return res.status(400).json({ error: inputError });

    try {
      const user = await createUserWithPassword({ name, email, password });
      return res.status(201).json({ ok: true, user });
    } catch (e) {
      if (e.code === "23505") {
        return res.status(409).json({ error: "Email already exists" });
      }
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/auth/login", async (req, res) => {
    const { email, password } = req.body || {};
    const inputError = validateCredentialsInput({ email, password }, false);
    if (inputError) return res.status(400).json({ error: inputError });

    try {
      const userRow = await findUserByEmail(String(email).trim().toLowerCase());
      const valid = await verifyUserPassword(userRow, password);
      if (!userRow || !valid) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      return res.json(createAuthResponse(userRow));
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/auth/logout", (_req, res) => res.json({ ok: true }));

  app.post("/refresh", (req, res) => {
    const { refreshToken } = req.body || {};
    if (!refreshToken) return res.status(400).json({ error: "refreshToken required" });
    try {
      const payload = verifyRefreshToken(refreshToken);
      const accessToken = signAccessToken(createAuthPayload(payload.uid));
      return res.json({ accessToken });
    } catch {
      return res.status(401).json({ error: "Invalid refresh token" });
    }
  });
}

function registerProfileRoutes() {
  app.get("/profile", requireAuth, async (req, res) => {
    try {
      const { rows } = await pool.query("SELECT id, name, email FROM users WHERE id = $1", [req.userId]);
      if (!rows[0]) return res.status(404).json({ error: "User not found" });
      return res.json({ user: rows[0], userId: req.userId });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  });
}

function registerJobsRoutes() {
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
}

function registerImportRoutes() {
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

  app.post("/import/json", requireAuth, async (req, res) => {
    try {
      const items = Array.isArray(req.body?.items) ? req.body.items : [];
      if (!items.length) return res.status(400).json({ error: "items array is required" });

      const normalized = normalizeImportItems(items).map((job) => ({
        ...job,
        status: normalizeStatus(job.status),
        source: job.source || null,
        location: job.location || null,
        notes: job.notes || null,
      }));
      if (!normalized.length) return res.status(400).json({ error: "no valid items" });

      const insertedItems = await insertJobsBatch(req.userId, normalized);
      return res.json({ ok: true, inserted: insertedItems.length, insertedItems });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/import/csv", requireAuth, upload.single("file"), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'file is required (multipart/form-data, field name "file")' });
    }
    try {
      const rows = await parseCsvRows(req.file.buffer);
      if (!rows.length) return res.status(400).json({ error: "CSV has no rows" });

      const jobs = rows
        .map(mapCsvRowToJob)
        .filter((job) => job.company && job.role);

      const insertedItems = await insertJobsBatch(req.userId, jobs);
      res.json({ ok: true, inserted: insertedItems.length, items: insertedItems });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
}

function registerRoutes() {
  registerHealthRoutes();
  registerAuthRoutes();
  registerProfileRoutes();
  registerJobsRoutes();
  registerImportRoutes();
}

function startServer() {
  const port = Number(process.env.PORT || 4000);
  app.listen(port, () => {
    console.log(`API on http://localhost:${port}`);
  });
}

registerCoreMiddleware();
registerRoutes();
ensureSchema().catch((e) => console.error("ensureSchema error:", e));
startServer();
