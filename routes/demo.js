/**
 * =============================
 * EMOOSE DEMO SIMULATION MODULE
 * =============================
 * routes/demo.js
 * ------------------------------------------------------------
 * Fitur "Simulasi Darurat" — KHUSUS untuk demo presentasi, QA/testing,
 * dan demonstrasi ke juri. BUKAN pengganti data sensor ESP32 asli.
 *
 * PLUG-AND-PLAY:
 *   Hapus file ini + baris `app.use('/api', demoRoutes)` di server.js
 *   + tag <script src="/js/demo.js"> di dashboard.html + slot kosong
 *   <div id="demo-master-slot"> di dashboard.html
 *   -> sistem EMOOSE asli (ESP32, sensor, threshold, hysteresis,
 *      Telegram asli, Socket.IO asli, database device) tetap berjalan
 *      100% normal seperti sebelum modul ini ada.
 *
 * PRINSIP KEAMANAN DATA:
 *   - Tabel `event_logs` SUDAH memiliki kolom `source` (default
 *     'ESP32') sejak awal project -- modul ini TIDAK mengubah skema
 *     apa pun, hanya menyisipkan baris baru dengan source='DEMO'.
 *   - Tabel `sensor_logs` (sumber kebenaran gauge/chart/digital twin
 *     ESP32) TIDAK PERNAH ditulis oleh modul ini. Simulasi dikirim
 *     murni lewat Socket.IO ('demo_sensor_update'), tidak pernah
 *     disimpan sebagai "data sensor". Efeknya: me-refresh halaman
 *     akan selalu menampilkan data ESP32 asli, tidak pernah data demo.
 *   - "Hapus Log Demo" HANYA menghapus event_logs WHERE source='DEMO'.
 *     Data source='ESP32' tidak pernah tersentuh oleh endpoint ini.
 * ------------------------------------------------------------
 */

const express = require('express');
const db = require('../config/database');
const { sendTelegramMessage } = require('../utils/telegram');

const DEMO_ENABLED = String(process.env.DEMO_ENABLED || 'true').toLowerCase() !== 'false';
const DEMO_MASTER_CODE = process.env.DEMO_MASTER_CODE || 'emoose2025';
const SIM_COOLDOWN_MS = 2000; // anti-spam: minimal 2 detik antar simulasi
const STEP_COUNT = 5; // 1 klik = rangkaian 5 event demo (grafik terlihat naik natural)
const STEP_INTERVAL_MS = 900; // jeda antar event demo supaya timestamp berurutan & terlihat live

let lastSimAt = 0;

function nowStr(offsetMs = 0) {
  return new Date(Date.now() + offsetMs).toISOString().replace('T', ' ').substring(0, 19);
}

function randomFloat(min, max, decimals = 1) {
  return Number((Math.random() * (max - min) + min).toFixed(decimals));
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Interpolasi bertahap dari nilai awal ke nilai target sepanjang N langkah,
// dengan sedikit noise acak supaya tidak terlihat seperti garis lurus buatan.
function buildRamp(start, end, steps, decimals = 1) {
  const out = [];
  for (let i = 0; i < steps; i += 1) {
    const t = i / Math.max(steps - 1, 1);
    const base = start + (end - start) * t;
    const noise = (Math.random() - 0.5) * (Math.abs(end - start) * 0.06);
    out.push(Number((base + noise).toFixed(decimals)));
  }
  return out;
}

function requireDemoMaster(req, res, next) {
  if (!req.session || req.session.isDemoMaster !== true) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

/**
 * Bangun rangkaian STEP_COUNT event simulasi sesuai mode.
 * Mengembalikan array payload siap kirim (bentuk field mengikuti
 * kontrak sensor_update ESP32 yang sudah ada: temperature, humidity,
 * mq135, water, pump, fan, sg90, status, node).
 */
function buildSteps(mode) {
  let tempRange, humRange, mqRange, reason;

  switch (mode) {
    case 'temperature':
      tempRange = [30.5, 34.5];
      humRange = [58, 68];
      mqRange = [500, 750];
      reason = 'TEMP_HIGH';
      break;
    case 'humidity':
      tempRange = [21.0, 25.0];
      humRange = [81, 92];
      mqRange = [500, 750];
      reason = 'HUMIDITY_HIGH';
      break;
    case 'gas':
      tempRange = [21.0, 25.0];
      humRange = [55, 70];
      mqRange = [1250, 1800];
      reason = 'MQ135_HIGH';
      break;
    case 'all':
    default:
      tempRange = [30.5, 34.5];
      humRange = [81, 92];
      mqRange = [1250, 1800];
      reason = 'MULTI_ABNORMAL';
      break;
  }

  const tempStart = randomFloat(tempRange[0], (tempRange[0] + tempRange[1]) / 2, 1);
  const tempEnd = randomFloat((tempRange[0] + tempRange[1]) / 2, tempRange[1], 1);
  const humStart = randomInt(humRange[0], Math.round((humRange[0] + humRange[1]) / 2));
  const humEnd = randomInt(Math.round((humRange[0] + humRange[1]) / 2), humRange[1]);
  const mqStart = randomInt(mqRange[0], Math.round((mqRange[0] + mqRange[1]) / 2));
  const mqEnd = randomInt(Math.round((mqRange[0] + mqRange[1]) / 2), mqRange[1]);

  const temps = buildRamp(tempStart, tempEnd, STEP_COUNT, 1);
  const hums = buildRamp(humStart, humEnd, STEP_COUNT, 0);
  const mqs = buildRamp(mqStart, mqEnd, STEP_COUNT, 0);

  return { reason, steps: temps.map((t, i) => ({
    temperature: t,
    humidity: hums[i],
    mq135: Math.round(mqs[i]),
    water: randomFloat(1.5, 3.5, 1),
    pump: mode === 'gas' ? 'OFF' : (i % 2 === 0 ? 'ON' : 'OFF'),
    fan: 'ON',
    sg90: 'CLOSE',
    status: 'ABNORMAL'
  })) };
}

module.exports = function (io, requireAuth) {
  const router = express.Router();

  if (!DEMO_ENABLED) {
    // DEMO_ENABLED=false -> tidak ada satu pun endpoint demo yang terdaftar.
    // Frontend (public/js/demo.js) akan mendapat 404 di /api/session dan
    // otomatis tidak menampilkan apa pun. Sistem asli tidak terpengaruh.
    return router;
  }

  // GET /api/session -- dipakai frontend demo.js untuk cek status login & isDemoMaster
  router.get('/session', requireAuth, (req, res) => {
    res.json({ authenticated: true, isDemoMaster: req.session.isDemoMaster === true });
  });

  // POST /api/demo/unlock -- masukkan kode master untuk elevasi session ini jadi presenter
  router.post('/demo/unlock', requireAuth, (req, res) => {
    const { code } = req.body || {};
    if (typeof code === 'string' && code === DEMO_MASTER_CODE) {
      req.session.isDemoMaster = true;
      return res.json({ success: true, isDemoMaster: true });
    }
    return res.status(403).json({ error: 'Forbidden' });
  });

  // POST /api/demo/simulate -- jalankan rangkaian event simulasi
  router.post('/demo/simulate', requireAuth, requireDemoMaster, async (req, res) => {
    const now = Date.now();
    if (now - lastSimAt < SIM_COOLDOWN_MS) {
      return res.status(429).json({ error: 'Simulation cooldown' });
    }
    lastSimAt = now;

    const body = req.body || {};
    const mode = ['temperature', 'humidity', 'gas', 'all'].includes(body.mode) ? body.mode : 'all';
    const sendTelegram = body.sendTelegram === true;
    const nodeId = process.env.NODE_ID || 'EMOOSE-NODE-01';

    const { reason, steps } = buildSteps(mode);

    // Kirim respons dulu supaya UI langsung terasa responsif,
    // lalu jalankan rangkaian event secara berurutan (async, tidak blocking).
    res.json({ success: true, mode, steps: steps.length });

    let lastStep = null;
    for (let i = 0; i < steps.length; i += 1) {
      const step = steps[i];
      const ts = nowStr(i * STEP_INTERVAL_MS);
      lastStep = step;

      // Catat sebagai event_logs biasa (source='DEMO') supaya muncul di Log Aktivitas
      // dan bisa dihapus lewat "Hapus Log Demo" tanpa menyentuh data source='ESP32'.
      try {
        const description = `[DEMO] Simulasi Darurat (${reason}) — Suhu ${step.temperature}°C, RH ${step.humidity}%, MQ135 ${step.mq135} ADC`;
        const result = await db.run(
          `INSERT INTO event_logs (timestamp, event, description, level, source) VALUES (?, ?, ?, ?, ?)`,
          [ts, 'Status ABNORMAL', description, 'ALARM', 'DEMO']
        );
        // Pakai ulang event Socket.IO 'event_update' yang SUDAH ADA -> toast &
        // baris tabel log otomatis tampil lewat listener asli, tanpa logic baru.
        io.emit('event_update', {
          id: result.id,
          timestamp: ts,
          event: 'Status ABNORMAL',
          description,
          level: 'ALARM',
          source: 'DEMO'
        });
      } catch (err) {
        console.error('[DEMO] Gagal mencatat event demo:', err.message);
      }

      // Kirim data "sensor" simulasi lewat event TERPISAH (demo_sensor_update),
      // BUKAN 'sensor_update' asli, dan TIDAK ditulis ke tabel sensor_logs.
      io.emit('demo_sensor_update', {
        ...step,
        node: nodeId,
        timestamp: ts,
        reason,
        source: 'demo',
        holdMs: 20000 // berapa lama frontend menahan tampilan demo sebelum kembali ke data asli
      });

      if (i < steps.length - 1) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, STEP_INTERVAL_MS));
      }
    }

    if (sendTelegram && lastStep) {
      const text = [
        '🚨 <b>[DEMO] EMOOSE ALERT</b>',
        `Status      : ABNORMAL`,
        `Temperature : ${lastStep.temperature}°C`,
        `Humidity    : ${lastStep.humidity}% RH`,
        `MQ135       : ${lastStep.mq135} ADC`,
        `Source      : DEMO`,
        `Waktu       : ${nowStr()}`
      ].join('\n');
      // debounceKey terpisah ('demo_alert') supaya TIDAK mengganggu debounce
      // notifikasi Telegram asli dari data sensor ESP32 sungguhan.
      sendTelegramMessage(text, { debounceKey: 'demo_alert' }).catch(() => {});
    }
  });

  // DELETE /api/demo/clear -- hapus HANYA baris demo, data ESP32 asli tidak tersentuh
  router.delete('/demo/clear', requireAuth, requireDemoMaster, async (req, res) => {
    try {
      await db.run(`DELETE FROM event_logs WHERE source = 'DEMO'`);
      io.emit('demo_cleared', {});
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  return router;
};
