// Entry point Vercel Serverless Function.
// Vercel tidak menjalankan app.listen(), cukup mengekspor instance Express.
module.exports = require('../src/app');
