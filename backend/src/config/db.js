require('dotenv').config();
const { Pool, types } = require('pg');

// Semua kolom TIMESTAMP di schema sengaja tanpa zona waktu dan disimpan dalam UTC
// (lihat database/schema.postgres.sql). Parser bawaan node-postgres memperlakukannya
// sebagai waktu lokal proses, yang membuat tanggal bergeser beberapa jam pada mesin
// non-UTC seperti Windows di WIB. Paksa baca sebagai UTC agar JSON-nya sama dengan
// yang dulu dikirim MySQL (mis. "2026-11-15T14:08:29.000Z").
types.setTypeParser(types.builtins.TIMESTAMP, v => (v === null ? null : new Date(`${v}Z`)));
// NUMERIC datang sebagai string; harga DIKEMBALIKAN sebagai string dan diubah
// ke Number di lapisan format produk agar tidak kehilangan presisi.
// bigint (COUNT) juga string; ubah ke Number karena hitungan kita jauh di bawah 2^53.
types.setTypeParser(types.builtins.INT8, v => (v === null ? null : Number(v)));

// Aiven mewajibkan SSL. DB_SSL_MODE=no-verify berguna bila sertifikat CA tidak
// disertakan; DB_CA_CERT (PEM utuh, baris baru boleh ditulis \n) memverifikasi penuh.
const ssl = process.env.DB_CA_CERT
  ? { ca: process.env.DB_CA_CERT.replace(/\\n/g, '\n') }
  : process.env.DB_SSL_MODE === 'no-verify'
    ? { rejectUnauthorized: false }
    : process.env.DB_SSL === 'true'
      ? { rejectUnauthorized: true }
      : undefined;

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: Number(process.env.DB_POOL) || 10,
  connectionTimeoutMillis: 10000,
  ...(ssl ? { ssl } : {}),
});

// Bentuk API sengaja meniru mysql2/promise agar route tetap ringkas:
//   const [rows] = await db.query(sql, params)  -> rows = array hasil SELECT
//   const r = await db.query(sql)               -> r.rowCount / r.rows
// Parameter selalu $1, $2, ... (bukan ?).
pool.query = async (text, params = []) => {
  const r = await pool.constructor.prototype.query.call(pool, text, params);
  return [r.rows, r];
};

// Khusus transaksi: kembalikan client yang sudah BEGIN dan harus di-commit/rollback.
async function transaction() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    return client;
  } catch (e) {
    client.release();
    throw e;
  }
}

pool.transaction = transaction;

// Tutup pool dengan rapi (dipakai script CLI dan saat proses dihentikan).
pool.shutdown = () => pool.end();

module.exports = pool;
