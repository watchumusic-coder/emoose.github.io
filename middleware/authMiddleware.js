/**
 * middleware/authMiddleware.js
 * ------------------------------------------------------------
 * Melindungi halaman dashboard dan endpoint API dari akses
 * tanpa login (BAB 12 TDD - Security Design).
 * ------------------------------------------------------------
 */

function requireAuthPage(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.redirect('/');
}

function requireAuthApi(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.status(401).json({ success: false, message: 'Unauthorized. Silakan login kembali.' });
}

module.exports = { requireAuthPage, requireAuthApi };
