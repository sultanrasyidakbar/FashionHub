/**
 * Blackbox testing FashionHub API.
 * Pemakaian:  node test/blackbox.js [BASE_URL]
 * Default BASE_URL: http://localhost:3000
 *
 * Menguji API lewat HTTP saja (tanpa melihat kode internal), mencatat
 * status code yang benar-benar diterima, lalu membersihkan data uji.
 */
const { Client } = require('pg');
require('dotenv').config();
// ENV_FILE=path/to/file memakai kredensial lain (mis. PostgreSQL lokal) tanpa menimpa .env.
if (process.env.ENV_FILE) {
  const fs = require('fs');
  for (const line of fs.readFileSync(process.env.ENV_FILE, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith('#')) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const BASE = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');
const STAMP = Date.now().toString().slice(-6);
const EMAIL_USER = `bb.user.${STAMP}@fashionhub.test`;
const EMAIL_ADMIN = `bb.admin.${STAMP}@fashionhub.test`;
const PASS = 'Test12345';

const results = [];
let token = { user: null, admin: null };
const created = { users: [], products: [], categories: [] };

async function req(method, path, { token: tk, body, form, raw } = {}) {
  const headers = {};
  if (tk) headers.Authorization = `Bearer ${tk}`;
  let payload;
  if (raw !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = raw;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  } else if (form) {
    payload = form;
  }
  const res = await fetch(BASE + path, { method, headers, body: payload });
  let json = null;
  const text = await res.text();
  try { json = JSON.parse(text); } catch { /* respons bukan JSON */ }
  return { status: res.status, json, text };
}

function record(id, fitur, skenario, harapan, aktual, pass, catatan = '') {
  results.push({ id, fitur, skenario, harapan, aktual, hasil: pass ? 'PASS' : 'FAIL', catatan });
  const mark = pass ? 'PASS' : 'FAIL';
  console.log(`${mark}  ${id.padEnd(6)} ${String(aktual).padEnd(5)} ${skenario}${pass ? '' : '   <-- harap ' + harapan}`);
}

async function step(num, fitur, skenario, harapan, fn) {
  try {
    const { status, extra } = await fn();
    record(num, fitur, skenario, String(harapan), status, status === harapan, extra || '');
    return status;
  } catch (e) {
    record(num, fitur, skenario, String(harapan), 'ERR', false, e.message);
    return null;
  }
}

function pngBuffer(size = 1024) {
  // PNG 1x1 transparan + padding agar ukuran file dapat diatur
  const base = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64');
  return Buffer.concat([base, Buffer.alloc(Math.max(0, size - base.length))]);
}

(async () => {
  console.log(`\n=== BLACKBOX TEST FASHIONHUB ===\nBASE: ${BASE}\n`);

  // ---------------------------------------------------------------- health
  await step('TC-01', 'Health', 'GET / mengembalikan status API', 200,
    async () => ({ status: (await req('GET', '/')).status }));

  // ---------------------------------------------------------------- registrasi
  await step('TC-02', 'Registrasi', 'Registrasi akun user dengan data valid', 201,
    async () => {
      const r = await req('POST', '/api/auth/register',
        { body: { name: 'Blackbox User', email: EMAIL_USER, password: PASS } });
      if (r.json?.data?.id) created.users.push(EMAIL_USER);
      return { status: r.status };
    });

  await step('TC-03', 'Registrasi', 'Registrasi dengan email yang sudah terdaftar', 409,
    async () => ({ status: (await req('POST', '/api/auth/register',
      { body: { name: 'Duplikat', email: EMAIL_USER, password: PASS } })).status }));

  await step('TC-04', 'Registrasi', 'Registrasi dengan format email tidak valid', 422,
    async () => ({ status: (await req('POST', '/api/auth/register',
      { body: { name: 'Email Salah', email: 'bukan-email', password: PASS } })).status }));

  await step('TC-05', 'Registrasi', 'Registrasi dengan password kurang dari 6 karakter', 422,
    async () => ({ status: (await req('POST', '/api/auth/register',
      { body: { name: 'Pass Pendek', email: `bb.short.${STAMP}@x.test`, password: '123' } })).status }));

  await step('TC-06', 'Registrasi', 'Registrasi dengan nama kurang dari 2 karakter', 422,
    async () => ({ status: (await req('POST', '/api/auth/register',
      { body: { name: 'A', email: `bb.name.${STAMP}@x.test`, password: PASS } })).status }));

  // ---------------------------------------------------------------- login
  await step('TC-07', 'Login', 'Login dengan email dan password benar', 200,
    async () => {
      const r = await req('POST', '/api/auth/login', { body: { email: EMAIL_USER, password: PASS } });
      token.user = r.json?.data?.token || null;
      return { status: r.status };
    });

  await step('TC-08', 'Login', 'Login dengan password salah', 401,
    async () => ({ status: (await req('POST', '/api/auth/login',
      { body: { email: EMAIL_USER, password: 'salah-sekali' } })).status }));

  await step('TC-09', 'Login', 'Login dengan email tidak terdaftar', 401,
    async () => ({ status: (await req('POST', '/api/auth/login',
      { body: { email: 'tidak.ada@fashionhub.test', password: PASS } })).status }));

  await step('TC-10', 'Login', 'Login dengan password kosong', 422,
    async () => ({ status: (await req('POST', '/api/auth/login',
      { body: { email: EMAIL_USER, password: '' } })).status }));

  // ---------------------------------------------------------------- profil
  await step('TC-11', 'Profil', 'GET /api/auth/me tanpa token', 401,
    async () => ({ status: (await req('GET', '/api/auth/me')).status }));

  await step('TC-12', 'Profil', 'GET /api/auth/me dengan token valid', 200,
    async () => ({ status: (await req('GET', '/api/auth/me', { token: token.user })).status }));

  await step('TC-13', 'Profil', 'GET /api/auth/me dengan token rusak', 401,
    async () => ({ status: (await req('GET', '/api/auth/me', { token: 'token.palsu.abc' })).status }));

  await step('TC-14', 'Profil', 'Ubah nama profil dengan nama valid', 200,
    async () => ({ status: (await req('PUT', '/api/auth/profile',
      { token: token.user, body: { name: 'Blackbox User Baru' } })).status }));

  await step('TC-15', 'Profil', 'Ubah nama profil dengan 1 karakter', 422,
    async () => ({ status: (await req('PUT', '/api/auth/profile',
      { token: token.user, body: { name: 'X' } })).status }));

  await step('TC-16', 'Profil', 'Ubah password dengan password lama salah', 400,
    async () => ({ status: (await req('PUT', '/api/auth/password',
      { token: token.user, body: { current_password: 'salah', new_password: 'Baru12345' } })).status }));

  // ---------------------------------------------------------------- kategori
  await step('TC-17', 'Kategori', 'GET kategori tanpa token', 401,
    async () => ({ status: (await req('GET', '/api/categories')).status }));

  await step('TC-18', 'Kategori', 'GET kategori dengan token user', 200,
    async () => ({ status: (await req('GET', '/api/categories', { token: token.user })).status }));

  // naikkan akun uji kedua menjadi admin untuk menguji endpoint admin
  await step('TC-19', 'Registrasi', 'Membuat akun uji kedua (calon admin)', 201,
    async () => ({ status: (await req('POST', '/api/auth/register',
      { body: { name: 'Blackbox Admin', email: EMAIL_ADMIN, password: PASS } })).status }));

  const db = new Client({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
    ...(process.env.DB_SSL === 'true' ? { ssl: { rejectUnauthorized: false } } : {}),
  });
  await db.connect();
  await db.query("UPDATE users SET role_id=(SELECT id FROM roles WHERE name='admin') WHERE email=$1", [EMAIL_ADMIN]);
  created.users.push(EMAIL_ADMIN);

  const loginAdmin = await req('POST', '/api/auth/login', { body: { email: EMAIL_ADMIN, password: PASS } });
  token.admin = loginAdmin.json?.data?.token || null;

  await step('TC-20', 'Kategori', 'Menambah kategori sebagai user biasa', 403,
    async () => ({ status: (await req('POST', '/api/categories',
      { token: token.user, body: { name: 'Kategori User' } })).status }));

  await step('TC-21', 'Kategori', 'Menambah kategori sebagai admin', 201,
    async () => {
      const r = await req('POST', '/api/categories',
        { token: token.admin, body: { name: `Uji Kategori ${STAMP}`, description: 'kategori uji blackbox' } });
      if (r.json?.data?.id) created.categories.push(r.json.data.id);
      return { status: r.status };
    });

  await step('TC-22', 'Kategori', 'Menambah kategori dengan nama 1 karakter', 422,
    async () => ({ status: (await req('POST', '/api/categories',
      { token: token.admin, body: { name: 'X' } })).status }));

  await step('TC-23', 'Kategori', 'Menambah kategori dengan nama duplikat', 409,
    async () => ({ status: (await req('POST', '/api/categories',
      { token: token.admin, body: { name: `Uji Kategori ${STAMP}` } })).status }));

  await step('TC-24', 'Kategori', 'Mengubah kategori yang ada', 200,
    async () => ({ status: (await req('PUT', `/api/categories/${created.categories[0]}`,
      { token: token.admin, body: { name: `Uji Kategori ${STAMP}`, description: 'diubah' } })).status }));

  await step('TC-25', 'Kategori', 'Mengubah kategori dengan ID tidak ada', 404,
    async () => ({ status: (await req('PUT', '/api/categories/999999',
      { token: token.admin, body: { name: 'Tidak Ada' } })).status }));

  // ---------------------------------------------------------------- produk
  await step('TC-26', 'Produk', 'GET daftar produk tanpa token (publik)', 200,
    async () => ({ status: (await req('GET', '/api/products')).status }));

  await step('TC-27', 'Produk', 'GET daftar produk dengan pencarian nama', 200,
    async () => ({ status: (await req('GET', '/api/products?search=hoodie')).status }));

  await step('TC-28', 'Produk', 'GET daftar produk dengan filter kategori', 200,
    async () => ({ status: (await req('GET', '/api/products?category_id=1')).status }));

  await step('TC-29', 'Produk', 'GET detail produk dengan ID valid', 200,
    async () => ({ status: (await req('GET', '/api/products/1')).status }));

  await step('TC-30', 'Produk', 'GET detail produk dengan ID tidak ada', 404,
    async () => ({ status: (await req('GET', '/api/products/999999')).status }));

  await step('TC-31', 'Produk', 'GET detail produk dengan ID bukan angka', 422,
    async () => ({ status: (await req('GET', '/api/products/abc')).status }));

  await step('TC-32', 'Produk', 'Menambah produk sebagai user biasa', 403,
    async () => {
      const form = new FormData();
      form.append('name', 'Produk User'); form.append('price', '1000');
      form.append('stock', '1'); form.append('category_id', '1');
      return { status: (await req('POST', '/api/products', { token: token.user, form })).status };
    });

  await step('TC-33', 'Produk', 'Menambah produk valid sebagai admin', 201,
    async () => {
      const form = new FormData();
      form.append('name', `Uji Produk ${STAMP}`);
      form.append('description', 'produk uji blackbox');
      form.append('price', '150000'); form.append('stock', '5');
      form.append('category_id', String(created.categories[0]));
      const r = await req('POST', '/api/products', { token: token.admin, form });
      if (r.json?.data?.id) created.products.push(r.json.data.id);
      return { status: r.status };
    });

  await step('TC-34', 'Produk', 'Menambah produk dengan harga negatif', 422,
    async () => {
      const form = new FormData();
      form.append('name', 'Produk Harga Minus'); form.append('price', '-500');
      form.append('stock', '1'); form.append('category_id', '1');
      return { status: (await req('POST', '/api/products', { token: token.admin, form })).status };
    });

  await step('TC-35', 'Produk', 'Menambah produk dengan stok bukan bilangan bulat', 422,
    async () => {
      const form = new FormData();
      form.append('name', 'Produk Stok Pecahan'); form.append('price', '1000');
      form.append('stock', '1.5'); form.append('category_id', '1');
      return { status: (await req('POST', '/api/products', { token: token.admin, form })).status };
    });

  await step('TC-36', 'Produk', 'Menambah produk dengan kategori tidak valid', 422,
    async () => {
      const form = new FormData();
      form.append('name', 'Produk Tanpa Kategori'); form.append('price', '1000');
      form.append('stock', '1'); form.append('category_id', '999999');
      return { status: (await req('POST', '/api/products', { token: token.admin, form })).status };
    });

  await step('TC-37', 'Upload', 'Mengunggah gambar PNG di bawah 2 MB', 201,
    async () => {
      const form = new FormData();
      form.append('name', `Produk Gambar ${STAMP}`);
      form.append('price', '75000'); form.append('stock', '2');
      form.append('category_id', String(created.categories[0]));
      form.append('image', new Blob([pngBuffer(50 * 1024)], { type: 'image/png' }), 'uji.png');
      const r = await req('POST', '/api/products', { token: token.admin, form });
      if (r.json?.data?.id) created.products.push(r.json.data.id);
      return { status: r.status };
    });

  await step('TC-38', 'Upload', 'Mengunggah file bertipe teks (ditolak)', 400,
    async () => {
      const form = new FormData();
      form.append('name', 'Produk File Teks'); form.append('price', '1000');
      form.append('stock', '1'); form.append('category_id', '1');
      form.append('image', new Blob(['bukan gambar'], { type: 'text/plain' }), 'uji.txt');
      return { status: (await req('POST', '/api/products', { token: token.admin, form })).status };
    });

  await step('TC-39', 'Upload', 'Mengunggah gambar lebih dari 2 MB', 413,
    async () => {
      const form = new FormData();
      form.append('name', 'Produk Gambar Besar'); form.append('price', '1000');
      form.append('stock', '1'); form.append('category_id', '1');
      form.append('image', new Blob([pngBuffer(3 * 1024 * 1024)], { type: 'image/png' }), 'besar.png');
      return { status: (await req('POST', '/api/products', { token: token.admin, form })).status };
    });

  await step('TC-40', 'Produk', 'Mengubah produk yang ada', 200,
    async () => {
      const form = new FormData();
      form.append('name', `Uji Produk ${STAMP} Edit`);
      form.append('price', '175000'); form.append('stock', '8');
      form.append('category_id', String(created.categories[0]));
      return { status: (await req('PUT', `/api/products/${created.products[0]}`,
        { token: token.admin, form })).status };
    });

  await step('TC-41', 'Produk', 'Mengubah produk dengan ID tidak ada', 404,
    async () => {
      const form = new FormData();
      form.append('name', 'Tidak Ada'); form.append('price', '1000');
      form.append('stock', '1'); form.append('category_id', '1');
      return { status: (await req('PUT', '/api/products/999999',
        { token: token.admin, form })).status };
    });

  // ---------------------------------------------------------------- pembelian
  await step('TC-42', 'Pembelian', 'User membeli produk yang stoknya tersedia', 200,
    async () => {
      const r = await req('POST', `/api/products/${created.products[0]}/purchase`, { token: token.user });
      const sisa = r.json?.data?.stock;
      return { status: r.status, extra: sisa !== undefined ? `stok sisa ${sisa}` : '' };
    });

  await step('TC-43', 'Pembelian', 'Admin mencoba membeli produk', 403,
    async () => ({ status: (await req('POST', `/api/products/${created.products[0]}/purchase`,
      { token: token.admin })).status }));

  await step('TC-44', 'Pembelian', 'Membeli tanpa token', 401,
    async () => ({ status: (await req('POST', `/api/products/${created.products[0]}/purchase`)).status }));

  await step('TC-45', 'Pembelian', 'Membeli produk yang tidak ada', 404,
    async () => ({ status: (await req('POST', '/api/products/999999/purchase',
      { token: token.user })).status }));

  await step('TC-46', 'Pembelian', 'Membeli produk dengan stok habis', 409,
    async () => {
      const form = new FormData();
      form.append('name', `Produk Stok Nol ${STAMP}`);
      form.append('price', '50000'); form.append('stock', '0');
      form.append('category_id', String(created.categories[0]));
      const c = await req('POST', '/api/products', { token: token.admin, form });
      const id = c.json?.data?.id;
      if (id) created.products.push(id);
      return { status: (await req('POST', `/api/products/${id}/purchase`,
        { token: token.user })).status };
    });

  // ---------------------------------------------------------------- integritas & error
  await step('TC-47', 'Integritas', 'Menghapus kategori yang masih dipakai produk', 409,
    async () => {
      const form = new FormData();
      form.append('name', `Produk Penjaga ${STAMP}`);
      form.append('price', '1000'); form.append('stock', '1');
      form.append('category_id', String(created.categories[0]));
      const p = await req('POST', '/api/products', { token: token.admin, form });
      const pid = p.json?.data?.id;
      if (pid) created.products.push(pid);
      return { status: (await req('DELETE', `/api/categories/${created.categories[0]}`,
        { token: token.admin })).status };
    });

  await step('TC-48', 'Error', 'Mengirim body JSON yang tidak valid', 400,
    async () => ({ status: (await req('POST', '/api/products', { raw: '{nama: rusak' })).status }));

  await step('TC-49', 'Error', 'Mengakses endpoint yang tidak terdaftar', 404,
    async () => ({ status: (await req('GET', '/api/tidak-ada')).status }));

  await step('TC-50', 'Produk', 'Menghapus produk sebagai admin', 200,
    async () => {
      const target = created.products.shift();
      return { status: (await req('DELETE', `/api/products/${target}`,
        { token: token.admin })).status };
    });

  await step('TC-51', 'Produk', 'Menghapus produk yang tidak ada', 404,
    async () => ({ status: (await req('DELETE', '/api/products/999999',
      { token: token.admin })).status }));

  // ---------------------------------------------------------------- cleanup
  console.log('\nMembersihkan data uji...');
  for (const pid of created.products) {
    await req('DELETE', `/api/products/${pid}`, { token: token.admin });
  }
  // hapus kategori & user lewat SQL agar sisa data uji tidak tertinggal
  if (created.categories.length) {
    await db.query('DELETE FROM products WHERE category_id = ANY($1)', [created.categories]);
    await db.query('DELETE FROM categories WHERE id = ANY($1)', [created.categories]);
  }
  if (created.users.length) {
    await db.query('DELETE FROM users WHERE email = ANY($1)', [created.users]);
  }
  await db.end();

  const pass = results.filter(r => r.hasil === 'PASS').length;
  const fail = results.filter(r => r.hasil === 'FAIL').length;
  console.log(`\nTOTAL ${results.length} | PASS ${pass} | FAIL ${fail}\n`);

  require('fs').writeFileSync(
    require('path').join(__dirname, 'blackbox-results.json'),
    JSON.stringify({ base: BASE, tanggal: new Date().toISOString(), total: results.length, pass, fail, results }, null, 2));
  console.log('Hasil tersimpan di test/blackbox-results.json');
  process.exit(fail ? 1 : 0);
})();
