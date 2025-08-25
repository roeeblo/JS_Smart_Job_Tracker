require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
} = require('./jwt');


const app = express();

app.use(express.json());
app.use(
  cors({
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'smart_job_tracker',
  max: 10,
});

function requireAuth(req, res, next) {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.uid;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}


app.get('/health', async (req, res) => {
  try {
    const r = await pool.query('SELECT 1 AS ok');
    res.json({ ok: true, db: r.rows[0].ok === 1 });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/users', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, email, created_at FROM users ORDER BY id DESC'
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/users', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email, password required' });
  }
  try {
    const password_hash = await bcrypt.hash(String(password), 10);
    const { rows } = await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, created_at',
      [name, email, password_hash]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    res.status(500).json({ error: e.message });
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(String(password), user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

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

app.get('/profile', (req, res) => {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    const payload = verifyAccessToken(token);
    res.json({ message: 'Protected route', userId: payload.uid });
  } catch (err) {
    console.error('JWT verify error:', err.message);
    res.status(401).json({ error: 'Invalid token' });
  }
});

app.get('/jobs', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM job_applications WHERE user_id = $1 ORDER BY updated_at DESC',
      [req.userId]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/jobs', requireAuth, async (req, res) => {
  const { company, role, status, source, location, applied_at } = req.body || {};
  if (!company || !role) {
    return res.status(400).json({ error: 'company and role are required' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO job_applications (user_id, company, role, status, source, location, applied_at)
       VALUES ($1,$2,$3,COALESCE($4,'applied'),$5,$6,COALESCE($7, CURRENT_DATE))
       RETURNING *`,
      [req.userId, company, role, status || null, source || null, location || null, applied_at || null]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/jobs/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const fields = ['company', 'role', 'status', 'source', 'location', 'applied_at'];
  const updates = [];
  const values = [];
  fields.forEach((f) => {
    if (f in req.body) {
      updates.push(`${f}=$${updates.length + 3}`);
      values.push(req.body[f]);
    }
  });
  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

  try {
    const q = `UPDATE job_applications SET ${updates.join(', ')} WHERE id=$1 AND user_id=$2 RETURNING *`;
    const { rows } = await pool.query(q, [id, req.userId, ...values]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/jobs/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM job_applications WHERE id=$1 AND user_id=$2',
      [id, req.userId]
    );
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/refresh', (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) return res.status(400).json({ error: 'refreshToken required' });
  try {
    const payload = require('./jwt').verifyRefreshToken(refreshToken);
    const accessToken = require('./jwt').signAccessToken({ uid: payload.uid });
    res.json({ accessToken });
  } catch {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
});


const port = Number(process.env.PORT || 4000);
app.listen(port, () =>
  console.log(`Smart Job Tracker API listening on http://localhost:${port}`)
);
