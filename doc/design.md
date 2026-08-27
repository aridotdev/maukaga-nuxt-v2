# Design Guideline: Modern Glassmorphism SaaS Dashboard

Panduan ini disusun berdasarkan referensi visual yang diberikan dan dioptimalkan sebagai instruksi atau *system prompt* untuk AI UI Generator (seperti v0, Bolt.new, Cursor, atau asisten coding lainnya).

## 1. Design Philosophy & Core Style
* **Tema Utama:** Modern, Clean, Data-Centric, dan Airy.
* **Gaya Visual:** **Soft Glassmorphism** (Efek kaca buram transparan).
* **Kesan:** Profesional, mutakhir namun ramah pengguna, dengan fokus penuh pada visibilitas metrik dan kemudahan administrasi.

## 2. Color Palette (Sistem Warna)
* **Background Utama:** Gradasi sangat lembut bernuansa abu-abu kebiruan/teal terang (contoh: dari `#DDE4E8` ke `#F0F4F8`).
* **Surface / Cards:** Putih transparan (`rgba(255, 255, 255, 0.4)` hingga `rgba(255, 255, 255, 0.7)`).
* **Teks Utama (Primary Text):** Abu-abu kehitaman / Navy gelap (`#1E293B` atau `#0F172A`) untuk kontras tinggi pada teks penting dan angka metrik.
* **Teks Sekunder (Secondary Text):** Abu-abu medium (`#64748B`) untuk label, deskripsi kecil, dan placeholder.
* **Warna Aksen (Primary Action):** Navy gelap solid (`#0F172A`) untuk tombol utama dan state aktif.
* **Warna Indikator Positif:** Hitam atau abu-abu gelap dengan *background pill* putih untuk persentase naik (contoh: `+24%`).

## 3. Typography
* **Font Family:** Sans-serif modern, bersih, dan geometris (Rekomendasi: **Inter**, **SF Pro Display**, atau **Plus Jakarta Sans**).
* **Hierarchy:**
    * **Metrik/Angka Besar:** Sangat besar (36px - 48px), Light atau Regular weight, menggunakan warna teks utama.
    * **Heading Card:** 16px - 18px, Medium weight.
    * **Label/Sub-text:** Kecil (12px - 14px), Regular weight, warna sekunder.

## 4. UI Components & Shapes
* **Border Radius (Sudut):**
    * **Cards/Widget:** Sudut sangat membulat (radius besar, sekitar `20px` hingga `24px`).
    * **Buttons/Tags/Pills:** Gaya bulat penuh (radius `9999px` atau `50px`).
* **Efek Glassmorphism pada Card:**
    * **Background:** Transparan (`rgba(255, 255, 255, 0.5)`).
    * **Backdrop Filter:** Blur (`backdrop-filter: blur(12px) - blur(20px)`).
    * **Border:** Garis putih sangat tipis (`border: 1px solid rgba(255, 255, 255, 0.6)`) untuk memberikan efek pantulan cahaya di tepi kaca.
    * **Shadow:** Drop shadow sangat lembut dan menyebar (`box-shadow: 0 8px 32px rgba(0, 0, 0, 0.05)`).
* **Sidebar & Navigasi:**
    * Sidebar tidak menggunakan kontainer solid, melainkan menyatu dengan *background* utama.
    * Indikator menu yang sedang aktif menggunakan latar belakang bergaya *pill* putih transparan.

## 5. Layout & Spacing
* **Whitespace:** Sangat lega (*generous padding*). Jarak antar elemen dalam card minimal `20px` - `24px`.
* **Grid System:** Asimetris bergaya bento-grid. Widget menyesuaikan lebar konten data.

## 6. Data Visualization (Charts)
* **Gaya Chart:** Minimalis, hindari garis grid background yang keras.
* **Elemen:** Menggunakan area chart dengan isian pola (seperti arsiran garis miring tipis) atau gradasi transparan.
* **Garis:** Garis chart utama menggunakan gaya *dashed* (putus-putus) atau *dotted* (titik-titik).
