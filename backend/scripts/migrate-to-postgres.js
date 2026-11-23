/**
 * Migrasi database dari MySQL (sumber) ke PostgreSQL (tujuan).
 *
 * Pemakaian (dari folder backend/):
 *   node scripts/migrate-to-postgres.js --mysql .env --pg .env.postgres
 *   node scripts/migrate-to-postgres.js --mysql .env --pg .env.postgres --dry-run
 *
 * --mysql  file env berisi DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME sumber (MySQL)
 * --pg     file env berisi kredensial PostgreSQL tujuan (Aiven)
 *
 * Yang dilakukan:
 *   1. Membuat tabel dari database/schema.postgres.sql (idempoten).
 *   2. Menyalin roles -> users -> categories -> products beserta id aslinya.
 *   3. Menyesuaikan sequence id agar INSERT berikutnya tidak bentrok.
 *   4. Memeriksa ulang jumlah baris kedua sisi.
 *
 * Skrip ini hanya MEMBACA dari MySQL. Jalankan ulang aman (ON CONFLICT DO NOTHING),
 * tetapi baris yang sudah ada di Postgres tidak ditimpa — kalau perlu menyegarkan
 * data, kosongkan tabel tujuan dulu.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { Client } = require('pg');

// ---------------------------------------------------------------- argumen
const argv = process.argv.slice(2);
const arg = name => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : null;
};
const MYSQL_ENV = arg('--mysql') || '.env';
const PG_ENV = arg('--pg');
const DRY = argv.includes('--dry-run');

if (!PG_ENV) {
  console.error('GAGAL: --pg <file-env-postgres> wajib diisi.\nContoh: node scripts/migrate-to-postgres.js --mysql .env --pg .env.postgres');
  process.exit(1);
}

const readEnv = file => {
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
};

const src = readEnv(MYSQL_ENV);
const dst = readEnv(PG_ENV);

const pgSsl = dst.DB_CA_CERT
  ? { ca: dst.DB_CA_CERT.replace(/\\n/g, '\n') }
  : dst.DB_SSL_MODE === 'no-verify'
    ? { rejectUnauthorized: false }
    : dst.DB_SSL === 'true'
      ? { rejectUnauthorized: true }
      : undefined;

// Urutan penting: foreign key users.role_id, products.category_id, products.created_by.
const TABLES = ['roles', 'users', 'categories', 'products'];
const COLUMNS = {
  roles: ['id', 'name'],
  users: ['id', 'name', 'email', 'password_hash', 'role_id', 'created_at'],
  categories: ['id', 'name', 'description', 'created_at'],
  products: ['id', 'category_id', 'created_by', 'name', 'description', 'price', 'stock',
    'image_url', 'image_public_id', 'created_at', 'updated_at'],
};
// Tabel dengan urutan id berlubang (roles bisa jadi 1 dan 3 karena role lama dihapus).
// Kalau id dibiarkan dibuat identity, INSERT IGNORE MySQL vs ON CONFLICT PostgreSQL
// bisa menghasilkan id berbeda untuk nama yang sama, sehingga users.role_id menunjuk
// role yang tidak ada. Untuk tabel seperti ini id ditulis eksplisit.
const PRESERVE_ID = new Set(['roles', 'users', 'categories', 'products']);

const resetIdentity = (target, table) =>
  target.query(
    `SELECT setval(pg_get_serial_sequence($1,'id'),
       COALESCE((SELECT MAX(id) FROM ${table}), 1),
       (SELECT COUNT(*) FROM ${table}) > 0)`, [`public.${table}`]);

(async () => {
  const source = await mysql.createConnection({
    host: src.DB_HOST, port: Number(src.DB_PORT) || 3306,
    user: src.DB_USER, password: src.DB_PASSWORD, database: src.DB_NAME,
  });
  const target = new Client({
    host: dst.DB_HOST, port: Number(dst.DB_PORT) || 5432,
    user: dst.DB_USER, password: dst.DB_PASSWORD, database: dst.DB_NAME,
    ...(pgSsl ? { ssl: pgSsl } : {}),
  });
  await target.connect();
  console.log(`Sumber : MySQL ${src.DB_USER}@${src.DB_HOST}/${src.DB_NAME}`);
  console.log(`Tujuan : PostgreSQL ${dst.DB_USER}@${dst.DB_HOST}/${dst.DB_NAME}${DRY ? '  (DRY RUN)' : ''}\n`);

  if (!DRY) {
    const schema = fs.readFileSync(path.join(__dirname, '..', '..', 'database', 'schema.postgres.sql'), 'utf8');
    await target.query(schema);
    console.log('Schema PostgreSQL siap.\n');
  }

  for (const table of TABLES) {
    const cols = COLUMNS[table];
    const insertCols = PRESERVE_ID.has(table) ? cols : cols.filter(c => c !== 'id');
    const [rows] = await source.query(`SELECT ${cols.join(',')} FROM ${table} ORDER BY id`);

    if (!DRY) {
      await target.query('BEGIN');
      try {
        // roles: baris yang sudah ada diperbarui id-nya ke id MySQL, baris baru ditambahkan.
        // Jangan DELETE + INSERT: users.role_id menunjuk baris lama, dan menghapusnya
        // (meski dalam transaksi) memutus FK pada baris yang masih dipakai.
        if (table === 'roles') {
          for (const row of rows) {
            await target.query(
              `INSERT INTO roles (id, name) VALUES ($1, $2)
               ON CONFLICT (name) DO UPDATE SET id = EXCLUDED.id`,
              [row.id, row.name]);
          }
        } else if (rows.length) {
          // Satu INSERT untuk semua baris: parameter datar $1..$n, $n+1..$2n, dst.
          const perRow = insertCols.length;
          const values = rows.map((_, r) =>
            `(${insertCols.map((__, c) => `$${r * perRow + c + 1}`).join(',')})`).join(',');
          const params = rows.flatMap(row => insertCols.map(c => row[c]));
          await target.query(
            `INSERT INTO ${table} (${insertCols.join(',')}) VALUES ${values} ON CONFLICT DO NOTHING`,
            params);
        }
        await target.query('COMMIT');
      } catch (e) {
        await target.query('ROLLBACK');
        throw new Error(`Gagal menyalin ${table}: ${e.message}`);
      }
      // Identity tetap harus melompati id tertinggi, kalau tidak INSERT berikutnya bentrok.
      await resetIdentity(target, table);
    }

    const { rows: [{ count }] } = await target.query(`SELECT COUNT(*)::int AS count FROM ${table}`);
    const status = DRY ? '(tidak disalin)' : count >= rows.length ? 'ok' : 'KURANG';
    console.log(`  ${table.padEnd(11)} MySQL ${String(rows.length).padStart(4)} baris -> PostgreSQL ${String(count).padStart(4)} baris  ${status}`);
  }

  console.log('\nVerifikasi integritas:');
  const checks = [
    ['users tanpa role valid', 'SELECT COUNT(*)::int AS n FROM users u LEFT JOIN roles r ON r.id=u.role_id WHERE r.id IS NULL'],
    ['products tanpa kategori valid', 'SELECT COUNT(*)::int AS n FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE c.id IS NULL'],
    ['products.created_by yatim', 'SELECT COUNT(*)::int AS n FROM products p LEFT JOIN users u ON u.id=p.created_by WHERE p.created_by IS NOT NULL AND u.id IS NULL'],
    ['email duplikat', 'SELECT COUNT(*)::int AS n FROM (SELECT email FROM users GROUP BY email HAVING COUNT(*) > 1) d'],
  ];
  for (const [label, sql] of checks) {
    const { rows: [{ n }] } = await target.query(sql);
    console.log(`  ${label.padEnd(30)} ${n === 0 ? 'ok (0)' : `PERIKSA: ${n}`}`);
  }

  await source.end();
  await target.end();
  console.log('\nSelesai.');
})().catch(e => { console.error('\nGAGAL:', e.code || e.message); process.exit(1); });
