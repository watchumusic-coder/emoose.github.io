/**
 * digital-twin.js — Digital Twin Kandang.
 * Menampilkan denah kandang asli (bukan peta GPS) dengan marker animasi
 * realtime: fan berputar, pintu SG90 membuka/menutup, level air terisi,
 * LED berdenyut sesuai status. Posisi marker mengikuti tata letak
 * Block A/B/C/D yang diberikan pengguna.
 */
(function () {
  // Posisi marker dalam persen (left, top) relatif terhadap gambar denah.
  const NODES = {
    fan:    { left: 43, top: 18, shape: 'octagon', label: 'EF',  title: 'Fan (Block A)' },
    sht31:  { left: 66, top: 23, shape: 'dual',    label: '°C',  title: 'SHT31 (Block A)' },
    mq135:  { left: 72, top: 28, shape: 'circle',  label: 'NH₃', title: 'MQ135 (Block A)' },
    // Dipindah sesuai posisi pintu pada denah (bracket putih di dinding atas Block B)
    sg90:   { left: 66, top: 41, shape: 'door',    label: '',    title: 'Pintu SG90 (Block B)' },
    hcsr:   { left: 91, top: 55, shape: 'circle',  label: 'Q',   title: 'HC-SR501 PIR (Block B)' },
    jsn:    { left: 38, top: 79, shape: 'circle',  label: 'US',  title: 'JSN-SR04T (Block C)' },
    mg996r: { left: 81, top: 74, shape: 'square',  label: '💧',  title: 'MG996R Pintu Air (Block C)' },
    pompa:  { left: 81, top: 88, shape: 'polygon', label: '⏻',  title: 'Pompa Air (Block D)' }
  };

  const COLOR_NORMAL = '#0eba05';
  const COLOR_ABNORMAL = '#cb0606';
  const COLOR_MANUAL = '#ff960c';
  const COLOR_OFFLINE = '#8a8a8a';

  let container;
  let popupEl;

  function svgForShape(shape, label, color) {
    const common = `fill="${color}" stroke="#0F172A" stroke-width="2"`;
    let shapeMarkup = '';
    switch (shape) {
      case 'dual':
        // Marker SHT31: satu lingkaran, suhu & kelembapan tampil berdampingan di dalamnya
        return `<svg viewBox="0 0 40 40" width="38" height="38">
          <circle cx="20" cy="20" r="17" ${common}/>
          <text class="dt-dual-temp" x="20" y="17" text-anchor="middle" font-size="8.5" font-weight="700" fill="#0F172A" font-family="var(--font-mono)">--</text>
          <text class="dt-dual-hum" x="20" y="27" text-anchor="middle" font-size="8.5" font-weight="700" fill="#0F172A" font-family="var(--font-mono)">--</text>
        </svg>`;
      case 'circle':
        shapeMarkup = `<circle cx="20" cy="20" r="17" ${common}/>`;
        break;
      case 'square':
        shapeMarkup = `<rect x="4" y="4" width="32" height="32" rx="4" ${common}/>`;
        break;
      case 'octagon':
        shapeMarkup = `<polygon points="13,4 27,4 36,13 36,27 27,36 13,36 4,27 4,13" ${common} class="dt-fan-blades"/>`;
        break;
      case 'polygon':
        shapeMarkup = `<polygon points="20,3 33,10 33,30 20,37 7,30 7,10" ${common}/>`;
        break;
      case 'door':
        shapeMarkup = `<path d="M10 4 v32 M10 4 h20 M10 36 h20" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
                        <rect x="4" y="2" width="32" height="36" rx="4" fill="${color}" stroke="#0F172A" stroke-width="2" opacity="0.25"/>`;
        break;
      default:
        shapeMarkup = `<circle cx="20" cy="20" r="17" ${common}/>`;
    }
    return `<svg viewBox="0 0 40 40" width="38" height="38">${shapeMarkup}
      ${label ? `<text x="20" y="24" text-anchor="middle" font-size="11" font-weight="700" fill="#0F172A" font-family="var(--font-mono)">${label}</text>` : ''}
    </svg>`;
  }

  function buildMarkers() {
    Object.keys(NODES).forEach((key) => {
      const node = NODES[key];
      const el = document.createElement('div');
      el.className = 'dt-marker';
      el.id = `dt-${key}`;
      el.style.left = `${node.left}%`;
      el.style.top = `${node.top}%`;
      el.innerHTML = svgForShape(node.shape, node.label, COLOR_OFFLINE);
      el.title = node.title;

      el.addEventListener('mouseenter', () => showPopup(key, el));
      el.addEventListener('mouseleave', hidePopup);
      el.addEventListener('click', () => showPopup(key, el));

      container.appendChild(el);
    });
  }

  function showPopup(key, el) {
    const node = NODES[key];
    const data = window.EmooseLastSensorData || {};
    let detail = '';
    if (key === 'sht31') detail = `${data.temperature != null ? data.temperature.toFixed(1) : '--'}°C`;
    else if (key === 'mq135') detail = `${data.mq135 ?? '--'} ADC`;
    else if (key === 'fan') detail = `${data.fanPercent ?? (data.fan === 'ON' ? 100 : 0)}%`;
    else if (key === 'jsn') detail = `${data.water != null ? data.water.toFixed(1) : '--'} cm`;
    else if (key === 'pompa') detail = data.pump || '--';
    else if (key === 'sg90') detail = data.sg90 || '--';
    else if (key === 'mg996r') detail = data.mg996r || '--';
    else if (key === 'hcsr') detail = data.pir ? 'Terdeteksi' : 'Kosong';

    popupEl.innerHTML = `<div class="dt-popup-title">${node.title}</div><div class="dt-popup-value">${detail}</div>`;
    popupEl.style.left = `${node.left}%`;
    popupEl.style.top = `${node.top}%`;
    popupEl.classList.add('visible');
    el.classList.add('dt-hover');
  }

  function hidePopup() {
    popupEl.classList.remove('visible');
    document.querySelectorAll('.dt-marker.dt-hover').forEach((el) => el.classList.remove('dt-hover'));
  }

  function setMarkerColor(key, color) {
    const el = document.getElementById(`dt-${key}`);
    if (!el) return;
    const shape = el.querySelector('circle, rect, polygon');
    if (shape) shape.setAttribute('fill', color);
  }

  function update(d) {
    if (!container) return;
    const color = d.status === 'ABNORMAL' || d.status === 'EMERGENCY' ? COLOR_ABNORMAL : COLOR_NORMAL;

    setMarkerColor('sht31', color);
    setMarkerColor('mq135', color);
    setMarkerColor('hcsr', d.pir ? COLOR_MANUAL : COLOR_NORMAL);
    setMarkerColor('jsn', color);

    // SHT31: tampilkan suhu & kelembapan berdampingan di dalam lingkaran yang sama
    const sht31El = document.getElementById('dt-sht31');
    if (sht31El) {
      const tempText = sht31El.querySelector('.dt-dual-temp');
      const humText = sht31El.querySelector('.dt-dual-hum');
      if (tempText) tempText.textContent = d.temperature != null ? `${d.temperature.toFixed(1)}°` : '--';
      if (humText) humText.textContent = d.humidity != null ? `${d.humidity.toFixed(0)}%` : '--';
    }

    // Fan: berputar jika ON, kecepatan animasi mengikuti fanPercent
    const fanEl = document.getElementById('dt-fan');
    if (fanEl) {
      const pct = d.fanPercent ?? (d.fan === 'ON' ? 100 : 0);
      setMarkerColor('fan', pct > 0 ? COLOR_NORMAL : COLOR_OFFLINE);
      const blades = fanEl.querySelector('.dt-fan-blades');
      if (blades) {
        if (pct > 0) {
          const duration = Math.max(0.15, 1.6 - (pct / 100) * 1.4); // makin cepat makin tinggi %
          blades.style.animation = `dt-spin ${duration}s linear infinite`;
        } else {
          blades.style.animation = 'none';
        }
      }
    }

    // Pintu SG90: buka/tutup
    const sg90El = document.getElementById('dt-sg90');
    if (sg90El) {
      const isOpen = d.sg90 === 'OPEN';
      setMarkerColor('sg90', isOpen ? COLOR_NORMAL : COLOR_OFFLINE);
      sg90El.classList.toggle('dt-door-open', isOpen);
    }

    // Pompa: ON/OFF + animasi isi air
    const pompaEl = document.getElementById('dt-pompa');
    if (pompaEl) {
      const pumpOn = d.pump === 'ON';
      setMarkerColor('pompa', pumpOn ? COLOR_NORMAL : COLOR_OFFLINE);
      pompaEl.classList.toggle('dt-pumping', pumpOn);
    }

    // MG996R (maintenance / pintu air)
    setMarkerColor('mg996r', (d.mg996r === 'OPEN') ? COLOR_MANUAL : COLOR_OFFLINE);

    // Water level bar
    const waterBar = document.getElementById('dt-water-fill');
    if (waterBar && d.water != null) {
      // water = jarak sensor ke permukaan air (cm). Semakin kecil = semakin penuh.
      const pct = Math.max(0, Math.min(100, (1 - (d.water / 5)) * 100));
      waterBar.style.width = `${pct}%`;
    }

    // Duck / PIR indicator
    const duckEl = document.getElementById('dt-ducks');
    if (duckEl) duckEl.textContent = d.pir ? '🦆🦆🦆' : '—';

    // Legend hidup: hijau berdetak terus saat aman, merah berkedip saat ABNORMAL/EMERGENCY
    // (suhu, amoniak/MQ135, atau kelembapan) sampai semua nilai kembali aman.
    const isAbnormal = d.status === 'ABNORMAL' || d.status === 'EMERGENCY';
    const normalDot = document.getElementById('legend-dot-normal');
    const abnormalDot = document.getElementById('legend-dot-abnormal');
    if (normalDot) normalDot.classList.toggle('legend-heartbeat', !isAbnormal);
    if (abnormalDot) abnormalDot.classList.toggle('legend-blink', isAbnormal);
  }

  function init() {
    container = document.getElementById('digital-twin-map');
    if (!container) return;
    popupEl = document.getElementById('dt-popup');
    buildMarkers();
  }

  window.EmooseDigitalTwin = { init, update };

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
