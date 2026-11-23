/**
 * Menjalankan database/schema.sql ke database yang ada di .env.
 * Dipakai untuk menyiapkan database Aiven yang sudah dibuat lewat console
 * (Aiven tidak mengizinkan CREATE DATABASE / USE, jadi dua perintah itu dilewati).
 *
 * Pemakaian: node scripts/db-init.js [--seed]
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../src/config/db');

const SCHEMA = path.join(__dirname, '..', '..', 'database', 'schema.sql');

function statements(sql) {
  return sql
    .split('\n')
    .filter(line => !/^\s*--/.test(line))
    .join('\n')
    .split(';')
    .map(s => s.trim())
    .filter(Boolean)
    // database sudah dibuat oleh Aiven, jadi dua perintah ini dilewati
    .filter(s => !/^CREATE\s+DATABASE/i.test(s))
    .filter(s => !/^USE\s+/i.test(s))
    // buat idempoten agar aman dijalankan berulang
    .map(s => s.replace(/^CREATE\s+TABLE\s+/i, 'CREATE TABLE IF NOT EXISTS '))
    .map(s => s.replace(/^INSERT\s+INTO\s+/i, 'INSERT IGNORE INTO '));
}

(async () => {
  const sql = fs.readFileSync(SCHEMA, 'utf8');
  const list = statements(sql);
  console.log(`Menjalankan ${list.length} perintah ke database ${process.env.DB_NAME} ...`);
  for (const s of list) {
    await db.query(s);
    console.log('  ok:', s.split('\n')[0].slice(0, 70));
  }

  const [tables] = await db.query('SHOW TABLES');
  console.log('\nTabel tersedia:', tables.map(t => Object.values(t)[0]).join(', '));

  if (process.argv.includes('--seed')) {
    console.log('\nMenjalankan seed...');
    await db.end();
    require('../src/seed');
    return;
  }
  await db.end();
  console.log('Selesai.');
})().catch(e => { console.error('GAGAL:', e.code || e.message); process.exit(1); });
