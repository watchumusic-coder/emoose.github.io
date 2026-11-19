# EMOOSE Dashboard
Smart IoT Duck Farm Monitoring and Automation System — Web Dashboard

Backend: **Node.js + Express + Socket.IO + SQLite**
Frontend: **HTML + CSS + Vanilla JS** (Leaflet.js untuk peta, Chart.js untuk grafik)
Port default: **5135**

---

## 1. Instalasi

```bash
cd emoose-dashboard
npm install
cp .env.example .env
```

Edit `.env` sesuai kebutuhan (minimal: `ADMIN_USERNAME`, `ADMIN_PASSWORD`, dan `NODE_LAT`/`NODE_LNG` untuk lokasi kandang di peta). Isi `TELEGRAM_BOT_TOKEN` dan `TELEGRAM_CHAT_ID` jika ingin notifikasi Telegram aktif — jika dikosongkan, server tetap berjalan normal, hanya pengiriman Telegram yang dilewati.

## 2. Menjalankan

```bash
npm start
```

Server berjalan di:

```
http://localhost:5135
http://<IP_WIFI_LAPTOP>:5135
```

Pastikan laptop/PC server dan modul ESP32 berada pada **jaringan WiFi yang sama**. Login dashboard menggunakan kredensial dari `.env` (default: `admin` / `emoose2026` — segera ganti untuk pemakaian nyata).

## 3. Struktur Folder

```
emoose-dashboard/
├── server.js                 # entry point Express + Socket.IO
├── config/
│   ├── database.js           # koneksi & skema SQLite
│   ├── session.js            # konfigurasi express-session
│   └── thresholds.js         # ambang batas rule engine (referensi)
├── routes/
│   ├── auth.js                # /api/login, /api/logout, /api/me
│   ├── api.js                 # /api/sensor, /api/event, /api/events, dst
│   └── export.js               # /api/export/csv, /api/export/pdf
├── middleware/
│   └── authMiddleware.js
├── utils/
│   └── telegram.js            # pengiriman notifikasi Telegram + debounce
├── database/                  # emoose.db dibuat otomatis di sini
├── exports/                   # file csv/pdf sementara saat diunduh
└── public/
    ├── index.html              # halaman login
    ├── dashboard.html           # halaman dashboard utama
    ├── css/ (theme.css, main.css, login.css)
    └── js/  (api, socket, theme, language, map, chart, table, dashboard, login)
```

## 4. Kontrak Data ESP32 ⇄ Server

### POST `/api/sensor` — dikirim tiap 1 detik oleh firmware
```json
{
  "timestamp": "2026-07-07 08:15:30",
  "temperature": 24.5,
  "humidity": 63,
  "mq135": 650,
  "water": 2.3,
  "pir": false,
  "fan": "OFF",
  "pump": "OFF",
  "servo": "OPEN",
  "mg996r": "-",
  "status": "NORMAL"
}
```
Response: `{"success": true}`

### POST `/api/event` — dikirim saat ada event diskrit (opsional, tapi disarankan)
```json
{
  "event": "Fan ON",
  "description": "Temperature >30°C",
  "level": "ALARM",
  "source": "ESP32",
  "timestamp": "2026-07-07 08:20:10"
}
```
`level` yang dikenali: `INFO`, `WARNING`, `ALARM` (ALARM/ABNORMAL memicu Telegram).

### Endpoint lain (dipakai dashboard, butuh login/session)
| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/api/sensor/latest` | data sensor terbaru |
| GET | `/api/sensor/history?limit=` | histori sensor |
| GET | `/api/events?search=&status=&date=&page=&limit=` | log event dengan filter |
| DELETE | `/api/events/:id` | hapus satu log |
| DELETE | `/api/events/all` | hapus semua log |
| GET | `/api/export/csv` | unduh CSV |
| GET | `/api/export/pdf` | unduh PDF |
| GET | `/api/status` | status WiFi/ESP32/Telegram/DB |
| GET/POST | `/api/settings` | preferensi bahasa/tema/telegram/alarm |
| GET | `/api/config/node` | koordinat & nama node untuk peta |

### Event Socket.IO yang dipancarkan server
`sensor_update`, `event_update`, `event_deleted`, `events_cleared`, `device_online`, `device_offline`, `telegram_sent`, `client_count`.

## 5. Fitur Dashboard

- Login dengan session (cookie `emoose.sid`), pencatatan `access_log`.
- Peta interaktif (Leaflet + OpenStreetMap) — marker berubah warna sesuai status (hijau/kuning/merah) secara realtime.
- Kartu sensor dengan gauge lingkar (Temperature, Humidity, MQ135, Water Level).
- Status aktuator realtime (Fan, Pump, Pintu SG90, Maintenance MG996R).
- Grafik tren (Chart.js) dengan tab per-metrik dan buffer 40 titik terakhir.
- Distribusi status (NORMAL/WARNING/ABNORMAL) hari berjalan.
- Log aktivitas: pencarian, filter level & tanggal, pagination, hapus per baris/semua, ekspor CSV & PDF.
- Notifikasi toast realtime saat status berubah.
- **Instrumentation strip** di header — indikator LED langsung untuk tiap subsistem (Temp/Hum/MQ135/Water/Fan/Pump/Door/WiFi/Telegram), berkedip saat data baru diterima.
- Dark mode / Light mode (localStorage, tidak memerlukan reload).
- Dwibahasa Indonesia / English (localStorage).
- Responsif untuk laptop & tablet.

## 6. Keamanan

- Semua endpoint `/api/*` (kecuali `/api/login` dan ingest dari ESP32 di `/api/sensor` & `/api/event`) memerlukan session login.
- Endpoint ingest ESP32 sengaja dibiarkan tanpa autentikasi session karena firmware tidak memegang cookie browser — batasi eksposur dengan menjaga dashboard hanya pada jaringan WiFi lokal (sesuai batasan SRS BAB 2.6), dan pertimbangkan menambahkan header API-key kustom bila jaringan tidak sepenuhnya tepercaya.
- Password admin & token Telegram disimpan di `.env`, tidak pernah dikirim ke frontend.

## 7. Perubahan Dashboard v2 (Neubrutalism + Fitur Industri)

Update besar ditambahkan di atas v1:

**Desain**
- Tema Soft/Modern Chromatic Neubrutalism: border flat 2px, sudut 6px, hard shadow tanpa blur, mikro-interaksi hover/focus (shadow hilang + geser 4px).
- Palet warna terpisah untuk Login dan Dashboard (light & dark), lihat `public/css/theme.css`.
- Font: Plus Jakarta Sans (judul/label), Inter (body), IBM Plex Mono (data numerik).
- Logo asli (`public/assets/logo.png`), efek mengetik (typing effect) di subtitle & footer, toggle show/hide password.

**Fitur Baru**
- **Digital Twin Kandang** — denah asli (`public/assets/kandang-map.png`) dengan marker animasi realtime: fan berputar, pintu SG90 membuka/menutup, tangki air terisi, LED berdenyut sesuai status (`public/js/digital-twin.js`). Menggantikan peta Leaflet/GPS sepenuhnya.
- **Kontrol Manual** — tombol Fan/Pompa/Pintu/Maintenance di sidebar, mengirim perintah via `POST /api/command` → disimpan di tabel `commands` → dijemput ESP32 lewat `GET /api/command/next` (lihat `README-v2.md` firmware untuk kontrak lengkap).
- **Riwayat Akses** — halaman baru `/access-history` menampilkan log login (waktu, IP, status), tombol hapus semua, dan ekspor CSV/PDF terpisah dari log event utama.
- **Health Score, Smart Water Consumption, Energy Saving, Smart Maintenance** — widget analitik dihitung di `routes/api.js` (`/api/analytics/*`) dari data `sensor_logs`/`event_logs` yang sudah ada, tanpa perlu sensor tambahan.
- **Fail-Safe UI** — banner "Sensor Failure — Safe Mode" muncul otomatis saat firmware mengirim `safeMode: true`.
- **Status EMERGENCY** — level baru di atas ABNORMAL (dipicu MQ135 > 1600 oleh firmware v2), ditampilkan merah solid berkedip cepat.
- Ekspor CSV/PDF kini satu tombol dengan dropdown pilihan format.
- Indikator heartbeat/glow pada node-strip header & footer status (hijau berdenyut = online, merah berdenyut = offline/abnormal).

**Database**
- Tabel baru `commands` (antrian kontrol manual).
- Kolom baru di `sensor_logs`: `fan_percent`, `safe_mode`, `predicted_temp`, `predicted_mq135` (migrasi otomatis & aman untuk database lama).

Field JSON tambahan yang dikirim firmware v2 (`fanPercent`, `safeMode`, `predictedTemp`, `predictedMQ135`) bersifat backward-compatible — dashboard v1 lama tidak akan error, hanya tidak menampilkan field baru tersebut.

## 8. Catatan Pengembangan Lanjutan

- Ambang batas rule-engine di `config/thresholds.js` hanya dipakai sebagai referensi/validasi backend; keputusan aktuator utama tetap dilakukan firmware ESP32 sesuai SRS BAB 3–4.
- Skema database dapat dilihat di `config/database.js` (tabel `sensor_logs`, `event_logs`, `access_log`, `settings`).
- Untuk multi-kandang/multi-node, tambahkan kolom `node_id` pada `sensor_logs`/`event_logs` dan render banyak marker pada peta.
