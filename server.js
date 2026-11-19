/**
 * server.js
 * ------------------------------------------------------------
 * EMOOSE Dashboard Server
 * Node.js + Express + Socket.IO + SQLite
 *
 * Menjalankan:
 *   - Static dashboard web (public/)
 *   - REST API (routes/api.js, routes/auth.js, routes/export.js)
 *   - Socket.IO realtime channel untuk sensor & event
 *
 * Jalankan dengan: npm install && npm start
 * Akses di      : http://<IP_WIFI_LAPTOP>:5135
 * ------------------------------------------------------------
 */

require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const sessionMiddleware = require('./config/session');
require('./config/database'); // memastikan tabel dibuat saat boot
const { requireAuthPage, requireAuthApi } = require('./middleware/authMiddleware');

const authRoutes = require('./routes/auth');
const exportRoutes = require('./routes/export');

const PORT = process.env.PORT || 5135;
const NODE_ID = process.env.NODE_ID || 'EMOOSE-NODE-01';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' } // ESP32 & dashboard berada di jaringan lokal yang sama
});

const apiRoutes = require('./routes/api')(io);
// =============================
// EMOOSE DEMO SIMULATION MODULE (plug-and-play)
// Hapus baris ini + file routes/demo.js + <script src="/js/demo.js"> di
// dashboard.html untuk menghilangkan fitur "Simulasi Darurat" sepenuhnya.
// =============================
const demoRoutes = require('./routes/demo')(io, requireAuthApi);

// ------------------------------------------------------------
// Middleware global
// ------------------------------------------------------------
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(sessionMiddleware);

// Bagikan session ke Socket.IO agar tahu siapa yang terhubung
io.engine.use(sessionMiddleware);

// ------------------------------------------------------------
// Static assets (css, js, images) selalu bisa diakses
// ------------------------------------------------------------
app.use('/css', express.static(path.join(__dirname, 'public', 'css')));
app.use('/js', express.static(path.join(__dirname, 'public', 'js')));
app.use('/assets', express.static(path.join(__dirname, 'public', 'assets')));

// ------------------------------------------------------------
// Halaman
// ------------------------------------------------------------
app.get('/', (req, res) => {
  if (req.session && req.session.user) return res.redirect('/dashboard');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', requireAuthPage, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/access-history', requireAuthPage, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'access-history.html'));
});

// ------------------------------------------------------------
// REST API
// ------------------------------------------------------------
app.use('/api', authRoutes);
app.use('/api', apiRoutes);
app.use('/api', demoRoutes); // EMOOSE DEMO SIMULATION MODULE (plug-and-play, aman dihapus)
app.use('/api/export', exportRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint tidak ditemukan.' });
});

// Error handler umum (menjaga server tetap hidup)
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err);
  res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server.' });
});

// ------------------------------------------------------------
// Socket.IO — hanya izinkan client yang sudah login dashboard
// ------------------------------------------------------------
let connectedClients = 0;

io.use((socket, next) => {
  const session = socket.request.session;
  if (session && session.user) return next();
  next(new Error('unauthorized'));
});

io.on('connection', (socket) => {
  connectedClients++;
  io.emit('client_count', { count: connectedClients });
  console.log(`[SOCKET.IO] Client terhubung (total: ${connectedClients})`);

  socket.on('disconnect', () => {
    connectedClients = Math.max(0, connectedClients - 1);
    io.emit('client_count', { count: connectedClients });
    console.log(`[SOCKET.IO] Client terputus (total: ${connectedClients})`);
  });
});

// ------------------------------------------------------------
// Start server
// ------------------------------------------------------------
server.listen(PORT, () => {
  console.log('================================================');
  console.log('  EMOOSE - Smart IoT Duck Farm Dashboard Server');
  console.log('================================================');
  console.log(`  Node       : ${NODE_ID}`);
  console.log(`  Port       : ${PORT}`);
  console.log(`  Local URL  : http://localhost:${PORT}`);
  console.log(`  Network URL: http://<IP_WIFI_LAPTOP>:${PORT}`);
  console.log('================================================');
});
