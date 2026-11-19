/**
 * config/thresholds.js
 * ------------------------------------------------------------
 * Ambang batas rule-based sesuai BAB 7 & BAB 9 SRS EMOOSE.
 * Dipakai backend untuk memvalidasi payload sensor dan
 * mendeteksi perubahan status (untuk logging & Telegram),
 * meskipun keputusan aktuator utamanya dilakukan di firmware.
 * ------------------------------------------------------------
 */

module.exports = {
  TEMP: { NORMAL_MIN: 20, NORMAL_MAX: 25, WARNING_MAX: 30, HYST: 1, VALID_MIN: 0, VALID_MAX: 80 },
  HUM: { NORMAL_MIN: 55, NORMAL_MAX: 70, WARNING_MAX: 80, HYST: 3, VALID_MIN: 0, VALID_MAX: 100 },
  MQ135: { NORMAL_MAX: 800, WARNING_MAX: 1200, HYST: 60, VALID_MIN: 0, VALID_MAX: 4095 },
  WATER: { EMPTY: 4.0, FULL: 1.0, HYST: 0.5, VALID_MIN: 0, VALID_MAX: 5 },
  STATUS: { NORMAL: 'NORMAL', WARNING: 'WARNING', ABNORMAL: 'ABNORMAL' },
  TELEGRAM_DEBOUNCE_MS: 10000
};
