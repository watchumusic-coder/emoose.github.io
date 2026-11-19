/**
 * routes/auth.js
 * ------------------------------------------------------------
 * Login / Logout dashboard EMOOSE.
 * Kredensial diambil dari .env (ADMIN_USERNAME / ADMIN_PASSWORD).
 * Setiap percobaan login (berhasil / gagal) dicatat ke access_log.
 * ------------------------------------------------------------
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');

function nowStr() {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

function getClientIp(req) {
  return (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').replace('::ffff:', '');
}

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  const ip = getClientIp(req);
  const ts = nowStr();

  const validUser = process.env.ADMIN_USERNAME || 'admin';
  const validPass = process.env.ADMIN_PASSWORD || 'emoose2026';

  const success = username === validUser && password === validPass;

  try {
    await db.run(
      'INSERT INTO access_log (timestamp, ip, username, success) VALUES (?, ?, ?, ?)',
      [ts, ip, username || '-', success ? 1 : 0]
    );
  } catch (err) {
    console.error('[AUTH] Gagal mencatat access_log:', err.message);
  }

  if (!success) {
    return res.status(401).json({ success: false, message: 'Username atau password salah.' });
  }

  req.session.user = { username, loginAt: ts };
  return res.json({ success: true, redirect: '/dashboard' });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('emoose.sid');
    res.json({ success: true, redirect: '/' });
  });
});

router.get('/me', (req, res) => {
  if (req.session && req.session.user) {
    return res.json({ success: true, user: req.session.user });
  }
  return res.status(401).json({ success: false });
});

module.exports = router;
