// Vercel serverless function: receives app state and forwards to Telegram
// POST — app sends its current session/state, we forward a summary to Telegram

const https = require('https');

function sendTelegram(text) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ chat_id: '-1003887229549', text });
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

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    try {
      const state = req.body;

      let text = '\ud83d\udcca IronLog Sync\n';
      if (state.activeSession) {
        const s = state.activeSession;
        text += '\nActive: ' + (s.programId || 'Custom') + ' Day\n';
        (s.exercises || []).forEach(se => {
          const done = se.sets.filter(s => s.completed).length;
          const total = se.sets.length;
          const maxW = Math.max(...se.sets.map(s => s.weight));
          text += '  ' + se.exerciseId + ': ' + done + '/' + total + ' sets @ ' + maxW + ' lbs\n';
          se.sets.forEach((set, i) => {
            if (set.notes) text += '    Set ' + (i+1) + ' note: ' + set.notes + '\n';
          });
        });
      }
      if (state.trainingMaxes && Object.keys(state.trainingMaxes).length > 0) {
        text += '\nTMs: ';
        text += Object.entries(state.trainingMaxes).map(([k, v]) => k + '=' + v).join(', ');
        text += '\n';
      }
      text += '\nSessions: ' + (state.sessions || []).length;
      text += '\nCycle: ' + (state.cycleNumber || 1) + ' / Week: ' + (state.cycleWeek || 1);

      await sendTelegram(text);
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
