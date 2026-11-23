const jwt = require('jsonwebtoken');

// Autentikasi: verifikasi JWT
exports.authenticate = (req, res, next) => {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ success: false, message: 'Token tidak ditemukan' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET); // {id, name, role}
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Token tidak valid atau kedaluwarsa' });
  }
};

// Otorisasi: batasi berdasarkan role
exports.authorize = (...roles) => (req, res, next) =>
  roles.includes(req.user.role)
    ? next()
    : res.status(403).json({ success: false, message: 'Anda tidak memiliki hak akses' });
