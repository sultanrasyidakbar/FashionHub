# FashionHub — Aplikasi Digital UMKM Fashion

Manajemen produk dan stok untuk toko fashion. Stack: **Node.js + Express**, **PostgreSQL**, **Flutter**, upload gambar via **Multer + Cloudinary** (backend memvalidasi file, mengunggah ke Cloudinary, URL disimpan di DB).

## Struktur
```
database/schema.sql          -> DDL MySQL lama (arsip, dipakai sebagai sumber migrasi)
database/schema.postgres.sql -> DDL PostgreSQL yang dipakai sekarang
docs/ERD.md                  -> ERD (Mermaid)
backend/                     -> REST API (Cloudinary di src/config/cloudinary.js)
mobile/                      -> source Flutter (lib/ + pubspec.yaml)
```

## Setup Cloudinary
1. Daftar gratis di cloudinary.com, buka Dashboard.
2. Salin Cloud name, API Key, dan API Secret ke `backend/.env` (`CLOUDINARY_*`).

## Menjalankan Backend
```bash
createdb fashionhub                # atau buat database lewat pgAdmin/psql
cd backend
cp .env.example .env        # isi DB_*, JWT_SECRET, dan CLOUDINARY_*
npm install
npm run db:init             # membuat tabel dari database/schema.postgres.sql
npm run seed                # admin@fashionhub.com / Admin123 + 4 kategori + 6 produk contoh
npm start                   # http://localhost:3000
```

Memindahkan data dari database MySQL lama:

```bash
cd backend
node scripts/migrate-to-postgres.js --mysql .env.mysql --pg .env
```

`--mysql` menunjuk file env berisi kredensial MySQL sumber, `--pg` file env PostgreSQL
tujuan. Skrip membuat tabel, menyalin seluruh baris beserta id aslinya, lalu memeriksa
integritas relasi.

## Menjalankan Flutter
```bash
cd mobile
flutter create . --project-name fashionhub --platforms android   # generate folder android/ (lib & pubspec tidak ditimpa)
flutter pub get
flutter run
```
Tambahkan di `android/app/src/main/AndroidManifest.xml`:
- sebelum `<application>`: `<uses-permission android:name="android.permission.INTERNET"/>`
- pada tag `<application ...>`: `android:usesCleartextTraffic="true"`

Ubah `baseUrl` di `lib/api.dart` (emulator: `10.0.2.2`; HP fisik: IP laptop).

## Struktur Aplikasi Flutter
`lib/screens/`: splash, auth (login/register), main_shell (bottom nav), dashboard_tab, products_tab, categories_tab, profile_tab, product_detail_screen, product_form_screen.

## Role & Hak Akses
| Aksi | admin | user |
|---|---|---|
| Lihat produk & kategori | ✔ | ✔ |
| Tambah/ubah/hapus produk + upload gambar | ✔ | ✘ (403) |
| CRUD kategori | ✔ | ✘ (403) |

Register hanya membuat role `user`; admin dibuat lewat seed (mencegah privilege escalation). Pada database lama yang masih memakai role `kasir`, jalankan sekali `database/migrations/001_replace_kasir_with_user.sql`.

## Endpoint
Semua respons: `{ "success": bool, "message": str, "data": ..., "errors": [...]? }`

| Method | Path | Akses | Status |
|---|---|---|---|
| POST | /api/auth/register | publik | 201, 409 email duplikat, 422 |
| POST | /api/auth/login | publik | 200, 401, 422 |
| GET | /api/auth/me | login | 200, 401 |
| PUT | /api/auth/profile | login | 200, 422 |
| PUT | /api/auth/password | login | 200, 400 (password lama salah), 422 |
| GET | /api/categories | login | 200 |
| POST/PUT/DELETE | /api/categories[/:id] | admin | 201/200, 404, 409 (masih dipakai), 422, 403 |
| GET | /api/products?search=&category_id= | login | 200 |
| GET | /api/products/:id | login | 200, 404 |
| POST | /api/products (multipart, field `image`) | admin | 201, 403, 413 (>2MB), 400 (tipe), 422 |
| PUT | /api/products/:id (multipart) | admin | 200, 403, 404, 422 |
| DELETE | /api/products/:id | admin | 200, 404, 403 |

Upload: hanya JPG/PNG/WEBP, maks 2 MB (divalidasi di backend), lalu diunggah ke Cloudinary folder `fashionhub/products`. Gambar lama otomatis dihapus dari Cloudinary saat diganti atau produk dihapus. Jika Cloudinary gagal: 502.

## Checklist Kriteria
- Backend: HTTP method & status code sesuai, JSON konsisten, CRUD `categories`↔`products`, bcrypt hash, JWT, middleware `authenticate` + `authorize(role)`, upload tervalidasi, express-validator + error handler global, semua data dari PostgreSQL.
- Mobile: splash, login/register (dengan konfirmasi password), dashboard, bottom navigation (Beranda, Produk, Kategori, Profil), produk tampilan grid + pencarian + filter, list & detail, tambah, edit, hapus dengan dialog konfirmasi, upload gambar (galeri/kamera), tampil gambar, tombol hapus & menu kategori hanya untuk admin, SnackBar sukses/gagal.
- Nilai tambah: pencarian, filter kategori, ringkasan stok menipis, pull-to-refresh.

## Contoh uji cepat (curl)
```bash
TOKEN=$(curl -s -X POST localhost:3000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@fashionhub.com","password":"Admin123"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["token"])')
curl -X POST localhost:3000/api/products -H "Authorization: Bearer $TOKEN" \
  -F name="Nasi Goreng" -F price=18000 -F stock=20 -F category_id=1 -F image=@foto.jpg
```
