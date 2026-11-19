/**
 * routes/api.js
 * ------------------------------------------------------------
 * Endpoint REST API utama EMOOSE.
 *
 *  ESP32 -> Server:
 *    POST /api/sensor   (data sensor tiap 1 detik)
 *    POST /api/event    (event diskrit: fan on/off, door, dsb)
 *
 *  Dashboard -> Server:
 *    GET    /api/sensor/latest
 *    GET    /api/sensor/history
 *    GET    /api/events
 *    DELETE /api/events/:id
 *    DELETE /api/events/all
 *    GET    /api/status
 *    GET    /api/settings
 *    POST   /api/settings
 * ------------------------------------------------------------
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../config/database');
const T = require('../config/thresholds');
const { sendTelegramMessage, buildAlertMessage } = require('../utils/telegram');
const { requireAuthApi } = require('../middleware/authMiddleware');

const NODE_ID = process.env.NODE_ID || 'EMOOSE-NODE-01';

// Menyimpan status terakhir di memori untuk deteksi *perubahan* status
// (dipakai supaya event & telegram hanya terkirim saat transisi, bukan tiap detik)
let lastKnownStatus = null;
// PENTING: mulai dari 0 (belum pernah), BUKAN Date.now() -- kalau di-set waktu boot,
// status akan salah tampil "online" beberapa detik pertama setelah server restart
// walau ESP32 belum pernah mengirim data sama sekali (status palsu/tipuan).
let lastSeenAt = 0;
let lastWifiRssi = null;

function wifiQualityLabel(rssi) {
  if (rssi == null || rssi === 0) return null;
  if (rssi >= -60) return 'Kuat';
  if (rssi >= -75) return 'Sedang';
  return 'Lemah';
}

function nowStr() {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

function clampValid(value, min, max) {
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  if (n < min || n > max) return null;
  return n;
}

function getClientIp(req) {
  return (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().replace('::ffff:', '');
}

module.exports = function (io) {
  // ------------------------------------------------------------
  // POST /api/sensor  <-- dipanggil oleh firmware ESP32 tiap 1 detik
  // ------------------------------------------------------------
  router.post('/sensor', async (req, res) => {
    try {
      const body = req.body || {};
      const ts = body.timestamp || nowStr();

      const temperature = clampValid(body.temperature, T.TEMP.VALID_MIN, T.TEMP.VALID_MAX);
      const humidity = clampValid(body.humidity, T.HUM.VALID_MIN, T.HUM.VALID_MAX);
      const mq135 = clampValid(body.mq135, T.MQ135.VALID_MIN, T.MQ135.VALID_MAX);
      const water = clampValid(body.water, T.WATER.VALID_MIN, T.WATER.VALID_MAX);
      const pir = body.pir ? 1 : 0;
      const fan = body.fan || 'OFF';
      const pump = body.pump || 'OFF';
      const sg90 = body.servo || body.sg90 || '-';
      const mg996r = body.mg996r || '-';
      const status = (body.status || 'NORMAL').toUpperCase();

      // Field baru firmware v2 (opsional - dashboard lama/firmware lama tetap kompatibel)
      const fanPercent = Number.isFinite(Number(body.fanPercent)) ? Number(body.fanPercent) : (fan === 'ON' ? 100 : 0);
      const safeMode = body.safeMode ? 1 : 0;
      const predictedTemp = Number.isFinite(Number(body.predictedTemp)) ? Number(body.predictedTemp) : null;
      const predictedMQ135 = Number.isFinite(Number(body.predictedMQ135)) ? Number(body.predictedMQ135) : null;
      const wifiRssi = Number.isFinite(Number(body.wifiRssi)) ? Number(body.wifiRssi) : null;
      if (wifiRssi) lastWifiRssi = wifiRssi;

      await db.run(
        `INSERT INTO sensor_logs (timestamp, temperature, humidity, mq135, water, pir, fan, pump, sg90, mg996r, status, fan_percent, safe_mode, predicted_temp, predicted_mq135)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [ts, temperature, humidity, mq135, water, pir, fan, pump, sg90, mg996r, status, fanPercent, safeMode, predictedTemp, predictedMQ135]
      );

      lastSeenAt = Date.now();

      const payload = {
        node: NODE_ID, timestamp: ts, temperature, humidity, mq135, water,
        pir: !!pir, fan, pump, sg90, mg996r, status,
        fanPercent, safeMode: !!safeMode, predictedTemp, predictedMQ135
      };

      io.emit('sensor_update', payload);
      io.emit('device_online', { node: NODE_ID, timestamp: ts });

      // Deteksi transisi status untuk logging + Telegram (bukan spam tiap detik)
      if (lastKnownStatus !== status) {
        const prevStatus = lastKnownStatus;
        lastKnownStatus = status;

        const description = `Status berubah dari ${prevStatus || 'UNKNOWN'} menjadi ${status}`;
        const level = (status === 'ABNORMAL' || status === 'EMERGENCY') ? 'ALARM' : (status === 'WARNING' ? 'WARNING' : 'INFO');

        const evt = await db.run(
          `INSERT INTO event_logs (timestamp, event, description, level, source) VALUES (?, ?, ?, ?, ?)`,
          [ts, `Status ${status}`, description, level, 'ESP32']
        );
        io.emit('event_update', { id: evt.id, timestamp: ts, event: `Status ${status}`, description, level, source: 'ESP32' });

        if (status === 'ABNORMAL' || status === 'EMERGENCY') {
          const msg = buildAlertMessage({
            nodeId: NODE_ID, status, temperature, humidity, mq135, water, fan, pump, timestamp: ts, ip: getClientIp(req)
          });
          const result = await sendTelegramMessage(msg, { debounceKey: `status_${status.toLowerCase()}` });
          if (result.sent) io.emit('telegram_sent', { timestamp: ts, type: status });
        } else if ((prevStatus === 'ABNORMAL' || prevStatus === 'EMERGENCY') && status === 'NORMAL') {
          const msg = buildAlertMessage({
            nodeId: NODE_ID, status, temperature, humidity, mq135, water, fan, pump, timestamp: ts, ip: getClientIp(req)
          });
          const result = await sendTelegramMessage(msg, { debounceKey: 'status_normal' });
          if (result.sent) io.emit('telegram_sent', { timestamp: ts, type: 'NORMAL' });
        }
      }

      res.json({ success: true });
    } catch (err) {
      console.error('[API] /sensor error:', err.message);
      res.status(500).json({ success: false, message: 'Sensor Error' });
    }
  });

  // ------------------------------------------------------------
  // POST /api/event  <-- event diskrit dari firmware (fan on/off, door, dsb)
  // ------------------------------------------------------------
  router.post('/event', async (req, res) => {
    try {
      const body = req.body || {};
      const ts = body.timestamp || nowStr();
      const event = body.event || 'Unknown Event';
      const description = body.description || '';
      const level = (body.level || 'INFO').toUpperCase();
      const source = body.source || 'ESP32';

      const result = await db.run(
        `INSERT INTO event_logs (timestamp, event, description, level, source) VALUES (?, ?, ?, ?, ?)`,
        [ts, event, description, level, source]
      );

      const payload = { id: result.id, timestamp: ts, event, description, level, source };
      io.emit('event_update', payload);

      if (level === 'ALARM' || level === 'ABNORMAL') {
        const msg = `🚨 <b>EMOOSE EVENT</b>\nNode  : ${NODE_ID}\nEvent : ${event}\nDetail: ${description}\nWaktu : ${ts}`;
        const result2 = await sendTelegramMessage(msg, { debounceKey: `event_${event}` });
        if (result2.sent) io.emit('telegram_sent', { timestamp: ts, type: event });
      }

      res.json({ success: true, id: result.id });
    } catch (err) {
      console.error('[API] /event error:', err.message);
      res.status(500).json({ success: false, message: 'Event Error' });
    }
  });

  // ------------------------------------------------------------
  // GET /api/command/next  <-- dijemput (polling) oleh firmware ESP32 tiap 2 detik
  // POST /api/command/ack  <-- dipanggil ESP32 setelah perintah dieksekusi
  // Tidak pakai requireAuthApi karena ESP32 bukan browser (tidak punya session cookie).
  // ------------------------------------------------------------
  router.get('/command/next', async (req, res) => {
    try {
      const row = await db.get(
        `SELECT * FROM commands WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1`
      );
      if (!row) {
        return res.json({ success: true, command: null });
      }
      await db.run(`UPDATE commands SET status = 'sent' WHERE id = ?`, [row.id]);
      res.json({ success: true, command: { id: row.id, type: row.type, action: row.action } });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  router.post('/command/ack', async (req, res) => {
    try {
      const { id } = req.body || {};
      if (id) {
        await db.run(`UPDATE commands SET status = 'done', acked_at = ? WHERE id = ?`, [nowStr(), id]);
        io.emit('command_acked', { id });
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // ------------------------------------------------------------
  // Endpoint berikut WAJIB login (dipakai dashboard)
  // ------------------------------------------------------------
  router.use(requireAuthApi);

  router.get('/sensor/latest', async (req, res) => {
    try {
      const row = await db.get('SELECT * FROM sensor_logs ORDER BY id DESC LIMIT 1');
      const online = lastSeenAt > 0 && (Date.now() - lastSeenAt < 15000); // online HANYA jika pernah & baru menerima data ESP32
      res.json({ success: true, data: row || null, node: NODE_ID, online });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  router.get('/sensor/history', async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit, 10) || 100, 1000);
      const rows = await db.all('SELECT * FROM sensor_logs ORDER BY id DESC LIMIT ?', [limit]);
      res.json({ success: true, data: rows.reverse() });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  router.get('/events', async (req, res) => {
    try {
      const { search, status, date, page, limit } = req.query;
      const p = Math.max(parseInt(page, 10) || 1, 1);
      const l = Math.min(parseInt(limit, 10) || 25, 200);
      const offset = (p - 1) * l;

      const clauses = [];
      const params = [];

      if (search) {
        clauses.push('(event LIKE ? OR description LIKE ?)');
        params.push(`%${search}%`, `%${search}%`);
      }
      if (status) {
        clauses.push('level = ?');
        params.push(status.toUpperCase());
      }
      if (date) {
        clauses.push('timestamp LIKE ?');
        params.push(`${date}%`);
      }

      const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

      const totalRow = await db.get(`SELECT COUNT(*) as count FROM event_logs ${where}`, params);
      const rows = await db.all(
        `SELECT * FROM event_logs ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
        [...params, l, offset]
      );

      res.json({ success: true, data: rows, total: totalRow.count, page: p, limit: l });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Peta rentang -> berapa hari cutoff. "all" = hapus semua tanpa syarat.
  const DELETE_RANGE_DAYS = { '3d': 3, '1w': 7, '3w': 21, '1m': 30 };

  router.delete('/events/all', async (req, res) => {
    try {
      const range = req.query.range || 'all';
      if (range === 'all') {
        await db.run('DELETE FROM event_logs');
      } else {
        const days = DELETE_RANGE_DAYS[range];
        if (!days) return res.status(400).json({ success: false, message: 'Rentang tidak dikenal.' });
        const cutoff = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString().replace('T', ' ').substring(0, 19);
        await db.run('DELETE FROM event_logs WHERE timestamp < ?', [cutoff]);
      }
      io.emit('events_cleared', {});
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  router.delete('/events/:id', async (req, res) => {
    try {
      await db.run('DELETE FROM event_logs WHERE id = ?', [req.params.id]);
      io.emit('event_deleted', { id: Number(req.params.id) });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  router.get('/status', async (req, res) => {
    const online = lastSeenAt > 0 && (Date.now() - lastSeenAt < 15000);
    res.json({
      success: true,
      wifi: online ? 'ONLINE' : 'OFFLINE',
      esp32: online ? 'CONNECTED' : 'DISCONNECTED',
      telegram: (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) ? 'CONFIGURED' : 'NOT_CONFIGURED',
      database: 'READY',
      node: NODE_ID,
      serverTime: nowStr(),
      wifiRssi: online ? lastWifiRssi : null,
      wifiQuality: online ? wifiQualityLabel(lastWifiRssi) : null
    });
  });

  router.get('/config/node', async (req, res) => {
    res.json({
      success: true,
      node: NODE_ID,
      lat: parseFloat(process.env.NODE_LAT || '-8.100557'),
      lng: parseFloat(process.env.NODE_LNG || '112.648576')
    });
  });

  router.get('/settings', async (req, res) => {
    try {
      const row = await db.get('SELECT * FROM settings WHERE id = 1');
      res.json({ success: true, data: row });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  router.post('/settings', async (req, res) => {
    try {
      const { language, dark_mode, telegram_enable, alarm_enable } = req.body || {};
      await db.run(
        `UPDATE settings SET
          language = COALESCE(?, language),
          dark_mode = COALESCE(?, dark_mode),
          telegram_enable = COALESCE(?, telegram_enable),
          alarm_enable = COALESCE(?, alarm_enable)
         WHERE id = 1`,
        [language ?? null, dark_mode ?? null, telegram_enable ?? null, alarm_enable ?? null]
      );
      const row = await db.get('SELECT * FROM settings WHERE id = 1');
      res.json({ success: true, data: row });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // ------------------------------------------------------------
  // Manual Control — tombol dari dashboard membuat perintah,
  // ESP32 menjemputnya lewat GET /api/command/next (lihat di atas)
  // ------------------------------------------------------------
  router.post('/command', async (req, res) => {
    try {
      const { type, action } = req.body || {};
      const allowedTypes = ['fan', 'pump', 'door', 'maintenance'];
      if (!allowedTypes.includes(type)) {
        return res.status(400).json({ success: false, message: 'Tipe perintah tidak dikenal.' });
      }
      const id = crypto.randomUUID();
      const ts = nowStr();
      await db.run(
        `INSERT INTO commands (id, type, action, status, created_at) VALUES (?, ?, ?, 'pending', ?)`,
        [id, type, action, ts]
      );
      await db.run(
        `INSERT INTO event_logs (timestamp, event, description, level, source) VALUES (?, ?, ?, ?, ?)`,
        [ts, `Manual Command: ${type}`, `Perintah manual "${action}" dikirim ke ESP32`, 'INFO', 'Dashboard']
      );
      io.emit('command_created', { id, type, action });
      res.json({ success: true, id });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  router.get('/commands/recent', async (req, res) => {
    try {
      const rows = await db.all(`SELECT * FROM commands ORDER BY created_at DESC LIMIT 10`);
      res.json({ success: true, data: rows });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // ------------------------------------------------------------
  // Access Log (Info Sesi / Riwayat Akses)
  // ------------------------------------------------------------
  router.get('/access-log', async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit, 10) || 100, 1000);
      const rows = await db.all('SELECT * FROM access_log ORDER BY id DESC LIMIT ?', [limit]);
      res.json({ success: true, data: rows });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  const ACCESS_DELETE_RANGE_DAYS = { '3d': 3, '1w': 7, '1m': 30 };

  router.delete('/access-log/all', async (req, res) => {
    try {
      const range = req.query.range || 'all';
      if (range === 'all') {
        await db.run('DELETE FROM access_log');
      } else {
        const days = ACCESS_DELETE_RANGE_DAYS[range];
        if (!days) return res.status(400).json({ success: false, message: 'Rentang tidak dikenal.' });
        const cutoff = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString().replace('T', ' ').substring(0, 19);
        await db.run('DELETE FROM access_log WHERE timestamp < ?', [cutoff]);
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // ------------------------------------------------------------
  // Analytics: Smart Water Consumption, Energy Saving, Smart Maintenance, Health Score
  // ------------------------------------------------------------
  const PUMP_FLOW_RATE_LPS = 2.3 / 25;   // Liter per detik (asumsi dari contoh: 25 detik -> 2.3L)
  const FAN_WATT = 25;                    // Watt (fan DC 12V + driver, estimasi)
  const PUMP_WATT = 40;                   // Watt (pompa air kecil, estimasi)
  const SERVO_WATT_PER_CYCLE = 0.5;       // Wh per siklus buka/tutup (estimasi)
  const FAN_MAINTENANCE_HOURS = 300;      // Rekomendasi bersihkan kipas setelah X jam aktif
  const SERVO_MAINTENANCE_CYCLES = 5000;  // Rekomendasi servis servo setelah X siklus

  // Menjumlahkan total detik "ON" sebuah aktuator dari pasangan event ON/OFF
  async function sumOnDurationSeconds(onEventLike, offEventLike, sinceDate) {
    const rows = await db.all(
      `SELECT event, timestamp FROM event_logs
       WHERE (event LIKE ? OR event LIKE ?) ${sinceDate ? 'AND timestamp >= ?' : ''}
       ORDER BY timestamp ASC`,
      sinceDate ? [onEventLike, offEventLike, sinceDate] : [onEventLike, offEventLike]
    );
    let totalMs = 0;
    let onAt = null;
    rows.forEach((r) => {
      const t = new Date(r.timestamp.replace(' ', 'T')).getTime();
      if (r.event.includes('ON') && onAt === null) {
        onAt = t;
      } else if (r.event.includes('OFF') && onAt !== null) {
        totalMs += Math.max(0, t - onAt);
        onAt = null;
      }
    });
    // Jika masih ON sampai sekarang (belum sempat OFF), hitung sampai waktu saat ini
    if (onAt !== null) totalMs += Math.max(0, Date.now() - onAt);
    return totalMs / 1000;
  }

  router.get('/analytics/water', async (req, res) => {
    try {
      // "Siklus Pompa": berapa kali pompa ON hari ini (sama caranya seperti siklus servo
      // dihitung dari jumlah event "Door Open"), menggantikan estimasi liter sebelumnya.
      const today = new Date().toISOString().substring(0, 10);
      const row = await db.get(
        `SELECT COUNT(*) as count FROM event_logs WHERE event LIKE 'Pump ON%' AND timestamp >= ?`,
        [today]
      );
      const pumpCyclesToday = row ? row.count : 0;
      res.json({ success: true, pumpCyclesToday });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  router.get('/analytics/abnormal-week', async (req, res) => {
    try {
      const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().replace('T', ' ').substring(0, 19);
      const row = await db.get(
        `SELECT COUNT(*) as count FROM event_logs WHERE event IN ('Status ABNORMAL', 'Status EMERGENCY') AND timestamp >= ?`,
        [since]
      );
      res.json({ success: true, count: row ? row.count : 0 });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  router.get('/analytics/energy', async (req, res) => {
    try {
      const today = new Date().toISOString().substring(0, 10);
      const fanSeconds = await sumOnDurationSeconds('Fan ON%', 'Fan OFF%', today);
      const pumpSeconds = await sumOnDurationSeconds('Pump ON%', 'Pump OFF%', today);

      const doorCyclesRow = await db.get(
        `SELECT COUNT(*) as count FROM event_logs WHERE event LIKE 'Door Open%' AND timestamp >= ?`,
        [today]
      );
      const doorCycles = doorCyclesRow ? doorCyclesRow.count : 0;

      const fanKwh = (fanSeconds / 3600) * FAN_WATT / 1000;
      const pumpKwh = (pumpSeconds / 3600) * PUMP_WATT / 1000;
      const servoKwh = (doorCycles * SERVO_WATT_PER_CYCLE) / 1000;
      const totalKwh = fanKwh + pumpKwh + servoKwh;

      res.json({
        success: true,
        totalKwh: Math.round(totalKwh * 1000) / 1000,
        breakdown: {
          fanKwh: Math.round(fanKwh * 1000) / 1000,
          pumpKwh: Math.round(pumpKwh * 1000) / 1000,
          servoKwh: Math.round(servoKwh * 1000) / 1000
        }
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  router.get('/analytics/maintenance', async (req, res) => {
    try {
      // Kumulatif SEMUA waktu (bukan cuma hari ini) untuk estimasi jam pakai
      const fanSeconds = await sumOnDurationSeconds('Fan ON%', 'Fan OFF%', null);
      const fanHours = fanSeconds / 3600;

      const doorCyclesRow = await db.get(`SELECT COUNT(*) as count FROM event_logs WHERE event LIKE 'Door Open%'`);
      const servoCycles = doorCyclesRow ? doorCyclesRow.count : 0;

      res.json({
        success: true,
        fan: {
          hoursActive: Math.round(fanHours * 10) / 10,
          maintenanceDue: fanHours >= FAN_MAINTENANCE_HOURS,
          recommendation: fanHours >= FAN_MAINTENANCE_HOURS ? 'Bersihkan kipas' : null
        },
        servo: {
          cycles: servoCycles,
          maintenanceDue: servoCycles >= SERVO_MAINTENANCE_CYCLES,
          recommendation: servoCycles >= SERVO_MAINTENANCE_CYCLES ? 'Maintenance Soon' : null
        }
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  router.get('/analytics/health', async (req, res) => {
    try {
      const row = await db.get('SELECT * FROM sensor_logs ORDER BY id DESC LIMIT 1');
      if (!row) {
        return res.json({ success: true, score: null, breakdown: null });
      }

      function scoreFromRange(value, goodMin, goodMax, hardMin, hardMax) {
        if (value == null) return 70;
        if (value >= goodMin && value <= goodMax) return 100;
        const dist = value < goodMin ? (goodMin - value) / Math.max(goodMin - hardMin, 0.001)
                                      : (value - goodMax) / Math.max(hardMax - goodMax, 0.001);
        return Math.max(0, Math.round(100 - dist * 60));
      }

      const tempScore = scoreFromRange(row.temperature, T.TEMP.NORMAL_MIN, T.TEMP.NORMAL_MAX, 0, T.TEMP.VALID_MAX);
      const humScore = scoreFromRange(row.humidity, T.HUM.NORMAL_MIN, T.HUM.NORMAL_MAX, 0, T.HUM.VALID_MAX);
      const gasScore = scoreFromRange(row.mq135, 0, T.MQ135.NORMAL_MAX, 0, T.MQ135.VALID_MAX);
      const waterScore = (row.water != null && row.water >= T.WATER.FULL && row.water <= T.WATER.EMPTY) ? 100
                        : (row.water != null ? 70 : 60);
      const movementScore = row.pir ? 95 : 100; // sekadar indikator aktivitas, bukan alarm

      const breakdown = { temperature: tempScore, humidity: humScore, gas: gasScore, water: waterScore, movement: movementScore };
      const overall = Math.round((tempScore + humScore + gasScore + waterScore + movementScore) / 5);

      res.json({ success: true, score: overall, breakdown });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  return router;
};
