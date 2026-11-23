require('dotenv').config();
const { v2: cloudinary } = require('cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Upload buffer (dari multer memoryStorage) -> { secure_url, public_id }
exports.uploadBuffer = buffer =>
  new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        { folder: 'fashionhub/products', resource_type: 'image', transformation: [{ width: 1280, crop: 'limit' }] },
        (err, result) => {
          if (err) { const e = new Error('Gagal mengunggah gambar ke Cloudinary'); e.status = 502; return reject(e); }
          resolve({ secure_url: result.secure_url, public_id: result.public_id });
        })
      .end(buffer);
  });

// Hapus gambar; kegagalan hapus tidak menggagalkan request
exports.remove = publicId =>
  publicId ? cloudinary.uploader.destroy(publicId).catch(() => {}) : Promise.resolve();
