const router = require('express').Router();
const { body, param } = require('express-validator');
const db = require('../config/db');
const upload = require('../middleware/upload');
const { uploadBuffer, remove } = require('../config/cloudinary');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { wrap } = require('../middleware/error');

const fmt = (req, p) => ({
  id: p.id, category_id: p.category_id, category_name: p.category_name,
  name: p.name, description: p.description, price: Number(p.price), stock: p.stock,
  image_url: p.image_url,
  created_by: p.created_by_name || null, created_at: p.created_at, updated_at: p.updated_at,
});
const BASE = `SELECT p.*, c.name AS category_name, u.name AS created_by_name
  FROM products p JOIN categories c ON c.id=p.category_id LEFT JOIN users u ON u.id=p.created_by`;

const idRule = [param('id').isInt({ min: 1 }).withMessage('ID tidak valid'), validate];
const rules = [
  body('name').trim().isLength({ min: 2, max: 150 }).withMessage('Nama produk 2-150 karakter'),
  body('description').optional({ values: 'falsy' }).trim().isLength({ max: 2000 }).withMessage('Deskripsi terlalu panjang'),
  body('price').isFloat({ min: 0 }).withMessage('Harga harus angka >= 0'),
  body('stock').isInt({ min: 0 }).withMessage('Stok harus bilangan bulat >= 0'),
  body('category_id').isInt({ min: 1 }).withMessage('Kategori wajib dipilih'),
  validate,
];

router.get('/', wrap(async (req, res) => {
  const where = [], args = [];
  if (req.query.search) { where.push('p.name LIKE ?'); args.push(`%${req.query.search}%`); }
  if (req.query.category_id) { where.push('p.category_id = ?'); args.push(Number(req.query.category_id)); }
  const [rows] = await db.query(`${BASE} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY p.created_at DESC`, args);
  res.json({ success: true, message: 'OK', data: rows.map(p => fmt(req, p)) });
}));

router.get('/:id', idRule, wrap(async (req, res) => {
  const [rows] = await db.query(`${BASE} WHERE p.id=?`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ success: false, message: 'Produk tidak ditemukan' });
  res.json({ success: true, message: 'OK', data: fmt(req, rows[0]) });
}));

router.post('/:id/purchase', authenticate, authorize('user'), idRule, wrap(async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      'SELECT stock FROM products WHERE id=? FOR UPDATE',
      [req.params.id],
    );
    if (!rows[0]) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Produk tidak ditemukan' });
    }
    if (rows[0].stock < 1) {
      await conn.rollback();
      return res.status(409).json({ success: false, message: 'Stok produk habis' });
    }
    await conn.query('UPDATE products SET stock=stock-1 WHERE id=?', [req.params.id]);
    await conn.commit();
    res.json({
      success: true,
      message: 'Produk berhasil dibeli',
      data: { stock: rows[0].stock - 1 },
    });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}));

// Hanya admin yang boleh menambah, mengubah, atau menghapus produk.
router.post('/', authenticate, authorize('admin'), upload.single('image'), rules, wrap(async (req, res) => {
  const { name, description, price, stock, category_id } = req.body;
  const img = req.file ? await uploadBuffer(req.file.buffer) : null;
  try {
    const [r] = await db.query(
      'INSERT INTO products (category_id,created_by,name,description,price,stock,image_url,image_public_id) VALUES (?,?,?,?,?,?,?,?)',
      [category_id, req.user.id, name, description || null, price, stock, img?.secure_url || null, img?.public_id || null]);
    const [rows] = await db.query(`${BASE} WHERE p.id=?`, [r.insertId]);
    res.status(201).json({ success: true, message: 'Produk ditambahkan', data: fmt(req, rows[0]) });
  } catch (e) { if (img) await remove(img.public_id); throw e; }
}));

router.put('/:id', authenticate, authorize('admin'), upload.single('image'), idRule, rules, wrap(async (req, res) => {
  const [old] = await db.query('SELECT image_url, image_public_id FROM products WHERE id=?', [req.params.id]);
  if (!old[0]) return res.status(404).json({ success: false, message: 'Produk tidak ditemukan' });
  const { name, description, price, stock, category_id } = req.body;
  const img = req.file ? await uploadBuffer(req.file.buffer) : null;
  try {
    await db.query(
      'UPDATE products SET category_id=?,name=?,description=?,price=?,stock=?,image_url=?,image_public_id=? WHERE id=?',
      [category_id, name, description || null, price, stock,
       img ? img.secure_url : old[0].image_url, img ? img.public_id : old[0].image_public_id, req.params.id]);
  } catch (e) { if (img) await remove(img.public_id); throw e; }
  if (img) await remove(old[0].image_public_id); // hapus gambar lama di Cloudinary
  const [rows] = await db.query(`${BASE} WHERE p.id=?`, [req.params.id]);
  res.json({ success: true, message: 'Produk diperbarui', data: fmt(req, rows[0]) });
}));

router.delete('/:id', authenticate, authorize('admin'), idRule, wrap(async (req, res) => {
  const [old] = await db.query('SELECT image_public_id FROM products WHERE id=?', [req.params.id]);
  if (!old[0]) return res.status(404).json({ success: false, message: 'Produk tidak ditemukan' });
  await db.query('DELETE FROM products WHERE id=?', [req.params.id]);
  await remove(old[0].image_public_id);
  res.json({ success: true, message: 'Produk dihapus', data: null });
}));

module.exports = router;
