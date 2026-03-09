const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_vgEJYmV3kD8e@ep-autumn-thunder-ahqu6n4d-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require'
});
// Delete the test rows (id 2 and 3), keep only id=1 which has real data
pool.query(`DELETE FROM ironlog_state WHERE id > 1`)
  .then(r => {
    console.log(`Deleted ${r.rowCount} test rows`);
    return pool.query(`SELECT id, synced_at FROM ironlog_state ORDER BY synced_at DESC`);
  })
  .then(r => {
    console.log(`Remaining rows: ${r.rows.length}`);
    r.rows.forEach(row => console.log(`  id=${row.id}, synced=${row.synced_at}`));
    pool.end();
  })
  .catch(e => { console.error(e.message); pool.end(); });
