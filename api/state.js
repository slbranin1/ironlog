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
      const incomingSessions = Array.isArray(state.sessions) ? state.sessions : [];

      // Fetch existing sessions to merge (never lose data)
      let existingSessions = [];
      try {
        const existing = await pool.query('SELECT sessions FROM ironlog_state WHERE id = 1');
        if (existing.rows.length && existing.rows[0].sessions) {
          existingSessions = existing.rows[0].sessions;
        }
      } catch (e) { /* first insert, no existing data */ }

      // Merge: keep all existing sessions, add any new ones from incoming
      // Deduplicate by session id (e.g. "c2w3-ohp"), falling back to date+programId
      const sessionKey = (s) => s.id || (s.date + ':' + s.programId);
      const existingKeys = new Set(existingSessions.map(sessionKey));
      const newSessions = incomingSessions.filter(s => !existingKeys.has(sessionKey(s)));

      // For sessions that exist in both, prefer the incoming version (may have updated data)
      const mergedSessions = existingSessions.map(existing => {
        const key = sessionKey(existing);
        const incoming = incomingSessions.find(s => sessionKey(s) === key);
        // Prefer incoming if it has exercises and existing doesn't, or if incoming has more data
        if (incoming && (incoming.exercises || []).length >= (existing.exercises || []).length) {
          return incoming;
        }
        return existing;
      }).concat(newSessions);

      const { rows } = await pool.query(
        `INSERT INTO ironlog_state (id, training_maxes, cycle_week, cycle_number, active_session, sessions, exercise_history)
         VALUES (1, $1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET
           training_maxes = COALESCE(EXCLUDED.training_maxes, ironlog_state.training_maxes),
           cycle_week = COALESCE(EXCLUDED.cycle_week, ironlog_state.cycle_week),
           cycle_number = COALESCE(EXCLUDED.cycle_number, ironlog_state.cycle_number),
           active_session = EXCLUDED.active_session,
           sessions = COALESCE(EXCLUDED.sessions, ironlog_state.sessions),
           exercise_history = COALESCE(EXCLUDED.exercise_history, ironlog_state.exercise_history),
           synced_at = NOW()
         RETURNING synced_at`,
        [
          state.trainingMaxes ? JSON.stringify(state.trainingMaxes) : null,
          state.cycleWeek || null,
          state.cycleNumber || null,
          state.activeSession ? JSON.stringify(state.activeSession) : null,
          JSON.stringify(mergedSessions),
          state.exerciseHistory ? JSON.stringify(state.exerciseHistory) : null,
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
      text += 'Sessions: ' + mergedSessions.length;
      text += ' · Cycle: ' + (state.cycleNumber || 1) + ' / Week: ' + (state.cycleWeek || 1);

      if (!silent) {
        await sendTelegram(text);
      }

      // Return merged state so the client can pull it back (bidirectional sync)
      return res.status(200).json({
        ok: true,
        cachedAt: syncedAt,
        mergedState: {
          trainingMaxes: state.trainingMaxes || undefined,
          cycleWeek: state.cycleWeek || undefined,
          cycleNumber: state.cycleNumber || undefined,
          sessions: mergedSessions,
          exerciseHistory: state.exerciseHistory || undefined,
        },
      });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
