const multer = require('multer');

exports.notFound = (req, res) =>
  res.status(404).json({ success: false, message: 'Endpoint tidak ditemukan' });

// Kode error PostgreSQL yang dipetakan ke status HTTP, padanan kode ER_* MySQL:
//   23505 unique_violation            -> 409 (dulu ER_DUP_ENTRY)
//   23503 foreign_key_violation       -> 409 bila baris masih dipakai, 422 bila referensinya tidak ada
exports.errorHandler = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const tooBig = err.code === 'LIMIT_FILE_SIZE';
    return res.status(tooBig ? 413 : 400).json({ success: false, message: tooBig ? 'Ukuran file maksimal 2 MB' : err.message });
  }
  if (err.code === '23505') return res.status(409).json({ success: false, message: 'Data sudah ada (duplikat)' });
  // 23001 restrict_violation: DELETE/UPDATE ditolak karena baris masih dirujuk
  // (padanan ER_ROW_IS_REFERENCED_2 MySQL) -> 409.
  if (err.code === '23001') return res.status(409).json({ success: false, message: 'Data masih dipakai data lain' });
  if (err.code === '23503') {
    // 23503 foreign_key_violation: referensi yang ditulis tidak ada
    // (padanan ER_NO_REFERENCED_ROW_2) -> 422.
    return res.status(422).json({ success: false, message: 'Referensi data tidak valid' });
  }
  if (err.status) return res.status(err.status).json({ success: false, message: err.message });
  console.error(err);
  res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server' });
};

// bungkus handler async agar error masuk ke errorHandler
exports.wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
