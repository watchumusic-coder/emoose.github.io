/**
 * routes/export.js
 * ------------------------------------------------------------
 * Ekspor data log ke CSV dan PDF (BAB 10.6 SRS / BAB 6 TDD).
 * ------------------------------------------------------------
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { createObjectCsvWriter } = require('csv-writer');
const PDFDocument = require('pdfkit');
const db = require('../config/database');
const { requireAuthApi } = require('../middleware/authMiddleware');

const EXPORT_DIR = path.join(__dirname, '..', 'exports');
if (!fs.existsSync(EXPORT_DIR)) fs.mkdirSync(EXPORT_DIR, { recursive: true });

router.use(requireAuthApi);

router.get('/csv', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM event_logs ORDER BY id DESC');
    const filePath = path.join(EXPORT_DIR, `emoose_log_${Date.now()}.csv`);

    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: 'id', title: 'ID' },
        { id: 'timestamp', title: 'Timestamp' },
        { id: 'event', title: 'Event' },
        { id: 'description', title: 'Description' },
        { id: 'level', title: 'Level' },
        { id: 'source', title: 'Source' }
      ]
    });

    await csvWriter.writeRecords(rows);
    res.download(filePath, 'emoose_event_log.csv', (err) => {
      if (!err) fs.unlink(filePath, () => {});
    });
  } catch (err) {
    console.error('[EXPORT CSV] error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/pdf', async (req, res) => {
  try {
    const events = await db.all('SELECT * FROM event_logs ORDER BY id DESC LIMIT 500');
    const latestSensor = await db.get('SELECT * FROM sensor_logs ORDER BY id DESC LIMIT 1');

    const filePath = path.join(EXPORT_DIR, `emoose_report_${Date.now()}.pdf`);
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    doc.fontSize(18).fillColor('#1c3d2e').text('EMOOSE - Laporan Monitoring Kandang Entok', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#555').text(`Dicetak pada: ${new Date().toISOString().replace('T', ' ').substring(0, 19)}`, { align: 'center' });
    doc.moveDown(1);

    if (latestSensor) {
      doc.fontSize(13).fillColor('#1c3d2e').text('Ringkasan Sensor Terakhir');
      doc.fontSize(10).fillColor('#222');
      doc.text(`Waktu       : ${latestSensor.timestamp}`);
      doc.text(`Suhu        : ${latestSensor.temperature ?? '-'} °C`);
      doc.text(`Kelembapan  : ${latestSensor.humidity ?? '-'} %RH`);
      doc.text(`MQ135       : ${latestSensor.mq135 ?? '-'} ADC`);
      doc.text(`Level Air   : ${latestSensor.water ?? '-'} cm`);
      doc.text(`Fan         : ${latestSensor.fan ?? '-'}`);
      doc.text(`Pompa       : ${latestSensor.pump ?? '-'}`);
      doc.text(`Status      : ${latestSensor.status ?? '-'}`);
      doc.moveDown(1);
    }

    doc.fontSize(13).fillColor('#1c3d2e').text(`Riwayat Event (${events.length} entri terakhir)`);
    doc.moveDown(0.3);
    doc.fontSize(9).fillColor('#000');

    events.forEach((e) => {
      doc.text(`[${e.timestamp}] (${e.level}) ${e.event} - ${e.description || ''}`);
    });

    doc.end();

    stream.on('finish', () => {
      res.download(filePath, 'emoose_report.pdf', (err) => {
        if (!err) fs.unlink(filePath, () => {});
      });
    });
  } catch (err) {
    console.error('[EXPORT PDF] error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/access-log/csv', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM access_log ORDER BY id DESC');
    const filePath = path.join(EXPORT_DIR, `emoose_access_log_${Date.now()}.csv`);

    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: 'id', title: 'ID' },
        { id: 'timestamp', title: 'Timestamp' },
        { id: 'ip', title: 'IP Address' },
        { id: 'username', title: 'Username' },
        { id: 'success', title: 'Success' }
      ]
    });

    await csvWriter.writeRecords(rows);
    res.download(filePath, 'emoose_access_log.csv', (err) => {
      if (!err) fs.unlink(filePath, () => {});
    });
  } catch (err) {
    console.error('[EXPORT ACCESS CSV] error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/access-log/pdf', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM access_log ORDER BY id DESC LIMIT 500');
    const filePath = path.join(EXPORT_DIR, `emoose_access_log_${Date.now()}.pdf`);
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    doc.fontSize(18).fillColor('#1c3d2e').text('EMOOSE - Riwayat Akses Dashboard', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#555').text(`Dicetak pada: ${new Date().toISOString().replace('T', ' ').substring(0, 19)}`, { align: 'center' });
    doc.moveDown(1);

    doc.fontSize(9).fillColor('#000');
    rows.forEach((r) => {
      doc.text(`[${r.timestamp}] ${r.username || '-'} dari IP ${r.ip || '-'} - ${r.success ? 'BERHASIL' : 'GAGAL'}`);
    });

    doc.end();
    stream.on('finish', () => {
      res.download(filePath, 'emoose_access_log.pdf', (err) => {
        if (!err) fs.unlink(filePath, () => {});
      });
    });
  } catch (err) {
    console.error('[EXPORT ACCESS PDF] error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
