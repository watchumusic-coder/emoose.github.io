/**
 * language.js — Dwibahasa (Bahasa Indonesia / English), client-side.
 * Elemen dengan atribut data-i18n="key" akan diisi textContent-nya.
 * Elemen dengan data-i18n-ph="key" akan diisi placeholder-nya.
 */
(function () {
  const STORAGE_KEY = 'emoose_lang';

  const DICT = {
    id: {
      brand_subtitle: 'Smart Duck Farm Monitoring',
      login_subtitle: 'Sistem Monitoring & Otomasi Kandang Entok Berbasis IoT',
      login_username_label: 'Username',
      login_password_label: 'Password',
      login_button: 'Masuk Dashboard',
      login_error_default: 'Username atau password salah.',
      login_footer: '© 2026 - EMOOSE Research Team',
      nav_logout: 'Keluar',
      sidebar_summary_title: 'Ringkasan Hari Ini',
      sidebar_alarm_today: 'Total Alarm',
      sidebar_fan_on: 'Fan Aktif',
      sidebar_pump_on: 'Pompa Aktif',
      sidebar_status_label: 'Status Kandang',
      sidebar_node_label: 'Node Aktif',
      sidebar_suggestion_title: 'Saran Tindakan',
      suggestion_abnormal: 'Kondisi abnormal terdeteksi. Periksa ventilasi dan kualitas udara kandang segera.',
      suggestion_warning: 'Beberapa parameter mendekati ambang batas. Pantau terus kondisi kandang.',
      map_title: 'Peta Lokasi Kandang',
      table_title: 'Log Aktivitas',
      table_search_ph: 'Cari event atau deskripsi...',
      table_filter_all: 'Semua Level',
      table_export_csv: 'Ekspor CSV',
      table_export_pdf: 'Ekspor PDF',
      table_delete_all: 'Hapus ▾',
      table_refresh: '⟳ Refresh',
      delete_range_all: 'Hapus Semua',
      delete_range_3d: 'Lebih dari 3 Hari Lalu',
      delete_range_1w: 'Lebih dari 1 Minggu Lalu',
      delete_range_3w: 'Lebih dari 3 Minggu Lalu',
      delete_range_1m: 'Lebih dari 1 Bulan Lalu',
      table_col_time: 'Waktu',
      table_col_event: 'Event',
      table_col_desc: 'Deskripsi',
      table_col_level: 'Level',
      table_col_action: 'Aksi',
      table_col_source: 'Sumber',
      table_empty: 'Belum ada log aktivitas.',
      table_confirm_delete_all: 'Hapus seluruh log aktivitas? Tindakan ini tidak dapat dibatalkan.',
      table_confirm_delete_range: 'Hapus log pada rentang waktu ini? Tindakan ini tidak dapat dibatalkan.',
      table_confirm_delete_one: 'Hapus log ini?',
      table_prev: 'Sebelumnya',
      table_next: 'Berikutnya',
      table_page_info: 'Halaman {page} dari {total}',
      right_sensor_title: 'Sensor Real-Time',
      right_actuator_title: 'Status Aktuator',
      right_chart_title: 'Grafik Tren',
      right_dist_title: 'Distribusi Status Hari Ini',
      actuator_fan: 'Fan (Ventilasi)',
      actuator_pump: 'Pompa Air',
      actuator_door: 'Pintu Otomatis (SG90)',
      actuator_maintenance: 'Mode Maintenance (MG996R)',
      footer_server: 'Server',
      footer_esp32: 'ESP32',
      footer_telegram: 'Telegram',
      footer_database: 'Database',
      footer_version: 'Versi',
      footer_clients: 'Klien Terhubung',
      sensor_temp: 'Suhu',
      sensor_hum: 'Kelembapan',
      sensor_mq135: 'Kualitas Udara',
      sensor_water: 'Level Air',
      toast_abnormal_title: 'Kondisi Abnormal',
      toast_warning_title: 'Peringatan',
      toast_normal_title: 'Kondisi Kembali Normal',
      toast_offline_title: 'ESP32 Terputus',
      status_online: 'ONLINE',
      status_offline: 'OFFLINE',
      status_connected: 'Tersambung',
      status_disconnected: 'Terputus',
      status_ready: 'SIAP',
      status_configured: 'AKTIF',
      status_not_configured: 'BELUM DIATUR',
      safe_mode_text: '⚠ Sensor Gagal — Mode Cadangan Aktif (Safe Mode)',
      cloud_sync_text: 'Data terkirim ke Cloud',
      cloud_sync_waiting: 'Menunggu data pertama...',
      cloud_sync_ago: 'Data terkirim ke Cloud {sec} detik yang lalu',
      access_history_link: '🕘 Riwayat Akses',
      manual_control_title: 'Kontrol Manual',
      manual_fan: 'Fan (Ventilasi)',
      manual_pump: 'Pompa Air',
      manual_door: 'Pintu (SG90)',
      manual_maintenance: 'Maintenance (MG996R)',
      digital_twin_title: 'Digital Twin Kandang',
      table_export: 'Ekspor ▾',
      health_score_title: 'Farm Health Score',
      health_movement: 'Gerakan',
      widgets_title: 'Air · Energi · Perawatan',
      widget_water: 'Siklus Pompa',
      widget_water_sub: 'Pompa ON hari ini',
      widget_energy: 'Energi Hari Ini',
      widget_fan_hours: 'Jam Aktif Fan',
      widget_servo_cycles: 'Siklus Servo',
      conn_online: 'System Online | Sudah Terkoneksi',
      conn_offline: 'System Offline | Menunggu Koneksi',
      footer_copyright: '© 2026 EMOOSE Research Team',
      suggestion_emergency: 'DARURAT: Gas MQ135 pada level berbahaya! Fan menyala penuh otomatis, segera periksa kandang.',
      back_to_dashboard: 'Kembali ke Dashboard',
      access_history_title: 'Riwayat Akses Dashboard',
      abnormal_week_title: 'Status Abnormal (7 Hari Terakhir)',
      abnormal_week_label: 'Kali Terdeteksi Abnormal',
      status_sistem_title: 'Status Sistem',
      status_sistem_server: 'Server',
      status_sistem_socket: 'Socket.IO',
      status_sistem_db: 'Database',
      status_sistem_esp: 'ESP32 EMOOSE',
      status_sistem_wifi: 'Sinyal WiFi Emoose',
      access_history_delete_all: 'Hapus Log Riwayat Akses ▾',
      access_last_prefix: 'Akses',
      access_ok: 'BERHASIL',
      access_fail: 'GAGAL',
      access_empty: 'Belum ada riwayat akses.',
      access_confirm_delete_all: 'Hapus seluruh riwayat akses? Tindakan ini tidak dapat dibatalkan.',
      access_confirm_delete_range: 'Hapus riwayat akses pada rentang waktu ini? Tindakan ini tidak dapat dibatalkan.'
    },
    en: {
      brand_subtitle: 'Smart Duck Farm Monitoring',
      login_subtitle: 'IoT-Based Duck Farm Monitoring & Automation System',
      login_username_label: 'Username',
      login_password_label: 'Password',
      login_button: 'Sign In to Dashboard',
      login_error_default: 'Incorrect username or password.',
      login_footer: '© 2026 - EMOOSE Research Team',
      nav_logout: 'Log Out',
      sidebar_summary_title: "Today's Summary",
      sidebar_alarm_today: 'Total Alarms',
      sidebar_fan_on: 'Fan Active',
      sidebar_pump_on: 'Pump Active',
      sidebar_status_label: 'Pen Status',
      sidebar_node_label: 'Active Node',
      sidebar_suggestion_title: 'Suggested Action',
      suggestion_abnormal: 'Abnormal condition detected. Check ventilation and air quality immediately.',
      suggestion_warning: 'Some parameters are approaching threshold. Keep monitoring the pen.',
      map_title: 'Pen Location Map',
      table_title: 'Activity Log',
      table_search_ph: 'Search event or description...',
      table_filter_all: 'All Levels',
      table_export_csv: 'Export CSV',
      table_export_pdf: 'Export PDF',
      table_delete_all: 'Delete ▾',
      table_refresh: '⟳ Refresh',
      delete_range_all: 'Delete All',
      delete_range_3d: 'Older than 3 Days',
      delete_range_1w: 'Older than 1 Week',
      delete_range_3w: 'Older than 3 Weeks',
      delete_range_1m: 'Older than 1 Month',
      table_col_time: 'Time',
      table_col_event: 'Event',
      table_col_desc: 'Description',
      table_col_level: 'Level',
      table_col_action: 'Action',
      table_col_source: 'Source',
      table_empty: 'No activity logs yet.',
      table_confirm_delete_all: 'Delete all activity logs? This cannot be undone.',
      table_confirm_delete_range: 'Delete logs in this time range? This cannot be undone.',
      table_confirm_delete_one: 'Delete this log entry?',
      table_prev: 'Previous',
      table_next: 'Next',
      table_page_info: 'Page {page} of {total}',
      right_sensor_title: 'Real-Time Sensors',
      right_actuator_title: 'Actuator Status',
      right_chart_title: 'Trend Chart',
      right_dist_title: "Today's Status Distribution",
      actuator_fan: 'Fan (Ventilation)',
      actuator_pump: 'Water Pump',
      actuator_door: 'Automatic Door (SG90)',
      actuator_maintenance: 'Maintenance Mode (MG996R)',
      footer_server: 'Server',
      footer_esp32: 'ESP32',
      footer_telegram: 'Telegram',
      footer_database: 'Database',
      footer_version: 'Version',
      footer_clients: 'Connected Clients',
      sensor_temp: 'Temperature',
      sensor_hum: 'Humidity',
      sensor_mq135: 'Air Quality',
      sensor_water: 'Water Level',
      toast_abnormal_title: 'Abnormal Condition',
      toast_warning_title: 'Warning',
      toast_normal_title: 'Back to Normal',
      toast_offline_title: 'ESP32 Disconnected',
      status_online: 'ONLINE',
      status_offline: 'OFFLINE',
      status_connected: 'CONNECTED',
      status_disconnected: 'DISCONNECTED',
      status_ready: 'READY',
      status_configured: 'ACTIVE',
      status_not_configured: 'NOT SET',
      safe_mode_text: '⚠ Sensor Failure — Backup Mode Active (Safe Mode)',
      cloud_sync_text: 'Data sent to Cloud',
      cloud_sync_waiting: 'Waiting for first data...',
      cloud_sync_ago: 'Data sent to Cloud {sec}s ago',
      access_history_link: '🕘 Access History',
      manual_control_title: 'Manual Control',
      manual_fan: 'Fan (Ventilation)',
      manual_pump: 'Water Pump',
      manual_door: 'Door (SG90)',
      manual_maintenance: 'Maintenance (MG996R)',
      digital_twin_title: 'Coop Digital Twin',
      table_export: 'Export ▾',
      health_score_title: 'Farm Health Score',
      health_movement: 'Movement',
      widgets_title: 'Water · Energy · Maintenance',
      widget_water: 'Pump Cycles',
      widget_water_sub: 'Pump ON today',
      widget_energy: "Today's Energy",
      widget_fan_hours: 'Fan Hours Active',
      widget_servo_cycles: 'Servo Cycles',
      conn_online: 'System Online | Connected',
      conn_offline: 'System Offline | Awaiting Connection',
      footer_copyright: '© 2026 EMOOSE Research Team',
      suggestion_emergency: 'EMERGENCY: MQ135 gas at dangerous level! Fan running at full speed automatically, check the coop immediately.',
      back_to_dashboard: 'Back to Dashboard',
      access_history_title: 'Dashboard Access History',
      abnormal_week_title: 'Abnormal Status (Last 7 Days)',
      abnormal_week_label: 'Times Detected Abnormal',
      status_sistem_title: 'System Status',
      status_sistem_server: 'Server',
      status_sistem_socket: 'Socket.IO',
      status_sistem_db: 'Database',
      status_sistem_esp: 'ESP32 EMOOSE',
      status_sistem_wifi: 'Emoose WiFi Signal',
      access_history_delete_all: 'Delete Access History Log ▾',
      access_last_prefix: 'Access',
      access_ok: 'SUCCESS',
      access_fail: 'FAILED',
      access_empty: 'No access history yet.',
      access_confirm_delete_all: 'Delete all access history? This cannot be undone.',
      access_confirm_delete_range: 'Delete access history in this time range? This cannot be undone.'
    }
  };

  function t(key, vars) {
    const lang = getLang();
    let str = (DICT[lang] && DICT[lang][key]) || DICT.id[key] || key;
    if (vars) {
      Object.keys(vars).forEach((k) => { str = str.replace(`{${k}}`, vars[k]); });
    }
    return str;
  }

  function getLang() {
    return localStorage.getItem(STORAGE_KEY) || 'id';
  }

  function applyTranslations() {
    const lang = getLang();
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-ph]').forEach((el) => {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph')));
    });
    document.documentElement.setAttribute('lang', lang);
    const sel = document.getElementById('lang-select');
    if (sel) sel.value = lang;
  }

  function setLang(lang) {
    localStorage.setItem(STORAGE_KEY, lang);
    applyTranslations();
    document.dispatchEvent(new CustomEvent('emoose:langchange', { detail: { lang } }));
  }

  function init() {
    applyTranslations();
    const sel = document.getElementById('lang-select');
    if (sel) {
      sel.value = getLang();
      sel.addEventListener('change', (e) => setLang(e.target.value));
    }
  }

  window.EmooseI18n = { t, getLang, setLang, applyTranslations };

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
