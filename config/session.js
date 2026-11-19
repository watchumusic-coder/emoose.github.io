/**
 * config/session.js
 * ------------------------------------------------------------
 * Konfigurasi express-session yang dipakai bersama oleh
 * Express (HTTP routes) dan Socket.IO (agar tahu siapa yang login).
 * ------------------------------------------------------------
 */

const session = require('express-session');

const sessionMiddleware = session({
  name: 'emoose.sid',
  secret: process.env.SESSION_SECRET || 'emoose-super-secret-change-this',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 8, // 8 jam
    sameSite: 'lax'
  }
});

module.exports = sessionMiddleware;
