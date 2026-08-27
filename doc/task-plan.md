Bisa, tapi skalanya **medium ke besar**, tergantung targetnya.

Kalau root app hanya “dipasang login” untuk semua user, perubahan UI/middleware tidak terlalu besar. Tapi kalau RBAC-nya benar untuk `cs`, `qrcc`, `management`, `admin`, perubahan jadi lebih luas karena backend juga harus ikut enforce role.

Gambaran impact:

**Medium**
- Tambah role `cs` di Supabase `profiles`.
- Update `useUserProfile()` agar role valid jadi `cs | qrcc | management | admin`.
- Update middleware route guard.
- Buat matrix akses route:
  - `cs`: buat pengajuan, draft, final submit, print ulang/status.
  - `qrcc`: dashboard operasional, review, cetak/kirim.
  - `management`: lihat dashboard/detail saja.
  - `admin`: semua akses termasuk settings/user.
- Update navigasi/menu berdasarkan role.

**Besar**
- Apps Script harus validasi token Supabase untuk action CS juga, bukan hanya admin action.
- Semua submit pengajuan perlu menyimpan identitas user: email/nama/role.
- Data perlu audit: siapa buat draft, siapa submit final, siapa update status.
- Perlu aturan apakah CS hanya boleh lihat pengajuannya sendiri atau semua pengajuan cabang.
- Invite/user management perlu mendukung role `cs`.
- Kalau CS wajib login, flow draft/resume token dan localStorage perlu ditinjau ulang.

Yang paling penting: **middleware frontend saja tidak cukup untuk security**. RBAC harus dicek juga di backend Apps Script, karena user masih bisa memanggil API langsung.

Rekomendasi saya:
- Kalau app ini hanya dipakai internal kantor: root app unified login masih masuk akal.
- Kalau CS app akan dibuka lebih publik/luas: lebih aman tetap pisah `cs-web` dan admin, karena admin code tidak ikut kebundle ke app CS.

Jadi jawabannya: **tidak kecil**, tapi juga tidak perlu rewrite total. Untuk implementasi yang benar dan rapi, anggap ini sebagai refactor auth/RBAC lintas frontend + backend.