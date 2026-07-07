import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', '..', '..');

async function ensureDatabase() {
  const conn = process.env.DATABASE_URL;
  const m = conn.match(/\/([^/?]+)(\?.*)?$/);
  const dbName = m ? m[1] : 'postgres';
  const adminUrl = conn.replace(/\/[^/?]+(\?.*)?$/, '/postgres$1');
  const client = new pg.Client({ connectionString: adminUrl });
  await client.connect();
  try {
    const r = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (r.rowCount === 0) {
      const safe = dbName.replace(/"/g, '""');
      await client.query(`CREATE DATABASE "${safe}"`);
      console.log(`Banco "${dbName}" criado.`);
    }
  } finally {
    await client.end();
  }
}

async function runSqlFile(client, relativeFromRoot) {
  const full = path.join(rootDir, relativeFromRoot);
  const sql = fs.readFileSync(full, 'utf8');
  await client.query(sql);
}

async function runMigrations(client) {
  const dir = path.join(rootDir, 'database', 'migrations');
  if (!fs.existsSync(dir)) return;
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));
  for (const f of files) {
    await runSqlFile(client, path.join('database', 'migrations', f));
  }
}

async function seedAdmin(client) {
  const hash = await bcrypt.hash('admin123', 10);
  const { rowCount } = await client.query('SELECT 1 FROM admins WHERE username = $1', ['admin']);
  if (rowCount === 0) {
    await client.query('INSERT INTO admins (username, password_hash) VALUES ($1, $2)', ['admin', hash]);
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('Defina DATABASE_URL no .env');
    process.exit(1);
  }
  console.log('Garantindo banco...');
  await ensureDatabase();

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    console.log('Aplicando schema...');
    await runSqlFile(client, 'database/schema.sql');
    await runMigrations(client);
    console.log('Dados de demonstração...');
    await runSqlFile(client, 'database/seed_data.sql');
    console.log('Admin padrão...');
    await seedAdmin(client);
    console.log('Pronto. Login admin: admin / admin123');
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
