# ERD FashionHub

Diagram ini menggambarkan tabel yang benar-benar ada pada `database/schema.sql`.
Fitur beli saat ini mengurangi `products.stock` dalam transaksi database, tetapi
belum membuat catatan pesanan atau pembayaran.

```mermaid
erDiagram
  roles      ||--o{ users      : "memberi peran"
  users      o|--o{ products   : "membuat"
  categories ||--o{ products   : "mengelompokkan"

  roles {
    INT id PK
    VARCHAR20 name "UNIQUE"
  }
  users {
    INT id PK
    VARCHAR100 name
    VARCHAR150 email "UNIQUE"
    VARCHAR255 password_hash
    INT role_id FK
    TIMESTAMP created_at
  }
  categories {
    INT id PK
    VARCHAR100 name "UNIQUE"
    VARCHAR255 description
    TIMESTAMP created_at
  }
  products {
    INT id PK
    INT category_id FK
    INT created_by FK "NULL"
    VARCHAR150 name
    TEXT description
    DECIMAL12_2 price
    INT stock
    VARCHAR500 image_url
    VARCHAR255 image_public_id
    TIMESTAMP created_at
    TIMESTAMP updated_at
  }
```

Relasi:
- Satu `role` dapat dimiliki banyak `users`; setiap user harus memiliki satu role.
- Satu `category` dapat mengelompokkan banyak `products`; setiap produk harus memiliki satu kategori.
- Satu `user` dapat membuat banyak `products`; `created_by` pada produk boleh kosong.

`category_id` menggunakan `ON DELETE RESTRICT`; kategori yang masih dipakai produk
tidak dapat dihapus. `created_by` menggunakan `ON DELETE SET NULL`; produk tetap
ada jika akun pembuatnya dihapus.
