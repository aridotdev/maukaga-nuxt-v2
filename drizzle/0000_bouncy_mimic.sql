CREATE TABLE `pengajuan` (
	`id_pengajuan` text PRIMARY KEY NOT NULL,
	`timestamp_submit` text,
	`nama` text,
	`bagian_cabang` text,
	`pemilik` text,
	`alasan_pengajuan` text,
	`tanggal_form` text,
	`catatan_tambahan` text,
	`jumlah_item` integer,
	`status` text,
	`raw_json` text NOT NULL,
	`detail_json` text,
	`sheet_updated_at` text,
	`cached_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_pengajuan_timestamp` ON `pengajuan` (`timestamp_submit`);--> statement-breakpoint
CREATE INDEX `idx_pengajuan_status` ON `pengajuan` (`status`);--> statement-breakpoint
CREATE INDEX `idx_pengajuan_search` ON `pengajuan` (`nama`,`bagian_cabang`,`pemilik`,`id_pengajuan`);--> statement-breakpoint
CREATE TABLE `pengajuan_items` (
	`id` text PRIMARY KEY NOT NULL,
	`id_pengajuan` text NOT NULL,
	`no_item` text,
	`model` text,
	`produk` text,
	`nomor_seri` text,
	`keputusan_item` text,
	`raw_json` text NOT NULL,
	`cached_at` text NOT NULL,
	FOREIGN KEY (`id_pengajuan`) REFERENCES `pengajuan`(`id_pengajuan`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_pengajuan_items_serial` ON `pengajuan_items` (`nomor_seri`);--> statement-breakpoint
CREATE INDEX `idx_pengajuan_items_pengajuan` ON `pengajuan_items` (`id_pengajuan`);--> statement-breakpoint
CREATE TABLE `sync_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`status` text NOT NULL,
	`source` text NOT NULL,
	`rows_fetched` integer DEFAULT 0,
	`rows_changed` integer DEFAULT 0,
	`error` text
);
--> statement-breakpoint
CREATE TABLE `sync_meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL
);
