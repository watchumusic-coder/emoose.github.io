/**
 * theme.js — Dark / Light mode toggle (client-side, persisted to localStorage)
 */
(function () {
  const STORAGE_KEY = 'emoose_theme';

  function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    if (document.body) document.body.setAttribute('data-theme', theme);
    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.innerHTML = theme === 'dark' ? ICON_SUN : ICON_MOON;
      btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    }
  }

  const ICON_SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  const ICON_MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/></svg>';

  function init() {
    const saved = localStorage.getItem(STORAGE_KEY) || 'dark';
    apply(saved);

    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme') || 'dark';
        const next = current === 'dark' ? 'light' : 'dark';
        localStorage.setItem(STORAGE_KEY, next);
        apply(next);
      });
    }
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
