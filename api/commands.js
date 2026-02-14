// Vercel serverless function: command bridge between Telegram bot and IronLog app
// GET — returns pending commands for the app

const fs = require('fs');
const path = require('path');

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    try {
      const data = fs.readFileSync(path.join(process.cwd(), 'commands.json'), 'utf8');
      return res.status(200).json(JSON.parse(data));
    } catch (e) {
      return res.status(200).json({ actions: [], updatedAt: null });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
