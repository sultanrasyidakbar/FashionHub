require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.json({ success: true, message: 'FashionHub API berjalan', data: null }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/products', require('./routes/products'));

app.use((err, req, res, next) =>
  err.type === 'entity.parse.failed'
    ? res.status(400).json({ success: false, message: 'JSON tidak valid' })
    : next(err));
app.use(notFound);
app.use(errorHandler);
module.exports = app;
