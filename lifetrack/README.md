# Dashboard Pribadi — panduan pasang

Data lama kamu (goals, keuangan) otomatis diimpor dari browser saat pertama dibuka.
File lama `index.html` tidak ditimpa. Ini folder baru.

## Isi
- `public/` → situs (index.html, styles.css, app.js, sw.js, manifest, icons)
- `netlify/functions/` → api (push), notify-cron (pengingat tiap 30 menit), polish (opsional)
- `apps-script/Code.gs` → penyimpanan Google Sheets
- `package.json`, `netlify.toml`

## Yang perlu kamu sambungkan (urut)

### 1. Deploy ke Netlify (WAJIB lewat GitHub atau CLI, bukan drag-and-drop)
Fungsi butuh paket npm, jadi drag-drop tidak cukup.
- GitHub: upload folder ini ke repo, di Netlify "Add new site > Import from Git". Publish dir `public` sudah diatur di netlify.toml.
- Atau CLI: `npm i -g netlify-cli && netlify deploy --prod`.

### 2. Buat kunci push (sekali)
`npx web-push generate-vapid-keys` → dapat Public & Private key.

### 3. Env vars di Netlify (Site configuration > Environment variables)
| Nama | Isi |
|---|---|
| `APP_TOKEN` | kata sandi panjang bebas buatan kamu (rahasia) |
| `VAPID_PUBLIC_KEY` | dari langkah 2 |
| `VAPID_PRIVATE_KEY` | dari langkah 2 |
| `VAPID_SUBJECT` | `mailto:emailkamu@gmail.com` (opsional) |
| `ANTHROPIC_API_KEY` | opsional, hanya untuk tombol "Rapikan goal" |
Setelah isi, deploy ulang.

### 4. Google Sheets
1. Buat Google Sheet baru > Ekstensi > Apps Script > tempel isi `apps-script/Code.gs`.
2. Project Settings > Script Properties > tambah `APP_TOKEN` = SAMA dengan token di Netlify.
3. Deploy > New deployment > Web app > Execute as: **Me**, Who has access: **Anyone**. Salin URL Web App.

### 5. Di aplikasi (Lainnya > Pengaturan)
Isi token + URL Web App → Simpan → Sinkron sekarang. Lalu aktifkan notifikasi.

### 6. iPhone
Buka situs di Safari > Bagikan > **Tambah ke Layar Utama** > buka dari ikon itu > aktifkan notifikasi (iOS 16.4+).

## Catatan
- Token hanya tersimpan di perangkat, tidak ikut ke Sheets.
- Fungsi terjadwal memakai kuota Netlify (jalan ±34x/hari). Cek paket kamu; kalau berat, kurangi jam di netlify/functions/notify-cron.mjs.
- Server tidak bisa baca data di HP, jadi notifikasi memakai ringkasan yang dikirim aplikasi. Buka aplikasi sesekali agar ringkasan segar.
- Jam default notifikasi: zona Asia/Jakarta, hari baru mulai 06:00.
