/**
 * socket.js — Koneksi Socket.IO realtime ke server EMOOSE.
 * Halaman lain (dashboard.js, table.js, map.js, chart.js) berlangganan
 * event lewat window.EmooseSocket.on(...).
 */
(function () {
  const socket = io({ withCredentials: true });

  socket.on('connect_error', () => {
    console.warn('[SOCKET.IO] Gagal terhubung, mencoba lagi...');
  });

  window.EmooseSocket = socket;
})();
