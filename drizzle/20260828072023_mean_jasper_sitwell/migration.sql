CREATE TABLE `archive_files` (
	`id` text PRIMARY KEY,
	`id_pengajuan` text NOT NULL,
	`kind` text NOT NULL,
	`sequence` integer DEFAULT 0 NOT NULL,
	`file_name` text NOT NULL,
	`public_path` text NOT NULL,
	`local_path` text,
	`mime_type` text,
	`size_bytes` integer,
	`sha256` text,
	`source_drive_file_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`downloaded_at` text,
	`drive_trashed_at` text,
	`error` text,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT `fk_archive_files_id_pengajuan_pengajuan_id_pengajuan_fk` FOREIGN KEY (`id_pengajuan`) REFERENCES `pengajuan`(`id_pengajuan`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `pengajuan` (
	`id_pengajuan` text PRIMARY KEY,
	`timestamp_submit` text,
	`nama` text,
	`bagian_cabang` text,
	`pemilik` text,
	`alasan_pengajuan` text,
	`tanggal_form` text,
	`catatan_tambahan` text,
	`jumlah_item` integer,
	`jumlah_file_bukti` integer,
	`status` text,
	`catatan_admin` text,
	`tanggal_update_status_terakhir` text,
	`user_update_status` text,
	`resume_token` text,
	`draft_created_at` text,
	`draft_updated_at` text,
	`submitted_at` text,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pengajuan_items` (
	`id_pengajuan` text NOT NULL,
	`no_item` integer NOT NULL,
	`produk` text,
	`model` text,
	`nomor_seri` text,
	`keputusan_item` text,
	`catatan_admin_item` text,
	`tanggal_update_keputusan_item` text,
	`user_update_keputusan_item` text,
	`jenis_kartu` text,
	`status_cetak` text DEFAULT 'Belum Dicetak' NOT NULL,
	`print_batch_id` text,
	`printed_at` text,
	`status_kirim` text DEFAULT 'Belum Dikirim' NOT NULL,
	`ship_batch_id` text,
	`shipped_at` text,
	`model_normalized` text,
	`produk_status` text,
	`produk_sumber` text,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT `pengajuan_items_pk` PRIMARY KEY(`id_pengajuan`, `no_item`),
	CONSTRAINT `fk_pengajuan_items_id_pengajuan_pengajuan_id_pengajuan_fk` FOREIGN KEY (`id_pengajuan`) REFERENCES `pengajuan`(`id_pengajuan`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `status_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`dedupe_key` text NOT NULL,
	`timestamp` text,
	`id_pengajuan` text NOT NULL,
	`status_lama` text,
	`status_baru` text,
	`catatan_admin` text,
	`user` text,
	`no_item` text,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT `fk_status_log_id_pengajuan_pengajuan_id_pengajuan_fk` FOREIGN KEY (`id_pengajuan`) REFERENCES `pengajuan`(`id_pengajuan`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `config` (
	`key` text PRIMARY KEY,
	`value` text,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `email_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`timestamp` text,
	`subject` text,
	`recipients` text,
	`jumlah_pengajuan` integer,
	`status` text,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `email_recipients` (
	`email` text PRIMARY KEY,
	`nama` text,
	`aktif` text DEFAULT 'yes',
	`keterangan` text,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `model_produk` (
	`model` text PRIMARY KEY,
	`produk` text NOT NULL,
	`origin` text,
	`status` text DEFAULT 'verified',
	`updated_at` text,
	`updated_by` text,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`local_updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `print_batch` (
	`batch_id` text PRIMARY KEY,
	`tipe_batch` text,
	`created_at` text,
	`created_by` text,
	`jumlah_item` integer,
	`catatan` text,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `print_layouts` (
	`id` text PRIMARY KEY,
	`type` text,
	`name` text,
	`offset_x` real,
	`offset_y` real,
	`gap_product_model` real,
	`gap_model_serial` real,
	`is_builtin` text DEFAULT 'FALSE',
	`created_at` text,
	`updated_at` text,
	`updated_by` text,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sync_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`run_id` text NOT NULL,
	`mode` text NOT NULL,
	`source` text NOT NULL,
	`status` text NOT NULL,
	`id_pengajuan` text,
	`started_at` text NOT NULL,
	`finished_at` text,
	`rows_fetched` integer DEFAULT 0 NOT NULL,
	`rows_changed` integer DEFAULT 0 NOT NULL,
	`message` text,
	`error` text,
	`meta_json` text,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sync_meta` (
	`key` text PRIMARY KEY,
	`value` text NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user` (
	`username` text PRIMARY KEY,
	`password_pin` text NOT NULL,
	`nama` text NOT NULL,
	`role` text NOT NULL,
	`aktif` integer DEFAULT true NOT NULL,
	`last_login` text,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `archive_files_id_pengajuan_idx` ON `archive_files` (`id_pengajuan`);--> statement-breakpoint
CREATE INDEX `archive_files_status_idx` ON `archive_files` (`status`);--> statement-breakpoint
CREATE INDEX `archive_files_public_path_idx` ON `archive_files` (`public_path`);--> statement-breakpoint
CREATE INDEX `pengajuan_status_idx` ON `pengajuan` (`status`);--> statement-breakpoint
CREATE INDEX `pengajuan_resume_token_idx` ON `pengajuan` (`resume_token`);--> statement-breakpoint
CREATE INDEX `pengajuan_timestamp_idx` ON `pengajuan` (`timestamp_submit`);--> statement-breakpoint
CREATE INDEX `items_id_pengajuan_idx` ON `pengajuan_items` (`id_pengajuan`);--> statement-breakpoint
CREATE INDEX `items_model_idx` ON `pengajuan_items` (`model_normalized`);--> statement-breakpoint
CREATE INDEX `items_nomor_seri_idx` ON `pengajuan_items` (`nomor_seri`);--> statement-breakpoint
CREATE INDEX `items_status_cetak_idx` ON `pengajuan_items` (`status_cetak`);--> statement-breakpoint
CREATE INDEX `items_status_kirim_idx` ON `pengajuan_items` (`status_kirim`);--> statement-breakpoint
CREATE UNIQUE INDEX `status_log_dedupe_key_idx` ON `status_log` (`dedupe_key`);--> statement-breakpoint
CREATE INDEX `status_log_id_pengajuan_idx` ON `status_log` (`id_pengajuan`);--> statement-breakpoint
CREATE INDEX `status_log_timestamp_idx` ON `status_log` (`timestamp`);--> statement-breakpoint
CREATE INDEX `model_produk_nama_idx` ON `model_produk` (`produk`);--> statement-breakpoint
CREATE INDEX `model_produk_status_idx` ON `model_produk` (`status`);--> statement-breakpoint
CREATE INDEX `sync_log_run_id_idx` ON `sync_log` (`run_id`);--> statement-breakpoint
CREATE INDEX `sync_log_status_idx` ON `sync_log` (`status`);--> statement-breakpoint
CREATE INDEX `sync_log_started_at_idx` ON `sync_log` (`started_at`);--> statement-breakpoint
CREATE INDEX `sync_log_id_pengajuan_idx` ON `sync_log` (`id_pengajuan`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_username_idx` ON `user` (`username`);