const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ironlog_state (
        id SERIAL PRIMARY KEY,
        synced_at TIMESTAMPTZ DEFAULT NOW(),
        training_maxes JSONB,
        cycle_week INT,
        cycle_number INT,
        active_session JSONB,
        sessions JSONB,
        exercise_history JSONB
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS ironlog_commands (
        id SERIAL PRIMARY KEY,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        executed_at TIMESTAMPTZ,
        action TEXT NOT NULL,
        payload JSONB,
        note TEXT
      )
    `);
    console.log('Migration successful');
  } catch (e) {
    console.error('Migration failed:', e.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
