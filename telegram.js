/**
 * utils/telegram.js
 * ------------------------------------------------------------
 * Mengirim notifikasi Telegram (BAB 10.5 / BAB 20 TDD).
 * Menggunakan fetch bawaan Node.js 18+ (tidak perlu axios/node-fetch).
 * Dilengkapi debounce agar tidak spam saat status berubah cepat.
 * ------------------------------------------------------------
 */

const { TELEGRAM_DEBOUNCE_MS } = require('../config/thresholds');

const lastSent = new Map(); // key -> timestamp ms

function canSend(key) {
  const now = Date.now();
  const last = lastSent.get(key) || 0;
  if (now - last < TELEGRAM_DEBOUNCE_MS) return false;
  lastSent.set(key, now);
  return true;
}

async function sendTelegramMessage(text, { debounceKey } = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    // Telegram belum dikonfigurasi -> abaikan diam-diam, jangan crash server
    return { sent: false, reason: 'not_configured' };
  }

  if (debounceKey && !canSend(debounceKey)) {
    return { sent: false, reason: 'debounced' };
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
    });
    const data = await res.json();
    return { sent: !!data.ok, reason: data.ok ? 'ok' : (data.description || 'unknown_error') };
  } catch (err) {
    console.error('[TELEGRAM] Gagal mengirim pesan:', err.message);
    return { sent: false, reason: err.message };
  }
}

function buildAlertMessage({ nodeId, status, temperature, humidity, mq135, water, fan, pump, timestamp, ip }) {
  const emoji = status === 'ABNORMAL' ? '🚨' : '✅';
  const title = status === 'ABNORMAL' ? 'EMOOSE ALERT' : 'EMOOSE - System Back Normal';
  return [
    `${emoji} <b>${title}</b>`,
    `Node       : ${nodeId || '-'}`,
    `Status     : ${status}`,
    `Suhu       : ${temperature ?? '-'} °C`,
    `Kelembapan : ${humidity ?? '-'} %RH`,
    `MQ135      : ${mq135 ?? '-'} ADC`,
    `Air        : ${water ?? '-'} cm`,
    `Fan        : ${fan ?? '-'}`,
    `Pompa      : ${pump ?? '-'}`,
    `IP Device  : ${ip || '-'}`,
    `Waktu      : ${timestamp}`
  ].join('\n');
}

module.exports = { sendTelegramMessage, buildAlertMessage };
