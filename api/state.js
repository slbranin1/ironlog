const https = require('https');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

function sendTelegram(text) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ chat_id: '-1003887229549', text, parse_mode: 'HTML' });
    const req = https.request({
      hostname: 'api.telegram.org',
      path: '/bot8337411473:AAENvzuB073XKZDWZCeZ0jrsPUBDyGxOYFk/sendMessage',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function formatSetDetail(se) {
  let lines = [];
  const label = se.label || se.exerciseId;
  const equip = se.equipment === 'dumbbell' ? ' (DB)' : '';
  lines.push('<b>' + label + equip + '</b>');
  se.sets.forEach((s, i) => {
    const status = s.completed ? (s.reps >= (s.targetReps || 0) ? '✓' : '✗') : '—';
    let line = '  Set ' + (i + 1) + ': ' + s.weight + ' lbs × ' + s.reps + ' ' + status;
    if (s.notes) line += ' — ' + s.notes;
    lines.push(line);
  });
  return lines.join('\n');
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    let rows;
    try {
      const result = await pool.query(
        'SELECT * FROM ironlog_state ORDER BY synced_at DESC LIMIT 1'
      );
      rows = result.rows;
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message, hint: 'DB connection failed' });
    }
    if (!rows.length) return res.status(200).json({ ok: false, message: 'No state cached. Sync from app first.' });
    const row = rows[0];
    return res.status(200).json({
      ok: true,
      cachedAt: row.synced_at,
      state: {
        trainingMaxes: row.training_maxes,
        cycleWeek: row.cycle_week,
        cycleNumber: row.cycle_number,
        activeSession: row.active_session,
        sessions: row.sessions,
        exerciseHistory: row.exercise_history,
      },
    });
  }

  if (req.method === 'POST') {
    try {
      const state = req.body;
      const silent = req.query.silent === '1';

      const { rows } = await pool.query(
        `INSERT INTO ironlog_state (training_maxes, cycle_week, cycle_number, active_session, sessions, exercise_history)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING synced_at`,
        [
          state.trainingMaxes || null,
          state.cycleWeek || null,
          state.cycleNumber || null,
          state.activeSession || null,
          state.sessions || null,
          state.exerciseHistory || null,
        ]
      );
      const syncedAt = rows[0].synced_at;

      let text = '📊 IronLog Sync\n';
      if (state.activeSession) {
        const s = state.activeSession;
        text += '\n<b>' + (s.programId || 'Custom') + ' Day</b>';
        if (s.date) text += ' — ' + s.date;
        text += '\n\n';
        (s.exercises || []).forEach(se => {
          text += formatSetDetail(se) + '\n\n';
        });
      }
      if (state.trainingMaxes && Object.keys(state.trainingMaxes).length > 0) {
        text += 'TMs: ';
        text += Object.entries(state.trainingMaxes).map(([k, v]) => k + '=' + v).join(', ');
        text += '\n';
      }
      text += 'Sessions: ' + (state.sessions || []).length;
      text += ' · Cycle: ' + (state.cycleNumber || 1) + ' / Week: ' + (state.cycleWeek || 1);

      if (!silent) {
        await sendTelegram(text);
      }

      return res.status(200).json({ ok: true, cachedAt: syncedAt });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
