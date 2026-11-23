const router = require('express').Router();
const { body, param } = require('express-validator');
const db = require('../config/db');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { wrap } = require('../middleware/error');

router.use(authenticate);

const rules = [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Nama kategori 2-100 karakter'),
  body('description').optional({ values: 'falsy' }).trim().isLength({ max: 255 }).withMessage('Deskripsi maksimal 255 karakter'),
  validate,
];
const idRule = [param('id').isInt({ min: 1 }).withMessage('ID tidak valid'), validate];

router.get('/', wrap(async (req, res) => {
  const [rows] = await db.query('SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id=c.id) AS product_count FROM categories c ORDER BY c.name');
  res.json({ success: true, message: 'OK', data: rows });
}));

router.post('/', authorize('admin'), rules, wrap(async (req, res) => {
  const [r] = await db.query('INSERT INTO categories (name,description) VALUES (?,?)', [req.body.name, req.body.description || null]);
  res.status(201).json({ success: true, message: 'Kategori ditambahkan', data: { id: r.insertId } });
}));

router.put('/:id', authorize('admin'), idRule, rules, wrap(async (req, res) => {
  const [r] = await db.query('UPDATE categories SET name=?, description=? WHERE id=?', [req.body.name, req.body.description || null, req.params.id]);
  if (!r.affectedRows) return res.status(404).json({ success: false, message: 'Kategori tidak ditemukan' });
  res.json({ success: true, message: 'Kategori diperbarui', data: null });
}));

router.delete('/:id', authorize('admin'), idRule, wrap(async (req, res) => {
  const [r] = await db.query('DELETE FROM categories WHERE id=?', [req.params.id]);
  if (!r.affectedRows) return res.status(404).json({ success: false, message: 'Kategori tidak ditemukan' });
  res.json({ success: true, message: 'Kategori dihapus', data: null });
}));

module.exports = router;
