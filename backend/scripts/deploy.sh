#!/usr/bin/env bash
# Siapkan environment variables di Vercel dari backend/.env, lalu deploy production.
#
# Pemakaian (dari folder backend/):
#   bash scripts/deploy.sh
#
# Prasyarat:
#   1. `vercel login` sudah berhasil
#   2. `vercel link` sudah dijalankan (project terhubung)
#   3. backend/.env sudah berisi kredensial Aiven (DB_HOST, DB_PORT, DB_SSL, DB_CA_CERT)
#
# Script ini TIDAK menampilkan nilai secret ke layar.

set -euo pipefail

ENV_FILE=".env"
[ -f "$ENV_FILE" ] || { echo "GAGAL: $ENV_FILE tidak ditemukan. Jalankan dari folder backend/."; exit 1; }

# git-bash di Windows sering tidak punya folder npm global di PATH.
# Cari binary vercel sendiri supaya script tetap jalan dari VS Code / Git Bash.
if command -v vercel >/dev/null 2>&1; then
  VERCEL="vercel"
elif [ -x "$(npm config get prefix 2>/dev/null)/vercel" ]; then
  VERCEL="$(npm config get prefix)/vercel"
elif [ -f "$USERPROFILE/AppData/Roaming/npm/vercel" ]; then
  VERCEL="$USERPROFILE/AppData/Roaming/npm/vercel"
else
  echo "GAGAL: perintah 'vercel' tidak ditemukan. Jalankan: npm install -g vercel"
  exit 1
fi

# Variabel yang wajib ada di Vercel (PORT tidak perlu: Vercel mengatur sendiri).
VARS=(
  DB_HOST DB_PORT DB_USER DB_PASSWORD DB_NAME DB_SSL DB_CA_CERT DB_SSL_MODE DB_POOL
  JWT_SECRET JWT_EXPIRES
  CLOUDINARY_CLOUD_NAME CLOUDINARY_API_KEY CLOUDINARY_API_SECRET
)

# Ambil nilai dari .env tanpa mengeksekusi isinya.
get_var() {
  local key="$1"
  sed -n "s/^${key}=//p" "$ENV_FILE" | head -1
}

echo "==> Cek login Vercel"
if ! "$VERCEL" whoami >/dev/null 2>&1; then
  echo "GAGAL: belum login. Jalankan: vercel login"
  exit 1
fi
echo "    login ok: $("$VERCEL" whoami 2>/dev/null)"

echo
echo "==> Cek koneksi database di .env"
DB_HOST_VAL="$(get_var DB_HOST)"
if [ "$DB_HOST_VAL" = "localhost" ] || [ "$DB_HOST_VAL" = "127.0.0.1" ]; then
  echo "PERINGATAN: DB_HOST masih '$DB_HOST_VAL'."
  echo "             Isi dulu kredensial Aiven PostgreSQL di $ENV_FILE sebelum deploy."
  read -r -p "Lanjutkan tetap? (y/N) " ans
  [ "$ans" = "y" ] || exit 1
fi
if [ -z "$(get_var DB_POOL)" ]; then
  echo "CATATAN: DB_POOL kosong. Aiven PostgreSQL free hanya mengizinkan 20 koneksi;"
  echo "         disarankan DB_POOL=3 untuk serverless."
fi

echo
echo "==> Menambahkan environment variables ke Vercel (production)"
for key in "${VARS[@]}"; do
  value="$(get_var "$key")"
  if [ -z "$value" ]; then
    echo "    lewati $key (kosong di .env)"
    continue
  fi
  # Hapus dulu kalau sudah ada, supaya nilainya benar-benar diperbarui.
  "$VERCEL" env rm "$key" production --yes >/dev/null 2>&1 || true
  printf '%s' "$value" | "$VERCEL" env add "$key" production >/dev/null 2>&1 \
    && echo "    ok   $key (${#value} karakter)" \
    || { echo "    GAGAL $key"; exit 1; }
done

echo
echo "==> Deploy production"
"$VERCEL" --prod

echo
echo "Selesai. Uji dengan:"
echo "  curl https://<domain-vercel>/"
