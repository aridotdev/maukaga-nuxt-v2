CREATE TABLE `pemilik_barang` (
	`id` text PRIMARY KEY,
	`nama` text NOT NULL,
	`created_by` text,
	`updated_by` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pemohon` (
	`id` text PRIMARY KEY,
	`nama` text NOT NULL,
	`bagian` text NOT NULL,
	`cabang` text NOT NULL,
	`email` text,
	`nomor_hp` text,
	`created_by` text,
	`updated_by` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pemilik_barang_nama_uidx` ON `pemilik_barang` (`nama`);--> statement-breakpoint
CREATE INDEX `pemilik_barang_nama_idx` ON `pemilik_barang` (`nama`);--> statement-breakpoint
CREATE UNIQUE INDEX `pemohon_email_uidx` ON `pemohon` (`email`);--> statement-breakpoint
CREATE INDEX `pemohon_nama_idx` ON `pemohon` (`nama`);--> statement-breakpoint
CREATE INDEX `pemohon_bagian_idx` ON `pemohon` (`bagian`);--> statement-breakpoint
CREATE INDEX `pemohon_cabang_idx` ON `pemohon` (`cabang`);