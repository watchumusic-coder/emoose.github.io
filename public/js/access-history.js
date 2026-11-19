/**
 * access-history.js — Halaman Riwayat Akses (Info Sesi Login).
 */
(function () {
  function el(id) { return document.getElementById(id); }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function formatEntry(row) {
    const t = window.EmooseI18n ? window.EmooseI18n.t : (k) => k;
    const status = row.success ? t('access_ok') : t('access_fail');
    return `${t('access_last_prefix')}: ${escapeHtml(row.timestamp)} (IP ${escapeHtml(row.ip || '-')}) — ${escapeHtml(row.username || '-')} — ${status}`;
  }

  async function load() {
    const list = el('access-log-list');
    try {
      const res = await window.EmooseApi.getAccessLog(200);
      const rows = res.data || [];
      if (!rows.length) {
        list.innerHTML = `<div class="access-log-item">${window.EmooseI18n.t('access_empty')}</div>`;
        return;
      }
      list.innerHTML = rows.map((r) => `
        <div class="access-log-item ${r.success ? 'ok' : 'fail'}">${formatEntry(r)}</div>
      `).join('');
    } catch (e) {
      list.innerHTML = `<div class="access-log-item fail">${e.message}</div>`;
    }
  }

  function closeMenu(id) {
    const dropdown = el(id);
    if (dropdown) dropdown.classList.remove('visible');
  }

  function init() {
    load();

    el('export-csv-btn').addEventListener('click', () => { window.location.href = '/api/export/access-log/csv'; closeMenu('export-dropdown'); });
    el('export-pdf-btn').addEventListener('click', () => { window.location.href = '/api/export/access-log/pdf'; closeMenu('export-dropdown'); });

    const menuBtn = el('export-menu-btn');
    const dropdown = el('export-dropdown');
    if (menuBtn && dropdown) {
      menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('visible');
      });
    }

    // ---------------- Hapus bertingkat (Semua / 3 Hari / 1 Minggu / 1 Bulan) ----------------
    const DELETE_RANGES = [
      { id: 'delete-range-all', range: 'all', confirmKey: 'access_confirm_delete_all' },
      { id: 'delete-range-3d', range: '3d', confirmKey: 'access_confirm_delete_range' },
      { id: 'delete-range-1w', range: '1w', confirmKey: 'access_confirm_delete_range' },
      { id: 'delete-range-1m', range: '1m', confirmKey: 'access_confirm_delete_range' }
    ];
    DELETE_RANGES.forEach((cfg) => {
      const btn = el(cfg.id);
      if (!btn) return;
      btn.addEventListener('click', async () => {
        closeMenu('delete-dropdown');
        if (!confirm(window.EmooseI18n.t(cfg.confirmKey))) return;
        try {
          await window.EmooseApi.deleteAllAccessLog(cfg.range);
          load();
        } catch (e) { alert(e.message); }
      });
    });
    const deleteMenuBtn = el('delete-menu-btn');
    const deleteDropdown = el('delete-dropdown');
    if (deleteMenuBtn && deleteDropdown) {
      deleteMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteDropdown.classList.toggle('visible');
      });
    }

    document.addEventListener('click', (e) => {
      if (dropdown && !dropdown.contains(e.target) && e.target !== menuBtn) closeMenu('export-dropdown');
      if (deleteDropdown && !deleteDropdown.contains(e.target) && e.target !== deleteMenuBtn) closeMenu('delete-dropdown');
    });
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
