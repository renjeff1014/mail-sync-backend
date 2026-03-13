import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getPool } from './client';

async function migrate() {
  const pool = getPool();
  const sql = readFileSync(
    join(__dirname, 'migrations', '001_initial.sql'),
    'utf-8'
  );
  await pool.query(sql);
  console.log('Migration 001_initial.sql applied.');
  await pool.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
