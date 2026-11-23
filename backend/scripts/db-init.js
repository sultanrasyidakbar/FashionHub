/**
 * Menjalankan database/schema.postgres.sql ke database PostgreSQL di .env.
 * Dipakai untuk menyiapkan database Aiven PostgreSQL yang sudah dibuat lewat
 * console (Aiven yang membuat database-nya, jadi file ini hanya membuat tabel).
 *
 * Pemakaian: node scripts/db-init.js [--seed]
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../src/config/db');

const SCHEMA = path.join(__dirname, '..', '..', 'database', 'schema.postgres.sql');

(async () => {
  const sql = fs.readFileSync(SCHEMA, 'utf8');
  // File schema hanya berisi DDL + trigger function; jalankan sebagai satu blok
  // agar CREATE FUNCTION ... $$ ... $$ tidak terpotong oleh pemisah pernyataan.
  console.log(`Menjalankan schema ke database ${process.env.DB_NAME} @ ${process.env.DB_HOST} ...`);
  await db.query(sql);

  const [tables] = await db.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name");
  console.log('Tabel tersedia:', tables.map(t => t.table_name).join(', '));

  const [counts] = await db.query(`SELECT 'roles' AS t, COUNT(*) FROM roles
    UNION ALL SELECT 'users', COUNT(*) FROM users
    UNION ALL SELECT 'categories', COUNT(*) FROM categories
    UNION ALL SELECT 'products', COUNT(*) FROM products`);
  for (const row of counts) console.log(`  ${row.t}: ${row.count} baris`);

  if (process.argv.includes('--seed')) {
    console.log('\nMenjalankan seed...');
    await db.end();
    require('../src/seed');
    return;
  }
  await db.end();
  console.log('Selesai.');
})().catch(e => { console.error('GAGAL:', e.code || e.message); process.exit(1); });
