/**
 * table.js — Tabel log aktivitas: cari, filter level, filter tanggal,
 * pagination, hapus per baris / hapus semua, dan ekspor CSV/PDF.
 */
(function () {
  const state = { search: '', status: '', date: '', page: 1, limit: 12, total: 0 };
  let searchTimer = null;

  function el(id) { return document.getElementById(id); }

  function levelToClass(level) {
    return (level || 'INFO').toUpperCase();
  }

  function sourceBadge(source) {
    const s = (source || 'ESP32').toUpperCase();
    if (s === 'DEMO') return `<span class="source-badge DEMO">DEMO</span>`;
    return `<span class="source-badge DEVICE">DEVICE</span>`;
  }

  function renderRows(rows, { highlightNew = false } = {}) {
    const tbody = el('log-tbody');
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:22px;color:var(--text-muted)" data-i18n="table_empty">${window.EmooseI18n.t('table_empty')}</td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map((r) => `
      <tr class="${highlightNew ? 'row-in' : ''}" data-id="${r.id}">
        <td>${r.timestamp}</td>
        <td>${escapeHtml(r.event)}</td>
        <td>${escapeHtml(r.description || '-')}</td>
        <td><span class="level-pill ${levelToClass(r.level)}">${r.level}</span></td>
        <td>${sourceBadge(r.source)}</td>
        <td><button class="row-delete-btn" data-id="${r.id}" title="Delete">&#10005;</button></td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.row-delete-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm(window.EmooseI18n.t('table_confirm_delete_one'))) return;
        try {
          await window.EmooseApi.deleteEvent(btn.dataset.id);
          load();
        } catch (e) { alert(e.message); }
      });
    });
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function renderPagination() {
    const totalPages = Math.max(Math.ceil(state.total / state.limit), 1);
    el('pagination-info').textContent = window.EmooseI18n.t('table_page_info', { page: state.page, total: totalPages });
    el('prev-page').disabled = state.page <= 1;
    el('next-page').disabled = state.page >= totalPages;
  }

  async function load() {
    try {
      const data = await window.EmooseApi.getEvents(state);
      state.total = data.total;
      renderRows(data.data);
      renderPagination();
    } catch (e) {
      console.error('[TABLE] load error', e.message);
    }
  }

  function prependRow(evt) {
    // Jika sedang di halaman 1 tanpa filter, sisipkan baris baru secara live
    if (state.page === 1 && !state.search && !state.status && !state.date) {
      const tbody = el('log-tbody');
      const emptyRow = tbody.querySelector('td[colspan]');
      if (emptyRow) tbody.innerHTML = '';
      const tr = document.createElement('tr');
      tr.className = 'row-in';
      tr.dataset.id = evt.id;
      tr.innerHTML = `
        <td>${evt.timestamp}</td>
        <td>${escapeHtml(evt.event)}</td>
        <td>${escapeHtml(evt.description || '-')}</td>
        <td><span class="level-pill ${levelToClass(evt.level)}">${evt.level}</span></td>
        <td>${sourceBadge(evt.source)}</td>
        <td><button class="row-delete-btn" data-id="${evt.id}" title="Delete">&#10005;</button></td>
      `;
      tr.querySelector('.row-delete-btn').addEventListener('click', async () => {
        if (!confirm(window.EmooseI18n.t('table_confirm_delete_one'))) return;
        try { await window.EmooseApi.deleteEvent(evt.id); load(); } catch (e) { alert(e.message); }
      });
      tbody.prepend(tr);
      while (tbody.children.length > state.limit) tbody.removeChild(tbody.lastChild);
      state.total += 1;
      renderPagination();
    } else if (state.page === 1) {
      load();
    }
  }

  function init() {
    el('search-input').addEventListener('input', (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => { state.search = e.target.value; state.page = 1; load(); }, 350);
    });
    el('status-filter').addEventListener('change', (e) => { state.status = e.target.value; state.page = 1; load(); });
    el('date-filter').addEventListener('change', (e) => { state.date = e.target.value; state.page = 1; load(); });
    el('prev-page').addEventListener('click', () => { if (state.page > 1) { state.page--; load(); } });
    el('next-page').addEventListener('click', () => {
      const totalPages = Math.max(Math.ceil(state.total / state.limit), 1);
      if (state.page < totalPages) { state.page++; load(); }
    });
    el('export-csv-btn').addEventListener('click', () => { window.location.href = '/api/export/csv'; closeMenu('export-dropdown'); });
    el('export-pdf-btn').addEventListener('click', () => { window.location.href = '/api/export/pdf'; closeMenu('export-dropdown'); });

    const menuBtn = el('export-menu-btn');
    const dropdown = el('export-dropdown');
    if (menuBtn && dropdown) {
      menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('visible');
      });
    }

    // ---------------- Hapus bertingkat (Semua / 3 Hari / 1 Minggu / 3 Minggu / 1 Bulan) ----------------
    const DELETE_RANGES = [
      { id: 'delete-range-all', range: 'all', confirmKey: 'table_confirm_delete_all' },
      { id: 'delete-range-3d', range: '3d', confirmKey: 'table_confirm_delete_range' },
      { id: 'delete-range-1w', range: '1w', confirmKey: 'table_confirm_delete_range' },
      { id: 'delete-range-3w', range: '3w', confirmKey: 'table_confirm_delete_range' },
      { id: 'delete-range-1m', range: '1m', confirmKey: 'table_confirm_delete_range' }
    ];
    DELETE_RANGES.forEach((cfg) => {
      const btn = el(cfg.id);
      if (!btn) return;
      btn.addEventListener('click', async () => {
        closeMenu('delete-dropdown');
        if (!confirm(window.EmooseI18n.t(cfg.confirmKey))) return;
        try {
          await window.EmooseApi.deleteAllEvents(cfg.range);
          state.page = 1;
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

    // ---------------- Refresh manual ----------------
    const refreshBtn = el('refresh-log-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => load());
    }

    load();
  }

  function closeMenu(id) {
    const dropdown = el(id);
    if (dropdown) dropdown.classList.remove('visible');
  }

  window.EmooseTable = { init, load, prependRow };
})();
