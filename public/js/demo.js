/**
 * =============================
 * EMOOSE DEMO SIMULATION MODULE
 * =============================
 * public/js/demo.js
 * ------------------------------------------------------------
 * Frontend untuk fitur "Simulasi Darurat". Sepenuhnya opsional:
 * jika file ini + routes/demo.js + tag <script> di dashboard.html
 * dihapus, dashboard EMOOSE asli berjalan normal tanpa error apa pun
 * (semua kode lain melindungi diri lewat `window.EmooseDemo &&`).
 *
 * Tombol & panel demo TIDAK PERNAH dibuat ke DOM untuk user yang
 * belum unlock kode master (bukan sekadar display:none) -- backend
 * (routes/demo.js) tetap menjadi lapisan keamanan utama; frontend ini
 * hanya kenyamanan tampilan.
 * ------------------------------------------------------------
 */
(function () {
  const STR = {
    id: {
      unlockPrompt: 'Masukkan kode presenter untuk mengaktifkan Simulasi Darurat:',
      unlockFailed: 'Kode salah.',
      panelTitle: 'Simulasi Darurat',
      modeLabel: 'Mode Simulasi',
      modeTemp: 'Suhu Abnormal',
      modeHum: 'Kelembapan Abnormal',
      modeGas: 'Gas / MQ135 Abnormal',
      modeAll: 'DARURAT SEMUA SENSOR',
      sendTelegram: 'Kirim Telegram',
      run: 'Jalankan Simulasi',
      clear: 'Hapus Semua Log Demo',
      confirmTitle: 'Apakah Anda yakin ingin menjalankan simulasi darurat?',
      confirmDesc: 'Data yang dibuat akan diberi label DEMO dan tidak akan mengubah data sensor asli.',
      cancel: 'Batal',
      proceed: 'Jalankan',
      demoModeActive: 'MODE DEMO AKTIF',
      cooldown: 'Tunggu sebentar sebelum menjalankan simulasi lagi.',
      cleared: 'Log demo berhasil dihapus.'
    },
    en: {
      unlockPrompt: 'Enter presenter code to enable Emergency Simulation:',
      unlockFailed: 'Incorrect code.',
      panelTitle: 'Emergency Simulation',
      modeLabel: 'Simulation Mode',
      modeTemp: 'Abnormal Temperature',
      modeHum: 'Abnormal Humidity',
      modeGas: 'Abnormal Gas / MQ135',
      modeAll: 'ALL SENSORS EMERGENCY',
      sendTelegram: 'Send Telegram',
      run: 'Run Simulation',
      clear: 'Clear All Demo Logs',
      confirmTitle: 'Are you sure you want to run the emergency simulation?',
      confirmDesc: 'Generated data will be labeled DEMO and will not change real sensor data.',
      cancel: 'Cancel',
      proceed: 'Run',
      demoModeActive: 'DEMO MODE ACTIVE',
      cooldown: 'Please wait before running another simulation.',
      cleared: 'Demo logs cleared successfully.'
    }
  };

  function lang() {
    return (localStorage.getItem('emoose_lang') === 'en') ? 'en' : 'id';
  }
  function t(key) { return STR[lang()][key] || key; }

  let demoActiveUntil = 0;
  let demoBannerTimer = null;

  function isActive() { return Date.now() < demoActiveUntil; }

  async function api(path, opts) {
    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      ...opts
    });
    let data = {};
    try { data = await res.json(); } catch (e) { /* ignore */ }
    if (!res.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`);
    return data;
  }

  function ensureBanner() {
    let banner = document.getElementById('demo-mode-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'demo-mode-banner';
      banner.className = 'demo-mode-banner';
      document.body.appendChild(banner);
    }
    return banner;
  }

  function showBanner() {
    const banner = ensureBanner();
    banner.textContent = `● ${t('demoModeActive')}`;
    banner.classList.add('visible');
  }

  function hideBanner() {
    const banner = document.getElementById('demo-mode-banner');
    if (banner) banner.classList.remove('visible');
  }

  function scheduleBannerHide(holdMs) {
    demoActiveUntil = Date.now() + holdMs;
    clearTimeout(demoBannerTimer);
    demoBannerTimer = setTimeout(() => {
      if (!isActive()) hideBanner();
    }, holdMs + 200);
  }

  // ---------------- Panel Simulasi ----------------
  function buildPanel() {
    const wrap = document.createElement('div');
    wrap.style.marginTop = '16px';
    wrap.innerHTML = `
      <div class="panel-title" style="margin-bottom:8px">🧪 ${t('panelTitle')}</div>
      <div class="demo-panel-box">
        <div class="demo-mode-grid">
          <label class="demo-mode-opt"><input type="radio" name="demo-mode" value="temperature"> ${t('modeTemp')}</label>
          <label class="demo-mode-opt"><input type="radio" name="demo-mode" value="humidity"> ${t('modeHum')}</label>
          <label class="demo-mode-opt"><input type="radio" name="demo-mode" value="gas"> ${t('modeGas')}</label>
          <label class="demo-mode-opt"><input type="radio" name="demo-mode" value="all" checked> ${t('modeAll')}</label>
        </div>
        <label class="demo-telegram-opt"><input type="checkbox" id="demo-send-telegram"> ${t('sendTelegram')}</label>
        <button class="btn danger" id="demo-run-btn" style="width:100%;margin-top:8px">${t('run')}</button>
        <button class="btn" id="demo-clear-btn" style="width:100%;margin-top:6px">${t('clear')}</button>
      </div>
    `;

    wrap.querySelector('#demo-run-btn').addEventListener('click', onRunClicked);
    wrap.querySelector('#demo-clear-btn').addEventListener('click', onClearClicked);
    return wrap;
  }

  function onRunClicked() {
    const mode = document.querySelector('input[name="demo-mode"]:checked')?.value || 'all';
    const sendTelegram = !!document.getElementById('demo-send-telegram')?.checked;

    const ok = confirm(`${t('confirmTitle')}\n\n${t('confirmDesc')}`);
    if (!ok) return;

    api('/api/demo/simulate', { method: 'POST', body: JSON.stringify({ mode, sendTelegram }) })
      .catch((e) => alert(e.message === 'Simulation cooldown' ? t('cooldown') : e.message));
  }

  function onClearClicked() {
    api('/api/demo/clear', { method: 'DELETE' })
      .then(() => { /* UI update terjadi lewat event 'demo_cleared' Socket.IO */ })
      .catch((e) => alert(e.message));
  }

  function renderMasterUI() {
    const slot = document.getElementById('demo-master-slot');
    if (slot && !slot.querySelector('.demo-panel-box')) {
      slot.appendChild(buildPanel());
    }
    const icon = document.getElementById('demo-unlock-icon');
    if (icon) icon.style.opacity = '1';
  }

  function bindSocketEvents() {
    const socket = window.EmooseSocket;
    if (!socket) return;

    socket.on('demo_sensor_update', (d) => {
      showBanner();
      scheduleBannerHide(d.holdMs || 20000);
      if (window.EmooseUpdateSensorCards) window.EmooseUpdateSensorCards(d);
    });

    socket.on('demo_cleared', () => {
      demoActiveUntil = 0;
      hideBanner();
      if (window.EmooseTable) window.EmooseTable.load();
      if (window.EmooseRefreshSummary) window.EmooseRefreshSummary();
      if (window.EmooseRefreshAbnormalWeek) window.EmooseRefreshAbnormalWeek();
    });
  }

  async function tryUnlock() {
    const code = prompt(t('unlockPrompt'));
    if (!code) return;
    try {
      await api('/api/demo/unlock', { method: 'POST', body: JSON.stringify({ code }) });
      renderMasterUI();
    } catch (e) {
      alert(t('unlockFailed'));
    }
  }

  function bindUnlockIcon() {
    const icon = document.getElementById('demo-unlock-icon');
    if (icon) icon.addEventListener('click', tryUnlock);
  }

  async function init() {
    bindUnlockIcon();
    try {
      const session = await api('/api/session');
      if (session.isDemoMaster) renderMasterUI();
      bindSocketEvents();
    } catch (e) {
      // /api/session tidak ada (DEMO_ENABLED=false atau modul dihapus) -> diamkan,
      // dashboard asli tidak terpengaruh sama sekali.
    }
  }

  window.EmooseDemo = { isActive };

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
