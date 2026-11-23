-- Database: fashionhub (MySQL 8)
CREATE DATABASE IF NOT EXISTS fashionhub CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE fashionhub;

CREATE TABLE roles (
  id   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(20) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role_id       INT UNSIGNED NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id)
) ENGINE=InnoDB;

CREATE TABLE categories (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL UNIQUE,
  description VARCHAR(255) NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE products (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_id INT UNSIGNED NOT NULL,
  created_by  INT UNSIGNED NULL,
  name        VARCHAR(150) NOT NULL,
  description TEXT NULL,
  price       DECIMAL(12,2) NOT NULL,
  stock       INT NOT NULL DEFAULT 0,
  image_url        VARCHAR(500) NULL,     -- secure_url dari Cloudinary
  image_public_id  VARCHAR(255) NULL,     -- public_id Cloudinary (untuk hapus/ganti gambar)
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
  CONSTRAINT fk_products_user     FOREIGN KEY (created_by)  REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_products_name (name)
) ENGINE=InnoDB;

INSERT INTO roles (name) VALUES ('admin'), ('user');
-- Akun admin & data contoh dibuat lewat: npm run seed
