require('dotenv').config();
const mysql = require('mysql2/promise');

// Aiven memakai port kustom dan mewajibkan koneksi SSL, berbeda dengan MySQL lokal.
// DB_CA_CERT boleh berisi PEM utuh; baris baru dapat ditulis sebagai \n.
const ssl = process.env.DB_CA_CERT
  ? { ca: process.env.DB_CA_CERT.replace(/\\n/g, '\n') }
  : process.env.DB_SSL === 'true'
    ? { rejectUnauthorized: true }
    : undefined;

module.exports = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_POOL) || 10,
  connectTimeout: 10000,
  ...(ssl ? { ssl } : {}),
});
