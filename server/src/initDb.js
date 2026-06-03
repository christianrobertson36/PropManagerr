import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function waitForDatabase(retries = 30) {
  for (let i = 1; i <= retries; i++) {
    try {
      await query('select 1');
      return;
    } catch (err) {
      console.log(`Waiting for database... attempt ${i}/${retries}`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  throw new Error('Database did not become ready');
}

export async function initDatabase() {
  await waitForDatabase();

  const schemaPath = path.join(__dirname, '..', 'db', '001_schema.sql');
  const seedPath = path.join(__dirname, '..', 'db', '002_seed.sql');

  const schemaSql = await fs.readFile(schemaPath, 'utf8');
  const seedSql = await fs.readFile(seedPath, 'utf8');

  console.log('Running database schema...');
  await query(schemaSql);

  const result = await query('select count(*)::int as count from app_users');
  const userCount = result.rows[0]?.count || 0;

  if (userCount === 0) {
    console.log('Seeding database...');
    await query(seedSql);
  } else {
    console.log('Database already seeded, skipping seed data.');
  }
}
