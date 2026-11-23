/**
 * Migrasi data dari PostgreSQL lokal ke PostgreSQL Aiven (atau host Postgres lain).
 *
 * Pemakaian (dari folder backend/):
 *   node scripts/copy-to-aiven.js --from .env --to .env.aiven
 *   node scripts/copy-to-aiven.js --from .env --to .env.aiven --dry-run
 *
 * --from  file env berisi PostgreSQL SUMBER (lokal)
 * --to    file env berisi PostgreSQL TUJUAN (Aiven)
 *
 * Yang dilakukan:
 *   1. Membuat tabel dari database/schema.postgres.sql di tujuan (idempoten).
 *   2. Menyalin roles -> users -> categories -> products beserta id aslinya.
 *   3. Menyetel sequence id agar INSERT berikutnya tidak bentrok.
 *   4. Memeriksa jumlah baris dan integritas relasi.
 *
 * Skrip hanya MEMBACA dari sumber. Aman dijalankan ulang: baris yang sudah ada
 * di tujuan tidak ditimpa (ON CONFLICT DO NOTHING).
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const argv = process.argv.slice(2);
const arg = name => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : null;
};
const FROM_ENV = arg('--from') || '.env';
const TO_ENV = arg('--to');
const DRY = argv.includes('--dry-run');

if (!TO_ENV) {
  console.error('GAGAL: --to <file-env-tujuan> wajib diisi.\nContoh: node scripts/copy-to-aiven.js --from .env --to .env.aiven');
  process.exit(1);
}

const readEnv = file => {
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
};

const makeClient = (cfg, label) => {
  const ssl = cfg.DB_CA_CERT
    ? { ca: cfg.DB_CA_CERT.replace(/\\n/g, '\n') }
    : cfg.DB_SSL_MODE === 'no-verify'
      ? { rejectUnauthorized: false }
      : cfg.DB_SSL === 'true'
        ? { rejectUnauthorized: true }
        : undefined;
  const c = new Client({
    host: cfg.DB_HOST, port: Number(cfg.DB_PORT) || 5432,
    user: cfg.DB_USER, password: cfg.DB_PASSWORD, database: cfg.DB_NAME,
    connectionTimeoutMillis: 15000,
    ...(ssl ? { ssl } : {}),
  });
  c.label = label;
  return c;
};

// Urutan penting: foreign key users.role_id, products.category_id, products.created_by.
const TABLES = ['roles', 'users', 'categories', 'products'];
const COLUMNS = {
  roles: ['id', 'name'],
  users: ['id', 'name', 'email', 'password_hash', 'role_id', 'created_at'],
  categories: ['id', 'name', 'description', 'created_at'],
  products: ['id', 'category_id', 'created_by', 'name', 'description', 'price', 'stock',
    'image_url', 'image_public_id', 'created_at', 'updated_at'],
};

// Id selalu ditulis eksplisit agar relasi antar tabel tetap utuh.
// Catatan: baris roles bisa berlubang (id 1 dan 3), jadi id tidak boleh dibuat ulang.
const resetIdentity = (target, table) =>
  target.query(
    `SELECT setval(pg_get_serial_sequence($1,'id'),
       COALESCE((SELECT MAX(id) FROM ${table}), 1),
       (SELECT COUNT(*) FROM ${table}) > 0)`, [`public.${table}`]);

(async () => {
  const srcCfg = readEnv(FROM_ENV);
  const dstCfg = readEnv(TO_ENV);

  const source = makeClient(srcCfg, 'sumber');
  const target = makeClient(dstCfg, 'tujuan');

  try {
    await source.connect();
  } catch (e) {
    throw new Error(`Gagal konek ke sumber (${FROM_ENV}): ${e.code || e.message}`);
  }
  try {
    await target.connect();
  } catch (e) {
    throw new Error(`Gagal konek ke tujuan (${TO_ENV}): ${e.code || e.message}`);
  }

  console.log(`Sumber : PostgreSQL ${srcCfg.DB_USER}@${srcCfg.DB_HOST}/${srcCfg.DB_NAME}`);
  console.log(`Tujuan : PostgreSQL ${dstCfg.DB_USER}@${dstCfg.DB_HOST}/${dstCfg.DB_NAME}${DRY ? '  (DRY RUN)' : ''}\n`);

  if (!DRY) {
    const schema = fs.readFileSync(path.join(__dirname, '..', '..', 'database', 'schema.postgres.sql'), 'utf8');
    await target.query(schema);
    console.log('Schema PostgreSQL siap.\n');
  }

  for (const table of TABLES) {
    const cols = COLUMNS[table];
    const { rows } = await source.query(`SELECT ${cols.join(',')} FROM ${table} ORDER BY id`);

    if (!DRY) {
      await target.query('BEGIN');
      try {
        // roles: baris yang sudah ada diperbarui id-nya, baris baru ditambahkan.
        // Jangan DELETE + INSERT: users.role_id menunjuk baris lama.
        if (table === 'roles') {
          for (const row of rows) {
            await target.query(
              `INSERT INTO roles (id, name) VALUES ($1, $2)
               ON CONFLICT (name) DO UPDATE SET id = EXCLUDED.id`,
              [row.id, row.name]);
          }
        } else if (rows.length) {
          const perRow = cols.length;
          const values = rows.map((_, r) =>
            `(${cols.map((__, c) => `$${r * perRow + c + 1}`).join(',')})`).join(',');
          const params = rows.flatMap(row => cols.map(c => row[c]));
          await target.query(
            `INSERT INTO ${table} (${cols.join(',')}) VALUES ${values} ON CONFLICT DO NOTHING`,
            params);
        }
        await target.query('COMMIT');
      } catch (e) {
        await target.query('ROLLBACK');
        throw new Error(`Gagal menyalin ${table}: ${e.message}`);
      }
      await resetIdentity(target, table);
    }

    const { rows: [{ count }] } = await target.query(`SELECT COUNT(*)::int AS count FROM ${table}`);
    const status = DRY ? '(tidak disalin)' : count >= rows.length ? 'ok' : 'KURANG';
    console.log(`  ${table.padEnd(11)} sumber ${String(rows.length).padStart(4)} baris -> tujuan ${String(count).padStart(4)} baris  ${status}`);
  }

  console.log('\nVerifikasi integritas di tujuan:');
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
