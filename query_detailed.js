const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_vgEJYmV3kD8e@ep-autumn-thunder-ahqu6n4d-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

async function queryDB() {
  try {
    // Get full state row with parsed JSON
    const stateResult = await pool.query('SELECT * FROM ironlog_state WHERE id=1');
    const row = stateResult.rows[0];
    
    console.log('=== FULL ironlog_state Row (id=1) ===\n');
    console.log('Last synced:', row.synced_at);
    console.log('Cycle Week:', row.cycle_week);
    console.log('Cycle Number:', row.cycle_number);
    console.log('');
    
    if (row.training_maxes) {
      console.log('Training Maxes:');
      console.log(JSON.stringify(row.training_maxes, null, 2));
    } else {
      console.log('Training Maxes: NULL');
    }
    
    console.log('');
    if (row.active_session) {
      console.log('Active Session:');
      console.log(JSON.stringify(row.active_session, null, 2));
    } else {
      console.log('Active Session: NULL');
    }
    
    console.log('');
    if (row.sessions) {
      const sessions = JSON.parse(row.sessions);
      console.log(`Sessions (${sessions.length} total):`);
      sessions.slice(0, 3).forEach((s, i) => {
        console.log(`\nSession ${i+1}:`);
        console.log('  Date:', s.date);
        console.log('  Program:', s.programId);
        console.log('  Exercises:', s.exercises ? s.exercises.length : 0);
        if (s.exercises) {
          s.exercises.slice(0, 2).forEach(ex => {
            console.log(`    - ${ex.label || ex.exerciseId}: ${ex.sets.length} sets`);
          });
        }
      });
    } else {
      console.log('Sessions: NULL');
    }
    
    console.log('');
    if (row.exercise_history) {
      const hist = row.exercise_history;
      console.log('Exercise History (sample):');
      const keys = Object.keys(hist).slice(0, 3);
      keys.forEach(key => {
        const data = hist[key];
        console.log(`  ${key}: ${data.history.length} workouts`);
        console.log(`    Latest: ${data.history[data.history.length - 1].date} @ ${data.history[data.history.length - 1].weight} lbs`);
      });
    } else {
      console.log('Exercise History: NULL');
    }
    
    // Also get all commands with payloads
    console.log('\n\n=== ALL COMMANDS WITH PAYLOADS ===\n');
    const cmdResult = await pool.query('SELECT * FROM ironlog_commands ORDER BY created_at DESC');
    cmdResult.rows.forEach((row, i) => {
      console.log(`Command ${i+1}:`);
      console.log('  Action:', row.action);
      console.log('  Created:', row.created_at);
      console.log('  Executed:', row.executed_at);
      console.log('  Note:', row.note);
      if (row.payload) {
        console.log('  Payload:', JSON.stringify(row.payload, null, 2));
      }
      console.log('');
    });
    
    await pool.end();
  } catch (e) {
    console.error('Error:', e.message);
    console.error(e.stack);
    await pool.end();
    process.exit(1);
  }
}

queryDB();
