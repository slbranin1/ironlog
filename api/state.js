// Vercel serverless function: receives app state, stores it, and forwards to Telegram
// POST — app sends its current session/state, we store + forward summary to Telegram
// GET  — returns the latest synced state (for coach to read)

const https = require('https');
const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join('/tmp', 'ironlog-latest-state.json');

// In-memory cache for warm function instances
let cachedState = null;
let cachedAt = null;

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

function storeState(state) {
  cachedState = state;
  cachedAt = new Date().toISOString();
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify({ state, cachedAt }));
  } catch (e) { /* /tmp may fail, that's ok — we have in-memory */ }
}

function readState() {
  if (cachedState) return { state: cachedState, cachedAt };
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    cachedState = parsed.state;
    cachedAt = parsed.cachedAt;
    return parsed;
  } catch (e) {
    return null;
  }
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

  // GET — return latest stored state
  if (req.method === 'GET') {
    const stored = readState();
    if (!stored) return res.status(200).json({ ok: false, message: 'No state cached. Sync from app first.' });
    return res.status(200).json({ ok: true, ...stored });
  }

  if (req.method === 'POST') {
    try {
      const state = req.body;
      const silent = req.query.silent === '1';

      // Always store state
      storeState(state);

      // Build detailed sync message
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

      // Only send Telegram message if not a silent auto-sync
      if (!silent) {
        await sendTelegram(text);
      }

      return res.status(200).json({ ok: true, cachedAt });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
