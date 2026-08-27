### 1. Prompt untuk IDE AI (System Rules / Context)

*(Salin teks bahasa Inggris di bawah ini dan jadikan sebagai rule utama AI Anda)*

> **Role:** You are an expert Senior Fullstack Engineer & Software Architect specializing in Vue, Nuxt 4, Nitro, Google Apps Script (GAS), SQLite, Drizzle ORM, and Zod.
> **Project Context:**
> We are re-architecting an internal application named "MAUKAGA" (Pengajuan Cetak Ulang Kartu Garansi). We are migrating from a pure GAS-backend to a Hybrid Active-Archive Architecture to bypass GAS memory limits and 100KB CacheService limits.
> **Tech Stack:**
> * **Frontend:** Nuxt 4 (Vue)
> * **Backend/Worker:** Nitro API
> * **Active DB & Proxy:** Google Apps Script (Sheets & Drive)
> * **Archive DB (Local):** SQLite with Drizzle ORM
> * **Schema Validation:** Zod
> 
> 
> **Architecture Goals:**
> 1. **Data Offloading:** Active data stays in GAS. Historical data (status "Selesai") is pulled by Nitro, archived in local SQLite, and hard-deleted from GAS.
> 2. **File Management:** Attachments for completed requests are downloaded by Nitro via GAS Proxy to the local `public/arsip_file/` directory. Original files in Google Drive are then trashed.
> 3. **Schema Simplification:** The GAS database must be heavily denormalized. `PengajuanItems`, `WarrantyCards`, and `ShippingLabels` will be consolidated into a single `PengajuanItems` table. Long blob texts (e.g., `Riwayat Singkat`) must be removed from the main header sheet.
> 
> 
> **Current Task:**
> Follow the implementation plan provided by the user. Focus on writing clean, modular code, enforcing strict typing with Zod schemas, and optimizing Nitro server API routes for background offloading tasks. Wait for my command on which phase to execute first.

---

### 2. Implementation Plan (Hybrid Re-Architecture)

Rencana ini dirancang secara berurutan agar aplikasi tidak *break* saat transisi.

* **Phase 1: GAS Schema Migration & Simplification**
* Ubah struktur header di Google Sheets: Gabungkan data dari `WarrantyCards` dan `ShippingLabels` ke dalam kolom baru di sheet `PengajuanItems`.
* Hapus kolom teks panjang (`Riwayat Singkat`, `File Hard Copy URL`, `Lampiran Foto Bukti URLs`) dari sheet `Pengajuan`. Cukup pertahankan ID file-nya.
* Refaktor `Code.gs` (`handleSubmitPengajuan` dan `handleUpdateStatus`) agar selaras dengan skema tabel yang baru.


* **Phase 2: Local Archive Setup (Nitro, SQLite, Drizzle, Zod)**
* Inisialisasi koneksi SQLite di lingkungan Nuxt/Nitro.
* Buat skema Drizzle untuk tabel arsip lokal (`Arsip_Pengajuan`, `Arsip_Items`, `Arsip_StatusLog`).
* Buat validasi skema input/output menggunakan Zod untuk memastikan integritas data saat ditarik dari GAS.


* **Phase 3: Nitro Sync Worker & File Management API**
* Buat Nitro API *endpoint* (`/api/cron/sync-archive`) yang bertugas memanggil API GAS untuk mencari data berstatus "Selesai".
* Tulis utilitas *file downloader* di Nitro untuk mengambil file dari Google Drive menggunakan File ID via GAS, lalu simpan ke `/public/arsip_file/`.
* Kirim mutasi API kembali ke GAS untuk mengeksekusi penghapusan baris di Sheets dan eksekusi `setTrashed(true)` pada Google Drive.


* **Phase 4: Frontend Adaptation**
* Pisahkan logika *fetching* di UI Dashboard: Jika melihat data aktif, *fetch* dari API GAS. Jika melihat arsip, *fetch* dari API SQLite Lokal.
* Ubah URL *binding* lampiran file agar membaca *local path* (`/arsip_file/...`) untuk data historis.



Bagian mana dari fase implementasi ini yang ingin Anda kerjakan terlebih dahulu?

