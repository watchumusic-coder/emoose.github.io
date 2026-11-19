/**
 * login.js — Menangani submit form login halaman index.html
 */
(function () {
  function initPasswordToggle() {
    const toggleBtn = document.getElementById('toggle-password');
    const passwordInput = document.getElementById('password');
    const eyeIcon = document.getElementById('eye-icon');
    if (!toggleBtn || !passwordInput) return;

    const EYE_OPEN = '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/>';
    const EYE_CLOSED = '<path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a18.5 18.5 0 0 1 4.22-5.06M9.9 4.24A9.12 9.12 0 0 1 12 5c7 0 11 7 11 7a18.5 18.5 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';

    toggleBtn.addEventListener('click', () => {
      const isPassword = passwordInput.type === 'password';
      passwordInput.type = isPassword ? 'text' : 'password';
      eyeIcon.innerHTML = isPassword ? EYE_CLOSED : EYE_OPEN;
    });
  }

  function init() {
    initPasswordToggle();

    const form = document.getElementById('login-form');
    const errorBox = document.getElementById('login-error');
    const btn = document.getElementById('login-btn');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorBox.classList.remove('visible');
      btn.disabled = true;
      btn.textContent = '...';

      const username = document.getElementById('username').value.trim();
      const password = document.getElementById('password').value;

      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (data.success) {
          window.location.href = data.redirect || '/dashboard';
        } else {
          errorBox.textContent = data.message || window.EmooseI18n.t('login_error_default');
          errorBox.classList.add('visible');
        }
      } catch (err) {
        errorBox.textContent = window.EmooseI18n.t('login_error_default');
        errorBox.classList.add('visible');
      } finally {
        btn.disabled = false;
        btn.textContent = window.EmooseI18n.t('login_button');
      }
    });
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
