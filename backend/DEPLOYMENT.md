# Deploy FashionHub API — Vercel + Aiven

Panduan ini mencatat langkah deploy yang **sudah disiapkan di repo** dan langkah yang
**harus dikerjakan manual** karena butuh akun/kredensial.

---

## 1. Yang sudah siap di repo

| File | Perubahan |
|---|---|
| `backend/vercel.json` | Ganti `builds`/`routes` legacy → `rewrites` ke `/api/index` |
| `backend/package.json` | `engines.node` `20.x` → `24.x` (Node 20 dimatikan Vercel 1 Okt 2026); `mysql2` → `pg` |
| `backend/api/index.js` | Entry Serverless Function (ekspor instance Express, tanpa `app.listen`) |
| `backend/src/config/db.js` | Pool `pg` + dukungan `DB_PORT`, `DB_SSL`, `DB_CA_CERT` untuk Aiven |
| `database/schema.postgres.sql` | DDL PostgreSQL (padanan `schema.sql` MySQL lama) |
| `backend/scripts/db-init.js` | Membuat tabel dari `schema.postgres.sql` |
| `backend/scripts/migrate-to-postgres.js` | Menyalin seluruh data MySQL → PostgreSQL |
| `backend/scripts/copy-to-aiven.js` | Menyalin seluruh data PostgreSQL lokal → Aiven (schema + baris + sequence) |
| `backend/scripts/deploy.sh` | Unggah env dari `.env` ke Vercel lalu `vercel --prod` |

Diverifikasi lokal terhadap PostgreSQL 18: blackbox 51/51 PASS, `db:init` dan `seed` jalan,
migrasi menyalin 2 role + 4 user + 4 kategori + 8 produk dengan id dan timestamp identik.

---

## 2. Status Aiven

**Free tier MySQL Aiven sudah ditutup** (6 Nov 2026 tidak bisa membuat service baru,
21 Des 2026 service lama dimatikan). Yang masih gratis adalah **PostgreSQL**, dan itu
kebetulan yang sekarang dipakai project ini.

---

## 3. Buat database Aiven PostgreSQL

1. Daftar/masuk di <https://console.aiven.io>.
2. **Create service** → pilih **PostgreSQL** → plan **Free**.
3. Pilih region terdekat (mis. `Singapore`), klik **Create**.
4. Setelah service `RUNNING`, buka **Overview → Connection information**. Catat:
   - `Host`, `Port` (bukan 5432 — Aiven memakai port kustom)
   - `User` (`avnadmin`), `Password`, `Database` (`defaultdb`)
5. Pada bagian **CA certificate**, salin isi sertifikatnya (format PEM).

### Batas koneksi

Plan gratis Aiven membatasi `max_connections` ke **20**. Serverless membuka koneksi
paralel, jadi **set `DB_POOL=3`** saat deploy.

---

## 4. Siapkan database

Dua pilihan, pilih salah satu.

**Database baru (kosong):**

```bash
cd backend
cp .env.example .env      # isi DB_* dengan kredensial Aiven
node scripts/db-init.js --seed
```

**Pindahkan data dari PostgreSQL lokal ke Aiven:**

```bash
cd backend
# .env berisi kredensial PostgreSQL lokal, .env.aiven berisi kredensial Aiven
node scripts/copy-to-aiven.js --from .env --to .env.aiven
```

Skrip membuat tabel di Aiven, menyalin semua baris beserta id aslinya, menyetel sequence,
lalu memeriksa relasi (user tanpa role, produk tanpa kategori, email duplikat). Aman
dijalankan ulang — baris yang sudah ada tidak ditimpa.

> `.env.aiven` berisi kredensial, jadi jangan di-commit. Simpan di `%TEMP%` bila tidak
> ingin meninggalkannya di folder project.

**Pindahkan langsung dari MySQL lama (tanpa lewat lokal):**

```bash
node scripts/migrate-to-postgres.js --mysql .env.mysql --pg .env.aiven
```

Skrip membuat tabel, menyalin semua baris beserta id aslinya, menyetel sequence, lalu
memeriksa relasi (user tanpa role, produk tanpa kategori, email duplikat). Aman dijalankan
ulang — baris yang sudah ada tidak ditimpa.

> Kalau `DB_CA_CERT` diisi utuh satu baris, tulis baris baru sebagai `\n` —
> `src/config/db.js` mengubahnya kembali menjadi newline. Alternatif cepat untuk uji:
> `DB_SSL=true` + `DB_SSL_MODE=no-verify` (tanpa verifikasi CA, jangan untuk produksi).

---

## 5. Deploy ke Vercel

Cara cepat (semua env var dari `.env` diunggah, lalu deploy production):

```bash
cd backend
vercel login     # sekali saja
vercel link      # sekali saja: buat project baru, root directory = backend
bash scripts/deploy.sh
```

`scripts/deploy.sh` membaca `backend/.env`, mengunggah `DB_*`, `JWT_*`, dan
`CLOUDINARY_*` ke environment **production** Vercel, lalu menjalankan
`vercel --prod`. Nilai secret tidak pernah dicetak ke layar — hanya jumlah
karakternya.

### Manual (kalau tidak memakai script)

```bash
cd backend
vercel login
vercel link
vercel --prod
```

### Environment variables di Vercel

Tambahkan untuk **Production** (dan Preview bila perlu):

```bash
vercel env add DB_HOST production
vercel env add DB_PORT production
vercel env add DB_USER production
vercel env add DB_PASSWORD production
vercel env add DB_NAME production
vercel env add DB_SSL production        # isi: true
vercel env add DB_CA_CERT production    # isi PEM satu baris, newline sebagai \n
vercel env add DB_SSL_MODE production   # opsional: no-verify bila CA tidak disertakan
vercel env add DB_POOL production       # isi: 3 (free plan Aiven maks 20 koneksi)
vercel env add JWT_SECRET production
vercel env add JWT_EXPIRES production   # isi: 1d
vercel env add CLOUDINARY_CLOUD_NAME production
vercel env add CLOUDINARY_API_KEY production
vercel env add CLOUDINARY_API_SECRET production
```

Atau lewat dashboard: **Project → Settings → Environment Variables** (lebih mudah
untuk nilai panjang seperti `DB_CA_CERT`).

Deploy ulang setelah env diisi:

```bash
vercel --prod
```

---

## 6. Verifikasi setelah deploy

Ganti `BASE` dengan domain Vercel kamu.

```bash
curl https://BASE/
```

Harapan:

```json
{"success":true,"message":"FashionHub API berjalan","data":null}
```

Uji login admin:

```bash
curl -X POST https://BASE/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@fashionhub.com","password":"Admin123"}'
```

Uji blackbox lengkap terhadap domain production:

```bash
node test/blackbox.js https://BASE
```

> Catatan: `test/blackbox.js` juga membersihkan data uji lewat koneksi DB (`pg`)
> memakai `.env` lokal, jadi `.env` harus mengarah ke Aiven saat uji. Untuk menguji
> dengan kredensial lain tanpa mengubah `.env`, pakai `ENV_FILE=path/env node test/blackbox.js ...`.

---

## 7. Arahkan aplikasi Flutter ke API production

`mobile_fashion/lib/api.dart` sudah mendukung override lewat `--dart-define`,
jadi tidak perlu ubah kode:

```bash
cd mobile_fashion
flutter run --dart-define=API_BASE_URL=https://<domain-vercel>
# atau untuk build rilis:
flutter build apk --dart-define=API_BASE_URL=https://<domain-vercel>
```

Tanpa `API_BASE_URL`, app memakai `10.0.2.2:3000` (emulator Android) atau
`localhost:3000` (web/desktop) — hanya untuk pengembangan lokal.

---

## 8. Yang perlu diingat

- `.env` tidak ikut ter-deploy (ada di `.gitignore`); semua nilai harus diisi
  ulang sebagai Environment Variables di Vercel.
- Upload gambar memakai `memoryStorage` → tidak menulis ke disk, aman untuk
  serverless. File diteruskan ke Cloudinary.
- `vercel.json` memakai `rewrites`, bukan `builds` legacy, agar kompatibel
  dengan runtime Vercel Functions saat ini.
