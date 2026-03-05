// Vercel serverless function: command bridge between coach and IronLog app
// GET  — returns pending commands as Redux actions (marks them executed atomically)
// POST — insert a new command (requires X-Coach-Token header)

const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Coach-Token');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    // Atomically mark pending commands as executed and return them as Redux actions
    const { rows } = await pool.query(
      `UPDATE ironlog_commands
       SET executed_at = NOW()
       WHERE executed_at IS NULL
       RETURNING id, action, payload, note, created_at`
    );

    if (!rows.length) {
      return res.status(200).json({ actions: [], updatedAt: null });
    }

    const actions = rows.map(r => r.payload).filter(Boolean);
    const updatedAt = new Date(rows[rows.length - 1].created_at).toISOString();
    const messageRow = rows.find(r => r.action === 'message');

    return res.status(200).json({
      actions,
      updatedAt,
      message: messageRow ? (messageRow.payload?.text || null) : null,
    });
  }

  if (req.method === 'POST') {
    const token = req.headers['x-coach-token'];
    if (!token || token !== process.env.COACH_TOKEN) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { action, payload, note } = req.body;
    if (!action) return res.status(400).json({ error: 'action is required' });
    const { rows } = await pool.query(
      'INSERT INTO ironlog_commands (action, payload, note) VALUES ($1, $2, $3) RETURNING *',
      [action, payload || null, note || null]
    );
    return res.status(201).json({ ok: true, command: rows[0] });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
