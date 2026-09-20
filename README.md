# 💰 Artha — Modern Personal Financial Tracker

Aplikasi manajemen kas, catatan keuangan pribadi, dan pelacakan anggaran modern berbasis Progressive Web App (PWA) dengan antarmuka Glassmorphism yang responsif, elegan, dan dinamis.

---

## ✨ Fitur Utama

- **📊 Dashboard Interaktif**: Menampilkan ringkasan total saldo, pemasukan, pengeluaran, serta grafik pergerakan kas secara visual menggunakan Chart.js.
- **💸 Pencatatan Transaksi Cepat**: Catat transaksi pemasukan dan pengeluaran dengan kategori yang lengkap, deskripsi, tanggal, dan bukti transaksi.
- **🎯 Anggaran & Target Finansial**: Atur batas anggaran (budget) per kategori serta target tabungan (savings goals).
- **📝 Laporan Finansial & Cetak PDF**: Cetak dan ekspor laporan keuangan dalam format dokumen resmi.
- **🔐 Otentikasi & Database Cloud**: Terintegrasi dengan **Supabase** (PostgreSQL, Auth, dan Row Level Security) serta mendukung mode offline (LocalStorage).
- **📱 PWA & Dukungan Offline**: Dapat diinstal di layar utama perangkat (Android/iOS/Desktop) dan dapat dibuka secara offline berkat Service Worker.
- **🛡️ Keamanan Data Ketat**: Mengimplementasikan Row Level Security (RLS) di Supabase agar setiap pengguna hanya dapat mengakses datanya sendiri.

---

## 🛠️ Teknologi yang Digunakan

- **Frontend**: HTML5, Vanilla CSS (Modern CSS Custom Properties, Glassmorphism, CSS Grid & Flexbox), Vanilla JavaScript (Modular ES Modules).
- **Visualisasi & Ikon**: [Chart.js](https://www.chartjs.org/) & [Remix Icon](https://remixicon.com/).
- **Backend & Auth**: [Supabase](https://supabase.com/) (PostgreSQL Database, Realtime, Authentication).
- **Offline & Cache**: Service Worker API & Web App Manifest (PWA).

---

## 🚀 Cara Menjalankan Secara Lokal

1. **Clone repositori**:
   ```bash
   git clone <URL_REPOSITORI_ANDA>
   cd Artha
   ```

2. **Jalankan web server lokal**:
   - Jika menggunakan **VS Code**: Klik kanan pada `index.html` dan pilih **Open with Live Server**.
   - Atau menggunakan server CLI:
     ```bash
     npx serve .
     # atau
     python -m http.server 8000
     ```

3. **Buka di browser**:
   Akses `http://localhost:5500` (atau port server yang digunakan).

---

## ⚙️ Konfigurasi Supabase

1. Secara default, aplikasi dapat langsung digunakan secara lokal (Offline Storage).
2. Untuk menghubungkan ke proyek Supabase pribadi:
   - Buat proyek baru di [Supabase](https://supabase.com).
   - Masukkan **Supabase Project URL** dan **Anon/Publishable Key** melalui menu **Pengaturan** di dalam aplikasi atau melalui `js/config.js`.
   - Jalankan skrip SQL Row Level Security yang disediakan di menu Admin / Pengaturan aplikasi untuk mengaktifkan kebijakan keamanan database.

---

## 🔒 Keamanan & Privasi

- File kredensial lokal dan token lingkungan (`.env*`, `.vercel`) secara otomatis dikecualikan dari repositori melalui konfigurasi `.gitignore`.
- Seluruh komunikasi data dengan Supabase dilindungi oleh otentikasi berbasis token JWT dan kebijakan Row Level Security (RLS).
