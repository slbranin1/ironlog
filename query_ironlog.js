const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_vgEJYmV3kD8e@ep-autumn-thunder-ahqu6n4d-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

async function queryDB() {
  try {
    console.log('=== Connected to Neon ===\n');
    
    // List all tables
    const tablesResult = await pool.query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public'
    `);
    console.log('Tables:', tablesResult.rows.map(r => r.tablename).join(', '));
    console.log('');
    
    // Query ironlog_state
    const stateResult = await pool.query('SELECT * FROM ironlog_state');
    console.log('=== ironlog_state ===');
    console.log('Row count:', stateResult.rows.length);
    stateResult.rows.forEach((row, i) => {
      console.log(`\nRow ${i + 1}:`);
      console.log('  id:', row.id);
      console.log('  synced_at:', row.synced_at);
      console.log('  cycle_week:', row.cycle_week);
      console.log('  cycle_number:', row.cycle_number);
      console.log('  training_maxes:', row.training_maxes ? JSON.stringify(row.training_maxes, null, 2) : null);
      console.log('  active_session keys:', row.active_session ? Object.keys(JSON.parse(row.active_session)).join(', ') : 'null');
      console.log('  sessions count:', row.sessions ? JSON.parse(row.sessions).length : 0);
      console.log('  exercise_history keys:', row.exercise_history ? Object.keys(JSON.parse(row.exercise_history)).join(', ') : 'none');
    });
    console.log('');
    
    // Query ironlog_commands
    const cmdResult = await pool.query('SELECT id, action, created_at, executed_at, note FROM ironlog_commands ORDER BY created_at DESC LIMIT 10');
    console.log('=== ironlog_commands (last 10) ===');
    console.log('Row count:', cmdResult.rows.length);
    cmdResult.rows.forEach((row, i) => {
      console.log(`\nCommand ${i + 1}:`);
      console.log('  id:', row.id);
      console.log('  action:', row.action);
      console.log('  created_at:', row.created_at);
      console.log('  executed_at:', row.executed_at);
      console.log('  note:', row.note);
    });
    
    await pool.end();
    console.log('\n=== Query Complete ===');
  } catch (e) {
    console.error('Error:', e.message);
    await pool.end();
    process.exit(1);
  }
}

queryDB();
