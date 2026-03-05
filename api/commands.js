const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Coach-Token');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const { rows } = await pool.query(
      'SELECT * FROM ironlog_commands WHERE executed_at IS NULL ORDER BY created_at ASC'
    );
    return res.status(200).json({ actions: [], commands: rows });
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
