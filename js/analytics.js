/**
 * analytics.js — Widget Health Score, Smart Water Consumption,
 * Energy Saving Controller, dan Smart Maintenance.
 */
(function () {
  function el(id) { return document.getElementById(id); }

  let lastHealthScore = null;
  function healthAnimDuration(score) {
    if (lastHealthScore == null) return 700;
    const delta = Math.min(Math.abs(score - lastHealthScore) / 100, 1);
    // Perubahan besar (lonjakan skor) -> animasi cepat; perubahan kecil -> pelan/halus.
    return Math.round(1500 - delta * 1150);
  }

  async function refreshHealth() {
    try {
      const res = await window.EmooseApi.getHealthScore();
      if (res.score == null) return;
      el('health-score-value').textContent = `${res.score}`;
      const ring = el('health-score-ring');
      if (ring) {
        const circumference = 2 * Math.PI * 42;
        const offset = circumference * (1 - res.score / 100);
        const duration = healthAnimDuration(res.score);
        ring.style.transitionDuration = `${duration}ms, 300ms`;
        ring.style.strokeDasharray = `${circumference}`;
        ring.style.strokeDashoffset = `${offset}`;
        ring.style.stroke = res.score >= 80 ? 'var(--nb-green)' : res.score >= 50 ? 'var(--nb-yellow)' : 'var(--nb-red)';
        lastHealthScore = res.score;
      }
      const b = res.breakdown || {};
      if (el('health-temp')) el('health-temp').textContent = b.temperature ?? '-';
      if (el('health-hum')) el('health-hum').textContent = b.humidity ?? '-';
      if (el('health-gas')) el('health-gas').textContent = b.gas ?? '-';
      if (el('health-water')) el('health-water').textContent = b.water ?? '-';
      if (el('health-movement')) el('health-movement').textContent = b.movement ?? '-';
    } catch (e) { /* diamkan */ }
  }

  async function refreshWater() {
    try {
      const res = await window.EmooseApi.getWaterAnalytics();
      if (el('pump-cycles-today')) el('pump-cycles-today').textContent = `${res.pumpCyclesToday}x`;
    } catch (e) { /* diamkan */ }
  }

  async function refreshEnergy() {
    try {
      const res = await window.EmooseApi.getEnergyAnalytics();
      if (el('energy-total-kwh')) el('energy-total-kwh').textContent = `${res.totalKwh} kWh`;
      if (el('energy-fan-kwh')) el('energy-fan-kwh').textContent = `${res.breakdown.fanKwh} kWh`;
      if (el('energy-pump-kwh')) el('energy-pump-kwh').textContent = `${res.breakdown.pumpKwh} kWh`;
    } catch (e) { /* diamkan */ }
  }

  async function refreshMaintenance() {
    try {
      const res = await window.EmooseApi.getMaintenanceAnalytics();
      const t = window.EmooseI18n ? window.EmooseI18n.t : (k) => k;

      if (el('maint-fan-hours')) el('maint-fan-hours').textContent = `${res.fan.hoursActive} jam`;
      if (el('maint-servo-cycles')) el('maint-servo-cycles').textContent = `${res.servo.cycles}x`;

      const banner = el('maintenance-banner');
      if (banner) {
        const messages = [];
        if (res.fan.maintenanceDue) messages.push(res.fan.recommendation);
        if (res.servo.maintenanceDue) messages.push(res.servo.recommendation);
        if (messages.length) {
          banner.textContent = `⚠ ${messages.join(' • ')}`;
          banner.classList.add('visible');
        } else {
          banner.classList.remove('visible');
        }
      }
    } catch (e) { /* diamkan */ }
  }

  function refreshAll() {
    refreshHealth();
    refreshWater();
    refreshEnergy();
    refreshMaintenance();
  }

  function init() {
    refreshAll();
    setInterval(refreshAll, 20000); // refresh tiap 20 detik, cukup untuk data akumulatif
  }

  window.EmooseAnalytics = { init, refreshAll };

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
