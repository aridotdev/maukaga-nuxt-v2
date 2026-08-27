# Source of Truth UI/UX: Fitur Cetak Kartu Garansi

Dokumen ini menjabarkan struktur data dan flow fitur **Cetak Kartu Garansi** berdasarkan implementasi contoh di `doc/dashboard.html` dan backend Google Apps Script di `doc/Code.gs`. Tujuannya menjadi pegangan UI/UX designer saat merancang ulang tampilan tanpa mengubah makna proses bisnis dan kontrak data yang sudah ada.

## Ruang Lingkup

Fitur ini dipakai admin untuk:

1. Membuka antrean item yang siap dicetak kartu garansinya.
2. Menentukan jenis kartu per item: `Local` atau `Import`.
3. Mencetak kartu garansi berdasarkan layout aktif per jenis kartu.
4. Menandai item sebagai sudah dicetak dan menyimpan batch cetak.
5. Membuat preview serta cetak label cabang berdasarkan item yang sudah printed.
6. Mengatur layout cetak aktif untuk kartu `Local` dan `Import`.

Fitur ini membutuhkan sesi admin yang valid. Semua API admin mengirim `token` dari session login.

## Prinsip Penting Untuk Redesign

- **Cetak dan tandai printed adalah dua aksi berbeda.** Tombol `Cetak Pilihan` hanya menyiapkan DOM print dan memanggil browser print. Status printed baru tersimpan ketika admin menekan `Tandai Sudah Dicetak`.
- **Antrean cetak hanya berisi item yang benar-benar siap.** Syarat item masuk antrean: pengajuan berstatus `Disetujui` dan item memiliki `produk_status = verified`.
- **Jenis kartu wajib ada sebelum cetak atau tandai printed.** Jika ada item terpilih tanpa jenis kartu, sistem menolak aksi.
- **Data persistent untuk cetak ada di sheet `WarrantyCards`.** Sheet ini menyimpan jenis kartu, status cetak, batch, timestamp, user, dan data reprint.
- **Layout cetak aktif dipisah per jenis kartu.** `Local` dan `Import` masing-masing punya layout aktif sendiri.
- **Label cabang berbasis item printed.** Label tidak berasal dari antrean belum dicetak, tetapi dari item yang sudah berstatus `Printed`.
- **Status lifecycle pengajuan terpisah dari keputusan item.** `Pengajuan.Status` mengikuti alur ringkas customer-facing: `Baru -> Disetujui -> Diprint -> Dikirim -> Diterima -> Selesai` (dengan `Ditolak` sebagai terminal rejection path). `PengajuanItems.Keputusan Item` khusus approval item: kosong berarti `Menunggu Review`, lalu `Disetujui` atau `Ditolak`. Status fulfillment seperti `Diprint`, `Dikirim`, dan `Diterima` tidak ditulis ke item.
- **Status `Diprint` dan `Dikirim` pengajuan diturunkan otomatis dari `WarrantyCards`.** Setelah `markWarrantyCardsPrinted` atau `markShippingLabelsShipped`, backend memanggil `syncPengajuanLifecycleFromWarranty_` untuk menaik-turunkan status pengajuan berdasarkan agregasi item approved. Item yang `Ditolak` tidak menghambat lifecycle pengajuan.
- **`Diterima` dan `Selesai` diubah manual oleh Admin/QRCC.** `Diterima` tidak otomatis menjadi `Selesai`. Transisi mundur hanya boleh dilakukan Admin dan wajib catatan admin.

## Modul UI Saat Ini

### 1. Entry Point Dashboard

Di dashboard admin ada tombol `Cetak Kartu` yang membuka view antrean cetak.

Perilaku:

- Set `state.currentView = "warranty"`.
- Muat layout aktif lewat API `getPrintLayouts`.
- Muat antrean cetak lewat API `getWarrantyPrintQueue`.

### 2. View Antrian Cetak

View utama fitur berjudul `Cetak Kartu Garansi` dan `Antrian Cetak`.

Elemen UI yang harus dipertahankan secara fungsi:

| Area | Elemen | Fungsi |
| --- | --- | --- |
| Header | Kembali ke Dashboard | Kembali ke dashboard utama |
| Header | Logout | Mengakhiri sesi admin |
| Alert | `print-alert` | Loading, error, dan success message |
| Summary | Total Tampil, Local, Import, Belum Dipilih | Ringkasan visible rows setelah filter |
| Filter | Search | Cari ID, nama, cabang, produk, model, atau nomor seri |
| Filter | Jenis Kartu | Semua, Local, Import, Belum Dipilih |
| Action | Refresh | Muat ulang antrean |
| Action | Setting Layout | Buka view setting layout |
| Layout summary | Local aktif, Import aktif | Menampilkan layout aktif dan offset/gap |
| Bulk selection | Pilih Semua Tampil | Centang semua row yang sedang visible |
| Bulk selection | Hapus Pilihan | Kosongkan selection |
| Bulk edit | Set Local | Set jenis kartu semua item terpilih ke Local |
| Bulk edit | Set Import | Set jenis kartu semua item terpilih ke Import |
| Print | Cetak Pilihan | Render kartu terpilih ke print DOM lalu panggil print |
| Persistence | Tandai Sudah Dicetak | Simpan status printed dan batch |
| Label | Preview Label Cabang | Preview label dari item printed |
| Table | Checkbox per row | Pilih item |
| Table | ID + Item # | Identitas item antrean |
| Table | Cabang | Cabang dari pengajuan |
| Table | Produk, Model, Nomor Seri | Data yang akan dicetak di kartu |
| Table | Jenis Kartu select | Pilih Local/Import per item |
| Table | Status | Badge `Belum Dicetak` atau `Printed` |

### 3. View Setting Layout Cetak

View ini mengelola layout cetak yang digunakan untuk kartu `Local` dan `Import`.

Elemen data/form:

| Field | Keterangan |
| --- | --- |
| Jenis Layout | `local` atau `import` |
| Layout aktif | Daftar layout untuk type terpilih |
| Nama layout | Wajib diisi saat save |
| Offset X (mm) | Boleh negatif, menggeser semua field horizontal |
| Offset Y (mm) | Boleh negatif, menggeser semua field vertikal |
| Gap Produk ke Model (mm) | Boleh negatif, mengatur jarak Produk ke Model |
| Gap Model ke Nomor Seri (mm) | Boleh negatif, mengatur jarak Model ke Nomor Seri |
| Simpan | Save layout baru atau update layout terpilih |
| Jadikan Aktif | Set layout terpilih sebagai layout aktif untuk type tersebut |
| Hapus | Hanya untuk layout custom, tidak untuk builtin |
| Tambah Layout | Form layout kosong |
| Duplikasi Layout Aktif | Copy nilai layout aktif menjadi layout custom baru |

Constraint:

- Layout builtin tidak boleh dihapus.
- Layout aktif tidak boleh dihapus sebelum admin memilih layout aktif lain.
- Layout harus disimpan dulu sebelum bisa dijadikan aktif.

### 4. View Preview Label Cabang

View ini dipakai setelah item ditandai printed atau dari tombol preview umum.

Elemen UI:

| Area | Elemen | Fungsi |
| --- | --- | --- |
| Header | Kembali ke Antrian | Kembali ke view antrean cetak |
| Header | Cetak Label | Print label cabang |
| Alert | `shipping-label-alert` | Loading, error, success |
| Summary | Cabang | Jumlah cabang/label |
| Summary | Qty Item Produk | Total item printed pada label |
| Summary | Ukuran Label | Selalu `60 x 50 mm` |
| Preview | Label per cabang | Nama cabang dan qty item |

### 5. Section Print-Only

Ada section tersembunyi `section-warranty-print` yang hanya muncul saat print.

Perilaku print:

- Saat layar normal, section print disembunyikan.
- Saat print, seluruh body selain `section-warranty-print` disembunyikan.
- Konten kartu garansi dan label cabang sama-sama dirender ke `warranty-print-content`.

## State Frontend

State utama yang relevan:

```js
{
  token: string | null,
  adminNama: string | null,
  currentView: "dashboard" | "warranty" | "settings" | "shipping-label" | string,
  printQueue: WarrantyPrintQueueRow[],
  selectedPrintKeys: Set<string>,
  visiblePrintKeys: string[],
  shippingLabels: ShippingLabel[],
  shippingLabelMeta: {
    batchId: string,
    search: string,
    totalItems: number
  } | null,
  printLayouts: PrintLayout[],
  activePrintLayouts: {
    local: PrintLayout | null,
    import: PrintLayout | null
  },
  activePrintLayoutIds: {
    local: string,
    import: string
  },
  selectedLayoutType: "local" | "import",
  editingLayout: PrintLayout | null
}
```

## Struktur Data Backend

### Sheet: `Pengajuan`

Dipakai sebagai sumber data pengajuan utama. Untuk antrean cetak, hanya row dengan `Status = Disetujui` yang dipakai.

`Status` adalah lifecycle utama pengajuan. Nilai yang valid mengikuti `VALID_STATUSES` backend: `Baru`, `Disetujui`, `Ditolak`, `Diprint`, `Dikirim`, `Diterima`, `Selesai`. Status `Menunggu Upload` adalah status draft khusus dan tidak masuk daftar status final.

Kolom relevan:

| Kolom | Dipakai Untuk |
| --- | --- |
| ID Pengajuan | Relasi ke item dan warranty card |
| Timestamp Submit | Sorting antrean |
| Nama | Search dan data row |
| Bagian/Cabang | Tabel antrean dan label cabang |
| Jumlah Item | Informasi pengajuan |
| Status | Gate utama antrean cetak: harus `Disetujui`. Otomatis naik ke `Diprint`/`Dikirim` saat `WarrantyCards` sinkron. `Diterima` dan `Selesai` diubah manual Admin/QRCC. |
| Catatan Admin | Catatan update status; wajib untuk `Ditolak`, transisi mundur, dan transisi `Diterima`/`Selesai` di luar alur normal |
| Tanggal Update Status Terakhir | Timestamp update terakhir |
| User Update Status | Username admin/QRCC yang melakukan update |
| Riwayat Singkat | Log singkat transisi status, format `[tanggal] StatusLama -> StatusBaru oleh user` |

### Sheet: `PengajuanItems`

Sumber item produk per pengajuan. Untuk antrean cetak, hanya item dengan `produk_status = verified` yang dipakai.

Kolom:

| Kolom | Dipakai Untuk |
| --- | --- |
| ID Pengajuan | Relasi ke pengajuan |
| No Item | Identitas item dalam pengajuan |
| Produk | Dicetak di kartu garansi |
| Model | Dicetak di kartu garansi |
| Nomor Seri | Dicetak di kartu garansi |
| model_normalized | Relasi validasi model produk |
| produk_status | Gate antrean: harus `verified` |
| produk_sumber | Metadata sumber produk |

### Sheet: `WarrantyCards`

State persistent per item kartu garansi. Key logisnya adalah gabungan `ID Pengajuan + No Item`, ditulis sebagai `id::noItem` di frontend.

Kolom:

| Kolom | Makna |
| --- | --- |
| ID Pengajuan | ID pengajuan asal |
| No Item | Nomor item dalam pengajuan |
| Produk | Snapshot produk saat state kartu disimpan |
| Model | Snapshot model saat state kartu disimpan |
| Nomor Seri | Snapshot nomor seri saat state kartu disimpan |
| Jenis Kartu | `Local` atau `Import` |
| Status Cetak | Default `Belum Dicetak`, berubah ke `Printed` |
| Print Batch ID | ID batch ketika ditandai printed |
| Printed At | Waktu pertama kali printed |
| Printed By | Admin yang pertama menandai printed |
| Reprint Count | Bertambah jika item yang sudah printed ditandai printed lagi |
| Last Reprint At | Waktu reprint terakhir |
| Last Reprint By | Admin reprint terakhir |
| Catatan | Catatan penyimpanan atau batch |

### Sheet: `PrintBatch`

Audit batch saat admin menekan `Tandai Sudah Dicetak`.

Kolom:

| Kolom | Makna |
| --- | --- |
| Batch ID | Format `KG-PRINT-yyyyMMdd-HHmmss-XXXXXXXX` |
| Tipe Batch | Saat ini `warranty_card` |
| Created At | Waktu batch dibuat |
| Created By | Username admin |
| Jumlah Item | Jumlah item dalam batch |
| Catatan | Catatan batch, saat ini optional |

### Sheet: `PrintLayouts`

Daftar layout cetak yang bisa dipilih untuk type `local` dan `import`.

Kolom:

| Kolom | Makna |
| --- | --- |
| ID | ID layout, contoh `local-default` |
| Type | `local` atau `import` |
| Name | Nama layout |
| Offset X | Offset horizontal dalam mm |
| Offset Y | Offset vertikal dalam mm |
| Gap Product Model | Jarak tambahan produk ke model dalam mm |
| Gap Model Serial | Jarak tambahan model ke serial dalam mm |
| Is Builtin | Builtin tidak boleh dihapus |
| Created At | Timestamp pembuatan |
| Updated At | Timestamp update |
| Updated By | Username admin terakhir update |

### Sheet: `Config`

Menyimpan layout aktif per type:

| Key | Value Default |
| --- | --- |
| ACTIVE_PRINT_LAYOUT_LOCAL | `local-default` |
| ACTIVE_PRINT_LAYOUT_IMPORT | `import-default` |

### Default Layout

Backend membuat dua layout bawaan jika belum ada:

```js
[
  {
    id: "local-default",
    type: "local",
    name: "Local Default",
    offsetX: 0,
    offsetY: 0,
    gapProductModel: 0,
    gapModelSerial: 0,
    isBuiltin: true
  },
  {
    id: "import-default",
    type: "import",
    name: "Import Default",
    offsetX: 0,
    offsetY: 0,
    gapProductModel: 0,
    gapModelSerial: 0,
    isBuiltin: true
  }
]
```

## Struktur Data API

### `WarrantyPrintQueueRow`

Objek row yang dikembalikan dari `getWarrantyPrintQueue`.

```ts
type WarrantyPrintQueueRow = {
  key: string; // `${idPengajuan}::${noItem}`
  idPengajuan: string;
  noItem: string | number;
  produk: string;
  model: string;
  nomorSeri: string;
  jenisKartu: "Local" | "Import" | "";
  jenisKartuKey: "local" | "import" | "";
  statusCetak: "Belum Dicetak" | "Printed" | string;
  printBatchId: string;
  printedAt: string; // ISO string atau kosong
  printedBy: string;
  reprintCount: number;
  nama: string;
  bagianCabang: string;
  timestampSubmit: string; // ISO string
};
```

### `WarrantyPrintQueueSummary`

Summary dari backend:

```ts
type WarrantyPrintQueueSummary = {
  total: number;
  local: number;
  import: number;
  belumJenisKartu: number;
  printed: number;
};
```

Catatan: UI saat ini menghitung ulang summary berdasarkan rows yang visible setelah filter jenis kartu:

```ts
type VisiblePrintSummary = {
  local: number;
  import: number;
  unset: number;
};
```

### `PrintLayout`

```ts
type PrintLayout = {
  id: string;
  type: "local" | "import";
  name: string;
  offsetX: number;
  offsetY: number;
  gapProductModel: number;
  gapModelSerial: number;
  isBuiltin: boolean;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
};
```

### `PrintLayoutState`

Response `getPrintLayouts`, `savePrintLayout`, `deletePrintLayout`, dan `setActivePrintLayout`.

```ts
type PrintLayoutState = {
  layouts: PrintLayout[];
  active: {
    local: string;
    import: string;
  };
  activeLayouts: {
    local: PrintLayout | null;
    import: PrintLayout | null;
  };
  savedLayoutId?: string;
};
```

### `ShippingLabel`

Dibentuk di frontend dari item printed, bukan langsung dari backend.

```ts
type ShippingLabel = {
  cabang: string;
  qty: number;
};
```

Jika cabang kosong, label memakai nama `Tanpa Cabang`.

## Kontrak API

Semua request dikirim ke `CONFIG.API_URL` dengan method `POST`, header `Content-Type: text/plain;charset=utf-8`, dan body JSON. Secara default frontend menyertakan `token`.

### `getWarrantyPrintQueue`

Request:

```json
{
  "action": "getWarrantyPrintQueue",
  "token": "...",
  "search": "opsional",
  "jenisKartu": "opsional: local/import",
  "includePrinted": false
}
```

Response sukses:

```json
{
  "success": true,
  "data": {
    "rows": [],
    "summary": {
      "total": 0,
      "local": 0,
      "import": 0,
      "belumJenisKartu": 0,
      "printed": 0
    }
  }
}
```

Rules backend:

- Wajib session admin valid.
- `includePrinted = false` membuat row dengan `statusCetak = Printed` tidak dikembalikan.
- `search` mencari di `idPengajuan`, `nama`, `bagianCabang`, `produk`, `model`, dan `nomorSeri`.
- `jenisKartu` optional dan dinormalisasi ke `Local` atau `Import`.
- Sorting backend: `Local`, `Import`, belum dipilih, lalu `timestampSubmit`, `idPengajuan`, `noItem`.

### `saveWarrantyCardTypes`

Request:

```json
{
  "action": "saveWarrantyCardTypes",
  "token": "...",
  "items": [
    {
      "idPengajuan": "KG-...",
      "noItem": 1,
      "jenisKartu": "local"
    }
  ]
}
```

Rules:

- Minimal satu item.
- `jenisKartu` wajib valid: `local/lokal` atau `import/impor`.
- Item harus masih masuk daftar approved queue: pengajuan `Disetujui` dan item `verified`.
- Jika row `WarrantyCards` belum ada, backend membuat row baru.
- Jika row sudah ada, backend mempertahankan status cetak, batch, printed metadata, reprint metadata, dan catatan lama.

Response:

```json
{
  "success": true,
  "data": {
    "count": 1
  }
}
```

### `markWarrantyCardsPrinted`

Request:

```json
{
  "action": "markWarrantyCardsPrinted",
  "token": "...",
  "items": [
    {
      "idPengajuan": "KG-...",
      "noItem": 1,
      "jenisKartu": "local"
    }
  ],
  "catatan": "opsional"
}
```

Rules:

- Minimal satu item.
- Semua item harus punya jenis kartu valid.
- Item harus masih approved dan verified.
- Backend membuat `batchId` baru untuk seluruh item.
- Set `Status Cetak = Printed`.
- Set `Print Batch ID = batchId`.
- Untuk cetak pertama:
  - `Printed At` diisi waktu sekarang.
  - `Printed By` diisi username admin.
  - `Reprint Count` tetap 0.
- Untuk item yang sebelumnya sudah printed:
  - `Printed At` dan `Printed By` pertama dipertahankan.
  - `Reprint Count` bertambah 1.
  - `Last Reprint At` dan `Last Reprint By` diisi.
- Tambah row ke `PrintBatch`.

Response:

```json
{
  "success": true,
  "data": {
    "batchId": "KG-PRINT-...",
    "count": 10
  }
}
```

### `getPrintLayouts`

Request:

```json
{
  "action": "getPrintLayouts",
  "token": "..."
}
```

Rules:

- Backend memastikan default layout tersedia.
- Response berisi semua layout, ID layout aktif, dan object layout aktif.

### `savePrintLayout`

Request:

```json
{
  "action": "savePrintLayout",
  "token": "...",
  "layout": {
    "id": "",
    "type": "local",
    "name": "Layout Baru",
    "offsetX": 0,
    "offsetY": 0,
    "gapProductModel": 0,
    "gapModelSerial": 0
  }
}
```

Rules:

- `type` wajib `local` atau `import`.
- `name` wajib.
- `offsetX` dan `offsetY` boleh negatif.
- `gapProductModel` dan `gapModelSerial` boleh negatif. Nilai positif memperbesar jarak, nilai negatif mempersempit jarak.
- Jika `id` kosong, backend generate ID baru: `{type}-{uuid8}`.
- Layout builtin yang diedit tetap `Is Builtin = TRUE`.

### `setActivePrintLayout`

Request:

```json
{
  "action": "setActivePrintLayout",
  "token": "...",
  "type": "local",
  "id": "local-default"
}
```

Rules:

- Layout harus ada dan type harus cocok.
- Backend update `Config.ACTIVE_PRINT_LAYOUT_LOCAL` atau `Config.ACTIVE_PRINT_LAYOUT_IMPORT`.

### `deletePrintLayout`

Request:

```json
{
  "action": "deletePrintLayout",
  "token": "...",
  "id": "local-abc12345"
}
```

Rules:

- Layout wajib ada.
- Layout builtin tidak boleh dihapus.
- Layout yang sedang aktif tidak boleh dihapus.

## Flow Utama

### Flow A: Membuka Antrean Cetak

1. Admin klik `Cetak Kartu`.
2. Frontend pindah ke view `warranty`.
3. Frontend panggil `getPrintLayouts`.
4. Frontend menyimpan:
   - `state.printLayouts`
   - `state.activePrintLayoutIds`
   - `state.activePrintLayouts`
5. Frontend panggil `getWarrantyPrintQueue` dengan `search` dari input.
6. Backend membangun antrean dari:
   - `Pengajuan` dengan `Status = Disetujui`
   - `PengajuanItems` dengan `produk_status = verified`
   - state cetak dari `WarrantyCards`
7. Frontend render summary, filter, table, dan layout summary.

Empty state:

- Jika tidak ada rows visible, tampilkan `Tidak ada antrian cetak`.

Error state:

- Jika API gagal atau unauthorized, tampilkan alert error. Unauthorized memicu logout.

### Flow B: Search dan Filter

Search:

1. Admin mengetik di field search.
2. Frontend debounce 300 ms.
3. Frontend panggil ulang `getWarrantyPrintQueue` dengan search baru.
4. Backend melakukan search server-side.

Filter jenis kartu:

1. Admin pilih `Semua Jenis`, `Local`, `Import`, atau `Belum Dipilih`.
2. Frontend tidak memanggil API.
3. Frontend filter `state.printQueue` secara client-side.
4. Frontend menghitung ulang summary visible.

### Flow C: Pilih Item

1. Admin centang checkbox row.
2. Frontend menyimpan `row.key` ke `selectedPrintKeys`.
3. Checkbox header menjadi:
   - checked jika semua visible rows terpilih.
   - indeterminate jika sebagian visible rows terpilih.
   - unchecked jika tidak ada visible rows terpilih.
4. `Pilih Semua Tampil` memilih semua row yang sedang visible.
5. `Hapus Pilihan` mengosongkan seluruh selection.

Catatan UX:

- Selection bisa tetap ada walaupun filter berubah, selama row masih ada di `state.printQueue`.
- Saat antrean dimuat ulang, selection yang key-nya tidak ada lagi akan dibuang.

### Flow D: Set Jenis Kartu Per Row

1. Admin memilih `Local` atau `Import` di select row.
2. Frontend memanggil `saveWarrantyCardTypes` untuk satu item.
3. Backend upsert row di `WarrantyCards`.
4. Frontend update row lokal:
   - `jenisKartuKey = "local" | "import"`
   - `jenisKartu = "Local" | "Import"`
5. Summary dan table dirender ulang.

### Flow E: Set Jenis Kartu Batch

1. Admin memilih beberapa item.
2. Admin klik `Set Local` atau `Set Import`.
3. Jika tidak ada item terpilih, tampilkan error `Pilih item terlebih dahulu`.
4. Frontend memanggil `saveWarrantyCardTypes` untuk semua item terpilih.
5. Backend upsert semua row.
6. Frontend update semua row lokal dan render ulang.

### Flow F: Cetak Pilihan

1. Admin memilih item.
2. Admin klik `Cetak Pilihan`.
3. Jika tidak ada item, tampilkan error `Pilih item yang ingin dicetak`.
4. Frontend validasi semua item terpilih sudah punya `jenisKartuKey`.
5. Jika ada yang belum dipilih, tampilkan error `{n} item belum dipilih jenis kartunya`.
6. Frontend refresh layout aktif dengan `getPrintLayouts`.
7. Frontend sort item terpilih:
   - `local`
   - `import`
   - kosong
   - `idPengajuan`
   - `noItem`
8. Frontend render print DOM per item.
9. Frontend tampilkan success `{n} kartu siap dicetak`.
10. Frontend memanggil `window.print()`.

Output print per kartu:

- Satu item menjadi satu halaman A4.
- Field yang dicetak:
  - `produk`
  - `model`
  - `nomorSeri`
- Layout aktif ditentukan oleh `jenisKartuKey`.

Yang tidak terjadi pada flow ini:

- Tidak ada update `WarrantyCards.Status Cetak`.
- Tidak ada row `PrintBatch`.
- Tidak ada perubahan status `Pengajuan`.

### Flow G: Tandai Sudah Dicetak

1. Admin memilih item yang sudah dicetak fisik.
2. Admin klik `Tandai Sudah Dicetak`.
3. Jika tidak ada item, tampilkan error `Pilih item yang sudah dicetak`.
4. Frontend validasi semua item punya jenis kartu.
5. Frontend menampilkan confirm `Tandai {n} kartu sebagai sudah dicetak?`.
6. Jika admin confirm, frontend memanggil `markWarrantyCardsPrinted`.
7. Backend membuat batch dan update `WarrantyCards`.
8. Backend append `PrintBatch`.
9. Backend memanggil `syncPengajuanLifecycleFromWarranty_` untuk setiap `ID Pengajuan` yang tersentuh. Jika semua item approved sudah `Printed`, status pengajuan naik ke `Diprint`. Baris `StatusLog` dan `Riwayat Singkat` ditambah dengan prefix `Auto lifecycle`.
10. Frontend clear selection.
11. Frontend reload antrean. Karena printed items tidak diminta dengan `includePrinted`, item yang baru printed hilang dari antrean normal.
12. Frontend tampilkan success:
    - `Batch {batchId} tersimpan ({count} kartu)`
    - Jika ada batch ID, tampil tombol inline `Preview Label`.

Catatan: Perubahan status pengajuan ke `Diprint` tidak ditampilkan eksplisit di UI antrean cetak; designer tidak perlu menambah kontrol status pengajuan di sini kecuali ditemukan kebutuhan baru.

### Flow H: Preview Label Cabang

Ada dua cara membuka preview:

1. Dari tombol umum `Preview Label Cabang`.
2. Dari tombol inline setelah batch printed, dengan `batchId`.

Jika pakai batch ID:

1. Frontend set view `shipping-label`.
2. Frontend panggil `getWarrantyPrintQueue` dengan `includePrinted = true` dan search kosong.
3. Frontend filter rows:
   - `statusCetak = Printed`
   - `printBatchId = batchId`
4. Frontend group rows berdasarkan `bagianCabang`.
5. Frontend render label dan summary.

Jika tanpa batch ID:

1. Frontend ambil search saat ini dari `print-search`.
2. Frontend panggil `getWarrantyPrintQueue` dengan `includePrinted = true` dan search tersebut.
3. Frontend filter rows `statusCetak = Printed`.
4. Frontend group rows berdasarkan `bagianCabang`.

Grouping label:

```ts
key = bagianCabang.trim().toLowerCase()
cabang = bagianCabang.trim() || "Tanpa Cabang"
qty = jumlah item printed untuk cabang tersebut
```

Sorting label:

- Ascending berdasarkan nama cabang dengan locale `id-ID`.

Empty state:

- Jika tidak ada item printed, tampilkan error `Tidak ada item Printed untuk label cabang`.

### Flow I: Cetak Label Cabang

1. Admin berada di preview label.
2. Admin klik `Cetak Label`.
3. Jika tidak ada label, tampilkan error `Tidak ada label untuk dicetak`.
4. Frontend render label ke `warranty-print-content`.
5. Frontend panggil `window.print()`.

Output label:

- Ukuran label: `60 x 50 mm`.
- Satu halaman A4 memuat maksimal 15 label.
- Grid: 3 kolom x 5 baris.
- Tiap label berisi:
  - Nama cabang uppercase besar.
  - `QTY ITEM` dan angka qty.

## Spesifikasi Cetak Kartu Garansi

Media:

- A4 portrait: `210mm x 297mm`.
- Margin print: 0.
- Satu kartu garansi per halaman A4.

Base offset per jenis kartu:

| Jenis | Base X | Base Y | Detail Base Y |
| --- | ---: | ---: | ---: |
| Local | 5mm | -5mm | -2mm |
| Import | 0mm | 3mm | 0mm |

Field posisi dasar:

| Field | Left | Top | Width | Height | Font |
| --- | ---: | ---: | ---: | ---: | ---: |
| Produk | 0mm | 218.3mm | 124.6mm | 6.4mm | 14pt |
| Model | 0mm | 236.3mm | 61.1mm | 5.3mm | 10pt |
| Nomor Seri | 73.3mm | 236.3mm | 51.3mm | 5.3mm | 10pt |

Layout aktif menambahkan CSS variables:

```css
--warranty-adjust-x: {layout.offsetX}mm;
--warranty-adjust-y: {layout.offsetY}mm;
--warranty-gap-product-model: {layout.gapProductModel}mm;
--warranty-gap-model-serial: {layout.gapModelSerial}mm;
```

Formula transform:

- Semua field bergeser oleh `baseX + offsetX` dan `baseY + offsetY`.
- Field model mendapat tambahan `detailBaseY + gapProductModel`.
- Field serial mendapat tambahan `detailBaseY + gapProductModel + gapModelSerial`.

## Spesifikasi Cetak Label Cabang

Media:

- A4 portrait.
- Sheet label: width `210mm`, min-height `297mm`, padding `10mm`.
- Grid: 3 kolom, tiap kolom `60mm`.
- Auto rows: `50mm`.
- Gap: horizontal `5mm`, vertical `4mm`.
- Maksimal label per halaman: 15.

Kartu label:

| Properti | Nilai |
| --- | --- |
| Size | `60mm x 50mm` |
| Border | 1px solid |
| Padding | `5mm 4mm` |
| Layout | Flex column, space-between |
| Cabang | Uppercase, font 32px, bold |
| Qty label | `QTY ITEM` |
| Qty number | 32px, bold |

## Validasi dan Error State

| Situasi | Pesan Saat Ini | Dampak UI |
| --- | --- | --- |
| Antrean gagal dimuat | `Gagal memuat antrian cetak` | Alert error |
| Layout gagal dimuat | `Gagal memuat layout cetak` | Alert error |
| Tidak ada item dipilih untuk set jenis | `Pilih item terlebih dahulu` | Alert error |
| Tidak ada item dipilih untuk cetak | `Pilih item yang ingin dicetak` | Alert error |
| Tidak ada item dipilih untuk mark printed | `Pilih item yang sudah dicetak` | Alert error |
| Ada item tanpa jenis kartu | `{n} item belum dipilih jenis kartunya` | Alert error, aksi dibatalkan |
| Save jenis kartu gagal | `Gagal menyimpan jenis kartu` | Alert error |
| Mark printed gagal | `Gagal menandai kartu tercetak` | Alert error |
| Tidak ada label printed | `Tidak ada item Printed untuk label cabang` | Alert error |
| Cetak label tanpa label | `Tidak ada label untuk dicetak` | Alert error |
| Nama layout kosong | `Nama layout wajib diisi` | Alert error |
| Nilai posisi bukan angka | `Semua nilai posisi harus berupa angka` | Alert error |

## Status dan Badge

Status cetak:

| Data | Badge |
| --- | --- |
| `Printed` | Printed |
| Selain `Printed` atau kosong | Belum Dicetak |

Status lifecycle pengajuan (badge di dashboard dan detail):

| Status | Warna/Sentuhan yang Disarankan | Copy di Cek Status Publik |
| --- | --- | --- |
| `Baru` | Info (biru) | Pengajuan sudah diterima dan sedang menunggu proses pengecekan admin. |
| `Disetujui` | Success (hijau) | Pengajuan telah diperiksa dan disetujui. Kartu garansi akan segera dibuat dan dikirimkan. |
| `Ditolak` | Error (merah) | Pengajuan telah diperiksa dan ditolak, silakan hubungi admin untuk informasi lebih lanjut. |
| `Diprint` | Warning (amber) | Kartu garansi sudah dicetak dan sedang disiapkan untuk pengiriman. |
| `Dikirim` | Primary (sky) | Kartu garansi sudah dikirim ke cabang atau alamat terkait. |
| `Diterima` | Secondary (violet) | Kartu garansi sudah dikonfirmasi diterima. |
| `Selesai` | Neutral (slate) | Proses kartu garansi sudah selesai. |
| `Menunggu Upload` | Warning (amber) | Pengajuan masih berupa draft. Lanjutkan draft untuk upload hard copy bertanda tangan dan submit final. |

Catatan perilaku badge dan status:

- Filter dashboard, dropdown update status, dan summary card menerima ketujuh status lifecycle di atas.
- `Diprint` dan `Dikirim` dihitung otomatis oleh backend dari `WarrantyCards`; admin tidak mengubahnya secara manual dari UI detail pengajuan kecuali untuk transisi mundur (Admin + catatan).
- `Diterima` dan `Selesai` hanya berubah lewat aksi manual Admin/QRCC.
- `Diterima` tidak otomatis menjadi `Selesai`.

Jenis kartu:

| UI value | Backend normalized | Display |
| --- | --- | --- |
| `local` atau `lokal` | `Local` | Local |
| `import` atau `impor` | `Import` | Import |
| kosong | kosong | Pilih / Belum Dipilih |

## Sorting

Backend sorting `getWarrantyPrintQueue`:

1. `Local`
2. `Import`
3. Belum dipilih
4. `timestampSubmit` paling lama dulu
5. `idPengajuan`
6. `noItem`

Frontend sorting visible rows:

1. `local`
2. `import`
3. Belum dipilih
4. `idPengajuan`
5. `noItem`

Frontend sorting selected rows untuk print:

1. `local`
2. `import`
3. Belum dipilih
4. `idPengajuan`
5. `noItem`

## Implikasi Desain Ulang

Desain baru boleh mengubah layout visual, komposisi, dan komponen, tetapi harus menjaga hal berikut:

- Admin harus bisa melihat mana item yang belum dipilih jenis kartunya.
- Admin harus bisa set jenis kartu per item dan secara batch.
- Admin harus bisa memilih item dengan jelas, termasuk select all visible dan clear selection.
- Tombol `Cetak Pilihan` dan `Tandai Sudah Dicetak` harus dipisahkan secara visual dan copywriting, karena efek datanya berbeda.
- Setelah mark printed berhasil, UI harus menonjolkan batch ID dan akses cepat ke preview label batch.
- Summary sebaiknya mengikuti rows yang sedang visible, agar angka cocok dengan filter aktif.
- Search dan filter harus terasa berbeda:
  - Search memuat ulang data dari backend.
  - Filter jenis kartu menyaring data lokal yang sudah dimuat.
- Setting layout harus memberi konteks layout aktif Local dan Import karena hasil cetak tergantung type.
- Preview label cabang harus menjelaskan secara visual bahwa label dihitung dari item printed, bukan dari antrean yang belum printed.
- Empty, loading, success, error, dan confirmation state harus tersedia.
- Status lifecycle pengajuan (`Baru`, `Disetujui`, `Ditolak`, `Diprint`, `Dikirim`, `Diterima`, `Selesai`) harus ditampilkan konsisten di dashboard, detail, dan cek status publik. Badge baru (`Diprint`, `Dikirim`, `Diterima`, `Selesai`) perlu tone warna berbeda dari badge yang sudah ada.
- Filter dashboard dan dropdown update status pengajuan harus mengenali ketujuh status lifecycle di atas.
- Detail pengajuan memvalidasi transisi mundur (Admin + catatan admin wajib) sebelum mengirim ke backend. Backend tetap menjadi guard utama.
- Cek status publik menampilkan copy khusus untuk `Diprint`, `Dikirim`, `Diterima`, dan `Selesai`.

## Checklist Fungsional Untuk Designer

- [ ] Ada jalur jelas dari dashboard ke antrean cetak.
- [ ] Ada ringkasan jumlah total, local, import, dan belum dipilih.
- [ ] Ada search untuk ID/nama/cabang/produk/model/serial.
- [ ] Ada filter jenis kartu: semua, local, import, belum dipilih.
- [ ] Ada table/list yang menampilkan ID, no item, cabang, produk, model, serial, jenis kartu, status cetak.
- [ ] Ada kontrol pilih per item dan pilih semua yang tampil.
- [ ] Ada aksi batch `Set Local` dan `Set Import`.
- [ ] Ada aksi `Cetak Pilihan` yang mensyaratkan jenis kartu.
- [ ] Ada aksi `Tandai Sudah Dicetak` dengan konfirmasi.
- [ ] Ada success state batch printed dengan batch ID dan CTA preview label.
- [ ] Ada preview label cabang dengan summary cabang, qty item, dan ukuran label.
- [ ] Ada aksi cetak label.
- [ ] Ada pengaturan layout Local dan Import.
- [ ] Ada indikasi layout aktif untuk Local dan Import.
- [ ] Ada validasi form layout.
- [ ] Ada proteksi delete untuk layout bawaan dan layout aktif.
