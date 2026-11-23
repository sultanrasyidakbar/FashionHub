require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./config/db');

(async () => {
  const hash = await bcrypt.hash('Admin123', 10);
  await db.query("INSERT INTO users (name,email,password_hash,role_id) VALUES ('Rina Saputri','admin@fashionhub.com',$1,(SELECT id FROM roles WHERE name='admin')) ON CONFLICT (email) DO NOTHING", [hash]);
  await db.query("INSERT INTO categories (name,description) VALUES ('Pria','Pakaian pria'),('Wanita','Pakaian wanita'),('Aksesoris','Topi, tas, dan aksesoris'),('Sepatu','Sneakers dan sepatu casual') ON CONFLICT (name) DO NOTHING");

  const [cnt] = await db.query('SELECT COUNT(*) AS n FROM products');
  if (cnt[0].n === 0) {
    const [adm] = await db.query("SELECT id FROM users WHERE email='admin@fashionhub.com'");
    const admin = adm[0];
    const cat = async name => (await db.query('SELECT id FROM categories WHERE name=$1', [name]))[0][0].id;
    const items = [
      ['Pria', 'Oversize Hoodie', 'Hoodie premium bahan lembut dan nyaman dipakai sehari-hari.', 199000, 40],
      ['Pria', 'T-Shirt Basic', 'Kaos katun combed 30s, adem dan tidak mudah melar.', 99000, 85],
      ['Pria', 'Jaket Denim', 'Jaket denim klasik dengan potongan regular fit.', 299000, 4],
      ['Wanita', 'Dress Floral', 'Dress motif bunga bahan rayon, cocok untuk santai.', 249000, 22],
      ['Aksesoris', 'Topi Baseball', 'Topi baseball adjustable dengan bordir logo.', 79000, 3],
      ['Sepatu', 'Sneakers Putih', 'Sneakers putih polos, sol empuk untuk harian.', 349000, 18],
    ];
    for (const [c, name, desc, price, stock] of items)
      await db.query('INSERT INTO products (category_id,created_by,name,description,price,stock) VALUES ($1,$2,$3,$4,$5,$6)', [await cat(c), admin.id, name, desc, price, stock]);
  }
  console.log('Seed selesai. Login admin: admin@fashionhub.com / Admin123');
  await db.end();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
