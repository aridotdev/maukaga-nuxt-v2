const APP = {
  SPREADSHEET_ID: '', // diisi manual oleh user setelah setup jika ingin memakai spreadsheet yang sudah ada
  DRIVE_FOLDER_ID: '', // diisi/di-update dari sheet Config
  MAX_UPLOAD_MB: 10,
  MAX_EVIDENCE_FILES: 10,
  MAX_EVIDENCE_UPLOAD_MB: 5,
  MAX_ITEMS: 10,
  APP_NAME: 'Pengajuan Kartu Garansi',
  SESSION_DURATION_HOURS: 6,
};

const SHEETS = {
  PENGAJUAN: 'Pengajuan',
  ITEMS: 'PengajuanItems',
  USERS: 'Users',
  RECIPIENTS: 'EmailRecipients',
  CONFIG: 'Config',
  STATUS_LOG: 'StatusLog',
  EMAIL_LOG: 'EmailLog',
  PRINT_BATCH: 'PrintBatch',
  PRINT_LAYOUTS: 'PrintLayouts',
  MODEL_PRODUK: 'ModelProduk',
};

const HEADERS = {
  [SHEETS.PENGAJUAN]: ['ID Pengajuan', 'Timestamp Submit', 'Nama', 'Bagian/Cabang', 'Pemilik', 'Alasan Pengajuan', 'Tanggal Form', 'Catatan Tambahan', 'Jumlah Item', 'Jumlah File Bukti', 'Status', 'Catatan Admin', 'Tanggal Update Status Terakhir', 'User Update Status', 'Resume Token', 'Draft Created At', 'Draft Updated At', 'Submitted At'],
  [SHEETS.ITEMS]: ['ID Pengajuan', 'No Item', 'Produk', 'Model', 'Nomor Seri', 'Keputusan Item', 'Catatan Admin Item', 'Jenis Kartu', 'Status Cetak', 'Print Batch ID', 'Printed At', 'Status Kirim', 'Ship Batch ID', 'Shipped At', 'model_normalized', 'produk_status', 'produk_sumber', 'Tanggal Update Keputusan Item', 'User Update Keputusan Item'],
  [SHEETS.USERS]: ['Username', 'Password/PIN', 'Nama', 'Role', 'Aktif', 'Last Login'],
  [SHEETS.RECIPIENTS]: ['Nama', 'Email', 'Aktif', 'Keterangan'],
  [SHEETS.CONFIG]: ['Key', 'Value'],
  [SHEETS.STATUS_LOG]: ['Timestamp', 'ID Pengajuan', 'Status Lama', 'Status Baru', 'Catatan Admin', 'User', 'No Item'],
  [SHEETS.EMAIL_LOG]: ['Timestamp', 'Subject', 'Recipients', 'Jumlah Pengajuan', 'Status'],
  [SHEETS.PRINT_BATCH]: ['Batch ID', 'Tipe Batch', 'Created At', 'Created By', 'Jumlah Item', 'Catatan'],
  [SHEETS.PRINT_LAYOUTS]: ['ID', 'Type', 'Name', 'Offset X', 'Offset Y', 'Gap Product Model', 'Gap Model Serial', 'Is Builtin', 'Created At', 'Updated At', 'Updated By'],
  [SHEETS.MODEL_PRODUK]: ['model', 'produk', 'origin', 'status', 'updated_at', 'updated_by'],
};

const DEFAULT_PRINT_LAYOUTS = [
  { id: 'local-default', type: 'local', name: 'Local Default', offsetX: 0, offsetY: 0, gapProductModel: 0, gapModelSerial: 0, isBuiltin: true },
  { id: 'import-default', type: 'import', name: 'Import Default', offsetX: 0, offsetY: 0, gapProductModel: 0, gapModelSerial: 0, isBuiltin: true },
];
const ACTIVE_PRINT_LAYOUT_KEYS = {
  local: 'ACTIVE_PRINT_LAYOUT_LOCAL',
  import: 'ACTIVE_PRINT_LAYOUT_IMPORT',
};
const DRAFT_STATUS = 'Menunggu Upload';
const VALID_STATUSES = ['Baru', 'Disetujui', 'Ditolak', 'Diprint', 'Dikirim', 'Selesai'];
const ITEM_DECISION_STATUSES = ['Disetujui', 'Ditolak'];
const LEGACY_ITEM_REVIEW_HEADER = ['Status', 'Item'].join(' ');
const LEGACY_ITEM_REVIEW_UPDATED_AT_HEADER = ['Tanggal Update', LEGACY_ITEM_REVIEW_HEADER].join(' ');
const LEGACY_ITEM_REVIEW_UPDATED_BY_HEADER = ['User Update', LEGACY_ITEM_REVIEW_HEADER].join(' ');
const LIFECYCLE_ORDER = ['Baru', 'Disetujui', 'Diprint', 'Dikirim', 'Selesai'];
const VALID_EXTENSIONS = ['pdf'];
const VALID_MIME_TYPES = ['application/pdf'];
const VALID_EVIDENCE_EXTENSIONS = ['jpg', 'jpeg'];
const VALID_EVIDENCE_MIME_TYPES = ['image/jpeg', 'image/jpg'];

function setupApp() {
  const ss = getSpreadsheet_();
  ensureAllSheets_(ss);

  const usersSheet = ss.getSheetByName(SHEETS.USERS);
  if (usersSheet.getLastRow() < 2) {
    usersSheet.appendRow(['admin', 'admin123', 'Administrator', 'Admin', 'yes', '']);
  }

  const configSheet = ss.getSheetByName(SHEETS.CONFIG);
  const defaults = {
    APP_NAME: APP.APP_NAME,
    DRIVE_FOLDER_ID: '',
    MAX_UPLOAD_MB: APP.MAX_UPLOAD_MB,
    MAX_EVIDENCE_FILES: APP.MAX_EVIDENCE_FILES,
    MAX_EVIDENCE_UPLOAD_MB: APP.MAX_EVIDENCE_UPLOAD_MB,
    MAX_ITEMS: APP.MAX_ITEMS,
    LAST_EMAIL_SENT_AT: '',
    ACTIVE_PRINT_LAYOUT_LOCAL: 'local-default',
    ACTIVE_PRINT_LAYOUT_IMPORT: 'import-default',
  };
  Object.keys(defaults).forEach(function (key) {
    upsertConfig_(configSheet, key, defaults[key], false);
  });
  ensurePrintLayoutDefaults_(configSheet);

  const config = getConfig();
  let folderId = String(config.DRIVE_FOLDER_ID || APP.DRIVE_FOLDER_ID || '').trim();
  if (!folderId) {
    const folder = DriveApp.createFolder(APP.APP_NAME + ' Uploads');
    folderId = folder.getId();
    upsertConfig_(configSheet, 'DRIVE_FOLDER_ID', folderId, true);
  } else {
    DriveApp.getFolderById(folderId);
  }

  ensureEmailDigestTrigger_();
  console.log('Setup selesai. Spreadsheet ID: ' + ss.getId() + ', Drive folder ID: ' + folderId);
}

function migrateStatusSimplification() {
  ensureRuntimeHeaders_();
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const now = new Date();
    const actor = 'system:migration';
    const summary = {
      pengajuanDiterimaToSelesai: 0,
    };

    const pengajuanSheet = getSheet_(SHEETS.PENGAJUAN);
    const pengajuanValues = pengajuanSheet.getDataRange().getValues();
    if (pengajuanValues.length > 1) {
      const pengajuanCol = indexMap_(pengajuanValues[0]);

      for (let i = 1; i < pengajuanValues.length; i++) {
        if (clean_(pengajuanValues[i][pengajuanCol['Status']]) !== 'Diterima') continue;

        appendStatusHistory_(
          pengajuanSheet,
          i + 1,
          pengajuanCol,
          pengajuanValues[i][pengajuanCol['ID Pengajuan']],
          'Diterima',
          'Selesai',
          'Migrasi penyederhanaan status pengajuan',
          actor,
          '',
          now,
          'Migrasi status'
        );
        summary.pengajuanDiterimaToSelesai += 1;
      }
    }

    return {
      success: true,
      migratedAt: now.toISOString(),
      summary: summary,
    };
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  const action = e && e.parameter && e.parameter.action;
  if (action === 'ping') return jsonResponse_({ success: true, data: { app: APP.APP_NAME, time: new Date().toISOString() } });
  return jsonResponse_({ success: true, data: { message: 'API Pengajuan Kartu Garansi aktif. Gunakan POST untuk action API.' } });
}

function doPost(e) {
  try {
    const data = parseRequest_(e);
    const action = data.action || (e && e.parameter && e.parameter.action);
    if (!action) throw new Error('Action wajib diisi');
    ensureRuntimeHeaders_();

    switch (action) {
      case 'submitPengajuan':
        return jsonResponse_(handleSubmitPengajuan(data));
      case 'saveDraftPengajuan':
        return jsonResponse_(handleSaveDraftPengajuan(data));
      case 'loadDraftPengajuanById':
        return jsonResponse_(handleLoadDraftPengajuanById(data));
      case 'getDraftPengajuan':
        return jsonResponse_(handleGetDraftPengajuan(data));
      case 'getPengajuanForPrint':
        return jsonResponse_(handleGetPengajuanForPrint(data));
      case 'checkDraftPengajuanStatus':
        return jsonResponse_(handleCheckDraftPengajuanStatus(data));
      case 'checkPengajuanStatusBySerial':
        return jsonResponse_(handleCheckPengajuanStatusBySerial(data));
      case 'checkPengajuanStatus':
        return jsonResponse_(handleCheckPengajuanStatus(data));
      case 'getModelProduk':
      case 'getModelKategori':
        return jsonResponse_(handleGetModelProduk(data));
      case 'submitDraftPengajuan':
        return jsonResponse_(handleSubmitDraftPengajuan(data));
      case 'adminLogin':
        return jsonResponse_(handleAdminLogin(data));
      case 'adminUsersList':
        return jsonResponse_(handleAdminUsersList(data));
      case 'adminUsersInvite':
        return jsonResponse_(handleAdminUsersInvite(data));
      case 'adminUsersUpdate':
        return jsonResponse_(handleAdminUsersUpdate(data));
      case 'adminUsersDeactivate':
        return jsonResponse_(handleAdminUsersDeactivate(data));
      case 'adminUsersReactivate':
        return jsonResponse_(handleAdminUsersReactivate(data));
      case 'getDashboard':
        return jsonResponse_(handleGetDashboard(data));
      case 'getDashboardSummary':
        return jsonResponse_(handleGetDashboardSummary(data));
      case 'getDashboardLatest':
        return jsonResponse_(handleGetDashboardLatest(data));
      case 'getPengajuanList':
        return jsonResponse_(handleGetPengajuanList(data));
      case 'getDashboardChartAggregate':
        return jsonResponse_(handleGetDashboardChartAggregate(data));
      case 'getDetail':
        return jsonResponse_(handleGetDetail(data));
      case 'getArchiveFile':
        return jsonResponse_(handleGetArchiveFile(data));
      case 'updateStatus':
        return jsonResponse_(handleUpdateStatus(data));
      case 'updateItemDecision':
        return jsonResponse_(handleUpdateItemDecision(data));
      case 'updatePengajuanAdmin':
        return jsonResponse_(handleUpdatePengajuanAdmin(data));
      case 'deletePengajuan':
        return jsonResponse_(handleDeletePengajuan(data));
      case 'finalizeArchivedPengajuan':
        return jsonResponse_(handleFinalizeArchivedPengajuan(data));
      case 'auditPengajuanDataIntegrity':
        return jsonResponse_(handleAuditPengajuanDataIntegrity(data));
      case 'recoverDraftPengajuanFromItems':
        return jsonResponse_(handleRecoverDraftPengajuanFromItems(data));
      case 'getProductReviewQueue':
      case 'getCategoryReviewQueue':
        return jsonResponse_(handleGetProductReviewQueue(data));
      case 'approveModelProduk':
      case 'approveModelKategori':
        return jsonResponse_(handleApproveModelProduk(data));
      case 'getWarrantyPrintQueue':
        return jsonResponse_(handleGetWarrantyPrintQueue(data));
      case 'getPrintLayouts':
        return jsonResponse_(handleGetPrintLayouts(data));
      case 'savePrintLayout':
        return jsonResponse_(handleSavePrintLayout(data));
      case 'deletePrintLayout':
        return jsonResponse_(handleDeletePrintLayout(data));
      case 'setActivePrintLayout':
        return jsonResponse_(handleSetActivePrintLayout(data));
      case 'saveWarrantyCardTypes':
        return jsonResponse_(handleSaveWarrantyCardTypes(data));
      case 'markWarrantyItemsPrinted':
        return jsonResponse_(handleMarkWarrantyItemsPrinted(data));
      case 'markWarrantyItemsShipped':
        return jsonResponse_(handleMarkWarrantyItemsShipped(data));
      case 'getShippingLabelQueue':
        return jsonResponse_(handleGetShippingLabelQueue(data));
      case 'previewPengajuanLifecycleMigration':
        return jsonResponse_(handlePreviewPengajuanLifecycleMigration(data));
      case 'migratePengajuanLifecycleFromItems':
        return jsonResponse_(handleMigratePengajuanLifecycleFromItems(data));
      case 'previewItemDecisionBackfill':
        return jsonResponse_(handlePreviewItemDecisionBackfill(data));
      case 'backfillItemDecisions':
        return jsonResponse_(handleBackfillItemDecisions(data));
      case 'adminLogout':
        return jsonResponse_(handleAdminLogout(data));
      default:
        throw new Error('Action tidak dikenal: ' + action);
    }
  } catch (err) {
    return jsonResponse_({ success: false, error: err.message || String(err) });
  }
}

function generateId() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return generateIdUnlocked_();
  } finally {
    lock.releaseLock();
  }
}

function getConfig() {
  const sheet = getSheet_(SHEETS.CONFIG);
  const values = sheet.getDataRange().getValues();
  const config = {};
  for (let i = 1; i < values.length; i++) {
    const key = String(values[i][0] || '').trim();
    if (key) config[key] = values[i][1];
  }
  return Object.assign({}, APP, config);
}

function validateSession(token) {
  token = clean_(token);
  if (!token) return null;

  const cacheKey = getSessionCacheKey_(token);
  const raw = CacheService.getScriptCache().get(cacheKey);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch (err) {
      return null;
    }
  }

  if (token.split('.').length !== 3) return null;

  const session = validateSupabaseSession_(token);
  CacheService.getScriptCache().put(cacheKey, JSON.stringify(session), 300);
  return session;
}

function getSessionCacheKey_(token) {
  if (token.length <= 200) return token;

  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token);
  return 'session:' + digest.map(function (byte) {
    const value = byte < 0 ? byte + 256 : byte;
    return ('0' + value.toString(16)).slice(-2);
  }).join('');
}

function getSupabaseProps_() {
  const props = PropertiesService.getScriptProperties();
  const supabaseUrl = clean_(props.getProperty('SUPABASE_URL')).replace(/\/+$/, '');
  const publishableKey = clean_(props.getProperty('SUPABASE_PUBLISHABLE_KEY'));
  const secretKey = clean_(props.getProperty('SUPABASE_SECRET_KEY'));
  const appUrl = clean_(props.getProperty('APP_URL')).replace(/\/+$/, '');

  return {
    supabaseUrl: supabaseUrl,
    publishableKey: publishableKey,
    secretKey: secretKey,
    appUrl: appUrl,
  };
}

function requireSupabaseProps_(requiredKeys) {
  const config = getSupabaseProps_();
  requiredKeys.forEach(function (key) {
    if (!config[key]) throw new Error('Script Property ' + getSupabasePropertyName_(key) + ' belum dikonfigurasi.');
  });
  return config;
}

function getSupabasePropertyName_(key) {
  const names = {
    supabaseUrl: 'SUPABASE_URL',
    publishableKey: 'SUPABASE_PUBLISHABLE_KEY',
    secretKey: 'SUPABASE_SECRET_KEY',
    appUrl: 'APP_URL',
  };
  return names[key] || key;
}

function supabaseUserHeaders_(token) {
  const config = requireSupabaseProps_(['publishableKey']);
  return {
    'User-Agent': 'MauKaGa-Google-Apps-Script/1.0',
    apikey: config.publishableKey,
    Authorization: 'Bearer ' + token,
  };
}

function supabaseAdminHeaders_() {
  const config = requireSupabaseProps_(['secretKey']);
  const headers = {
    'User-Agent': 'MauKaGa-Google-Apps-Script/1.0',
    apikey: config.secretKey,
  };

  if (config.secretKey.indexOf('sb_secret_') !== 0) {
    headers.Authorization = 'Bearer ' + config.secretKey;
  }

  return headers;
}

function fetchSupabaseJson_(url, options) {
  const response = UrlFetchApp.fetch(url, Object.assign({
    muteHttpExceptions: true,
  }, options || {}));
  const status = response.getResponseCode();
  const text = response.getContentText();
  let json = null;

  if (text) {
    try {
      json = JSON.parse(text);
    } catch (err) {
      json = { message: text };
    }
  }

  if (status < 200 || status >= 300) {
    const message = json && (json.message || json.error_description || json.error || json.msg);
    throw new Error(message || ('Supabase error ' + status));
  }

  return json;
}

function validateSupabaseSession_(token) {
  const config = requireSupabaseProps_(['supabaseUrl', 'publishableKey']);
  const userData = fetchSupabaseJson_(config.supabaseUrl + '/auth/v1/user', {
    method: 'get',
    headers: supabaseUserHeaders_(token),
  });

  if (!userData || !userData.id) throw new Error('Token Supabase tidak valid.');

  const profiles = fetchSupabaseJson_(
    config.supabaseUrl + '/rest/v1/profiles?id=eq.' + encodeURIComponent(userData.id) + '&select=role,is_active,full_name,email',
    {
      method: 'get',
      headers: supabaseUserHeaders_(token),
    }
  );
  const profile = profiles && profiles[0];

  if (!profile) throw new Error('Profile Supabase tidak ditemukan.');
  if (profile.is_active !== true) throw new Error('Unauthorized: akun tidak aktif.');

  const role = normalizeRole_(profile.role);
  if (!role) throw new Error('Unauthorized: role tidak valid.');

  return {
    userId: userData.id,
    username: userData.email || profile.email || userData.id,
    nama: profile.full_name || userData.email || 'User',
    email: userData.email || profile.email || '',
    role: role,
    authProvider: 'supabase',
  };
}

function handleSubmitPengajuan(data) {
  const config = getConfig();
  const cleaned = normalizeSubmission_(data, config, true);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    assertNoDuplicateModelSerial_(cleaned.items, '');
    const id = generateIdUnlocked_();
    const folderId = String(config.DRIVE_FOLDER_ID || APP.DRIVE_FOLDER_ID || '').trim();
    if (!folderId) throw new Error('DRIVE_FOLDER_ID belum dikonfigurasi. Jalankan setupApp() terlebih dahulu.');

    const folder = DriveApp.getFolderById(folderId);
    createHardcopyFile_(folder, id, cleaned);
    const evidenceFiles = createEvidenceFiles_(folder, id, cleaned.evidenceAttachments);

    const now = new Date();
    appendPengajuanRow_(id, cleaned, 'Baru', '', now, '', '', now, evidenceFiles.count);
    replaceItemRows_(id, cleaned.items);
    getSheet_(SHEETS.STATUS_LOG).appendRow([now, id, '', 'Baru', 'Pengajuan dibuat', 'system', '']);
    return { success: true, data: { idPengajuan: id } };
  } finally {
    lock.releaseLock();
  }
}

function handleSaveDraftPengajuan(data) {
  const config = getConfig();
  const cleaned = normalizeSubmission_(data, config, false);
  const requestedId = clean_(data.idPengajuan);
  const requestedToken = clean_(data.resumeToken);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const now = new Date();
    const sheet = getSheet_(SHEETS.PENGAJUAN);
    const record = requestedId ? findPengajuanRecord_(requestedId) : null;
    let id = requestedId;
    let token = requestedToken;
    let draftCreatedAt = now;

    if (record) {
      if (!requestedToken || clean_(record.row[record.col['Resume Token']]) !== requestedToken) throw new Error('Link lanjutkan tidak valid atau draft tidak ditemukan');
      if (record.row[record.col['Status']] !== DRAFT_STATUS) throw new Error('Draft sudah tidak dapat diubah');
      assertNoDuplicateModelSerial_(cleaned.items, requestedId);
      draftCreatedAt = record.row[record.col['Draft Created At']] || now;
      updatePengajuanRow_(sheet, record.rowNumber, record.col, id, cleaned, DRAFT_STATUS, token, '', draftCreatedAt, now, '', 0);
    } else {
      if (requestedId || requestedToken) throw new Error('Draft tidak ditemukan atau link lanjutkan tidak valid');
      assertNoDuplicateModelSerial_(cleaned.items, '');
      id = generateIdUnlocked_();
      token = generateResumeToken_();
      appendPengajuanRow_(id, cleaned, DRAFT_STATUS, token, '', now, now, '', 0);
    }

    replaceItemRows_(id, cleaned.items);
    return { success: true, data: { idPengajuan: id, resumeToken: token, status: DRAFT_STATUS } };
  } finally {
    lock.releaseLock();
  }
}

function handleGetDraftPengajuan(data) {
  const id = clean_(data.idPengajuan);
  const token = clean_(data.resumeToken);
  if (!id || !token) throw new Error('Buka draft dari Draft Terakhir atau Link Lanjutkan Draft');

  const record = findPengajuanRecord_(id);
  if (!record) throwDraftParentMissingError_(id, 'Draft tidak ditemukan');
  if (clean_(record.row[record.col['Resume Token']]) !== token) throw new Error('Link lanjutkan tidak valid atau draft tidak ditemukan');
  return buildDraftPengajuanResponse_(record, id, token);
}

function handleLoadDraftPengajuanById(data) {
  const id = clean_(data.idPengajuan);
  if (!id) throw new Error('Masukkan ID Pengajuan terlebih dahulu.');

  const record = findPengajuanRecord_(id);
  if (!record) throwDraftParentMissingError_(id, 'ID Pengajuan tidak ditemukan. Periksa kembali ID pada printout draft.');

  const resumeToken = clean_(record.row[record.col['Resume Token']]);
  if (!resumeToken) {
    throw new Error('Draft ditemukan, tetapi Resume Token tidak tersedia. Draft ini tidak bisa dilanjutkan. Silakan buat draft baru atau hubungi admin.');
  }

  return buildDraftPengajuanResponse_(record, id, resumeToken);
}

function buildDraftPengajuanResponse_(record, id, resumeToken) {
  const row = record.row;
  const col = record.col;
  if (row[col['Status']] !== DRAFT_STATUS) throw new Error('Draft sudah tidak dapat dilanjutkan');
  if (clean_(row[col['Resume Token']]) !== resumeToken) throw new Error('Link lanjutkan tidak valid atau draft tidak ditemukan');

  return {
    success: true,
    data: {
      idPengajuan: id,
      status: row[col['Status']],
      resumeToken: resumeToken,
      nama: row[col['Nama']],
      bagianCabang: row[col['Bagian/Cabang']],
      pemilik: row[col['Pemilik']],
      alasanPengajuan: row[col['Alasan Pengajuan']],
      tanggalForm: formatDateOnly_(row[col['Tanggal Form']]),
      catatanTambahan: row[col['Catatan Tambahan']],
      items: getItemsForPengajuan_(id),
    },
  };
}

function handleGetPengajuanForPrint(data) {
  // Untuk fitur "Print Ulang" â€” mengambil data pengajuan berdasarkan ID saja
  // (tanpa Resume Token, tanpa filter status). Berlaku untuk semua status
  // (Baru, Disetujui, Ditolak, Selesai, maupun Menunggu Upload) supaya
  // user bisa mencetak ulang form meskipun pengajuan sudah final.
  const id = clean_(data.idPengajuan);
  if (!id) throw new Error('Masukkan ID Pengajuan terlebih dahulu.');

  const record = findPengajuanRecord_(id);
  if (!record) throwDraftParentMissingError_(id, 'ID Pengajuan tidak ditemukan. Periksa kembali ID yang dimasukkan.');

  const row = record.row;
  const col = record.col;
  const status = clean_(row[col['Status']]);
  const allowed = VALID_STATUSES.concat([DRAFT_STATUS]);
  if (allowed.indexOf(status) === -1) {
    throw new Error('Status pengajuan tidak bisa ditampilkan.');
  }

  return {
    success: true,
    data: {
      idPengajuan: id,
      status: status,
      nama: row[col['Nama']],
      bagianCabang: row[col['Bagian/Cabang']],
      pemilik: row[col['Pemilik']],
      alasanPengajuan: row[col['Alasan Pengajuan']],
      tanggalForm: formatDateOnly_(row[col['Tanggal Form']]),
      catatanTambahan: row[col['Catatan Tambahan']],
      items: getItemsForPengajuan_(id),
    },
  };
}

function handleCheckDraftPengajuanStatus(data) {
  const id = clean_(data.idPengajuan);
  if (!id) throw new Error('Masukkan ID Pengajuan terlebih dahulu.');

  const record = findPengajuanRecord_(id);
  if (!record) throwDraftParentMissingError_(id, 'ID Pengajuan tidak ditemukan. Periksa kembali ID pada printout draft.');

  const status = record.row[record.col['Status']];
  if (status !== DRAFT_STATUS) {
    throw new Error('ID Pengajuan ini sudah dikirim final dan tidak bisa dibuka sebagai draft.');
  }

  const resumeToken = clean_(record.row[record.col['Resume Token']]);
  if (!resumeToken) {
    throw new Error('Draft ditemukan, tetapi Resume Token tidak tersedia. Draft ini tidak bisa dilanjutkan. Silakan buat draft baru atau hubungi admin.');
  }

  return { success: true, data: { idPengajuan: id, status: status, resumeToken: resumeToken } };
}

function handleCheckPengajuanStatus(data) {
  const lookup = resolvePengajuanStatusLookup_(data);
  return buildPengajuanStatusResponse_(lookup);
}

function handleCheckPengajuanStatusBySerial(data) {
  data = data || {};
  const nomorSeri = clean_(data.nomorSeri || data.keyword || data.search || data.query);
  if (!nomorSeri) throw new Error('Masukkan Nomor Seri terlebih dahulu.');

  const item = findItemRecordBySerial_(nomorSeri);
  if (!item) throw new Error('Nomor Seri tidak ditemukan. Periksa kembali input yang dimasukkan.');

  const itemId = clean_(item.data['ID Pengajuan']);
  const itemRecord = itemId ? findPengajuanRecord_(itemId) : null;
  if (!itemRecord) throw new Error('Data pengajuan untuk Nomor Seri ini tidak ditemukan.');

  return buildPengajuanStatusResponse_({ record: itemRecord, item: item, searchBy: 'nomorSeri' });
}

function buildPengajuanStatusResponse_(lookup) {
  const record = lookup.record;
  const matchedItem = lookup.item ? lookup.item.data : null;

  const row = record.row;
  const col = record.col;
  const id = clean_(row[col['ID Pengajuan']]);
  const parentStatus = clean_(row[col['Status']]);
  if (VALID_STATUSES.concat([DRAFT_STATUS]).indexOf(parentStatus) === -1) {
    throw new Error('Status pengajuan tidak bisa ditampilkan.');
  }

  const itemDecision = matchedItem ? normalizeExplicitItemDecision_(matchedItem['Keputusan Item']) : '';
  const status = parentStatus;

  return {
    success: true,
    data: {
      idPengajuan: id,
      searchBy: lookup.searchBy,
      status: status,
      parentStatus: parentStatus,
      keputusanItem: itemDecision,
      noItem: matchedItem ? matchedItem['No Item'] : '',
      nomorSeri: matchedItem ? matchedItem['Nomor Seri'] : '',
      produk: matchedItem ? matchedItem['Produk'] : '',
      model: matchedItem ? matchedItem['Model'] : '',
      timestampSubmit: toIso_(row[col['Timestamp Submit']]),
      jumlahItem: row[col['Jumlah Item']],
      catatanAdmin: row[col['Catatan Admin']],
      catatanAdminItem: matchedItem ? clean_(matchedItem['Catatan Admin Item']) : '',
      tanggalUpdateStatusTerakhir: toIso_(row[col['Tanggal Update Status Terakhir']]),
      draftUpdatedAt: toIso_(row[col['Draft Updated At']]),
    },
  };
}

function resolvePengajuanStatusLookup_(data) {
  data = data || {};
  const keyword = clean_(data.keyword || data.search || data.query || data.idPengajuan || data.nomorSeri);
  if (!keyword) throw new Error('Masukkan ID Pengajuan atau Nomor Seri terlebih dahulu.');

  const record = findPengajuanRecord_(keyword);
  if (record) return { record: record, item: null, searchBy: 'idPengajuan' };

  const item = findItemRecordBySerial_(keyword);
  if (!item) throw new Error('ID Pengajuan atau Nomor Seri tidak ditemukan. Periksa kembali input yang dimasukkan.');

  const itemId = clean_(item.data['ID Pengajuan']);
  const itemRecord = itemId ? findPengajuanRecord_(itemId) : null;
  if (!itemRecord) throw new Error('Data pengajuan untuk Nomor Seri ini tidak ditemukan.');

  return { record: itemRecord, item: item, searchBy: 'nomorSeri' };
}

function handleGetModelProduk() {
  const rows = getModelProdukRows_().map(function (row) {
    return {
      model: row.model,
      produk: row.produk,
      origin: row.origin,
      status: row.status,
      updatedAt: toIso_(row.updatedAt),
    };
  });
  return { success: true, data: { rows: rows } };
}

function handleSubmitDraftPengajuan(data) {
  const config = getConfig();
  const cleaned = normalizeSubmission_(data, config, true);
  const id = clean_(data.idPengajuan);
  const token = clean_(data.resumeToken);
  if (!id || !token) throw new Error('Buka draft dari Draft Terakhir atau Link Lanjutkan Draft');

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const record = findPengajuanRecord_(id);
    if (!record) throw new Error('Draft tidak ditemukan');
    if (clean_(record.row[record.col['Resume Token']]) !== token) throw new Error('Link lanjutkan tidak valid atau draft tidak ditemukan');
    if (record.row[record.col['Status']] !== DRAFT_STATUS) throw new Error('Draft sudah tidak dapat dilanjutkan');
    assertNoDuplicateModelSerial_(cleaned.items, id);

    const folderId = String(config.DRIVE_FOLDER_ID || APP.DRIVE_FOLDER_ID || '').trim();
    if (!folderId) throw new Error('DRIVE_FOLDER_ID belum dikonfigurasi. Jalankan setupApp() terlebih dahulu.');

    const folder = DriveApp.getFolderById(folderId);
    createHardcopyFile_(folder, id, cleaned);
    const evidenceFiles = createEvidenceFiles_(folder, id, cleaned.evidenceAttachments);

    const now = new Date();
    updatePengajuanRow_(record.sheet, record.rowNumber, record.col, id, cleaned, 'Baru', '', now, record.row[record.col['Draft Created At']] || '', record.row[record.col['Draft Updated At']] || '', now, evidenceFiles.count);
    replaceItemRows_(id, cleaned.items);
    getSheet_(SHEETS.STATUS_LOG).appendRow([now, id, DRAFT_STATUS, 'Baru', 'Final submit hard copy signed', 'system', '']);

    return { success: true, data: { idPengajuan: id } };
  } finally {
    lock.releaseLock();
  }
}

function handleAdminLogin(data) {
  const username = clean_(data.username).toLowerCase();
  const password = clean_(data.password);
  if (!username || !password) throw new Error('Username dan password wajib diisi');

  const sheet = getSheet_(SHEETS.USERS);
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    const rowUsername = clean_(values[i][0]).toLowerCase();
    const rowPassword = clean_(values[i][1]);
    const nama = clean_(values[i][2]);
    const role = clean_(values[i][3]);
    const aktif = clean_(values[i][4]).toLowerCase();
    if (rowUsername === username && aktif === 'yes' && role.toLowerCase() === 'admin') {
      if (rowPassword !== password) break;
      const token = Utilities.getUuid();
      const session = { username: rowUsername, nama: nama || rowUsername, role: role };
      CacheService.getScriptCache().put(token, JSON.stringify(session), APP.SESSION_DURATION_HOURS * 60 * 60);
      sheet.getRange(i + 1, 6).setValue(new Date());
      return { success: true, data: { token: token, nama: session.nama, username: rowUsername } };
    }
  }
  throw new Error('Username atau password salah');
}

function handleAdminLogout(data) {
  const token = clean_(data.token);
  if (token) CacheService.getScriptCache().remove(getSessionCacheKey_(token));
  return { success: true, data: {} };
}

function handleAdminUsersList(data) {
  requireSession_(data.token, ['admin']);

  const config = requireSupabaseProps_(['supabaseUrl', 'secretKey']);
  const users = fetchSupabaseJson_(
    config.supabaseUrl + '/rest/v1/profiles?select=id,email,full_name,role,is_active,created_at&order=created_at.desc',
    {
      method: 'get',
      headers: supabaseAdminHeaders_(),
    }
  ) || [];

  return { success: true, data: users };
}

function handleAdminUsersInvite(data) {
  requireSession_(data.token, ['admin']);

  const email = clean_(data.email).toLowerCase();
  const fullName = clean_(data.full_name || data.fullName);
  const role = normalizeRole_(data.role);

  if (!email) throw new Error('Email wajib diisi.');
  if (!role) throw new Error('Role tidak valid.');

  const config = requireSupabaseProps_(['supabaseUrl', 'secretKey', 'appUrl']);
  const redirectTo = config.appUrl + '/confirm';
  const invitedUser = fetchSupabaseJson_(
    config.supabaseUrl + '/auth/v1/invite?redirect_to=' + encodeURIComponent(redirectTo),
    {
      method: 'post',
      contentType: 'application/json',
      headers: supabaseAdminHeaders_(),
      payload: JSON.stringify({
        email: email,
        data: {
          full_name: fullName,
          role: role,
        },
      }),
    }
  );

  if (invitedUser && invitedUser.id) {
    upsertSupabaseProfile_(invitedUser.id, {
      email: invitedUser.email || email,
      full_name: fullName,
      role: role,
      is_active: true,
    });
  }

  return {
    success: true,
    data: {
      id: invitedUser && invitedUser.id,
      email: invitedUser && invitedUser.email ? invitedUser.email : email,
    },
  };
}

function handleAdminUsersUpdate(data) {
  requireSession_(data.token, ['admin']);

  const targetUserId = clean_(data.targetUserId || data.id);
  const patch = {};

  if (!targetUserId) throw new Error('targetUserId wajib diisi.');

  if (data.full_name !== undefined || data.fullName !== undefined) {
    patch.full_name = clean_(data.full_name || data.fullName);
  }

  if (data.role !== undefined) {
    const role = normalizeRole_(data.role);
    if (!role) throw new Error('Role tidak valid.');
    if (role !== 'admin') assertNotLastActiveAdmin_(targetUserId, 'Tidak boleh downgrade admin terakhir.');
    patch.role = role;
  }

  if (!Object.keys(patch).length) throw new Error('Tidak ada data user yang diubah.');

  patchSupabaseProfile_(targetUserId, patch);
  return { success: true, data: { id: targetUserId } };
}

function handleAdminUsersDeactivate(data) {
  const caller = requireSession_(data.token, ['admin']);
  const targetUserId = clean_(data.targetUserId || data.id);

  if (!targetUserId) throw new Error('targetUserId wajib diisi.');
  assertNotLastActiveAdmin_(targetUserId, 'Tidak boleh menonaktifkan admin terakhir.');

  patchSupabaseProfile_(targetUserId, { is_active: false });
  return { success: true, data: { id: targetUserId, deactivatedBy: caller.userId || caller.username } };
}

function handleAdminUsersReactivate(data) {
  requireSession_(data.token, ['admin']);

  const targetUserId = clean_(data.targetUserId || data.id);
  if (!targetUserId) throw new Error('targetUserId wajib diisi.');

  patchSupabaseProfile_(targetUserId, { is_active: true });
  return { success: true, data: { id: targetUserId } };
}

function upsertSupabaseProfile_(id, values) {
  const config = requireSupabaseProps_(['supabaseUrl', 'secretKey']);
  const payload = Object.assign({ id: id }, values || {});
  const headers = supabaseAdminHeaders_();
  headers.Prefer = 'resolution=merge-duplicates,return=minimal';

  fetchSupabaseJson_(config.supabaseUrl + '/rest/v1/profiles?on_conflict=id', {
    method: 'post',
    contentType: 'application/json',
    headers: headers,
    payload: JSON.stringify(payload),
  });
}

function patchSupabaseProfile_(id, patch) {
  const config = requireSupabaseProps_(['supabaseUrl', 'secretKey']);
  const headers = supabaseAdminHeaders_();
  headers.Prefer = 'return=minimal';

  fetchSupabaseJson_(config.supabaseUrl + '/rest/v1/profiles?id=eq.' + encodeURIComponent(id), {
    method: 'patch',
    contentType: 'application/json',
    headers: headers,
    payload: JSON.stringify(patch),
  });
}

function assertNotLastActiveAdmin_(targetUserId, message) {
  const config = requireSupabaseProps_(['supabaseUrl', 'secretKey']);
  const admins = fetchSupabaseJson_(
    config.supabaseUrl + '/rest/v1/profiles?role=eq.admin&is_active=eq.true&select=id',
    {
      method: 'get',
      headers: supabaseAdminHeaders_(),
    }
  ) || [];

  if (admins.length === 1 && admins[0].id === targetUserId) {
    throw new Error(message);
  }
}

function handleGetDashboard(data) {
  const session = requireSession_(data.token);
  const payload = buildDashboardPayload_(data);
  payload.admin = session.nama;
  return { success: true, data: payload };
}

function handleGetDashboardSummary(data) {
  const session = requireSession_(data.token);
  const payload = buildDashboardPayload_({
    page: 1,
    pageSize: 1
  });

  return {
    success: true,
    data: {
      summary: payload.summary,
      admin: session.nama
    }
  };
}

function handleGetDashboardLatest(data) {
  const session = requireSession_(data.token);
  const limit = Math.min(Math.max(parseInt(data.limit || 5, 10), 1), 20);
  const payload = buildDashboardPayload_({
    page: 1,
    pageSize: limit,
    sortBy: 'timestampSubmit',
    sortDirection: 'desc'
  });

  return {
    success: true,
    data: {
      rows: payload.rows,
      totalRows: payload.totalRows,
      page: 1,
      pageSize: limit,
      admin: session.nama
    }
  };
}

function handleGetPengajuanList(data) {
  const session = requireSession_(data.token);
  const payload = buildDashboardPayload_(data);
  payload.admin = session.nama;
  return { success: true, data: payload };
}

function handleGetDashboardChartAggregate(data) {
  const session = requireSession_(data.token);
  const params = normalizeDashboardChartParams_(data);
  const payload = buildDashboardChartAggregate_(params);
  payload.admin = session.nama;
  return { success: true, data: payload };
}

function normalizeDashboardChartParams_(data) {
  const startDate = parseDashboardChartDate_(data.startDate, 'startDate');
  const endDate = parseDashboardChartDate_(data.endDate, 'endDate');
  const start = startOfDay_(startDate);
  const end = endOfDay_(endDate);

  if (start > end) throw new Error('startDate tidak boleh lebih besar dari endDate');

  return {
    startDate: start,
    endDate: end,
    groupBy: normalizeDashboardChartGroupBy_(data.groupBy),
  };
}

function parseDashboardChartDate_(value, fieldName) {
  const raw = clean_(value);
  if (!raw) throw new Error(fieldName + ' wajib diisi');

  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? new Date(raw + 'T00:00:00')
    : new Date(raw);

  if (isNaN(date.getTime())) throw new Error(fieldName + ' tidak valid');
  return date;
}

function normalizeDashboardChartGroupBy_(value) {
  const raw = clean_(value || 'day').toLowerCase();
  const aliases = {
    daily: 'day',
    day: 'day',
    weekly: 'week',
    week: 'week',
    monthly: 'month',
    month: 'month',
    yearly: 'year',
    year: 'year',
  };
  const groupBy = aliases[raw];

  if (!groupBy) throw new Error('groupBy tidak valid');
  return groupBy;
}

function buildDashboardChartAggregate_(params) {
  const parents = readObjects_(SHEETS.PENGAJUAN).filter(function (row) {
    if (VALID_STATUSES.indexOf(row['Status']) === -1) return false;

    const timestampSubmit = row['Timestamp Submit'] instanceof Date ? row['Timestamp Submit'] : new Date(row['Timestamp Submit']);
    if (isNaN(timestampSubmit.getTime())) return false;
    if (timestampSubmit < params.startDate) return false;
    if (timestampSubmit > params.endDate) return false;

    return true;
  });

  const parentById = {};
  parents.forEach(function (row) {
    const id = clean_(row['ID Pengajuan']);
    if (id) parentById[id] = row;
  });

  const itemAggregateById = {};
  readObjects_(SHEETS.ITEMS).forEach(function (item) {
    const id = clean_(item['ID Pengajuan']);
    if (!parentById[id]) return;

    const decision = normalizeExplicitItemDecision_(item['Keputusan Item']);
    const aggregate = itemAggregateById[id] || {
      totalItems: 0,
      approvedItems: 0,
      rejectedItems: 0,
    };

    aggregate.totalItems += 1;
    if (decision === 'Disetujui') aggregate.approvedItems += 1;
    else if (decision === 'Ditolak') aggregate.rejectedItems += 1;

    itemAggregateById[id] = aggregate;
  });

  const pointByPeriod = createDashboardChartEmptyPoints_(params.startDate, params.endDate, params.groupBy);
  const summary = {
    totalItems: 0,
    approvedItems: 0,
    rejectedItems: 0,
  };

  parents.forEach(function (row) {
    const id = clean_(row['ID Pengajuan']);
    const timestampSubmit = row['Timestamp Submit'] instanceof Date ? row['Timestamp Submit'] : new Date(row['Timestamp Submit']);
    const period = formatDashboardChartPeriodKey_(timestampSubmit, params.groupBy);
    const point = pointByPeriod[period] || createDashboardChartPoint_(period);
    const itemAggregate = itemAggregateById[id] || {
      totalItems: normalizeDashboardChartItemCount_(row['Jumlah Item']),
      approvedItems: 0,
      rejectedItems: 0,
    };

    point.totalItems += itemAggregate.totalItems;
    point.approvedItems += itemAggregate.approvedItems;
    point.rejectedItems += itemAggregate.rejectedItems;

    summary.totalItems += itemAggregate.totalItems;
    summary.approvedItems += itemAggregate.approvedItems;
    summary.rejectedItems += itemAggregate.rejectedItems;
    pointByPeriod[period] = point;
  });

  return {
    points: Object.keys(pointByPeriod).sort().map(function (period) { return pointByPeriod[period]; }),
    summary: summary,
    groupBy: params.groupBy,
    startDate: formatDateOnly_(params.startDate),
    endDate: formatDateOnly_(params.endDate),
  };
}

function createDashboardChartEmptyPoints_(startDate, endDate, groupBy) {
  const pointByPeriod = {};
  let cursor = getDashboardChartPeriodStart_(startDate, groupBy);
  const endPeriod = getDashboardChartPeriodStart_(endDate, groupBy);

  while (cursor <= endPeriod) {
    const period = formatDashboardChartPeriodKey_(cursor, groupBy);
    pointByPeriod[period] = createDashboardChartPoint_(period);
    cursor = getDashboardChartNextPeriod_(cursor, groupBy);
  }

  return pointByPeriod;
}

function normalizeDashboardChartItemCount_(value) {
  const count = Number(value || 0);
  if (!isFinite(count) || count < 0) return 0;
  return Math.floor(count);
}

function createDashboardChartPoint_(period) {
  return {
    period: period,
    totalItems: 0,
    approvedItems: 0,
    rejectedItems: 0,
  };
}

function getDashboardChartPeriodStart_(dateValue, groupBy) {
  const date = startOfDay_(new Date(dateValue));

  if (groupBy === 'week') {
    const day = date.getDay();
    const offset = day === 0 ? 6 : day - 1;
    date.setDate(date.getDate() - offset);
  } else if (groupBy === 'month') {
    date.setDate(1);
  } else if (groupBy === 'year') {
    date.setMonth(0, 1);
  }

  return date;
}

function getDashboardChartNextPeriod_(dateValue, groupBy) {
  const next = new Date(dateValue);

  if (groupBy === 'week') next.setDate(next.getDate() + 7);
  else if (groupBy === 'month') next.setMonth(next.getMonth() + 1);
  else if (groupBy === 'year') next.setFullYear(next.getFullYear() + 1);
  else next.setDate(next.getDate() + 1);

  return startOfDay_(next);
}

function formatDashboardChartPeriodKey_(dateValue, groupBy) {
  return formatDateOnly_(getDashboardChartPeriodStart_(dateValue, groupBy));
}

function buildDashboardPayload_(data) {
  const page = Math.max(parseInt(data.page || 1, 10), 1);
  const pageSize = Math.min(Math.max(parseInt(data.pageSize || 20, 10), 1), 100);
  const search = clean_(data.search).toLowerCase();
  const status = clean_(data.status);
  const itemDecision = clean_(data.itemDecision || data.decisionFilter || data.keputusanItem || 'all');
  const sortBy = clean_(data.sortBy || 'timestampSubmit');
  const sortDirection = clean_(data.sortDirection || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
  const dateFrom = data.dateFrom ? startOfDay_(new Date(data.dateFrom)) : null;
  const dateTo = data.dateTo ? endOfDay_(new Date(data.dateTo)) : null;
  if (status && VALID_STATUSES.indexOf(status) === -1) throw new Error('Status filter tidak valid');
  if (['', 'all', 'pending'].indexOf(itemDecision) === -1 && ITEM_DECISION_STATUSES.indexOf(itemDecision) === -1) {
    throw new Error('Filter keputusan item tidak valid');
  }

  let rows = readObjects_(SHEETS.PENGAJUAN).filter(function (row) {
    if (VALID_STATUSES.indexOf(row['Status']) === -1) return false;
    const ts = row['Timestamp Submit'] instanceof Date ? row['Timestamp Submit'] : new Date(row['Timestamp Submit']);
    if (status && row['Status'] !== status) return false;
    if (dateFrom && ts < dateFrom) return false;
    if (dateTo && ts > dateTo) return false;
    return true;
  });

  const rowById = {};
  rows.forEach(function (row) {
    const id = clean_(row['ID Pengajuan']);
    if (id) rowById[id] = row;
  });

  const itemCountById = {};
  const itemDetailById = {};
  const itemDecisionById = {};
  const itemSearchById = {};
  readObjects_(SHEETS.ITEMS).forEach(function (item) {
    const id = clean_(item['ID Pengajuan']);
    const parent = rowById[id];
    if (!parent) return;

    const decisionItem = normalizeExplicitItemDecision_(item['Keputusan Item']);
    const noItem = clean_(item['No Item']);
    itemCountById[id] = (itemCountById[id] || 0) + 1;
    if (noItem) {
      itemDetailById[id] = itemDetailById[id] || {};
      itemDecisionById[id] = itemDecisionById[id] || {};
      itemDetailById[id][noItem] = {
        model: item['Model'],
        nomorSeri: item['Nomor Seri']
      };
      itemDecisionById[id][noItem] = decisionItem;
    }
    itemSearchById[id] = [
      itemSearchById[id] || '',
      item['Produk'],
      item['Model'],
      item['Nomor Seri'],
      decisionItem
    ].join(' ').toLowerCase();
  });

  rows = rows.filter(function (row) {
    const id = clean_(row['ID Pengajuan']);
    const parentHaystack = [
      row['ID Pengajuan'],
      row['Timestamp Submit'],
      row['Nama'],
      row['Bagian/Cabang'],
      row['Jumlah Item'],
      row['Status']
    ].join(' ').toLowerCase();

    if (search && [parentHaystack, itemSearchById[id] || ''].join(' ').indexOf(search) === -1) return false;
    if (!dashboardRowMatchesItemDecision_(row, itemDecision, itemCountById, itemDecisionById)) return false;
    return true;
  });

  const filteredRowById = {};
  rows.forEach(function (row) {
    const id = clean_(row['ID Pengajuan']);
    if (!id) return;

    filteredRowById[id] = row;
  });

  const summary = {
    total: rows.length,
    totalItems: 0,
    baru: 0,
    disetujui: 0,
    ditolak: 0,
    diprint: 0,
    dikirim: 0,
    selesai: 0,
    itemDisetujui: 0,
    itemDitolak: 0
  };

  rows.forEach(function (row) {
    const key = String(row['Status'] || '').toLowerCase();
    if (summary.hasOwnProperty(key)) summary[key] += 1;
  });

  readObjects_(SHEETS.ITEMS).forEach(function (item) {
    const id = clean_(item['ID Pengajuan']);
    if (!filteredRowById[id]) return;

    const decisionItem = normalizeExplicitItemDecision_(item['Keputusan Item']);
    summary.totalItems += 1;
    if (decisionItem === 'Disetujui') summary.itemDisetujui += 1;
    else if (decisionItem === 'Ditolak') summary.itemDitolak += 1;
  });

  rows.forEach(function (row) {
    const id = clean_(row['ID Pengajuan']);
    if (!id || itemCountById[id]) return;

    const itemCount = Number(row['Jumlah Item'] || 0);
    summary.totalItems += itemCount;
  });

  rows.sort(function (a, b) {
    return compareDashboardRows_(a, b, sortBy, sortDirection);
  });

  const totalRows = rows.length;
  const start = (page - 1) * pageSize;
  const paged = rows.slice(start, start + pageSize).map(function (row) {
    const id = clean_(row['ID Pengajuan']);
    const itemCount = Number(row['Jumlah Item'] || itemCountById[id] || 0);
    const items = [];

    for (let noItem = 1; noItem <= itemCount; noItem += 1) {
      const itemDetail = itemDetailById[id] && itemDetailById[id][String(noItem)]
        ? itemDetailById[id][String(noItem)]
        : {};

      items.push({
        noItem: noItem,
        model: itemDetail.model || '',
        nomorSeri: itemDetail.nomorSeri || '',
        keputusanItem: itemDecisionById[id] && Object.prototype.hasOwnProperty.call(itemDecisionById[id], String(noItem))
          ? itemDecisionById[id][String(noItem)]
          : ''
      });
    }

    return {
      idPengajuan: row['ID Pengajuan'],
      timestampSubmit: toIso_(row['Timestamp Submit']),
      nama: row['Nama'],
      bagianCabang: row['Bagian/Cabang'],
      jumlahItem: row['Jumlah Item'],
      status: row['Status'],
      items: items,
    };
  });

  return { summary: summary, rows: paged, totalRows: totalRows, page: page, pageSize: pageSize };
}

function dashboardRowMatchesItemDecision_(row, itemDecision, itemCountById, itemDecisionById) {
  if (!itemDecision || itemDecision === 'all') return true;

  const id = clean_(row['ID Pengajuan']);
  const itemCount = Number(row['Jumlah Item'] || itemCountById[id] || 0);

  for (let noItem = 1; noItem <= itemCount; noItem += 1) {
    const key = String(noItem);
    const decision = itemDecisionById[id] && Object.prototype.hasOwnProperty.call(itemDecisionById[id], key)
      ? itemDecisionById[id][key]
      : '';

    if (itemDecision === 'pending' && !decision) return true;
    if (decision === itemDecision) return true;
  }

  return false;
}

function compareDashboardRows_(a, b, sortBy, sortDirection) {
  const dir = sortDirection === 'asc' ? 1 : -1;
  const aValue = dashboardSortValue_(a, sortBy);
  const bValue = dashboardSortValue_(b, sortBy);

  if (aValue < bValue) return -1 * dir;
  if (aValue > bValue) return 1 * dir;
  return 0;
}

function dashboardSortValue_(row, sortBy) {
  switch (sortBy) {
    case 'idPengajuan':
      return clean_(row['ID Pengajuan']);
    case 'nama':
      return clean_(row['Nama']).toLowerCase();
    case 'bagianCabang':
      return clean_(row['Bagian/Cabang']).toLowerCase();
    case 'status':
      return clean_(row['Status']);
    case 'timestampSubmit':
    default:
      return new Date(row['Timestamp Submit']).getTime();
  }
}

function handleGetDetail(data) {
  requireSession_(data.token);
  return { success: true, data: buildDetailPayload_(data.idPengajuan) };
}

function handleGetArchiveFile(data) {
  requireSession_(data.token);
  const id = clean_(data.idPengajuan);
  const kind = clean_(data.kind);
  const sequence = parseInt(data.sequence, 10);
  const requestedFileName = clean_(data.fileName);
  if (!requestedFileName && !id) throw new Error('ID Pengajuan atau fileName wajib diisi');
  if (!requestedFileName && kind !== 'hardcopy' && kind !== 'bukti') throw new Error('Jenis file arsip tidak valid');

  const fileName = requestedFileName || buildArchiveFileName_(id, kind, isNaN(sequence) ? 0 : sequence);

  const config = getConfig();
  const folderId = String(config.DRIVE_FOLDER_ID || APP.DRIVE_FOLDER_ID || '').trim();
  if (!folderId) throw new Error('DRIVE_FOLDER_ID belum dikonfigurasi. Jalankan setupApp() terlebih dahulu.');

  const folder = DriveApp.getFolderById(folderId);
  const files = folder.getFilesByName(fileName);
  if (!files.hasNext()) throw new Error('File arsip tidak ditemukan: ' + fileName);

  let file = files.next();
  while (file && file.isTrashed && file.isTrashed() && files.hasNext()) {
    file = files.next();
  }
  const blob = file.getBlob();
  return {
    success: true,
    data: {
      fileName: file.getName(),
      mimeType: blob.getContentType(),
      sizeBytes: blob.getBytes().length,
      base64: Utilities.base64Encode(blob.getBytes()),
      sourceDriveFileId: file.getId(),
    },
  };
}

function buildDetailPayload_(idPengajuan) {
  const id = clean_(idPengajuan);
  if (!id) throw new Error('ID Pengajuan wajib diisi');

  const record = findPengajuanRecord_(id);
  const pengajuan = record ? listToObject_(record.headers, record.row) : null;
  if (!pengajuan) throw new Error('Pengajuan tidak ditemukan');
  if (VALID_STATUSES.indexOf(pengajuan['Status']) === -1) throw new Error('Pengajuan tidak ditemukan');

  const items = getItemsForPengajuan_(id);
  const riwayat = readObjects_(SHEETS.STATUS_LOG)
    .filter(function (row) { return normalizePengajuanId_(row['ID Pengajuan']) === normalizePengajuanId_(id); })
    .sort(function (a, b) { return new Date(b['Timestamp']).getTime() - new Date(a['Timestamp']).getTime(); })
    .map(function (row) {
      return {
        timestamp: toIso_(row['Timestamp']),
        noItem: row['No Item'],
        statusLama: row['Status Lama'],
        statusBaru: row['Status Baru'],
        catatanAdmin: row['Catatan Admin'],
        user: row['User'],
      };
    });

  return {
    idPengajuan: pengajuan['ID Pengajuan'],
    timestampSubmit: toIso_(pengajuan['Timestamp Submit']),
    nama: pengajuan['Nama'],
    bagianCabang: pengajuan['Bagian/Cabang'],
    pemilik: pengajuan['Pemilik'],
    alasanPengajuan: pengajuan['Alasan Pengajuan'],
    tanggalForm: formatDateOnly_(pengajuan['Tanggal Form']),
    catatanTambahan: pengajuan['Catatan Tambahan'],
    jumlahItem: pengajuan['Jumlah Item'],
    jumlahFileBukti: Number(pengajuan['Jumlah File Bukti'] || 0),
    hardcopyArchivePath: buildArchiveFilePath_(pengajuan['ID Pengajuan'], 'hardcopy', 0),
    evidenceArchivePaths: buildEvidenceArchivePaths_(pengajuan['ID Pengajuan'], pengajuan['Jumlah File Bukti']),
    status: pengajuan['Status'],
    catatanAdmin: pengajuan['Catatan Admin'],
    tanggalUpdateStatusTerakhir: toIso_(pengajuan['Tanggal Update Status Terakhir']),
    userUpdateStatus: pengajuan['User Update Status'],
    items: items,
    riwayat: riwayat,
  };
}

function buildDashboardRowFromDetail_(detail) {
  return {
    idPengajuan: detail.idPengajuan,
    timestampSubmit: detail.timestampSubmit,
    nama: detail.nama,
    bagianCabang: detail.bagianCabang,
    jumlahItem: detail.jumlahItem,
    status: detail.status,
    items: (detail.items || []).map(function (item) {
      return {
        noItem: item.noItem,
        model: item.model,
        nomorSeri: item.nomorSeri,
        keputusanItem: item.keputusanItem,
      };
    }),
  };
}

function buildPengajuanMutationPayload_(idPengajuan) {
  const detail = buildDetailPayload_(idPengajuan);
  return {
    detail: detail,
    row: buildDashboardRowFromDetail_(detail),
    status: detail.status,
  };
}

function handleUpdateStatus(data) {
  const session = requireSession_(data.token, ['admin', 'qrcc']);
  const id = clean_(data.idPengajuan);
  const statusBaru = clean_(data.statusBaru);
  const catatanAdmin = clean_(data.catatanAdmin);
  if (!id) throw new Error('ID Pengajuan wajib diisi');
  if (VALID_STATUSES.indexOf(statusBaru) === -1) throw new Error('Status tidak valid');

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = getSheet_(SHEETS.PENGAJUAN);
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    const col = indexMap_(headers);
    let targetRow = -1;
    for (let i = 1; i < values.length; i++) {
      if (values[i][col['ID Pengajuan']] === id && VALID_STATUSES.indexOf(values[i][col['Status']]) !== -1) {
        targetRow = i + 1;
        break;
      }
    }
    if (targetRow === -1) throw new Error('Pengajuan tidak ditemukan');

    const statusLama = clean_(values[targetRow - 1][col['Status']]);
    assertStatusTransitionAllowed_(session, statusLama, statusBaru, catatanAdmin);
    const now = new Date();
    const entry = '[' + formatDateTime_(now) + '] ' + statusLama + ' â†’ ' + statusBaru + ' oleh ' + session.username;

    sheet.getRange(targetRow, col['Status'] + 1).setValue(statusBaru);
    sheet.getRange(targetRow, col['Catatan Admin'] + 1).setValue(catatanAdmin);
    sheet.getRange(targetRow, col['Tanggal Update Status Terakhir'] + 1).setValue(now);
    sheet.getRange(targetRow, col['User Update Status'] + 1).setValue(session.username);

    getSheet_(SHEETS.STATUS_LOG).appendRow([now, id, statusLama, statusBaru, catatanAdmin, session.username, '']);
    SpreadsheetApp.flush();
    return { success: true, data: buildPengajuanMutationPayload_(id) };
  } finally {
    lock.releaseLock();
  }
}

function handleUpdateItemDecision(data) {
  const session = requireSession_(data.token, ['admin', 'qrcc']);
  const id = clean_(data.idPengajuan);
  const noItem = clean_(data.noItem);
  const hasDecisionPayload = Object.prototype.hasOwnProperty.call(data, 'keputusanItem');
  const requestedDecision = hasDecisionPayload ? clean_(data.keputusanItem) : '';
  const catatanAdmin = clean_(data.catatanAdmin);
  if (!id) throw new Error('ID Pengajuan wajib diisi');
  if (!noItem) throw new Error('No Item wajib diisi');
  if (!hasDecisionPayload) throw new Error('Keputusan item wajib diisi');
  if (hasDecisionPayload && requestedDecision && ITEM_DECISION_STATUSES.indexOf(requestedDecision) === -1) throw new Error('Keputusan item tidak valid');
  if (requestedDecision === 'Ditolak' && !catatanAdmin) throw new Error('Catatan Admin wajib diisi jika keputusan Ditolak');

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const pengajuanSheet = getSheet_(SHEETS.PENGAJUAN);
    const pengajuanValues = pengajuanSheet.getDataRange().getValues();
    const pengajuanCol = indexMap_(pengajuanValues[0]);
    let pengajuanRow = -1;
    let parentStatusLama = '';

    for (let i = 1; i < pengajuanValues.length; i++) {
      if (pengajuanValues[i][pengajuanCol['ID Pengajuan']] === id && VALID_STATUSES.indexOf(pengajuanValues[i][pengajuanCol['Status']]) !== -1) {
        pengajuanRow = i + 1;
        parentStatusLama = pengajuanValues[i][pengajuanCol['Status']] || '';
        break;
      }
    }
    if (pengajuanRow === -1) throw new Error('Pengajuan tidak ditemukan');

    const itemSheet = getSheet_(SHEETS.ITEMS);
    const itemValues = itemSheet.getDataRange().getValues();
    const itemCol = indexMap_(itemValues[0]);
    let itemRow = -1;
    let decisionLama = '';

    for (let i = 1; i < itemValues.length; i++) {
      if (itemValues[i][itemCol['ID Pengajuan']] === id && String(itemValues[i][itemCol['No Item']]) === noItem) {
        itemRow = i + 1;
        decisionLama = itemCol['Keputusan Item'] !== undefined
          ? normalizeExplicitItemDecision_(itemValues[i][itemCol['Keputusan Item']])
          : '';
        break;
      }
    }
    if (itemRow === -1) throw new Error('Item pengajuan tidak ditemukan');
    if (itemCol['Keputusan Item'] === undefined) throw new Error('Kolom Keputusan Item belum tersedia. Jalankan setupApp terlebih dahulu.');

    const now = new Date();
    const decisionBaru = normalizeExplicitItemDecision_(requestedDecision);
    itemSheet.getRange(itemRow, itemCol['Keputusan Item'] + 1).setValue(decisionBaru);
    itemSheet.getRange(itemRow, itemCol['Catatan Admin Item'] + 1).setValue(catatanAdmin);
    itemSheet.getRange(itemRow, itemCol['Tanggal Update Keputusan Item'] + 1).setValue(now);
    itemSheet.getRange(itemRow, itemCol['User Update Keputusan Item'] + 1).setValue(session.username);

    itemValues[itemRow - 1][itemCol['Keputusan Item']] = decisionBaru;

    // Reuse itemValues yang sudah dibaca di awal untuk hindari getDataRange kedua.
    const refreshedDecisions = itemValues.slice(1)
      .filter(function (row) { return row[itemCol['ID Pengajuan']] === id; })
      .map(function (row) {
        return normalizeExplicitItemDecision_(row[itemCol['Keputusan Item']]);
      });
    const derivedParentStatus = derivePengajuanStatusFromItemDecisions_(refreshedDecisions);
    const parentStatusBaru = shouldApplyItemDerivedParentStatus_(parentStatusLama) ? derivedParentStatus : parentStatusLama;
    const logLabel = 'Keputusan Item #' + noItem;
    const logBefore = decisionLama || 'Belum Diputuskan';
    const logAfter = decisionBaru || 'Belum Diputuskan';

    pengajuanSheet.getRange(pengajuanRow, pengajuanCol['Status'] + 1).setValue(parentStatusBaru);
    pengajuanSheet.getRange(pengajuanRow, pengajuanCol['Catatan Admin'] + 1).setValue(catatanAdmin);
    pengajuanSheet.getRange(pengajuanRow, pengajuanCol['Tanggal Update Status Terakhir'] + 1).setValue(now);
    pengajuanSheet.getRange(pengajuanRow, pengajuanCol['User Update Status'] + 1).setValue(session.username);

    getSheet_(SHEETS.STATUS_LOG).appendRow([now, id, logBefore, logAfter, catatanAdmin, session.username, noItem]);
    SpreadsheetApp.flush();
    const payload = buildPengajuanMutationPayload_(id);
    payload.keputusanItem = decisionBaru;

    return { success: true, data: payload };
  } finally {
    lock.releaseLock();
  }
}

function handleUpdatePengajuanAdmin(data) {
  const session = requireSession_(data.token, ['admin']);
  const id = clean_(data.idPengajuan);
  if (!id) throw new Error('ID Pengajuan wajib diisi');

  const cleaned = normalizeAdminPengajuanPatch_(data);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const record = findPengajuanRecord_(id);
    if (!record || VALID_STATUSES.indexOf(record.row[record.col['Status']]) === -1) {
      throw new Error('Pengajuan tidak ditemukan');
    }

    const row = record.sheet.getRange(record.rowNumber, 1, 1, record.sheet.getLastColumn()).getValues()[0];
    const before = {
      nama: clean_(row[record.col['Nama']]),
      bagianCabang: clean_(row[record.col['Bagian/Cabang']]),
      pemilik: clean_(row[record.col['Pemilik']]),
      alasanPengajuan: clean_(row[record.col['Alasan Pengajuan']]),
      tanggalForm: formatDateOnly_(row[record.col['Tanggal Form']]),
      catatanTambahan: clean_(row[record.col['Catatan Tambahan']]),
    };
    const changedFields = getChangedPengajuanAdminFields_(before, cleaned);

    if (!changedFields.length) {
      return { success: true, data: buildPengajuanMutationPayload_(id) };
    }

    row[record.col['Nama']] = cleaned.nama;
    row[record.col['Bagian/Cabang']] = cleaned.bagianCabang;
    row[record.col['Pemilik']] = cleaned.pemilik;
    row[record.col['Alasan Pengajuan']] = cleaned.alasanPengajuan;
    row[record.col['Tanggal Form']] = cleaned.tanggalForm;
    row[record.col['Catatan Tambahan']] = cleaned.catatanTambahan;

    const now = new Date();
    record.sheet.getRange(record.rowNumber, 1, 1, row.length).setValues([row]);
    getSheet_(SHEETS.STATUS_LOG).appendRow([now, id, row[record.col['Status']], row[record.col['Status']], 'Edit data: ' + changedFields.join(', '), session.username, '']);
    SpreadsheetApp.flush();

    return { success: true, data: buildPengajuanMutationPayload_(id) };
  } finally {
    lock.releaseLock();
  }
}

function handleDeletePengajuan(data) {
  const session = requireSession_(data.token, ['admin']);
  const id = clean_(data.idPengajuan);
  if (!id) throw new Error('ID Pengajuan wajib diisi');

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const detail = buildDetailPayload_(id);
    const deleted = {
      items: deleteRowsByColumnValue_(SHEETS.ITEMS, 'ID Pengajuan', id),
      statusLog: deleteRowsByColumnValue_(SHEETS.STATUS_LOG, 'ID Pengajuan', id),
      pengajuan: deleteRowsByColumnValue_(SHEETS.PENGAJUAN, 'ID Pengajuan', id),
    };

    trashPengajuanFiles_(detail);
    SpreadsheetApp.flush();

    return {
      success: true,
      data: {
        idPengajuan: id,
        deleted: deleted,
        deletedBy: session.username,
        deletedAt: new Date().toISOString(),
      },
    };
  } finally {
    lock.releaseLock();
  }
}

function handleFinalizeArchivedPengajuan(data) {
  const session = requireSession_(data.token, ['admin']);
  const id = clean_(data.idPengajuan);
  if (!id) throw new Error('ID Pengajuan wajib diisi');

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const detail = buildDetailPayload_(id);
    if (clean_(detail.status) !== 'Selesai') throw new Error('Pengajuan belum berstatus Selesai');

    trashPengajuanFiles_(detail);

    const deleted = {
      items: deleteRowsByColumnValue_(SHEETS.ITEMS, 'ID Pengajuan', id),
      statusLog: deleteRowsByColumnValue_(SHEETS.STATUS_LOG, 'ID Pengajuan', id),
      pengajuan: deleteRowsByColumnValue_(SHEETS.PENGAJUAN, 'ID Pengajuan', id),
    };

    SpreadsheetApp.flush();

    return {
      success: true,
      data: {
        idPengajuan: id,
        deleted: deleted,
        deletedBy: session.username,
        deletedAt: new Date().toISOString(),
      },
    };
  } finally {
    lock.releaseLock();
  }
}

function handleAuditPengajuanDataIntegrity(data) {
  const session = requireSession_(data.token, ['admin']);
  const parsedLimit = parseInt(data.limit || 50, 10);
  const limit = Math.min(Math.max(isNaN(parsedLimit) ? 50 : parsedLimit, 1), 200);
  const parents = readObjectsWithRowNumbers_(SHEETS.PENGAJUAN);
  const items = readObjectsWithRowNumbers_(SHEETS.ITEMS);
  const statusLogs = readObjectsWithRowNumbers_(SHEETS.STATUS_LOG);

  const parentById = groupRowsByCleanValue_(parents, 'ID Pengajuan');
  const itemsById = groupRowsByCleanValue_(items, 'ID Pengajuan');
  const parentIds = {};
  Object.keys(parentById).forEach(function (id) { parentIds[id] = true; });

  const duplicateIds = Object.keys(parentById)
    .filter(function (id) { return parentById[id].length > 1; })
    .map(function (id) {
      const rows = parentById[id];
      return {
        idPengajuan: id,
        count: rows.length,
        rows: rows.map(buildAuditParentSummary_),
        recommendedKeep: pickLikelyValidParent_(rows, itemsById[id] || [], statusLogs),
      };
    });

  const orphanItems = Object.keys(itemsById)
    .filter(function (id) { return id && !parentIds[id]; })
    .map(function (id) {
      const rows = itemsById[id];
      return {
        idPengajuan: id,
        count: rows.length,
        rows: rows.slice(0, 10).map(buildAuditItemSummary_),
      };
    });

  const parentsWithoutItems = parents
    .filter(function (row) {
      const id = normalizePengajuanId_(row.data['ID Pengajuan']);
      return id && !itemsById[id];
    })
    .map(buildAuditParentSummary_);

  const duplicateCandidates = buildPengajuanDuplicateCandidates_(parents, itemsById);
  const serialConflicts = buildSerialConflictCandidates_(items, parentById);

  return {
    success: true,
    data: {
      auditedAt: new Date().toISOString(),
      auditedBy: session.username,
      summary: {
        pengajuanRows: parents.length,
        pengajuanItemRows: items.length,
        uniquePengajuanIds: Object.keys(parentById).length,
        duplicateIdGroups: duplicateIds.length,
        duplicateCandidateGroups: duplicateCandidates.length,
        serialConflictGroups: serialConflicts.length,
        orphanItemGroups: orphanItems.length,
        orphanItemRows: orphanItems.reduce(function (sum, group) { return sum + group.count; }, 0),
        parentsWithoutItems: parentsWithoutItems.length,
      },
      duplicateIds: duplicateIds.slice(0, limit),
      duplicateCandidates: duplicateCandidates.slice(0, limit),
      serialConflicts: serialConflicts.slice(0, limit),
      orphanItems: orphanItems.slice(0, limit),
      parentsWithoutItems: parentsWithoutItems.slice(0, limit),
    },
  };
}

function handleRecoverDraftPengajuanFromItems(data) {
  const session = requireSession_(data.token, ['admin']);
  const id = normalizePengajuanId_(data.idPengajuan);
  if (!id) throw new Error('ID Pengajuan wajib diisi');

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    if (findPengajuanRecord_(id)) throw new Error('Data utama Pengajuan sudah ada. Recovery tidak diperlukan.');

    const items = getItemsForPengajuan_(id);
    if (!items.length) throw new Error('PengajuanItems tidak ditemukan untuk ID Pengajuan ini.');

    const cleaned = normalizeRecoveredDraftInput_(data, items);
    const now = new Date();
    const token = generateResumeToken_();

    appendPengajuanRow_(id, cleaned, DRAFT_STATUS, token, '', now, now, '', 0);
    getSheet_(SHEETS.STATUS_LOG).appendRow([now, id, '', DRAFT_STATUS, 'Draft direcovery dari PengajuanItems', session.username, '']);

    return {
      success: true,
      data: {
        idPengajuan: id,
        resumeToken: token,
        status: DRAFT_STATUS,
        itemsRecovered: cleaned.items.length,
      },
    };
  } finally {
    lock.releaseLock();
  }
}

function buildPengajuanDuplicateCandidates_(parents, itemsById) {
  const groups = {};

  parents.forEach(function (row) {
    const id = normalizePengajuanId_(row.data['ID Pengajuan']);
    if (!id) return;

    const key = buildPengajuanAuditFingerprint_(row.data, itemsById[id] || []);
    if (!key) return;

    if (!groups[key]) groups[key] = [];
    groups[key].push(row);
  });

  return Object.keys(groups)
    .filter(function (key) {
      const ids = uniqueCleanValues_(groups[key].map(function (row) { return row.data['ID Pengajuan']; }));
      return ids.length > 1;
    })
    .map(function (key) {
      const rows = groups[key];
      const ids = uniqueCleanValues_(rows.map(function (row) { return row.data['ID Pengajuan']; }));
      return {
        fingerprint: key,
        idPengajuan: ids,
        count: rows.length,
        rows: rows.map(buildAuditParentSummary_),
      };
    });
}

function buildSerialConflictCandidates_(items, parentById) {
  const bySerial = {};

  items.forEach(function (row) {
    const serial = clean_(row.data['Nomor Seri']).toLowerCase();
    const id = normalizePengajuanId_(row.data['ID Pengajuan']);
    if (!serial || !id) return;

    if (!bySerial[serial]) bySerial[serial] = [];
    bySerial[serial].push(row);
  });

  return Object.keys(bySerial)
    .filter(function (serial) {
      const ids = uniqueCleanValues_(bySerial[serial].map(function (row) { return row.data['ID Pengajuan']; }));
      return ids.length > 1;
    })
    .map(function (serial) {
      const rows = bySerial[serial];
      const ids = uniqueCleanValues_(rows.map(function (row) { return row.data['ID Pengajuan']; }));
      return {
        nomorSeri: serial,
        idPengajuan: ids,
        rows: rows.slice(0, 10).map(function (row) {
          const id = normalizePengajuanId_(row.data['ID Pengajuan']);
          const parent = parentById[id] && parentById[id][0];
          return Object.assign(buildAuditItemSummary_(row), {
            parent: parent ? buildAuditParentSummary_(parent) : null,
          });
        }),
      };
    });
}

function buildPengajuanAuditFingerprint_(parent, items) {
  const serials = items
    .map(function (item) { return clean_(item.data['Nomor Seri']).toLowerCase(); })
    .filter(Boolean)
    .sort()
    .join(',');

  if (!serials) return '';

  return [
    clean_(parent['Nama']).toLowerCase(),
    clean_(parent['Bagian/Cabang']).toLowerCase(),
    clean_(parent['Pemilik']).toLowerCase(),
    formatDateOnly_(parent['Tanggal Form']),
    serials,
  ].join('|');
}

function pickLikelyValidParent_(parents, items, statusLogs) {
  let best = null;
  let bestScore = -1;

  parents.forEach(function (row) {
    const id = clean_(row.data['ID Pengajuan']);
    const score = scoreAuditParent_(row.data, id, items, statusLogs);
    if (score > bestScore) {
      best = row;
      bestScore = score;
    }
  });

  return best ? Object.assign(buildAuditParentSummary_(best), { score: bestScore }) : null;
}

function scoreAuditParent_(parent, id, items, statusLogs) {
  const normalizedId = normalizePengajuanId_(id);
  let score = 0;
  if (VALID_STATUSES.indexOf(clean_(parent['Status'])) !== -1) score += 20;
  if (clean_(parent['Status']) === DRAFT_STATUS) score += 5;
  if (parent['Submitted At']) score += 15;
  if (parent['Timestamp Submit']) score += 10;
  if (items.length) score += Math.min(items.length, 10);
  if (statusLogs.some(function (row) { return normalizePengajuanId_(row.data['ID Pengajuan']) === normalizedId; })) score += 5;
  return score;
}

function buildAuditParentSummary_(row) {
  return {
    rowNumber: row.rowNumber,
    idPengajuan: row.data['ID Pengajuan'],
    status: row.data['Status'],
    timestampSubmit: toIso_(row.data['Timestamp Submit']),
    submittedAt: toIso_(row.data['Submitted At']),
    draftCreatedAt: toIso_(row.data['Draft Created At']),
    draftUpdatedAt: toIso_(row.data['Draft Updated At']),
    nama: row.data['Nama'],
    bagianCabang: row.data['Bagian/Cabang'],
    pemilik: row.data['Pemilik'],
    tanggalForm: formatDateOnly_(row.data['Tanggal Form']),
    jumlahItem: row.data['Jumlah Item'],
    jumlahFileBukti: Number(row.data['Jumlah File Bukti'] || 0),
  };
}

function buildAuditItemSummary_(row) {
  return {
    rowNumber: row.rowNumber,
    idPengajuan: row.data['ID Pengajuan'],
    noItem: row.data['No Item'],
    produk: row.data['Produk'],
    model: row.data['Model'],
    nomorSeri: row.data['Nomor Seri'],
    keputusanItem: normalizeExplicitItemDecision_(row.data['Keputusan Item']),
  };
}

function groupRowsByCleanValue_(rows, field) {
  const groups = {};
  rows.forEach(function (row) {
    const key = field === 'ID Pengajuan' ? normalizePengajuanId_(row.data[field]) : clean_(row.data[field]);
    if (!key) return;

    if (!groups[key]) groups[key] = [];
    groups[key].push(row);
  });
  return groups;
}

function uniqueCleanValues_(values) {
  const seen = {};
  const result = [];
  values.forEach(function (value) {
    const key = clean_(value);
    if (!key || seen[key]) return;

    seen[key] = true;
    result.push(key);
  });
  return result;
}

function normalizeAdminPengajuanPatch_(data) {
  const cleaned = {
    nama: clean_(data.nama),
    bagianCabang: clean_(data.bagianCabang),
    pemilik: clean_(data.pemilik),
    alasanPengajuan: clean_(data.alasanPengajuan),
    tanggalForm: clean_(data.tanggalForm),
    catatanTambahan: clean_(data.catatanTambahan),
  };

  ['nama', 'bagianCabang', 'pemilik', 'tanggalForm', 'alasanPengajuan'].forEach(function (field) {
    if (!cleaned[field]) throw new Error('Field wajib belum lengkap: ' + field);
  });

  const tanggal = new Date(cleaned.tanggalForm + 'T00:00:00');
  if (isNaN(tanggal.getTime())) throw new Error('Tanggal Form tidak valid');
  const maxDate = endOfDay_(new Date());
  maxDate.setDate(maxDate.getDate() + 7);
  if (tanggal > maxDate) throw new Error('Tanggal Form tidak boleh lebih dari 7 hari ke depan');
  cleaned.tanggalForm = formatDateOnly_(tanggal);

  return cleaned;
}

function normalizeRecoveredDraftInput_(data, items) {
  const cleaned = normalizeAdminPengajuanPatch_(data);
  cleaned.items = items.map(function (item, index) {
    const recoveredItem = {
      produk: clean_(item.produk),
      model: clean_(item.model),
      nomorSeri: clean_(item.nomorSeri),
      modelNormalized: clean_(item.modelNormalized) || normalizeModelKey_(item.model),
      produkStatus: clean_(item.produkStatus) || 'needs_review',
      produkSumber: clean_(item.produkSumber),
    };

    if (!recoveredItem.produk || !recoveredItem.model || !recoveredItem.nomorSeri) {
      throw new Error('PengajuanItems #' + (index + 1) + ' belum lengkap dan tidak bisa direcovery.');
    }

    return recoveredItem;
  });

  return cleaned;
}

function getChangedPengajuanAdminFields_(before, after) {
  const labels = {
    nama: 'Nama',
    bagianCabang: 'Bagian/Cabang',
    pemilik: 'Pemilik',
    alasanPengajuan: 'Alasan Pengajuan',
    tanggalForm: 'Tanggal Form',
    catatanTambahan: 'Catatan Tambahan',
  };

  return Object.keys(labels).filter(function (field) {
    return clean_(before[field]) !== clean_(after[field]);
  }).map(function (field) {
    return labels[field];
  });
}

function deleteRowsByColumnValue_(sheetName, header, value) {
  const sheet = getSheet_(sheetName);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return 0;

  const col = indexMap_(values[0]);
  if (col[header] === undefined) return 0;
  const normalizedValue = header === 'ID Pengajuan' ? normalizePengajuanId_(value) : '';

  let deleted = 0;
  for (let i = values.length - 1; i >= 1; i--) {
    const matches = header === 'ID Pengajuan'
      ? normalizePengajuanId_(values[i][col[header]]) === normalizedValue
      : values[i][col[header]] === value;
    if (!matches) continue;
    sheet.deleteRow(i + 1);
    deleted += 1;
  }

  return deleted;
}

function trashPengajuanFiles_(detail) {
  const id = clean_(detail && detail.idPengajuan);
  if (!id) return;

  const config = getConfig();
  const folderId = String(config.DRIVE_FOLDER_ID || APP.DRIVE_FOLDER_ID || '').trim();
  if (!folderId) return;

  const folder = DriveApp.getFolderById(folderId);
  trashFilesByName_(folder, buildArchiveFileName_(id, 'hardcopy', 0));
  for (let i = 1; i <= Number(detail.jumlahFileBukti || 0); i++) {
    trashFilesByName_(folder, buildArchiveFileName_(id, 'bukti', i));
  }
}

function trashFilesByName_(folder, fileName) {
  const files = folder.getFilesByName(fileName);
  while (files.hasNext()) {
    try {
      files.next().setTrashed(true);
    } catch (e) {}
  }
}

function derivePengajuanStatusFromItemDecisions_(decisions) {
  const cleanDecisions = decisions.map(function (decision) { return normalizeExplicitItemDecision_(decision); });
  if (!cleanDecisions.length) return 'Baru';
  if (cleanDecisions.indexOf('') !== -1) return 'Baru';
  if (cleanDecisions.every(function (decision) { return decision === 'Ditolak'; })) return 'Ditolak';
  if (cleanDecisions.some(function (decision) { return decision === 'Disetujui'; })) return 'Disetujui';
  return 'Baru';
}

function inferItemDecisionFromLegacyReview_(review, parentStatus) {
  const legacyReview = clean_(review);
  if (legacyReview === 'Ditolak') return 'Ditolak';
  if (legacyReview === 'Disetujui' || legacyReview === 'Selesai') return 'Disetujui';

  const parent = clean_(parentStatus);
  if (parent === 'Ditolak') return 'Ditolak';
  if (['Disetujui', 'Diprint', 'Dikirim', 'Selesai'].indexOf(parent) !== -1) return 'Disetujui';

  return '';
}

function normalizeExplicitItemDecision_(decision) {
  const cleanedDecision = clean_(decision);
  return ITEM_DECISION_STATUSES.indexOf(cleanedDecision) !== -1 ? cleanedDecision : '';
}

function shouldApplyItemDerivedParentStatus_(status) {
  return ['Baru', 'Disetujui', 'Ditolak'].indexOf(clean_(status)) !== -1;
}

function getLifecycleRank_(status) {
  return LIFECYCLE_ORDER.indexOf(clean_(status));
}

function isBackwardLifecycleTransition_(fromStatus, toStatus) {
  const fromRank = getLifecycleRank_(fromStatus);
  const toRank = getLifecycleRank_(toStatus);
  return fromRank !== -1 && toRank !== -1 && toRank < fromRank;
}

function assertStatusTransitionAllowed_(session, oldStatus, newStatus, catatanAdmin) {
  const statusLama = clean_(oldStatus);
  const statusBaru = clean_(newStatus);
  const note = clean_(catatanAdmin);
  if (VALID_STATUSES.indexOf(statusBaru) === -1) throw new Error('Status tidak valid');
  if (statusBaru === statusLama) return;

  if (statusBaru === 'Ditolak' && !note) {
    throw new Error('Catatan Admin wajib diisi jika status Ditolak');
  }

  if (isBackwardLifecycleTransition_(statusLama, statusBaru)) {
    if (session.role !== 'admin') throw new Error('Transisi status mundur hanya boleh dilakukan Admin');
    if (!note) throw new Error('Catatan Admin wajib diisi untuk transisi status mundur');
  }

  if (statusBaru === 'Selesai' && statusLama !== 'Dikirim') {
    if (session.role !== 'admin') throw new Error('Status Selesai hanya bisa dipilih setelah Dikirim');
    if (!note) throw new Error('Catatan Admin wajib diisi jika status Selesai dipilih bukan dari Dikirim');
  }
}

function appendStatusHistory_(sheet, rowNumber, col, id, statusLama, statusBaru, catatanAdmin, actor, noItem, now, historyPrefix) {
  const timestamp = now || new Date();
  const username = clean_(actor) || 'system';
  const note = clean_(catatanAdmin);
  const prefix = clean_(historyPrefix);
  const logNote = prefix && note ? prefix + ': ' + note : (note || prefix);

  sheet.getRange(rowNumber, col['Status'] + 1).setValue(statusBaru);
  sheet.getRange(rowNumber, col['Catatan Admin'] + 1).setValue(note);
  sheet.getRange(rowNumber, col['Tanggal Update Status Terakhir'] + 1).setValue(timestamp);
  sheet.getRange(rowNumber, col['User Update Status'] + 1).setValue(username);

  getSheet_(SHEETS.STATUS_LOG).appendRow([timestamp, id, statusLama, statusBaru, logNote, username, noItem || '']);
}

function getApprovedItemKeysForPengajuan_(idPengajuan) {
  const id = clean_(idPengajuan);
  if (!id) return [];

  return readObjects_(SHEETS.ITEMS)
    .filter(function (row) {
      return clean_(row['ID Pengajuan']) === id && normalizeExplicitItemDecision_(row['Keputusan Item']) === 'Disetujui';
    })
    .map(function (row) {
      return warrantyCardKey_(row['ID Pengajuan'], row['No Item']);
    });
}

function getApprovedItemKeysByPengajuan_() {
  const map = {};
  readObjects_(SHEETS.ITEMS).forEach(function (row) {
    const id = clean_(row['ID Pengajuan']);
    if (!id || normalizeExplicitItemDecision_(row['Keputusan Item']) !== 'Disetujui') return;
    if (!map[id]) map[id] = [];
    map[id].push(warrantyCardKey_(id, row['No Item']));
  });
  return map;
}

function summarizeWarrantyFulfillment_(approvedKeys, cardState) {
  const keys = Array.isArray(approvedKeys) ? approvedKeys : [];
  const state = {
    approvedCount: keys.length,
    printedCount: 0,
    shippedCount: 0,
    allPrinted: false,
    allShipped: false,
  };
  if (!keys.length) return state;

  keys.forEach(function (key) {
    const card = cardState.rows[key] ? cardState.rows[key].data : {};
    if (clean_(card['Status Cetak']) === 'Printed') state.printedCount += 1;
    if (clean_(card['Status Kirim']) === 'Dikirim') state.shippedCount += 1;
  });

  state.allPrinted = state.printedCount === state.approvedCount;
  state.allShipped = state.shippedCount === state.approvedCount;
  return state;
}

function getWarrantyFulfillmentState_(idPengajuan) {
  return summarizeWarrantyFulfillment_(
    getApprovedItemKeysForPengajuan_(idPengajuan),
    getItemLifecycleState_()
  );
}

function derivePengajuanLifecycleFromFulfillment_(idPengajuan, currentStatus) {
  const current = clean_(currentStatus);
  if (['Ditolak', 'Selesai'].indexOf(current) !== -1) return current;

  const state = getWarrantyFulfillmentState_(idPengajuan);
  if (!state.approvedCount) return current;

  let target = current;
  if (state.allShipped) target = 'Dikirim';
  else if (state.allPrinted) target = 'Diprint';

  const currentRank = getLifecycleRank_(current);
  const targetRank = getLifecycleRank_(target);
  if (currentRank !== -1 && targetRank !== -1 && currentRank > targetRank) return current;

  return target;
}

function syncPengajuanLifecycleFromItems_(idPengajuan, actor, note) {
  const id = clean_(idPengajuan);
  if (!id) return { changed: false, status: '' };

  const sheet = getSheet_(SHEETS.PENGAJUAN);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return { changed: false, status: '' };

  const col = indexMap_(values[0]);
  for (let i = 1; i < values.length; i++) {
    if (clean_(values[i][col['ID Pengajuan']]) !== id) continue;

    const currentStatus = clean_(values[i][col['Status']]);
    if (VALID_STATUSES.indexOf(currentStatus) === -1) return { changed: false, status: currentStatus };

    const targetStatus = derivePengajuanLifecycleFromFulfillment_(id, currentStatus);
    if (targetStatus === currentStatus) return { changed: false, status: currentStatus };

    appendStatusHistory_(
      sheet,
      i + 1,
      col,
      id,
      currentStatus,
      targetStatus,
      note || 'Sinkronisasi lifecycle dari PengajuanItems',
      actor || 'system',
      '',
      new Date(),
      'Auto lifecycle'
    );
    return { changed: true, status: targetStatus };
  }

  return { changed: false, status: '' };
}

function previewPengajuanLifecycleMigration() {
  return buildPengajuanLifecycleMigrationPreview_();
}

function migratePengajuanLifecycleFromItems() {
  return runPengajuanLifecycleMigration_('system:migration', 'Migrasi lifecycle dari PengajuanItems');
}

function handlePreviewPengajuanLifecycleMigration(data) {
  requireSession_(data.token, ['admin']);
  return { success: true, data: buildPengajuanLifecycleMigrationPreview_() };
}

function handleMigratePengajuanLifecycleFromItems(data) {
  const session = requireSession_(data.token, ['admin']);
  return { success: true, data: runPengajuanLifecycleMigration_(session.username, 'Migrasi lifecycle dari PengajuanItems') };
}

function previewItemDecisionBackfill() {
  return buildItemDecisionBackfillPreview_();
}

function backfillItemDecisions() {
  return runItemDecisionBackfill_('system:migration');
}

function handlePreviewItemDecisionBackfill(data) {
  requireSession_(data.token, ['admin']);
  return { success: true, data: buildItemDecisionBackfillPreview_() };
}

function handleBackfillItemDecisions(data) {
  const session = requireSession_(data.token, ['admin']);
  return { success: true, data: runItemDecisionBackfill_(session.username) };
}

function buildItemDecisionBackfillPreview_() {
  ensureRuntimeHeaders_();
  const changes = getItemDecisionBackfillChanges_();
  const summary = {
    totalItems: changes.totalItems,
    alreadySet: changes.alreadySet,
    willSet: changes.rows.length,
    willSetDisetujui: 0,
    willSetDitolak: 0,
    unresolved: changes.unresolved.length,
  };

  changes.rows.forEach(function (row) {
    if (row.keputusanItem === 'Disetujui') summary.willSetDisetujui += 1;
    else if (row.keputusanItem === 'Ditolak') summary.willSetDitolak += 1;
  });

  return {
    summary: summary,
    changes: changes.rows,
    unresolved: changes.unresolved,
  };
}

function runItemDecisionBackfill_(actor) {
  ensureRuntimeHeaders_();
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const changes = getItemDecisionBackfillChanges_();
    if (!changes.rows.length) {
      return { updated: 0, summary: buildItemDecisionBackfillPreview_().summary, changes: [] };
    }

    const sheet = getSheet_(SHEETS.ITEMS);
    const values = sheet.getDataRange().getValues();
    const col = indexMap_(values[0]);
    const decisionCol = col['Keputusan Item'];
    if (decisionCol === undefined) throw new Error('Kolom Keputusan Item belum tersedia. Jalankan setupApp atau panggil API sekali agar header dibuat.');

    const rowByKey = {};
    for (let i = 1; i < values.length; i++) {
      rowByKey[itemDecisionBackfillKey_(values[i][col['ID Pengajuan']], values[i][col['No Item']])] = i + 1;
    }

    changes.rows.forEach(function (change) {
      const rowNumber = rowByKey[itemDecisionBackfillKey_(change.idPengajuan, change.noItem)];
      if (!rowNumber) return;
      sheet.getRange(rowNumber, decisionCol + 1).setValue(change.keputusanItem);
    });

    return {
      updated: changes.rows.length,
      actor: clean_(actor) || 'system:migration',
      summary: buildItemDecisionBackfillPreview_().summary,
      changes: changes.rows,
    };
  } finally {
    lock.releaseLock();
  }
}

function getItemDecisionBackfillChanges_() {
  const parentById = {};
  readObjects_(SHEETS.PENGAJUAN).forEach(function (row) {
    const id = clean_(row['ID Pengajuan']);
    if (id) parentById[id] = row;
  });

  const rows = [];
  const unresolved = [];
  let totalItems = 0;
  let alreadySet = 0;

  readObjects_(SHEETS.ITEMS).forEach(function (item) {
    totalItems += 1;
    const id = clean_(item['ID Pengajuan']);
    const noItem = clean_(item['No Item']);
    const existingDecision = clean_(item['Keputusan Item']);
    if (ITEM_DECISION_STATUSES.indexOf(existingDecision) !== -1) {
      alreadySet += 1;
      return;
    }

    const parent = parentById[id] || {};
    const parentStatus = clean_(parent['Status']);
    const decision = inferItemDecisionFromLegacyReview_('', parentStatus);
    const preview = {
      idPengajuan: id,
      noItem: noItem,
      statusPengajuan: parentStatus,
      keputusanItem: decision,
    };

    if (decision) rows.push(preview);
    else unresolved.push(preview);
  });

  return {
    totalItems: totalItems,
    alreadySet: alreadySet,
    rows: rows,
    unresolved: unresolved,
  };
}

function itemDecisionBackfillKey_(idPengajuan, noItem) {
  return clean_(idPengajuan) + '::' + clean_(noItem);
}

function buildPengajuanLifecycleMigrationPreview_() {
  const changes = getPengajuanLifecycleMigrationChanges_();
  const summary = {
    eligible: changes.eligible,
    unchanged: changes.unchanged,
    willChange: changes.rows.length,
    toDisetujui: 0,
    toDiprint: 0,
    toDikirim: 0,
  };

  changes.rows.forEach(function (row) {
    if (row.targetStatus === 'Disetujui') summary.toDisetujui += 1;
    else if (row.targetStatus === 'Diprint') summary.toDiprint += 1;
    else if (row.targetStatus === 'Dikirim') summary.toDikirim += 1;
  });

  return {
    summary: summary,
    changes: changes.rows,
  };
}

function runPengajuanLifecycleMigration_(actor, note) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const changes = getPengajuanLifecycleMigrationChanges_();
    const sheet = getSheet_(SHEETS.PENGAJUAN);
    const values = sheet.getDataRange().getValues();
    if (values.length < 2) return { updated: 0, changes: [] };

    const col = indexMap_(values[0]);
    const rowById = {};
    for (let i = 1; i < values.length; i++) {
      rowById[clean_(values[i][col['ID Pengajuan']])] = i + 1;
    }

    const now = new Date();
    changes.rows.forEach(function (change) {
      const rowNumber = rowById[change.idPengajuan];
      if (!rowNumber) return;
      appendStatusHistory_(
        sheet,
        rowNumber,
        col,
        change.idPengajuan,
        change.currentStatus,
        change.targetStatus,
        note,
        actor || 'system:migration',
        '',
        now,
        'Migrasi lifecycle'
      );
    });

    return {
      updated: changes.rows.length,
      changes: changes.rows,
    };
  } finally {
    lock.releaseLock();
  }
}

function getPengajuanLifecycleMigrationChanges_() {
  const eligibleStatuses = ['Disetujui', 'Diprint', 'Dikirim'];
  const approvedById = getApprovedItemKeysByPengajuan_();
  const itemState = getItemLifecycleState_();
  const rows = [];
  let eligible = 0;
  let unchanged = 0;

  readObjects_(SHEETS.PENGAJUAN).forEach(function (row) {
    const id = clean_(row['ID Pengajuan']);
    const currentStatus = clean_(row['Status']);
    if (!id || eligibleStatuses.indexOf(currentStatus) === -1) return;

    eligible += 1;
    const approvedKeys = approvedById[id] || [];
    const state = summarizeWarrantyFulfillment_(approvedKeys, itemState);
    const targetStatus = deriveMigrationLifecycleTarget_(currentStatus, state);

    if (targetStatus === currentStatus) {
      unchanged += 1;
      return;
    }

    rows.push({
      idPengajuan: id,
      currentStatus: currentStatus,
      targetStatus: targetStatus,
      approvedCount: state.approvedCount,
      printedCount: state.printedCount,
      shippedCount: state.shippedCount,
    });
  });

  return {
    eligible: eligible,
    unchanged: unchanged,
    rows: rows,
  };
}

function deriveMigrationLifecycleTarget_(currentStatus, state) {
  if (!state || !state.approvedCount) return currentStatus;
  if (state.allShipped) return 'Dikirim';
  if (state.allPrinted) return 'Diprint';
  return 'Disetujui';
}

function handleGetProductReviewQueue(data) {
  requireSession_(data.token);
  const pengajuanMap = {};
  readObjects_(SHEETS.PENGAJUAN).forEach(function (row) {
    if (VALID_STATUSES.indexOf(row['Status']) !== -1) pengajuanMap[row['ID Pengajuan']] = row;
  });

  const groups = {};
  readObjects_(SHEETS.ITEMS).forEach(function (row) {
    const pengajuan = pengajuanMap[row['ID Pengajuan']];
    if (!pengajuan) return;
    const status = clean_(row['produk_status']);
    if (status === 'verified') return;
    const model = clean_(row['model_normalized']) || normalizeModelKey_(row['Model']);
    if (!model) return;
    if (!groups[model]) {
      groups[model] = {
        model: model,
        produk: clean_(row['Produk']),
        count: 0,
        items: [],
        produkOptions: {},
      };
    }
    const group = groups[model];
    const produk = clean_(row['Produk']);
    group.count += 1;
    if (produk) group.produkOptions[produk] = (group.produkOptions[produk] || 0) + 1;
    group.items.push({
      idPengajuan: row['ID Pengajuan'],
      noItem: row['No Item'],
      produk: produk,
      model: row['Model'],
      nomorSeri: row['Nomor Seri'],
      statusPengajuan: pengajuan['Status'],
      bagianCabang: pengajuan['Bagian/Cabang'],
    });
  });

  const rows = Object.keys(groups).map(function (key) {
    const group = groups[key];
    const options = Object.keys(group.produkOptions).sort(function (a, b) {
      return group.produkOptions[b] - group.produkOptions[a] || a.localeCompare(b);
    });
    if (!group.produk && options.length) group.produk = options[0];
    group.produkOptions = options.map(function (produk) {
      return { produk: produk, count: group.produkOptions[produk] };
    });
    return group;
  }).sort(function (a, b) {
    if (b.count !== a.count) return b.count - a.count;
    return a.model.localeCompare(b.model);
  });

  return { success: true, data: { rows: rows } };
}

function handleApproveModelProduk(data) {
  const session = requireSession_(data.token, ['admin', 'qrcc']);
  const model = normalizeModelKey_(data.model);
  const produk = clean_(data.produk || data.kategori);
  const hasOriginInput = data.origin !== undefined && data.origin !== null;
  const origin = hasOriginInput ? normalizeModelOrigin_(data.origin, false) : undefined;
  if (!model) throw new Error('Model wajib dipilih');
  if (!produk) throw new Error('Nama Produk wajib diisi');

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    upsertModelProduk_(model, produk, session.username, origin);
    const count = verifyPendingItemsByModel_(model, produk);
    CacheService.getScriptCache().remove('model_produk_map');
    return { success: true, data: { model: model, produk: produk, origin: origin || '', count: count } };
  } finally {
    lock.releaseLock();
  }
}

function handleGetWarrantyPrintQueue(data) {
  requireSession_(data.token, ['admin', 'qrcc']);
  const includePrinted = data.includePrinted === true || clean_(data.includePrinted).toLowerCase() === 'yes';
  const onlyUnsent = data.onlyUnsent === true || clean_(data.onlyUnsent).toLowerCase() === 'yes';
  const search = clean_(data.search).toLowerCase();
  const cardType = normalizeWarrantyCardType_(data.jenisKartu, false);
  const rows = getApprovedWarrantyQueueItems_().filter(function (item) {
    if (!includePrinted && item.statusCetak === 'Printed') return false;
    if (onlyUnsent && item.statusKirim !== 'Belum Dikirim') return false;
    if (cardType && item.jenisKartu !== cardType) return false;
    if (search) {
      const haystack = [
        item.idPengajuan,
        item.nama,
        item.bagianCabang,
        item.produk,
        item.model,
        item.nomorSeri,
      ].join(' ').toLowerCase();
      if (haystack.indexOf(search) === -1) return false;
    }
    return true;
  });

  rows.sort(function (a, b) {
    const typeOrder = { Local: 1, Import: 2, '': 3 };
    const aType = typeOrder[a.jenisKartu] || 3;
    const bType = typeOrder[b.jenisKartu] || 3;
    if (aType !== bType) return aType - bType;
    const aTime = new Date(a.timestampSubmit || 0).getTime();
    const bTime = new Date(b.timestampSubmit || 0).getTime();
    if (aTime !== bTime) return aTime - bTime;
    if (a.idPengajuan !== b.idPengajuan) return String(a.idPengajuan).localeCompare(String(b.idPengajuan));
    return Number(a.noItem) - Number(b.noItem);
  });

  const summary = { total: rows.length, local: 0, import: 0, belumJenisKartu: 0, printed: 0 };
  rows.forEach(function (item) {
    if (item.jenisKartu === 'Local') summary.local += 1;
    else if (item.jenisKartu === 'Import') summary.import += 1;
    else summary.belumJenisKartu += 1;
    if (item.statusCetak === 'Printed') summary.printed += 1;
  });

  return { success: true, data: { rows: rows, summary: summary } };
}

function handleGetPrintLayouts(data) {
  requireSession_(data.token, ['admin', 'qrcc']);
  ensurePrintLayoutDefaults_(getSheet_(SHEETS.CONFIG));
  return { success: true, data: getPrintLayoutState_() };
}

function handleSavePrintLayout(data) {
  const session = requireSession_(data.token, ['admin', 'qrcc']);
  const cleaned = normalizePrintLayoutInput_(data.layout || data, true);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    ensurePrintLayoutDefaults_(getSheet_(SHEETS.CONFIG));
    const sheet = getSheet_(SHEETS.PRINT_LAYOUTS);
    const values = sheet.getDataRange().getValues();
    const headers = values[0] || HEADERS[SHEETS.PRINT_LAYOUTS];
    const col = indexMap_(headers);
    const now = new Date();
    let targetRow = -1;
    let existing = null;
    if (cleaned.id) {
      for (let i = 1; i < values.length; i++) {
        if (clean_(values[i][col.ID]) === cleaned.id) {
          targetRow = i + 1;
          existing = values[i];
          break;
        }
      }
    }
    const id = cleaned.id || generatePrintLayoutId_(cleaned.type);
    const isBuiltin = existing ? parseBoolean_(existing[col['Is Builtin']]) : false;
    const createdAt = existing ? existing[col['Created At']] : now;
    const row = [
      id,
      cleaned.type,
      cleaned.name,
      cleaned.offsetX,
      cleaned.offsetY,
      cleaned.gapProductModel,
      cleaned.gapModelSerial,
      isBuiltin ? 'TRUE' : 'FALSE',
      createdAt,
      now,
      session.username,
    ];
    if (targetRow > -1) sheet.getRange(targetRow, 1, 1, row.length).setValues([row]);
    else sheet.appendRow(row);
    const state = getPrintLayoutState_();
    state.savedLayoutId = id;
    return { success: true, data: state };
  } finally {
    lock.releaseLock();
  }
}

function handleDeletePrintLayout(data) {
  requireSession_(data.token, ['admin', 'qrcc']);
  const id = clean_(data.id || data.layoutId);
  if (!id) throw new Error('Layout wajib dipilih');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    ensurePrintLayoutDefaults_(getSheet_(SHEETS.CONFIG));
    const state = getPrintLayoutState_();
    const layout = state.layouts.find(function (item) { return item.id === id; });
    if (!layout) throw new Error('Layout tidak ditemukan');
    if (layout.isBuiltin) throw new Error('Layout bawaan tidak boleh dihapus');
    if (state.active[layout.type] === id) throw new Error('Pilih layout aktif lain sebelum menghapus layout ini');

    const sheet = getSheet_(SHEETS.PRINT_LAYOUTS);
    const values = sheet.getDataRange().getValues();
    const col = indexMap_(values[0]);
    for (let i = 1; i < values.length; i++) {
      if (clean_(values[i][col.ID]) === id) {
        sheet.deleteRow(i + 1);
        break;
      }
    }
    return { success: true, data: getPrintLayoutState_() };
  } finally {
    lock.releaseLock();
  }
}

function handleSetActivePrintLayout(data) {
  const session = requireSession_(data.token, ['admin', 'qrcc']);
  const type = normalizePrintLayoutType_(data.type, true);
  const id = clean_(data.id || data.layoutId);
  if (!id) throw new Error('Layout wajib dipilih');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    ensurePrintLayoutDefaults_(getSheet_(SHEETS.CONFIG));
    const state = getPrintLayoutState_();
    const layout = state.layouts.find(function (item) { return item.id === id && item.type === type; });
    if (!layout) throw new Error('Layout tidak ditemukan untuk jenis kartu ini');
    upsertConfig_(getSheet_(SHEETS.CONFIG), ACTIVE_PRINT_LAYOUT_KEYS[type], id, true);
    return { success: true, data: getPrintLayoutState_(), updatedBy: session.username };
  } finally {
    lock.releaseLock();
  }
}

function handleSaveWarrantyCardTypes(data) {
  const session = requireSession_(data.token, ['admin', 'qrcc']);
  const items = Array.isArray(data.items) ? data.items : [];
  if (!items.length) throw new Error('Pilih item terlebih dahulu');

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const approvedMap = mapByWarrantyKey_(getApprovedWarrantyQueueItems_());
    const state = getItemLifecycleState_();
    let originUpdated = false;
    items.forEach(function (input) {
      const id = clean_(input.idPengajuan);
      const noItem = clean_(input.noItem);
      const jenisKartu = normalizeWarrantyCardType_(input.jenisKartu, true);
      const key = warrantyCardKey_(id, noItem);
      const item = approvedMap[key];
      if (!item) throw new Error('Item tidak ditemukan atau belum berstatus Disetujui: ' + id + ' #' + noItem);

      const existing = state.rows[key] ? state.rows[key].data : {};
      updateItemLifecycleRow_(state, key, {
        'Jenis Kartu': jenisKartu,
        'Status Cetak': clean_(existing['Status Cetak']) || 'Belum Dicetak',
        'Status Kirim': clean_(existing['Status Kirim']) || 'Belum Dikirim',
      });
      originUpdated = updateModelProdukOriginIfMissing_(item.model, jenisKartu, session.username) || originUpdated;
    });

    const cache = CacheService.getScriptCache();
    if (originUpdated) cache.remove('model_produk_map');
    return { success: true, data: { count: items.length } };
  } finally {
    lock.releaseLock();
  }
}

function handleMarkWarrantyItemsPrinted(data) {
  const session = requireSession_(data.token, ['admin', 'qrcc']);
  const inputs = Array.isArray(data.items) ? data.items : [];
  const catatan = clean_(data.catatan);
  if (!inputs.length) throw new Error('Pilih item yang sudah dicetak');

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const approvedMap = mapByWarrantyKey_(getApprovedWarrantyQueueItems_());
    const state = getItemLifecycleState_();
    const now = new Date();
    const batchId = generatePrintBatchId_('KG');
    const touchedPengajuanIds = {};

    inputs.forEach(function (input) {
      const id = clean_(input.idPengajuan);
      const noItem = clean_(input.noItem);
      const key = warrantyCardKey_(id, noItem);
      const item = approvedMap[key];
      if (!item) throw new Error('Item tidak ditemukan atau belum berstatus Disetujui: ' + id + ' #' + noItem);
      touchedPengajuanIds[id] = true;

      const existing = state.rows[key] ? state.rows[key].data : {};
      const jenisKartu = normalizeWarrantyCardType_(input.jenisKartu || existing['Jenis Kartu'], true);
      updateItemLifecycleRow_(state, key, {
        'Jenis Kartu': jenisKartu,
        'Status Cetak': 'Printed',
        'Print Batch ID': batchId,
        'Printed At': now,
        'Status Kirim': clean_(existing['Status Kirim']) || 'Belum Dikirim',
      });
    });

    getSheet_(SHEETS.PRINT_BATCH).appendRow([batchId, 'warranty_card', now, session.username, inputs.length, catatan]);
    Object.keys(touchedPengajuanIds).forEach(function (idPengajuan) {
      syncPengajuanLifecycleFromItems_(idPengajuan, session.username, catatan || 'Sinkronisasi setelah tandai printed');
    });
    return { success: true, data: { batchId: batchId, count: inputs.length } };
  } finally {
    lock.releaseLock();
  }
}

function handleMarkWarrantyItemsShipped(data) {
  const session = requireSession_(data.token, ['admin', 'qrcc']);
  const inputs = Array.isArray(data.items) ? data.items : [];
  if (!inputs.length) throw new Error('Pilih item yang akan ditandai dikirim');

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const state = getItemLifecycleState_();
    const now = new Date();
    const batchId = generatePrintBatchId_('KIRIM');
    const touchedPengajuanIds = {};

    inputs.forEach(function (input) {
      const id = clean_(input.idPengajuan);
      const noItem = clean_(input.noItem);
      const key = warrantyCardKey_(id, noItem);
      const existing = state.rows[key] ? state.rows[key].data : null;
      if (!existing) throw new Error('Item tidak ditemukan: ' + id + ' #' + noItem);
      if (clean_(existing['Status Cetak']) !== 'Printed') throw new Error('Item belum berstatus Printed: ' + id + ' #' + noItem);
      touchedPengajuanIds[id] = true;

      updateItemLifecycleRow_(state, key, {
        'Status Kirim': 'Dikirim',
        'Ship Batch ID': batchId,
        'Shipped At': now,
      });
    });

    getSheet_(SHEETS.PRINT_BATCH).appendRow([batchId, 'shipping_label', now, session.username, inputs.length, '']);
    Object.keys(touchedPengajuanIds).forEach(function (idPengajuan) {
      syncPengajuanLifecycleFromItems_(idPengajuan, session.username, 'Sinkronisasi setelah tandai dikirim');
    });
    return { success: true, data: { batchId: batchId, count: inputs.length } };
  } finally {
    lock.releaseLock();
  }
}

function listToObject_(headers, row) {
  const obj = {};
  headers.forEach(function (header, index) { obj[header] = row[index]; });
  return obj;
}

function handleGetShippingLabelQueue(data) {
  requireSession_(data.token, ['admin', 'qrcc']);
  const statusKirim = clean_(data.statusKirim);
  const shipBatchId = clean_(data.shipBatchId);

  const rows = getApprovedWarrantyQueueItems_().filter(function (item) {
    if (item.statusCetak !== 'Printed') return false;
    if (statusKirim && item.statusKirim !== statusKirim) return false;
    if (shipBatchId && item.shipBatchId !== shipBatchId) return false;
    return true;
  }).map(function (item) {
    return {
      key: item.key,
      idPengajuan: clean_(item.idPengajuan),
      noItem: clean_(item.noItem),
      produk: clean_(item.produk),
      model: clean_(item.model),
      nomorSeri: clean_(item.nomorSeri),
      bagianCabang: clean_(item.bagianCabang),
      nama: clean_(item.nama),
      printBatchId: clean_(item.printBatchId),
      printedAt: item.printedAt,
      statusKirim: item.statusKirim,
      shipBatchId: clean_(item.shipBatchId),
      shippedAt: item.shippedAt,
      createdAt: item.printedAt,
      updatedAt: item.shippedAt || item.printedAt,
    };
  }).sort(function (a, b) {
    const at = new Date(a.createdAt || 0).getTime();
    const bt = new Date(b.createdAt || 0).getTime();
    return bt - at;
  });

  return { success: true, data: { rows: rows, total: rows.length } };
}

function sendEmailDigest() {
  const config = getConfig();
  const appName = config.APP_NAME || APP.APP_NAME;
  const recipients = readObjects_(SHEETS.RECIPIENTS)
    .filter(function (row) { return clean_(row['Aktif']).toLowerCase() === 'yes' && clean_(row['Email']); })
    .map(function (row) { return clean_(row['Email']); });
  const subject = '[' + appName + '] Reminder pengajuan baru';

  if (!recipients.length) {
    getSheet_(SHEETS.EMAIL_LOG).appendRow([new Date(), subject, '', 0, 'Tidak ada penerima aktif']);
    return;
  }

  const rows = readObjects_(SHEETS.PENGAJUAN)
    .filter(function (row) { return clean_(row['Status']) === 'Baru'; });
  const count = rows.length;

  if (!count) {
    getSheet_(SHEETS.EMAIL_LOG).appendRow([new Date(), subject, recipients.join(', '), 0, 'Tidak ada pengajuan status Baru']);
    return;
  }

  const sendSubject = '[' + appName + '] ' + count + ' pengajuan baru perlu diproses';
  const htmlBody = buildDigestHtml_(count, config);
  MailApp.sendEmail({ to: recipients.join(','), subject: sendSubject, htmlBody: htmlBody });
  upsertConfig_(getSheet_(SHEETS.CONFIG), 'LAST_EMAIL_SENT_AT', new Date(), true);
  getSheet_(SHEETS.EMAIL_LOG).appendRow([new Date(), sendSubject, recipients.join(', '), count, 'Terkirim']);
}

function ensureRuntimeHeaders_() {
  ensureAllSheets_(getSpreadsheet_());
}

function getSpreadsheet_() {
  if (APP.SPREADSHEET_ID) return SpreadsheetApp.openById(APP.SPREADSHEET_ID);
  const props = PropertiesService.getScriptProperties();
  const storedId = props.getProperty('SPREADSHEET_ID');
  if (storedId) return SpreadsheetApp.openById(storedId);
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) {
    props.setProperty('SPREADSHEET_ID', active.getId());
    return active;
  }
  const created = SpreadsheetApp.create(APP.APP_NAME + ' Data');
  props.setProperty('SPREADSHEET_ID', created.getId());
  return created;
}

function getSheet_(name) {
  const sheet = getSpreadsheet_().getSheetByName(name);
  if (!sheet) throw new Error('Sheet ' + name + ' belum ada. Jalankan setupApp() terlebih dahulu.');
  return sheet;
}

function ensureAllSheets_(ss) {
  Object.keys(HEADERS).forEach(function (name) {
    if (name === SHEETS.PENGAJUAN) {
      ensurePengajuanSheet_(ss);
      return;
    }
    if (name === SHEETS.MODEL_PRODUK) {
      ensureModelProdukSheet_(ss);
      return;
    }
    if (name === SHEETS.ITEMS) {
      ensureItemsSheet_(ss);
      return;
    }
    ensureSheet_(ss, name, HEADERS[name]);
  });
}

function ensurePengajuanSheet_(ss) {
  const headers = HEADERS[SHEETS.PENGAJUAN];
  const sheet = ss.getSheetByName(SHEETS.PENGAJUAN) || ss.insertSheet(SHEETS.PENGAJUAN);
  if (!sheet.getLastRow()) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return sheet;
  }

  const existing = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length)).getValues()[0];
  const isCurrent = headers.every(function (header, index) { return existing[index] === header; }) &&
    existing.slice(headers.length).every(function (header) { return !header; });
  if (isCurrent) {
    sheet.setFrozenRows(1);
    return sheet;
  }

  const values = sheet.getDataRange().getValues();
  const oldHeaders = values[0] || [];
  const rows = [];

  for (let i = 1; i < values.length; i++) {
    const source = {};
    oldHeaders.forEach(function (header, index) {
      if (header) source[header] = values[i][index];
    });
    if (!values[i].some(function (cell) { return cell !== ''; })) continue;

    const evidenceCount = Number(source['Jumlah File Bukti'] || 0);

    rows.push([
      source['ID Pengajuan'] || '',
      source['Timestamp Submit'] || '',
      source['Nama'] || '',
      source['Bagian/Cabang'] || '',
      source['Pemilik'] || '',
      source['Alasan Pengajuan'] || '',
      source['Tanggal Form'] || '',
      source['Catatan Tambahan'] || '',
      source['Jumlah Item'] || '',
      evidenceCount,
      source['Status'] || '',
      source['Catatan Admin'] || '',
      source['Tanggal Update Status Terakhir'] || '',
      source['User Update Status'] || '',
      source['Resume Token'] || '',
      source['Draft Created At'] || '',
      source['Draft Updated At'] || '',
      source['Submitted At'] || '',
    ]);
  }

  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (rows.length) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
  sheet.setFrozenRows(1);
  return sheet;
}

function ensureItemsSheet_(ss) {
  const headers = HEADERS[SHEETS.ITEMS];
  const sheet = ss.getSheetByName(SHEETS.ITEMS) || ss.insertSheet(SHEETS.ITEMS);
  if (!sheet.getLastRow()) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return sheet;
  }

  const existing = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length)).getValues()[0];
  const isCurrent = headers.every(function (header, index) { return existing[index] === header; }) &&
    existing.slice(headers.length).every(function (header) { return !header; });
  if (isCurrent) {
    sheet.setFrozenRows(1);
    return sheet;
  }

  const parentStatusById = getParentStatusByIdFromSheet_(ss);
  const values = sheet.getDataRange().getValues();
  const oldHeaders = values[0] || [];
  const rows = [];

  for (let i = 1; i < values.length; i++) {
    const source = {};
    oldHeaders.forEach(function (header, index) {
      if (header) source[header] = values[i][index];
    });
    if (!values[i].some(function (cell) { return cell !== ''; })) continue;

    const id = clean_(source['ID Pengajuan']);
    const decision = normalizeExplicitItemDecision_(source['Keputusan Item']) ||
      inferItemDecisionFromLegacyReview_(source[LEGACY_ITEM_REVIEW_HEADER], parentStatusById[id]);

    rows.push([
      source['ID Pengajuan'] || '',
      source['No Item'] || '',
      source['Produk'] || '',
      source['Model'] || '',
      source['Nomor Seri'] || '',
      decision,
      source['Catatan Admin Item'] || '',
      source['Jenis Kartu'] || '',
      source['Status Cetak'] || 'Belum Dicetak',
      source['Print Batch ID'] || '',
      source['Printed At'] || '',
      source['Status Kirim'] || 'Belum Dikirim',
      source['Ship Batch ID'] || '',
      source['Shipped At'] || '',
      source['model_normalized'] || '',
      source['produk_status'] || '',
      source['produk_sumber'] || '',
      source['Tanggal Update Keputusan Item'] || source[LEGACY_ITEM_REVIEW_UPDATED_AT_HEADER] || '',
      source['User Update Keputusan Item'] || source[LEGACY_ITEM_REVIEW_UPDATED_BY_HEADER] || '',
    ]);
  }

  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (rows.length) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
  sheet.setFrozenRows(1);
  return sheet;
}

function getParentStatusByIdFromSheet_(ss) {
  const sheet = ss.getSheetByName(SHEETS.PENGAJUAN);
  if (!sheet || sheet.getLastRow() < 2) return {};

  const values = sheet.getDataRange().getValues();
  const col = indexMap_(values[0] || []);
  if (col['ID Pengajuan'] === undefined || col['Status'] === undefined) return {};

  const map = {};
  for (let i = 1; i < values.length; i++) {
    const id = clean_(values[i][col['ID Pengajuan']]);
    if (id) map[id] = values[i][col['Status']];
  }
  return map;
}

function ensureModelProdukSheet_(ss) {
  const headers = HEADERS[SHEETS.MODEL_PRODUK];
  const sheet = ss.getSheetByName(SHEETS.MODEL_PRODUK) || ss.insertSheet(SHEETS.MODEL_PRODUK);
  if (!sheet.getLastRow()) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return sheet;
  }

  const existing = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length)).getValues()[0];
  const isCurrent = headers.every(function (header, index) { return existing[index] === header; }) &&
    existing.slice(headers.length).every(function (header) { return !header; });
  if (isCurrent) {
    sheet.setFrozenRows(1);
    return sheet;
  }

  const values = sheet.getDataRange().getValues();
  const oldHeaders = values[0] || [];
  const rowsByModel = {};
  for (let i = 1; i < values.length; i++) {
    const source = {};
    oldHeaders.forEach(function (header, index) {
      if (header) source[header] = values[i][index];
    });

    const row = normalizeModelProdukObject_(source);
    if (!row.model || !row.produk) continue;
    rowsByModel[row.model] = [
      row.model,
      row.produk,
      row.origin,
      row.status,
      row.updatedAt,
      row.updatedBy,
    ];
  }

  const rows = Object.keys(rowsByModel).sort().map(function (model) { return rowsByModel[model]; });
  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (rows.length) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
  sheet.setFrozenRows(1);
  return sheet;
}

function ensureSheet_(ss, name, headers) {
  const sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  if (!sheet.getLastRow()) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return sheet;
  }

  const existing = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length)).getValues()[0];
  const needsHeader = headers.some(function (header, index) { return existing[index] !== header; });
  if (needsHeader) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  sheet.setFrozenRows(1);
  return sheet;
}

function upsertConfig_(sheet, key, value, overwrite) {
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim() === key) {
      if (overwrite || values[i][1] === '') sheet.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  sheet.appendRow([key, value]);
}

function ensureEmailDigestTrigger_() {
  const triggers = ScriptApp.getProjectTriggers();
  const exists = triggers.some(function (trigger) { return trigger.getHandlerFunction() === 'sendEmailDigest'; });
  if (!exists) {
    ScriptApp.newTrigger('sendEmailDigest').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(9).create();
    ScriptApp.newTrigger('sendEmailDigest').timeBased().onWeekDay(ScriptApp.WeekDay.THURSDAY).atHour(9).create();
  }
}

function parseRequest_(e) {
  if (e && e.postData && e.postData.contents) {
    try { return JSON.parse(e.postData.contents); }
    catch (err) { throw new Error('Body request tidak valid (bukan JSON).'); }
  }
  const data = {};
  if (e && e.parameter) Object.keys(e.parameter).forEach(function (key) { data[key] = e.parameter[key]; });
  return data;
}

function jsonResponse_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function normalizeModelKey_(value) {
  return clean_(value).replace(/\s+/g, ' ').toUpperCase();
}

function normalizeModelOrigin_(value, required) {
  const raw = clean_(value).toLowerCase();
  if (!raw) {
    if (required) throw new Error('Origin wajib dipilih');
    return '';
  }
  if (raw === 'local' || raw === 'lokal') return 'local';
  if (raw === 'import' || raw === 'impor') return 'import';
  throw new Error('Origin tidak valid: ' + value);
}

function normalizeModelProdukObject_(row) {
  const model = normalizeModelKey_(row.model || row['model_normalized']);
  let produk = clean_(row.produk);
  const origin = normalizeModelOrigin_(row.origin || row.Origin || row['Jenis Kartu'], false);
  let status = clean_(row.status) || 'verified';
  let updatedAt = row.updated_at || '';
  const updatedBy = clean_(row.updated_by);

  if (status !== 'verified' && clean_(row.updated_at) === 'verified') {
    produk = status;
    status = 'verified';
    updatedAt = '';
  }

  return {
    model: model,
    produk: produk,
    origin: origin,
    status: status,
    updatedAt: updatedAt,
    updatedBy: updatedBy,
  };
}

function getModelProdukRows_() {
  return readObjects_(SHEETS.MODEL_PRODUK)
    .map(normalizeModelProdukObject_)
    .filter(function (row) {
      return row.model && row.produk && row.status === 'verified';
    });
}

function getModelProdukMap_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('model_produk_map');
  if (cached) {
    try { return JSON.parse(cached); } catch (e) {}
  }
  const map = {};
  getModelProdukRows_().forEach(function (row) {
    map[row.model] = row;
  });
  cache.put('model_produk_map', JSON.stringify(map), 60);
  return map;
}

function resolveItemProduk_(item, modelMap) {
  const modelNormalized = normalizeModelKey_(item.model);
  const master = modelMap[modelNormalized];
  if (master) {
    return Object.assign({}, item, {
      produk: master.produk,
      modelNormalized: modelNormalized,
      produkStatus: 'verified',
      produkSumber: 'auto',
    });
  }
  return Object.assign({}, item, {
    modelNormalized: modelNormalized,
    produkStatus: 'needs_review',
    produkSumber: 'manual',
  });
}

function upsertModelProduk_(model, produk, username, origin) {
  const sheet = getSheet_(SHEETS.MODEL_PRODUK);
  const values = sheet.getDataRange().getValues();
  const headers = values[0] || HEADERS[SHEETS.MODEL_PRODUK];
  const col = indexMap_(headers);
  const now = new Date();
  const hasOriginInput = origin !== undefined && origin !== null;
  const normalizedOrigin = hasOriginInput ? normalizeModelOrigin_(origin, false) : '';
  for (let i = 1; i < values.length; i++) {
    if (normalizeModelKey_(values[i][col.model]) === model) {
      const row = values[i].slice(0, headers.length);
      row[col.model] = model;
      row[col.produk] = produk;
      if (hasOriginInput) row[col.origin] = normalizedOrigin;
      row[col.status] = 'verified';
      row[col.updated_at] = now;
      row[col.updated_by] = username;
      sheet.getRange(i + 1, 1, 1, headers.length).setValues([row]);
      return;
    }
  }
  sheet.appendRow([model, produk, normalizedOrigin, 'verified', now, username]);
}

function updateModelProdukOriginIfMissing_(model, origin, username) {
  const normalizedModel = normalizeModelKey_(model);
  const normalizedOrigin = normalizeModelOrigin_(origin, false);
  if (!normalizedModel || !normalizedOrigin) return false;

  const sheet = getSheet_(SHEETS.MODEL_PRODUK);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return false;

  const headers = values[0] || HEADERS[SHEETS.MODEL_PRODUK];
  const col = indexMap_(headers);
  if (col.origin == null) return false;

  for (let i = 1; i < values.length; i++) {
    if (normalizeModelKey_(values[i][col.model]) !== normalizedModel) continue;
    if (clean_(values[i][col.origin])) return false;

    const row = values[i].slice(0, headers.length);
    row[col.origin] = normalizedOrigin;
    row[col.updated_at] = new Date();
    row[col.updated_by] = username;
    sheet.getRange(i + 1, 1, 1, headers.length).setValues([row]);
    return true;
  }

  return false;
}

function verifyPendingItemsByModel_(model, produk) {
  const sheet = getSheet_(SHEETS.ITEMS);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return 0;
  const col = indexMap_(values[0]);
  let count = 0;
  for (let i = 1; i < values.length; i++) {
    const rowModelNormalized = clean_(values[i][col['model_normalized']]) || normalizeModelKey_(values[i][col['Model']]);
    if (rowModelNormalized !== model) continue;
    if (clean_(values[i][col['produk_status']]) === 'verified') continue;
    values[i][col['Produk']] = produk;
    values[i][col['model_normalized']] = model;
    values[i][col['produk_status']] = 'verified';
    values[i][col['produk_sumber']] = 'admin';
    count += 1;
  }
  if (count) {
    sheet.getRange(2, 1, values.length - 1, values[0].length).setValues(values.slice(1));
  }
  return count;
}

function normalizeSubmission_(data, config, includeFile) {
  const cleaned = {
    nama: clean_(data.nama),
    bagianCabang: clean_(data.bagianCabang),
    pemilik: clean_(data.pemilik),
    tanggalForm: clean_(data.tanggalForm),
    alasanPengajuan: clean_(data.alasanPengajuan),
    catatanTambahan: clean_(data.catatanTambahan),
    items: Array.isArray(data.items) ? data.items : [],
    fileBase64: clean_(data.fileBase64),
    fileExtension: clean_(data.fileExtension).toLowerCase().replace(/^\./, ''),
    fileMimeType: clean_(data.fileMimeType).toLowerCase(),
    evidenceAttachments: normalizeEvidenceAttachments_(data.evidenceAttachments, config),
  };
  ['nama', 'bagianCabang', 'pemilik', 'tanggalForm', 'alasanPengajuan'].forEach(function (field) {
    if (!cleaned[field]) throw new Error('Field wajib belum lengkap: ' + field);
  });

  const tanggal = new Date(cleaned.tanggalForm + 'T00:00:00');
  if (isNaN(tanggal.getTime())) throw new Error('Tanggal Form tidak valid');
  const maxDate = endOfDay_(new Date());
  maxDate.setDate(maxDate.getDate() + 7);
  if (tanggal > maxDate) throw new Error('Tanggal Form tidak boleh lebih dari 7 hari ke depan');

  const maxItems = Number(config.MAX_ITEMS || APP.MAX_ITEMS);
  if (!cleaned.items.length) throw new Error('Minimal 1 item produk wajib diisi');
  if (cleaned.items.length > maxItems) throw new Error('Jumlah item maksimal ' + maxItems);
  const modelMap = getModelProdukMap_();
  cleaned.items = cleaned.items.map(function (item, index) {
    const normalized = { produk: clean_(item.produk), model: clean_(item.model), nomorSeri: clean_(item.nomorSeri) };
    if (!normalized.produk || !normalized.model || !normalized.nomorSeri) throw new Error('Item #' + (index + 1) + ' belum lengkap');
    return resolveItemProduk_(normalized, modelMap);
  });

  if (includeFile) {
    if (!cleaned.fileBase64) throw new Error('File hard copy wajib dilampirkan');
    if (VALID_EXTENSIONS.indexOf(cleaned.fileExtension) === -1) throw new Error('Format file tidak valid');
    if (VALID_MIME_TYPES.indexOf(cleaned.fileMimeType) === -1) throw new Error('MIME type file tidak valid');
    const approxBytes = Math.ceil((cleaned.fileBase64.length * 3) / 4);
    const maxBytes = Number(config.MAX_UPLOAD_MB || APP.MAX_UPLOAD_MB) * 1024 * 1024;
    if (approxBytes > maxBytes) throw new Error('Ukuran file melebihi ' + (config.MAX_UPLOAD_MB || APP.MAX_UPLOAD_MB) + 'MB');
  }
  return cleaned;
}

function assertNoDuplicateModelSerial_(items, currentId) {
  const current = clean_(currentId);
  const requested = {};
  const requestedLabels = {};

  (items || []).forEach(function (item, index) {
    const key = buildModelSerialDuplicateKey_(item.model, item.nomorSeri);
    if (!key) return;

    if (requested[key]) {
      throw new Error('Model dan nomor seri sudah diinput lebih dari sekali: ' + requestedLabels[key] + ' sama dengan item #' + (index + 1) + '.');
    }

    requested[key] = true;
    requestedLabels[key] = formatModelSerialLabel_(item.model, item.nomorSeri);
  });

  const keys = Object.keys(requested);
  if (!keys.length) return;

  const keyMap = {};
  keys.forEach(function (key) { keyMap[key] = true; });

  const sheet = getSheet_(SHEETS.ITEMS);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return;

  const col = indexMap_(values[0]);
  for (let i = 1; i < values.length; i++) {
    const existingId = clean_(values[i][col['ID Pengajuan']]);
    if (current && existingId === current) continue;

    const key = buildModelSerialDuplicateKey_(values[i][col['Model']], values[i][col['Nomor Seri']]);
    if (!keyMap[key]) continue;

    throw new Error(
      'Model dan nomor seri sudah pernah diajukan di ID Pengajuan ' + existingId + ': ' + requestedLabels[key] + '. Gunakan data lain atau cek pengajuan yang sudah ada.'
    );
  }
}

function buildModelSerialDuplicateKey_(model, nomorSeri) {
  const normalizedModel = normalizeModelKey_(model);
  const normalizedSerial = clean_(nomorSeri).replace(/\s+/g, ' ').toUpperCase();
  return normalizedModel && normalizedSerial ? normalizedModel + '|' + normalizedSerial : '';
}

function formatModelSerialLabel_(model, nomorSeri) {
  return clean_(model) + ' / ' + clean_(nomorSeri);
}

function normalizeEvidenceAttachments_(attachments, config) {
  if (!Array.isArray(attachments)) return [];

  const maxFiles = Number(config.MAX_EVIDENCE_FILES || APP.MAX_EVIDENCE_FILES);
  if (attachments.length > maxFiles) throw new Error('Jumlah lampiran foto bukti maksimal ' + maxFiles);

  const maxBytes = Number(config.MAX_EVIDENCE_UPLOAD_MB || APP.MAX_EVIDENCE_UPLOAD_MB) * 1024 * 1024;

  return attachments.map(function (rawAttachment, index) {
    const attachment = rawAttachment || {};
    const fileName = clean_(attachment.fileName || attachment.name || ('foto-bukti-' + (index + 1)));
    const extensionFromName = clean_(fileName).split('.').pop();
    const fileExtension = clean_(attachment.fileExtension || extensionFromName).toLowerCase().replace(/^\./, '');
    const fileMimeType = clean_(attachment.fileMimeType || attachment.mimeType).toLowerCase();
    const fileBase64 = clean_(attachment.fileBase64 || attachment.base64);

    if (!fileBase64) throw new Error('Lampiran foto bukti #' + (index + 1) + ' belum lengkap');
    if (VALID_EVIDENCE_EXTENSIONS.indexOf(fileExtension) === -1) throw new Error('Format lampiran foto bukti harus JPG/JPEG');
    if (VALID_EVIDENCE_MIME_TYPES.indexOf(fileMimeType) === -1) throw new Error('MIME type lampiran foto bukti tidak valid');

    const approxBytes = Math.ceil((fileBase64.length * 3) / 4);
    if (approxBytes > maxBytes) throw new Error('Ukuran lampiran foto bukti #' + (index + 1) + ' melebihi ' + (config.MAX_EVIDENCE_UPLOAD_MB || APP.MAX_EVIDENCE_UPLOAD_MB) + 'MB');

    return {
      fileName: fileName,
      fileBase64: fileBase64,
      fileExtension: fileExtension,
      fileMimeType: fileMimeType,
    };
  });
}

function createHardcopyFile_(folder, id, cleaned) {
  const name = buildArchiveFileName_(id, 'hardcopy', 0);
  trashFilesByName_(folder, name);

  const bytes = Utilities.base64Decode(cleaned.fileBase64);
  const blob = Utilities.newBlob(bytes, cleaned.fileMimeType, name);
  const file = folder.createFile(blob);
  file.setName(name);
  return file;
}

function createEvidenceFiles_(folder, id, attachments) {
  (attachments || []).forEach(function (attachment, index) {
    const name = buildArchiveFileName_(id, 'bukti', index + 1);
    trashFilesByName_(folder, name);

    const bytes = Utilities.base64Decode(attachment.fileBase64);
    const blob = Utilities.newBlob(bytes, attachment.fileMimeType, name);
    const file = folder.createFile(blob);
    file.setName(name);
  });

  return { count: (attachments || []).length };
}

function buildArchiveFileName_(id, type, index) {
  if (type === 'hardcopy') return clean_(id) + '_hardcopy.pdf';
  return clean_(id) + '_bukti_' + String(index).padStart(2, '0') + '.jpg';
}

function buildArchiveFilePath_(id, type, index) {
  return '/arsip_file/' + buildArchiveFileName_(id, type, index);
}

function buildEvidenceArchivePaths_(id, count) {
  const paths = [];
  for (let i = 1; i <= Number(count || 0); i++) {
    paths.push(buildArchiveFilePath_(id, 'bukti', i));
  }
  return paths;
}

function appendPengajuanRow_(id, cleaned, status, resumeToken, timestampSubmit, draftCreatedAt, draftUpdatedAt, submittedAt, jumlahFileBukti) {
  getSheet_(SHEETS.PENGAJUAN).appendRow([
    id,
    timestampSubmit,
    cleaned.nama,
    cleaned.bagianCabang,
    cleaned.pemilik,
    cleaned.alasanPengajuan,
    cleaned.tanggalForm,
    cleaned.catatanTambahan,
    cleaned.items.length,
    Number(jumlahFileBukti || 0),
    status,
    '',
    '',
    '',
    resumeToken,
    draftCreatedAt,
    draftUpdatedAt,
    submittedAt,
  ]);
}

function updatePengajuanRow_(sheet, rowNumber, col, id, cleaned, status, resumeToken, timestampSubmit, draftCreatedAt, draftUpdatedAt, submittedAt, jumlahFileBukti) {
  const row = sheet.getRange(rowNumber, 1, 1, sheet.getLastColumn()).getValues()[0];
  row[col['ID Pengajuan']] = id;
  row[col['Timestamp Submit']] = timestampSubmit;
  row[col['Nama']] = cleaned.nama;
  row[col['Bagian/Cabang']] = cleaned.bagianCabang;
  row[col['Pemilik']] = cleaned.pemilik;
  row[col['Alasan Pengajuan']] = cleaned.alasanPengajuan;
  row[col['Tanggal Form']] = cleaned.tanggalForm;
  row[col['Catatan Tambahan']] = cleaned.catatanTambahan;
  row[col['Jumlah Item']] = cleaned.items.length;
  row[col['Jumlah File Bukti']] = Number(jumlahFileBukti || 0);
  row[col['Status']] = status;
  row[col['Catatan Admin']] = '';
  row[col['Tanggal Update Status Terakhir']] = '';
  row[col['User Update Status']] = '';
  row[col['Resume Token']] = resumeToken;
  row[col['Draft Created At']] = draftCreatedAt;
  row[col['Draft Updated At']] = draftUpdatedAt;
  row[col['Submitted At']] = submittedAt;
  sheet.getRange(rowNumber, 1, 1, row.length).setValues([row]);
}

function findPengajuanRecord_(id) {
  const normalizedId = normalizePengajuanId_(id);
  if (!normalizedId) return null;

  const sheet = getSheet_(SHEETS.PENGAJUAN);
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow < 2 || lastColumn < 1) return null;

  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const col = indexMap_(headers);
  const idColumn = col['ID Pengajuan'] + 1;
  const match = sheet
    .getRange(2, idColumn, lastRow - 1, 1)
    .createTextFinder(normalizedId)
    .matchCase(false)
    .matchEntireCell(true)
    .findNext();

  if (!match) return null;

  const rowNumber = match.getRow();
  const row = sheet.getRange(rowNumber, 1, 1, lastColumn).getValues()[0];
  if (normalizePengajuanId_(row[col['ID Pengajuan']]) !== normalizedId) return null;

  return { sheet: sheet, values: [headers, row], headers: headers, col: col, rowNumber: rowNumber, row: row };
}

function getItemRecordsForPengajuan_(id) {
  const normalizedId = normalizePengajuanId_(id);
  if (!normalizedId) return [];

  const sheet = getSheet_(SHEETS.ITEMS);
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow < 2 || lastColumn < 1) return [];

  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const col = indexMap_(headers);
  const idColumn = col['ID Pengajuan'] + 1;
  const matches = sheet
    .getRange(2, idColumn, lastRow - 1, 1)
    .createTextFinder(normalizedId)
    .matchCase(false)
    .matchEntireCell(true)
    .findAll();
  const records = [];

  for (let i = 0; i < matches.length; i++) {
    const row = sheet.getRange(matches[i].getRow(), 1, 1, lastColumn).getValues()[0];
    if (normalizePengajuanId_(row[col['ID Pengajuan']]) !== normalizedId) continue;
    records.push(listToObject_(headers, row));
  }

  return records;
}

function findItemRecordBySerial_(nomorSeri) {
  const serial = clean_(nomorSeri).toLowerCase();
  if (!serial) return null;

  const sheet = getSheet_(SHEETS.ITEMS);
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow < 2 || lastColumn < 1) return null;

  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const col = indexMap_(headers);
  const serialColumn = col['Nomor Seri'] + 1;
  const serialValues = sheet.getRange(2, serialColumn, lastRow - 1, 1).getValues();
  const matches = [];

  for (let i = 0; i < serialValues.length; i++) {
    if (clean_(serialValues[i][0]).toLowerCase() === serial) matches.push(i + 2);
  }

  if (!matches.length) return null;
  if (matches.length > 1) {
    throw new Error('Nomor Seri ditemukan di lebih dari satu item. Gunakan ID Pengajuan untuk hasil yang lebih spesifik.');
  }

  const rowNumber = matches[0];
  const row = sheet.getRange(rowNumber, 1, 1, lastColumn).getValues()[0];
  return {
    sheet: sheet,
    values: [headers, row],
    headers: headers,
    col: col,
    rowNumber: rowNumber,
    row: row,
    data: listToObject_(headers, row),
  };
}

function getItemsForPengajuan_(id) {
  return getItemRecordsForPengajuan_(id)
    .sort(function (a, b) { return Number(a['No Item']) - Number(b['No Item']); })
    .map(function (row) {
      return {
        noItem: row['No Item'],
        produk: row['Produk'],
        model: row['Model'],
        nomorSeri: row['Nomor Seri'],
        modelNormalized: clean_(row['model_normalized']) || normalizeModelKey_(row['Model']),
        produkStatus: clean_(row['produk_status']) || 'needs_review',
        produkSumber: clean_(row['produk_sumber']) || '',
        keputusanItem: normalizeExplicitItemDecision_(row['Keputusan Item']),
        catatanAdminItem: clean_(row['Catatan Admin Item']),
        jenisKartu: normalizeWarrantyCardType_(row['Jenis Kartu'], false),
        statusCetak: clean_(row['Status Cetak']) || 'Belum Dicetak',
        printBatchId: clean_(row['Print Batch ID']),
        printedAt: toIso_(row['Printed At']),
        statusKirim: clean_(row['Status Kirim']) || 'Belum Dikirim',
        shipBatchId: clean_(row['Ship Batch ID']),
        shippedAt: toIso_(row['Shipped At']),
        tanggalUpdateKeputusanItem: toIso_(row['Tanggal Update Keputusan Item']),
        userUpdateKeputusanItem: clean_(row['User Update Keputusan Item']),
      };
    });
}

function throwDraftParentMissingError_(id, fallbackMessage) {
  const items = getItemsForPengajuan_(id);
  if (!items.length) throw new Error(fallbackMessage);

  throw new Error(
    'Data item pengajuan ditemukan, tetapi data utama Pengajuan tidak ditemukan. Hubungi admin untuk recovery data Pengajuan sebelum upload final submit.'
  );
}

function getItemLifecycleState_() {
  const sheet = getSheet_(SHEETS.ITEMS);
  const values = sheet.getDataRange().getValues();
  const headers = values[0] || HEADERS[SHEETS.ITEMS];
  const rows = {};

  for (let i = 1; i < values.length; i++) {
    if (!values[i].some(function (cell) { return cell !== ''; })) continue;

    const data = listToObject_(headers, values[i]);
    const key = warrantyCardKey_(data['ID Pengajuan'], data['No Item']);
    if (key.indexOf('::') !== -1) {
      rows[key] = { rowNumber: i + 1, data: data };
    }
  }

  return {
    sheet: sheet,
    headers: headers,
    col: indexMap_(headers),
    rows: rows,
  };
}

function updateItemLifecycleRow_(state, key, patch) {
  const existing = state.rows[key];
  if (!existing) throw new Error('Item pengajuan tidak ditemukan: ' + key);

  const row = state.sheet.getRange(existing.rowNumber, 1, 1, state.headers.length).getValues()[0];
  Object.keys(patch || {}).forEach(function (header) {
    if (state.col[header] === undefined) throw new Error('Kolom PengajuanItems belum tersedia: ' + header);
    row[state.col[header]] = patch[header];
    existing.data[header] = patch[header];
  });

  state.sheet.getRange(existing.rowNumber, 1, 1, state.headers.length).setValues([row]);
}

function getApprovedWarrantyQueueItems_() {
  const pengajuanMap = {};
  readObjects_(SHEETS.PENGAJUAN).forEach(function (row) {
    if (VALID_STATUSES.indexOf(row['Status']) === -1) return;
    pengajuanMap[row['ID Pengajuan']] = row;
  });

  const modelMap = getModelProdukMap_();
  return readObjects_(SHEETS.ITEMS)
    .filter(function (row) {
      const pengajuan = pengajuanMap[row['ID Pengajuan']];
      const decisionItem = normalizeExplicitItemDecision_(row['Keputusan Item']);
      return pengajuan && decisionItem === 'Disetujui' && clean_(row['produk_status']) === 'verified';
    })
    .map(function (row) {
      const pengajuan = pengajuanMap[row['ID Pengajuan']];
      const key = warrantyCardKey_(row['ID Pengajuan'], row['No Item']);
      const modelNormalized = clean_(row['model_normalized']) || normalizeModelKey_(row['Model']);
      const master = modelMap[modelNormalized] || {};
      const originJenisKartu = normalizeWarrantyCardType_(master.origin, false);
      const jenisKartu = normalizeWarrantyCardType_(row['Jenis Kartu'], false) || originJenisKartu;
      return {
        key: key,
        idPengajuan: row['ID Pengajuan'],
        noItem: row['No Item'],
        produk: row['Produk'],
        model: row['Model'],
        nomorSeri: row['Nomor Seri'],
        origin: master.origin || '',
        jenisKartu: jenisKartu,
        jenisKartuKey: jenisKartu ? jenisKartu.toLowerCase() : '',
        statusCetak: clean_(row['Status Cetak']) || 'Belum Dicetak',
        printBatchId: clean_(row['Print Batch ID']),
        printedAt: toIso_(row['Printed At']),
        statusKirim: clean_(row['Status Kirim']) || 'Belum Dikirim',
        shippedAt: toIso_(row['Shipped At']),
        shipBatchId: clean_(row['Ship Batch ID']),
        nama: pengajuan['Nama'],
        bagianCabang: pengajuan['Bagian/Cabang'],
        timestampSubmit: toIso_(pengajuan['Timestamp Submit']),
      };
    });
}

function mapByWarrantyKey_(items) {
  const map = {};
  items.forEach(function (item) { map[warrantyCardKey_(item.idPengajuan, item.noItem)] = item; });
  return map;
}

function warrantyCardKey_(id, noItem) {
  return clean_(id) + '::' + clean_(noItem);
}

function normalizeWarrantyCardType_(value, required) {
  const raw = clean_(value).toLowerCase();
  if (!raw) {
    if (required) throw new Error('Jenis kartu wajib dipilih');
    return '';
  }
  if (raw === 'local' || raw === 'lokal') return 'Local';
  if (raw === 'import' || raw === 'impor') return 'Import';
  throw new Error('Jenis kartu tidak valid: ' + value);
}

function ensurePrintLayoutDefaults_(configSheet) {
  const sheet = getSheet_(SHEETS.PRINT_LAYOUTS);
  const state = getPrintLayoutRows_();
  const now = new Date();
  DEFAULT_PRINT_LAYOUTS.forEach(function (layout) {
    if (!state.byId[layout.id]) {
      sheet.appendRow([
        layout.id,
        layout.type,
        layout.name,
        layout.offsetX,
        layout.offsetY,
        layout.gapProductModel,
        layout.gapModelSerial,
        'TRUE',
        now,
        now,
        'system',
      ]);
    }
    upsertConfig_(configSheet, ACTIVE_PRINT_LAYOUT_KEYS[layout.type], layout.id, false);
  });
}

function getPrintLayoutState_() {
  const rows = getPrintLayoutRows_().layouts;
  const configSheet = getSheet_(SHEETS.CONFIG);
  const config = getConfig();
  const active = {
    local: clean_(config.ACTIVE_PRINT_LAYOUT_LOCAL) || 'local-default',
    import: clean_(config.ACTIVE_PRINT_LAYOUT_IMPORT) || 'import-default',
  };
  const activeLayouts = {};
  ['local', 'import'].forEach(function (type) {
    let layout = rows.find(function (item) { return item.id === active[type] && item.type === type; });
    if (!layout) {
      layout = rows.find(function (item) { return item.id === type + '-default' && item.type === type; });
      active[type] = layout ? layout.id : '';
      if (layout) upsertConfig_(configSheet, ACTIVE_PRINT_LAYOUT_KEYS[type], layout.id, true);
    }
    activeLayouts[type] = layout || null;
  });
  return { layouts: rows, active: active, activeLayouts: activeLayouts };
}

function getPrintLayoutRows_() {
  const sheet = getSheet_(SHEETS.PRINT_LAYOUTS);
  const values = sheet.getDataRange().getValues();
  const headers = values[0] || HEADERS[SHEETS.PRINT_LAYOUTS];
  const col = indexMap_(headers);
  const layouts = [];
  const byId = {};
  for (let i = 1; i < values.length; i++) {
    if (!values[i].some(function (cell) { return cell !== ''; })) continue;
    const layout = {
      id: clean_(values[i][col.ID]),
      type: normalizePrintLayoutType_(values[i][col.Type], false),
      name: clean_(values[i][col.Name]),
      offsetX: normalizeNumber_(values[i][col['Offset X']], 0, true),
      offsetY: normalizeNumber_(values[i][col['Offset Y']], 0, true),
      gapProductModel: normalizeNumber_(values[i][col['Gap Product Model']], 0, true),
      gapModelSerial: normalizeNumber_(values[i][col['Gap Model Serial']], 0, true),
      isBuiltin: parseBoolean_(values[i][col['Is Builtin']]),
      createdAt: toIso_(values[i][col['Created At']]),
      updatedAt: toIso_(values[i][col['Updated At']]),
      updatedBy: clean_(values[i][col['Updated By']]),
    };
    if (!layout.id || !layout.type) continue;
    layouts.push(layout);
    byId[layout.id] = layout;
  }
  layouts.sort(function (a, b) {
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    if (a.isBuiltin !== b.isBuiltin) return a.isBuiltin ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return { layouts: layouts, byId: byId };
}

function normalizePrintLayoutInput_(input, requireName) {
  const layout = {
    id: clean_(input.id || input.layoutId),
    type: normalizePrintLayoutType_(input.type, true),
    name: clean_(input.name),
    offsetX: normalizeNumber_(input.offsetX, 0, true),
    offsetY: normalizeNumber_(input.offsetY, 0, true),
    gapProductModel: normalizeNumber_(input.gapProductModel, 0, true),
    gapModelSerial: normalizeNumber_(input.gapModelSerial, 0, true),
  };
  if (requireName && !layout.name) throw new Error('Nama layout wajib diisi');
  return layout;
}

function normalizePrintLayoutType_(value, required) {
  const raw = clean_(value).toLowerCase();
  if (!raw) {
    if (required) throw new Error('Jenis layout wajib dipilih');
    return '';
  }
  if (raw === 'local' || raw === 'lokal') return 'local';
  if (raw === 'import' || raw === 'impor') return 'import';
  throw new Error('Jenis layout tidak valid: ' + value);
}

function normalizeNumber_(value, fallback, allowNegative) {
  if (value === '' || value == null) return fallback;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error('Nilai angka tidak valid');
  if (!allowNegative && number < 0) throw new Error('Nilai tidak boleh negatif');
  return number;
}

function parseBoolean_(value) {
  const raw = clean_(value).toLowerCase();
  return raw === 'true' || raw === 'yes' || raw === '1';
}

function generatePrintLayoutId_(type) {
  return type + '-' + Utilities.getUuid().slice(0, 8).toLowerCase();
}

function replaceItemRows_(id, items) {
  if (!findPengajuanRecord_(id)) throw new Error('Data utama Pengajuan tidak ditemukan. Item pengajuan tidak disimpan agar data tidak yatim.');

  const sheet = getSheet_(SHEETS.ITEMS);
  const values = sheet.getDataRange().getValues();
  const normalizedId = normalizePengajuanId_(id);
  if (values.length >= 2) {
    const col = indexMap_(values[0]);
    for (let i = values.length - 1; i >= 1; i--) {
      if (normalizePengajuanId_(values[i][col['ID Pengajuan']]) === normalizedId) sheet.deleteRow(i + 1);
    }
  }

  const itemRows = items.map(function (item, index) {
    return [
      id,
      index + 1,
      item.produk,
      item.model,
      item.nomorSeri,
      '',
      '',
      '',
      'Belum Dicetak',
      '',
      '',
      'Belum Dikirim',
      '',
      '',
      item.modelNormalized,
      item.produkStatus,
      item.produkSumber,
      '',
      '',
    ];
  });
  if (itemRows.length) sheet.getRange(sheet.getLastRow() + 1, 1, itemRows.length, itemRows[0].length).setValues(itemRows);
}

function generateIdUnlocked_() {
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd');
  const prefix = 'KG-' + today + '-';
  const sheet = getSheet_(SHEETS.PENGAJUAN);
  const lastRow = sheet.getLastRow();
  let max = 0;
  if (lastRow >= 2) {
    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
    ids.forEach(function (id) {
      id = String(id || '');
      if (id.indexOf(prefix) === 0) {
        const seq = parseInt(id.slice(prefix.length), 10);
        if (!isNaN(seq) && seq > max) max = seq;
      }
    });
  }
  return prefix + String(max + 1).padStart(4, '0');
}

function generatePrintBatchId_(prefix) {
  const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');
  return prefix + '-PRINT-' + stamp + '-' + Utilities.getUuid().slice(0, 8).toUpperCase();
}

function generateResumeToken_() {
  return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
}

function readObjects_(sheetName) {
  const sheet = getSheet_(sheetName);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  return values.slice(1).filter(function (row) { return row.some(function (cell) { return cell !== ''; }); }).map(function (row) {
    const obj = {};
    headers.forEach(function (header, index) { obj[header] = row[index]; });
    return obj;
  });
}

function readObjectsWithRowNumbers_(sheetName) {
  const sheet = getSheet_(sheetName);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0];
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    if (!values[i].some(function (cell) { return cell !== ''; })) continue;

    const obj = {};
    headers.forEach(function (header, index) { obj[header] = values[i][index]; });
    rows.push({ rowNumber: i + 1, data: obj });
  }
  return rows;
}

function requireSession_(token, allowedRoles) {
  const session = validateSession(token);
  if (!session) throw new Error('Unauthorized');

  session.role = normalizeRole_(session.role);
  if (!session.role) throw new Error('Unauthorized');

  if (allowedRoles && allowedRoles.length && allowedRoles.indexOf(session.role) === -1) {
    throw new Error('Unauthorized');
  }

  return session;
}

function normalizeRole_(value) {
  const role = clean_(value).toLowerCase();
  if (role === 'admin' || role === 'administrator') return 'admin';
  if (role === 'management' || role === 'manajemen') return 'management';
  if (role === 'qrcc') return 'qrcc';
  return '';
}

function splitStoredLines_(value) {
  return clean_(value).split(/\r?\n/).map(clean_).filter(Boolean);
}

function clean_(value) {
  return String(value == null ? '' : value).trim();
}

function normalizePengajuanId_(value) {
  return clean_(value).replace(/\s+/g, '').toUpperCase();
}

function indexMap_(headers) {
  const map = {};
  headers.forEach(function (header, index) { map[header] = index; });
  return map;
}

function startOfDay_(date) {
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay_(date) {
  date.setHours(23, 59, 59, 999);
  return date;
}

function toIso_(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function formatDateOnly_(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return isNaN(date.getTime()) ? String(value) : Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function formatDateTime_(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
}

function buildDigestHtml_(count, config) {
  const appName = config.APP_NAME || APP.APP_NAME;
  const safeAppName = escapeHtml_(appName);
  const safeCount = escapeHtml_(count);
  const sentAt = escapeHtml_(formatDateTime_(new Date()));

  return '<div style="margin:0;padding:24px;background:#f8fafc;font-family:Arial,sans-serif;color:#111827;">' +
    '<div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:24px;">' +
    '<div style="font-size:14px;font-weight:700;color:#65a30d;margin-bottom:12px;">' + safeAppName + '</div>' +
    '<h1 style="font-size:22px;line-height:1.3;margin:0 0 16px;color:#111827;">Pengajuan Baru Perlu Diproses</h1>' +
    '<div style="font-size:48px;line-height:1;font-weight:700;color:#65a30d;margin:0 0 16px;">' + safeCount + '</div>' +
    '<p style="font-size:16px;line-height:1.5;margin:0 0 8px;">Ada ' + safeCount + ' pengajuan status "Baru" yang harus diproses.</p>' +
    '<p style="font-size:16px;line-height:1.5;margin:0 0 24px;">Silakan cek dashboard admin ' + safeAppName + '.</p>' +
    '<p style="font-size:12px;line-height:1.5;margin:0;color:#6b7280;">Email ini dikirim otomatis oleh sistem ' + safeAppName + ' pada ' + sentAt + '.</p>' +
    '</div>' +
    '</div>';
}

function escapeHtml_(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
