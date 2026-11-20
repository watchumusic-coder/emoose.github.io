/**
 * typing-effect.js — Efek mengetik (typewriter) untuk teks di halaman login.
 * Dipakai untuk subtitle EMOOSE dan teks footer copyright.
 */
(function () {
  function typeText(el, text, speed = 35) {
    return new Promise((resolve) => {
      el.textContent = '';
      const cursor = document.createElement('span');
      cursor.className = 'typing-cursor';
      cursor.innerHTML = '&nbsp;';
      let i = 0;

      function step() {
        if (i <= text.length) {
          el.textContent = text.substring(0, i);
          el.appendChild(cursor);
          i++;
          setTimeout(step, speed);
        } else {
          resolve();
        }
      }
      step();
    });
  }

  window.EmooseTyping = { typeText };

  async function runTypingSequence() {
    const t = window.EmooseI18n ? window.EmooseI18n.t : (k) => k;
    const subtitleEl = document.getElementById('typing-subtitle');
    const footerEl = document.getElementById('typing-footer');

    if (subtitleEl) {
      await typeText(subtitleEl, t('login_subtitle'), 28);
    }
    if (footerEl) {
      await typeText(footerEl, t('login_footer'), 30);
    }
  }

  document.addEventListener('emoose:langchange', () => {
    runTypingSequence();
  });

  function init() {
    setTimeout(runTypingSequence, 300); // beri jeda kecil agar terasa natural saat halaman dimuat
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
