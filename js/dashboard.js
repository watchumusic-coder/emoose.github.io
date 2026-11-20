/**
 * dashboard.js — Bootstrap utama halaman dashboard EMOOSE.
 * Menyatukan: jam realtime, node pulse strip, kartu sensor + gauge,
 * status aktuator, ringkasan sidebar, distribusi status, dan toast.
 */
(function () {
  const GAUGE_RANGES = {
    temperature: { min: 0, max: 40 },
    humidity: { min: 0, max: 100 },
    mq135: { min: 0, max: 2000 },
    water: { min: 0, max: 5 }
  };
  const GAUGE_ARC_LEN = Math.PI * 18; // setengah lingkaran, r=18

  function el(id) { return document.getElementById(id); }
  let lastCloudSyncAt = null;

  function classifyValue(key, value, status) {
    // Warna kartu ikut status global kandang (NORMAL/WARNING/ABNORMAL/EMERGENCY) untuk konsistensi
    if (status === 'EMERGENCY') return 'abnormal'; // pakai styling merah yang sama, lebih genting
    if (status === 'ABNORMAL') return 'abnormal';
    if (status === 'WARNING') return 'warning';
    return 'normal';
  }

  // Durasi animasi mengikuti besar-kecilnya perubahan nilai: lonjakan besar -> cepat,
  // perubahan kecil -> pelan/halus (bukan durasi tetap untuk semua kasus).
  const lastGaugeValues = {};
  function dynamicDuration(key, value, range) {
    const span = Math.max(range.max - range.min, 0.0001);
    const prev = lastGaugeValues[key];
    lastGaugeValues[key] = value;
    if (prev == null) return 600;
    const deltaRatio = Math.min(Math.abs(value - prev) / span, 1);
    // deltaRatio besar (lonjakan) -> durasi pendek (cepat); deltaRatio kecil -> durasi panjang (halus)
    return Math.round(1400 - deltaRatio * 1100); // 300ms (lonjakan besar) .. 1400ms (nyaris tak berubah)
  }

  function setGauge(svgId, value, range, key) {
    const path = document.querySelector(`#${svgId} path.value`);
    if (!path) return;
    const pct = Math.max(0, Math.min(1, (value - range.min) / (range.max - range.min)));
    const offset = GAUGE_ARC_LEN * (1 - pct);
    const duration = dynamicDuration(key || svgId, value, range);
    path.style.transitionDuration = `${duration}ms`;
    path.style.strokeDasharray = `${GAUGE_ARC_LEN}`;
    path.style.strokeDashoffset = `${offset}`;
  }

  function updateSensorCards(d) {
    const cls = classifyValue(null, null, d.status);
    ['temp', 'hum', 'mq135', 'water'].forEach((k) => {
      const card = el(`card-${k}`);
      if (card) card.className = `sensor-card ${cls}`;
    });

    el('val-temp').textContent = d.temperature != null ? `${d.temperature.toFixed(1)}°C` : '--';
    el('val-hum').textContent = d.humidity != null ? `${d.humidity.toFixed(0)}%` : '--';
    el('val-mq135').textContent = d.mq135 != null ? `${d.mq135}` : '--';
    el('val-water').textContent = d.water != null ? `${d.water.toFixed(1)}cm` : '--';

    if (d.temperature != null) setGauge('gauge-temp', d.temperature, GAUGE_RANGES.temperature, 'temperature');
    if (d.humidity != null) setGauge('gauge-hum', d.humidity, GAUGE_RANGES.humidity, 'humidity');
    if (d.mq135 != null) setGauge('gauge-mq135', d.mq135, GAUGE_RANGES.mq135, 'mq135');
    if (d.water != null) setGauge('gauge-water', d.water, GAUGE_RANGES.water, 'water');

    el('actuator-fan').textContent = d.fan || '-';
    el('actuator-fan').className = `actuator-state ${d.fan || 'OFF'}`;
    el('actuator-pump').textContent = d.pump || '-';
    el('actuator-pump').className = `actuator-state ${d.pump || 'OFF'}`;
    el('actuator-door').textContent = d.sg90 || '-';
    el('actuator-door').className = `actuator-state ${d.sg90 || 'CLOSE'}`;
    el('actuator-maintenance').textContent = d.mg996r && d.mg996r !== '-' ? d.mg996r : (d.status ? 'OFF' : '-');
    el('actuator-maintenance').className = `actuator-state ${d.mg996r === 'OPEN' ? 'ON' : 'OFF'}`;

    const badge = el('status-badge');
    badge.textContent = d.status || '-';
    badge.className = `status-badge ${d.status || ''}`;

    const suggestion = el('suggestion-box');
    if (d.status === 'EMERGENCY') {
      suggestion.textContent = window.EmooseI18n.t('suggestion_emergency');
      suggestion.classList.add('visible');
    } else if (d.status === 'ABNORMAL') {
      suggestion.textContent = window.EmooseI18n.t('suggestion_abnormal');
      suggestion.classList.add('visible');
    } else if (d.status === 'WARNING') {
      suggestion.textContent = window.EmooseI18n.t('suggestion_warning');
      suggestion.classList.add('visible');
    } else {
      suggestion.classList.remove('visible');
    }

    updateNodeStrip(d);
    window.EmooseLastSensorData = d;
    if (window.EmooseDigitalTwin) window.EmooseDigitalTwin.update(d);
    if (window.EmooseManualControl) window.EmooseManualControl.syncFromSensor(d);
    if (window.EmooseChart) window.EmooseChart.pushPoint(d);

    const safeBanner = el('safe-mode-banner');
    if (safeBanner) safeBanner.classList.toggle('visible', !!d.safeMode);

    lastCloudSyncAt = Date.now();
  }

  function chipState(status) {
    if (status === 'EMERGENCY' || status === 'ABNORMAL') return 'state-abnormal';
    if (status === 'WARNING') return 'state-warning';
    return 'state-normal';
  }

  function pulseChip(chip) {
    chip.classList.remove('pulse');
    void chip.offsetWidth;
    chip.classList.add('pulse');
  }

  function updateNodeStrip(d) {
    const map = {
      'chip-temp': d.status, 'chip-hum': d.status, 'chip-mq135': d.status, 'chip-water': d.status,
      'chip-fan': d.fan === 'ON' ? 'WARNING' : 'NORMAL',
      'chip-pump': d.pump === 'ON' ? 'WARNING' : 'NORMAL',
      'chip-door': d.sg90 === 'OPEN' ? 'NORMAL' : 'NORMAL'
    };
    Object.keys(map).forEach((id) => {
      const chip = el(id);
      if (!chip) return;
      chip.classList.remove('state-normal', 'state-warning', 'state-abnormal');
      chip.classList.add(chipState(map[id]));
      pulseChip(chip);
    });
    const wifiChip = el('chip-wifi');
    if (wifiChip) { wifiChip.classList.remove('state-normal'); wifiChip.classList.add('state-normal'); pulseChip(wifiChip); }
  }

  function setOfflineState() {
    ['chip-temp', 'chip-hum', 'chip-mq135', 'chip-water', 'chip-fan', 'chip-pump', 'chip-door', 'chip-wifi', 'chip-telegram'].forEach((id) => {
      const chip = el(id);
      if (chip) chip.classList.remove('state-normal', 'state-warning', 'state-abnormal');
    });
    setStatusDot('ss-dot-esp', false);
    const wifiEl = el('ss-wifi-signal');
    if (wifiEl) wifiEl.textContent = '-';
  }

  function tickCloudSync() {
    const el2 = el('cloud-sync-text');
    if (!el2) return;
    if (lastCloudSyncAt == null) {
      el2.textContent = window.EmooseI18n.t('cloud_sync_waiting');
      return;
    }
    const secs = Math.floor((Date.now() - lastCloudSyncAt) / 1000);
    el2.textContent = window.EmooseI18n.t('cloud_sync_ago', { sec: secs });
  }

  function setConnStatus(online) {
    const wrap = el('conn-status');
    const text = el('conn-status-text');
    if (!wrap || !text) return;
    wrap.classList.toggle('offline', !online);
    text.textContent = online ? window.EmooseI18n.t('conn_online') : window.EmooseI18n.t('conn_offline');
  }

  function tickClock() {
    const now = new Date();
    el('clock-time').textContent = now.toLocaleTimeString('id-ID', { hour12: false });
    el('clock-date').textContent = now.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function showToast({ title, desc, type = 'alarm' }) {
    const stack = el('toast-stack');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<div class="t-title">${title}</div><div class="t-desc">${desc}</div>`;
    stack.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(24px)';
      toast.style.transition = 'all .3s ease';
      setTimeout(() => toast.remove(), 320);
    }, 5500);
  }

  async function refreshSummary() {
    try {
      const today = new Date().toISOString().substring(0, 10);
      const [alarms, fanEvents, pumpEvents] = await Promise.all([
        window.EmooseApi.getEvents({ date: today, status: 'ALARM', limit: 1 }),
        window.EmooseApi.getEvents({ date: today, search: 'Fan ON', limit: 1 }),
        window.EmooseApi.getEvents({ date: today, search: 'Pump ON', limit: 1 })
      ]);
      el('sum-alarm').textContent = alarms.total ?? 0;
      el('sum-fan').textContent = fanEvents.total ?? 0;
      el('sum-pump').textContent = pumpEvents.total ?? 0;
    } catch (e) { /* diamkan, tidak kritikal */ }
  }

  async function refreshStatusFooter() {
    try {
      const s = await window.EmooseApi.getStatus();
      setFooterDot('foot-server', true, window.EmooseI18n.t('status_online'));
      setFooterDot('foot-esp32', s.esp32 === 'CONNECTED', s.esp32 === 'CONNECTED' ? window.EmooseI18n.t('status_connected') : window.EmooseI18n.t('status_disconnected'));
      setFooterDot('foot-telegram', s.telegram === 'CONFIGURED', s.telegram === 'CONFIGURED' ? window.EmooseI18n.t('status_configured') : window.EmooseI18n.t('status_not_configured'));
      setFooterDot('foot-database', true, window.EmooseI18n.t('status_ready'));
      setConnStatus(s.esp32 === 'CONNECTED');

      const wifiChip = el('chip-wifi');
      const teleChip = el('chip-telegram');
      if (wifiChip) { wifiChip.classList.remove('state-normal','state-warning','state-abnormal'); if (s.esp32 === 'CONNECTED') wifiChip.classList.add('state-normal'); }
      if (teleChip) { teleChip.classList.remove('state-normal','state-warning','state-abnormal'); if (s.telegram === 'CONFIGURED') teleChip.classList.add('state-normal'); }

      updateStatusSistem(s);
    } catch (e) {
      // Server tidak merespons sama sekali -> semua indikator "Status Sistem" harus jujur menyala merah
      setStatusDot('ss-dot-server', false);
      setStatusDot('ss-dot-socket', false);
      setStatusDot('ss-dot-db', false);
      setStatusDot('ss-dot-esp', false);
      const wifiEl = el('ss-wifi-signal');
      if (wifiEl) wifiEl.textContent = '-';
    }
  }

  function setStatusDot(id, ok) {
    const dot = el(id);
    if (dot) dot.className = `footer-dot ${ok ? 'on' : 'off'}`;
  }

  function updateStatusSistem(s) {
    setStatusDot('ss-dot-server', true); // permintaan /api/status berhasil dibalas -> server hidup
    setStatusDot('ss-dot-socket', !!(window.EmooseSocket && window.EmooseSocket.connected));
    setStatusDot('ss-dot-db', s.database === 'READY');
    const espOnline = s.esp32 === 'CONNECTED';
    setStatusDot('ss-dot-esp', espOnline);

    const wifiEl = el('ss-wifi-signal');
    if (wifiEl) {
      if (espOnline && s.wifiRssi != null) {
        wifiEl.textContent = `${s.wifiRssi} dBm (${s.wifiQuality || '-'})`;
      } else {
        wifiEl.textContent = '-';
      }
    }
  }

  async function refreshAbnormalWeek() {
    try {
      const res = await window.EmooseApi.getAbnormalWeek();
      const elCount = el('abnormal-week-count');
      if (elCount) elCount.textContent = res.count ?? 0;
    } catch (e) { /* ignore */ }
  }

  function setFooterDot(id, ok, text) {
    const wrap = el(id);
    if (!wrap) return;
    wrap.querySelector('.footer-dot').className = `footer-dot ${ok ? 'on' : 'off'}`;
    wrap.querySelector('.footer-text').textContent = text;
  }

  async function refreshDistribution() {
    try {
      const today = new Date().toISOString().substring(0, 10);
      const rows = await window.EmooseApi.getSensorHistory(500);
      const todays = rows.data.filter((r) => (r.timestamp || '').startsWith(today));
      const counts = { NORMAL: 0, WARNING: 0, ABNORMAL: 0 };
      todays.forEach((r) => { if (counts[r.status] !== undefined) counts[r.status]++; });
      const total = Math.max(counts.NORMAL + counts.WARNING + counts.ABNORMAL, 1);
      ['NORMAL', 'WARNING', 'ABNORMAL'].forEach((k) => {
        const bar = el(`dist-${k.toLowerCase()}`);
        if (bar) bar.style.width = `${(counts[k] / total) * 100}%`;
      });
      el('dist-legend-text').textContent = `N:${counts.NORMAL}  W:${counts.WARNING}  A:${counts.ABNORMAL}`;
    } catch (e) { /* ignore */ }
  }

  async function bootstrap() {
    setInterval(tickClock, 1000);
    tickClock();
    setInterval(tickCloudSync, 1000);
    tickCloudSync();

    if (window.EmooseTyping) {
      setTimeout(() => {
        const footerEl = el('footer-typing-copyright');
        if (footerEl) window.EmooseTyping.typeText(footerEl, window.EmooseI18n.t('footer_copyright'), 22);
      }, 600);
    }

    if (window.EmooseChart) window.EmooseChart.init();
    if (window.EmooseTable) window.EmooseTable.init();

    try {
      const cfg = await window.EmooseApi.getNodeConfig();
      el('node-name').textContent = (cfg.node || '').replace(/[^0-9]/g, '') || cfg.node;
      el('node-name').title = cfg.node;
    } catch (e) { /* ignore */ }

    try {
      const latest = await window.EmooseApi.getLatestSensor();
      if (latest.data) updateSensorCards(latest.data);
    } catch (e) { /* belum ada data */ }

    try {
      const hist = await window.EmooseApi.getSensorHistory(30);
      if (window.EmooseChart) window.EmooseChart.seedFromHistory(hist.data);
    } catch (e) { /* ignore */ }

    refreshSummary();
    refreshStatusFooter();
    refreshDistribution();
    refreshAbnormalWeek();
    setInterval(refreshStatusFooter, 8000);
    setInterval(refreshSummary, 30000);
    setInterval(refreshDistribution, 60000);
    setInterval(refreshAbnormalWeek, 60000);

    // --- Socket.IO subscriptions ---
    const socket = window.EmooseSocket;
    socket.on('connect', () => setStatusDot('ss-dot-socket', true));
    socket.on('disconnect', () => setStatusDot('ss-dot-socket', false));
    socket.on('sensor_update', (d) => {
      // EMOOSE DEMO SIMULATION MODULE guard: selama "Mode Demo Aktif" berlangsung,
      // tampilan gauge/marker/chart tetap menunjukkan data simulasi supaya tidak
      // langsung tertimpa data ESP32 asli yang datang tiap 1 detik. Data asli tetap
      // diterima & disimpan seperti biasa (window.EmooseLastSensorData selalu ada
      // di objek d) -- ini HANYA guard tampilan, aman default ke `false` jika
      // public/js/demo.js dihapus (window.EmooseDemo tidak akan pernah ada).
      if (window.EmooseDemo && window.EmooseDemo.isActive()) return;
      updateSensorCards(d);
    });

    socket.on('event_update', (evt) => {
      if (window.EmooseTable) window.EmooseTable.prependRow(evt);
      if (evt.level === 'ALARM' || evt.level === 'ABNORMAL') {
        showToast({ title: window.EmooseI18n.t('toast_abnormal_title'), desc: evt.description || evt.event, type: 'alarm' });
        refreshSummary();
        refreshAbnormalWeek();
      } else if (evt.level === 'WARNING') {
        showToast({ title: window.EmooseI18n.t('toast_warning_title'), desc: evt.description || evt.event, type: 'warning' });
      } else if (evt.event && evt.event.includes('NORMAL')) {
        showToast({ title: window.EmooseI18n.t('toast_normal_title'), desc: evt.description || '', type: 'normal' });
      }
    });

    socket.on('event_deleted', () => { if (window.EmooseTable) window.EmooseTable.load(); });
    socket.on('events_cleared', () => { if (window.EmooseTable) window.EmooseTable.load(); refreshSummary(); });

    socket.on('device_online', () => { refreshStatusFooter(); setConnStatus(true); });
    socket.on('device_offline', () => {
      setOfflineState();
      setConnStatus(false);
      showToast({ title: window.EmooseI18n.t('toast_offline_title'), desc: '', type: 'warning' });
      refreshStatusFooter();
    });

    socket.on('client_count', (d) => { el('foot-clients-count').textContent = d.count; });

    // Deteksi ESP32 offline di sisi client (tidak ada data > 15 detik)
    let offlineTimer = null;
    socket.on('sensor_update', () => {
      clearTimeout(offlineTimer);
      offlineTimer = setTimeout(() => { setOfflineState(); setConnStatus(false); }, 15000);
    });

    document.addEventListener('emoose:langchange', () => {
      const badge = el('status-badge');
      if (badge && !badge.classList.contains('NORMAL')) {
        // re-render suggestion text on language change
        if (badge.classList.contains('ABNORMAL')) el('suggestion-box').textContent = window.EmooseI18n.t('suggestion_abnormal');
        else if (badge.classList.contains('WARNING')) el('suggestion-box').textContent = window.EmooseI18n.t('suggestion_warning');
      }
    });

    el('logout-btn').addEventListener('click', async () => {
      try { await window.EmooseApi.logout(); } finally { window.location.href = '/'; }
    });
  }

  if (document.readyState !== 'loading') bootstrap();
  else document.addEventListener('DOMContentLoaded', bootstrap);

  // EMOOSE DEMO SIMULATION MODULE: expose fungsi update asli supaya demo.js bisa
  // memakai ULANG fungsi yang sama persis (bukan logic tampilan terpisah).
  // Aman dihapus -- baris ini hanya menempel properti di window, tidak mengubah
  // perilaku fungsi apa pun jika tidak pernah dipanggil.
  window.EmooseUpdateSensorCards = updateSensorCards;
  window.EmooseRefreshAbnormalWeek = refreshAbnormalWeek;
  window.EmooseRefreshSummary = refreshSummary;
})();
