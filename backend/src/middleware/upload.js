const multer = require('multer');

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

module.exports = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (req, file, cb) => {
    if (ALLOWED.includes(file.mimetype)) return cb(null, true);
    const e = new Error('Tipe file harus JPG, PNG, atau WEBP'); e.status = 400; cb(e);
  },
});
