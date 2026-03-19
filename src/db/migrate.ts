import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getPool } from './client';

async function migrate() {
  const pool = getPool();
  const migrations = ['001_initial.sql', '002_jobs_companies_applications.sql'];
  for (const name of migrations) {
    const sql = readFileSync(join(__dirname, 'migrations', name), 'utf-8');
    await pool.query(sql);
    console.log('Migration', name, 'applied.');
  }
  await pool.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
