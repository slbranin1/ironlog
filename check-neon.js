const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_vgEJYmV3kD8e@ep-autumn-thunder-ahqu6n4d-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require');
sql`SELECT id, session_date, created_at, jsonb_array_length(state->'sessions') as session_count FROM ironlog_state ORDER BY created_at DESC LIMIT 5`.then(rows => {
  console.log(JSON.stringify(rows, null, 2));
}).catch(e => console.error(e.message));
