/**
 * chart.js — Grafik tren realtime (Chart.js) untuk Temperature, Humidity,
 * MQ135, dan Water. Satu canvas, ditukar lewat tab metrik.
 */
(function () {
  const MAX_POINTS = 40;
  const METRICS = {
    temperature: { label: 'Temperature (°C)', color: '#d1543f' },
    humidity: { label: 'Humidity (%RH)', color: '#4c9db3' },
    mq135: { label: 'MQ135 (ADC)', color: '#e0a83e' },
    water: { label: 'Water (cm)', color: '#34ab8f' }
  };

  let chart, activeMetric = 'temperature';
  const buffers = { temperature: [], humidity: [], mq135: [], water: [] };
  const labels = [];

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function buildChart() {
    const ctx = document.getElementById('trend-chart').getContext('2d');
    chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: METRICS[activeMetric].label,
          data: [],
          borderColor: METRICS[activeMetric].color,
          backgroundColor: METRICS[activeMetric].color + '22',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.35,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 300 },
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: cssVar('--text-muted'), maxTicksLimit: 6 }, grid: { display: false } },
          y: { ticks: { color: cssVar('--text-muted') }, grid: { color: cssVar('--border') } }
        }
      }
    });
  }

  function pushPoint(d) {
    const t = (d.timestamp || '').split(' ')[1] || '';
    labels.push(t);
    Object.keys(buffers).forEach((k) => buffers[k].push(d[k] ?? null));
    if (labels.length > MAX_POINTS) {
      labels.shift();
      Object.keys(buffers).forEach((k) => buffers[k].shift());
    }
    renderActive();
  }

  // Rentang kasar tiap metrik, dipakai untuk menormalkan besar perubahan (delta) jadi rasio 0-1.
  const METRIC_SPAN = { temperature: 40, humidity: 100, mq135: 2000, water: 5 };

  function dynamicChartDuration() {
    const buf = buffers[activeMetric];
    if (buf.length < 2) return 300;
    const a = buf[buf.length - 2];
    const b = buf[buf.length - 1];
    if (a == null || b == null) return 300;
    const span = METRIC_SPAN[activeMetric] || 1;
    const deltaRatio = Math.min(Math.abs(b - a) / span, 1);
    // Lonjakan besar -> animasi cepat; perubahan kecil/landai -> animasi pelan & halus.
    return Math.round(1100 - deltaRatio * 850);
  }

  function renderActive() {
    if (!chart) return;
    chart.options.animation.duration = dynamicChartDuration();
    chart.data.labels = labels;
    chart.data.datasets[0].data = buffers[activeMetric];
    chart.data.datasets[0].label = METRICS[activeMetric].label;
    chart.data.datasets[0].borderColor = METRICS[activeMetric].color;
    chart.data.datasets[0].backgroundColor = METRICS[activeMetric].color + '22';
    chart.update();
  }

  function setMetric(metric) {
    activeMetric = metric;
    document.querySelectorAll('.chart-tab').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.metric === metric);
    });
    renderActive();
  }

  function seedFromHistory(rows) {
    rows.forEach((r) => pushPoint(r));
  }

  function init() {
    buildChart();
    document.querySelectorAll('.chart-tab').forEach((btn) => {
      btn.addEventListener('click', () => setMetric(btn.dataset.metric));
    });
  }

  window.EmooseChart = { init, pushPoint, seedFromHistory, setMetric };
})();
