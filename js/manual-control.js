/**
 * manual-control.js — Tombol kontrol manual (Fan/Pompa/Pintu/Maintenance).
 * Mengirim perintah ke server (/api/command), yang kemudian dijemput ESP32.
 */
(function () {
  const BUTTONS = [
    { id: 'manual-fan', type: 'fan', onLabelKey: 'manual_fan', onAction: 'ON', offAction: 'OFF' },
    { id: 'manual-pump', type: 'pump', onLabelKey: 'manual_pump', onAction: 'ON', offAction: 'OFF' },
    { id: 'manual-door', type: 'door', onLabelKey: 'manual_door', onAction: 'OPEN', offAction: 'CLOSE' },
    { id: 'manual-maintenance', type: 'maintenance', onLabelKey: 'manual_maintenance', onAction: 'ON', offAction: 'OFF' }
  ];

  const state = {}; // type -> current boolean (true = "on"/"open")

  function render(btnConfig) {
    const el = document.getElementById(btnConfig.id);
    if (!el) return;
    const isOn = !!state[btnConfig.type];
    const stateLabel = isOn
      ? (btnConfig.type === 'door' ? 'OPEN' : 'ON')
      : (btnConfig.type === 'door' ? 'CLOSE' : 'OFF');
    el.querySelector('.manual-state').textContent = stateLabel;
    el.classList.toggle('is-on', isOn);
  }

  // Update optimistic panel "Status Aktuator" + Digital Twin begitu perintah manual
  // dikirim -- sebelumnya panel ini HANYA mengikuti sensor_update dari ESP32, sehingga
  // terlihat "tidak sinkron" karena ESP32 baru mengeksekusi setelah polling berikutnya
  // (maks ~2 detik). Nilai asli dari ESP32 tetap akan menimpa/mengonfirmasi ini begitu
  // sensor_update berikutnya masuk.
  function applyOptimisticActuatorState(type, action) {
    const map = {
      fan:          { id: 'actuator-fan',         value: action },
      pump:         { id: 'actuator-pump',        value: action },
      door:         { id: 'actuator-door',        value: action },
      maintenance:  { id: 'actuator-maintenance', value: action }
    };
    const cfg = map[type];
    if (!cfg) return;
    const elx = document.getElementById(cfg.id);
    if (elx) {
      elx.textContent = cfg.value;
      elx.className = `actuator-state ${cfg.value}`;
    }

    if (window.EmooseDigitalTwin && window.EmooseLastSensorData) {
      const patched = { ...window.EmooseLastSensorData };
      if (type === 'fan') patched.fan = action;
      else if (type === 'pump') patched.pump = action;
      else if (type === 'door') patched.sg90 = action;
      else if (type === 'maintenance') patched.mg996r = action === 'ON' ? 'OPEN' : '-';
      window.EmooseDigitalTwin.update(patched);
    }
  }

  async function toggle(btnConfig) {
    const el = document.getElementById(btnConfig.id);
    if (el) el.disabled = true;

    const nextState = !state[btnConfig.type];
    const action = nextState ? btnConfig.onAction : btnConfig.offAction;

    try {
      await window.EmooseApi.sendCommand(btnConfig.type, action);
      state[btnConfig.type] = nextState;
      render(btnConfig);
      applyOptimisticActuatorState(btnConfig.type, action);
    } catch (e) {
      console.error('[MANUAL CONTROL] gagal mengirim perintah:', e.message);
      alert(e.message || 'Gagal mengirim perintah manual.');
    } finally {
      if (el) el.disabled = false;
    }
  }

  function init() {
    BUTTONS.forEach((cfg) => {
      const el = document.getElementById(cfg.id);
      if (!el) return;
      state[cfg.type] = false;
      render(cfg);
      el.addEventListener('click', () => toggle(cfg));
    });
  }

  function syncFromSensor(d) {
    state.fan = d.fan === 'ON';
    state.pump = d.pump === 'ON';
    state.door = d.sg90 === 'OPEN';
    state.maintenance = d.mg996r === 'OPEN';
    BUTTONS.forEach(render);
  }

  window.EmooseManualControl = { init, syncFromSensor };

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
