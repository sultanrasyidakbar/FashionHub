const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const db = require('../config/db');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { wrap } = require('../middleware/error');

const sign = u => jwt.sign({ id: u.id, name: u.name, role: u.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES || '1d' });

// Register: role selalu "user" (admin hanya dari seed) -> mencegah privilege escalation
router.post('/register',
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Nama 2-100 karakter'),
  body('email').trim().isEmail().withMessage('Email tidak valid').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password minimal 6 karakter'),
  validate,
  wrap(async (req, res) => {
    const { name, email, password } = req.body;
    const hash = await bcrypt.hash(password, 10);
    const [r] = await db.query(
      "INSERT INTO users (name,email,password_hash,role_id) VALUES (?,?,?,(SELECT id FROM roles WHERE name='user'))",
      [name, email, hash]);
    res.status(201).json({ success: true, message: 'Registrasi berhasil', data: { id: r.insertId, name, email, role: 'user' } });
  }));

router.post('/login',
  body('email').trim().isEmail().withMessage('Email tidak valid').normalizeEmail(),
  body('password').notEmpty().withMessage('Password wajib diisi'),
  validate,
  wrap(async (req, res) => {
    const [rows] = await db.query(
      'SELECT u.id,u.name,u.email,u.password_hash,r.name AS role FROM users u JOIN roles r ON r.id=u.role_id WHERE u.email=?',
      [req.body.email]);
    const u = rows[0];
    if (!u || !(await bcrypt.compare(req.body.password, u.password_hash)))
      return res.status(401).json({ success: false, message: 'Email atau password salah' });
    res.json({ success: true, message: 'Login berhasil', data: { token: sign(u), user: { id: u.id, name: u.name, email: u.email, role: u.role } } });
  }));

router.get('/me', authenticate, wrap(async (req, res) => {
  const [rows] = await db.query('SELECT u.id,u.name,u.email,r.name AS role FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=?', [req.user.id]);
  if (!rows[0]) return res.status(401).json({ success: false, message: 'Pengguna tidak ditemukan' });
  res.json({ success: true, message: 'OK', data: rows[0] });
}));

// Ubah nama profil
router.put('/profile', authenticate,
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Nama 2-100 karakter'),
  validate,
  wrap(async (req, res) => {
    await db.query('UPDATE users SET name=? WHERE id=?', [req.body.name, req.user.id]);
    const [rows] = await db.query('SELECT u.id,u.name,u.email,r.name AS role FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=?', [req.user.id]);
    res.json({ success: true, message: 'Profil diperbarui', data: rows[0] });
  }));

// Ubah password (wajib menyertakan password lama)
router.put('/password', authenticate,
  body('current_password').notEmpty().withMessage('Password lama wajib diisi'),
  body('new_password').isLength({ min: 6 }).withMessage('Password baru minimal 6 karakter'),
  validate,
  wrap(async (req, res) => {
    const [rows] = await db.query('SELECT password_hash FROM users WHERE id=?', [req.user.id]);
    if (!rows[0] || !(await bcrypt.compare(req.body.current_password, rows[0].password_hash)))
      return res.status(400).json({ success: false, message: 'Password lama salah' });
    await db.query('UPDATE users SET password_hash=? WHERE id=?', [await bcrypt.hash(req.body.new_password, 10), req.user.id]);
    res.json({ success: true, message: 'Password berhasil diubah', data: null });
  }));

module.exports = router;
