CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`actor_id` text,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`metadata_json` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT `fk_audit_log_actor_id_user_id_fk` FOREIGN KEY (`actor_id`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `config` (
	`key` text PRIMARY KEY,
	`value` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `daily_sequence` (
	`sequence_date` text PRIMARY KEY,
	`current_value` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `email_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`subject` text NOT NULL,
	`recipients_json` text NOT NULL,
	`pengajuan_count` integer DEFAULT 0 NOT NULL,
	`status` text NOT NULL,
	`sent_at` integer,
	`error` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `email_recipients` (
	`email` text PRIMARY KEY,
	`nama` text,
	`aktif` integer DEFAULT true NOT NULL,
	`keterangan` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `model_produk` (
	`id` text PRIMARY KEY,
	`model` text NOT NULL,
	`produk` text NOT NULL,
	`origin` text DEFAULT 'local' NOT NULL,
	`status` text DEFAULT 'verified' NOT NULL,
	`created_by` text,
	`updated_by` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pengajuan_files` (
	`id` text PRIMARY KEY,
	`pengajuan_id` integer NOT NULL,
	`kind` text NOT NULL,
	`sequence` integer DEFAULT 0 NOT NULL,
	`original_name` text NOT NULL,
	`storage_key` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`sha256` text NOT NULL,
	`uploaded_by` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT `fk_pengajuan_files_pengajuan_id_pengajuan_id_fk` FOREIGN KEY (`pengajuan_id`) REFERENCES `pengajuan`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `pengajuan_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`pengajuan_id` integer NOT NULL,
	`no_item` integer NOT NULL,
	`model_produk_id` text,
	`produk` text,
	`model` text NOT NULL,
	`model_normalized` text NOT NULL,
	`nomor_seri` text NOT NULL,
	`nomor_seri_normalized` text NOT NULL,
	`keputusan_item` text DEFAULT 'Menunggu' NOT NULL,
	`catatan_keputusan` text,
	`keputusan_oleh` text,
	`keputusan_at` integer,
	`jenis_kartu` text,
	`status_cetak` text DEFAULT 'Belum Dicetak' NOT NULL,
	`status_kirim` text DEFAULT 'Belum Dikirim' NOT NULL,
	`last_print_batch_id` text,
	`last_shipping_batch_id` text,
	`printed_at` integer,
	`shipped_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT `fk_pengajuan_items_pengajuan_id_pengajuan_id_fk` FOREIGN KEY (`pengajuan_id`) REFERENCES `pengajuan`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_pengajuan_items_model_produk_id_model_produk_id_fk` FOREIGN KEY (`model_produk_id`) REFERENCES `model_produk`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `pengajuan` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`id_pengajuan` text NOT NULL,
	`nama` text NOT NULL,
	`bagian_cabang` text NOT NULL,
	`pemilik` text NOT NULL,
	`alasan_pengajuan` text NOT NULL,
	`tanggal_form` text NOT NULL,
	`catatan_tambahan` text,
	`status` text DEFAULT 'Baru' NOT NULL,
	`catatan_admin` text,
	`created_by` text,
	`updated_by` text,
	`deleted_by` text,
	`deleted_at` integer,
	`deleted_reason` text,
	`submitted_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `print_batch_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`batch_id` text NOT NULL,
	`item_id` integer NOT NULL,
	`status` text NOT NULL,
	`error` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`succeeded_at` integer,
	CONSTRAINT `fk_print_batch_items_batch_id_print_batches_id_fk` FOREIGN KEY (`batch_id`) REFERENCES `print_batches`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_print_batch_items_item_id_pengajuan_items_id_fk` FOREIGN KEY (`item_id`) REFERENCES `pengajuan_items`(`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE `print_batches` (
	`id` text PRIMARY KEY,
	`layout_id` text,
	`actor_id` text,
	`status` text DEFAULT 'queued' NOT NULL,
	`note` text,
	`requested_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`completed_at` integer,
	CONSTRAINT `fk_print_batches_layout_id_print_layouts_id_fk` FOREIGN KEY (`layout_id`) REFERENCES `print_layouts`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_print_batches_actor_id_user_id_fk` FOREIGN KEY (`actor_id`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `print_layouts` (
	`id` text PRIMARY KEY,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`offset_x` real DEFAULT 0 NOT NULL,
	`offset_y` real DEFAULT 0 NOT NULL,
	`gap_product_model` real DEFAULT 0 NOT NULL,
	`gap_model_serial` real DEFAULT 0 NOT NULL,
	`is_builtin` integer DEFAULT false NOT NULL,
	`created_by` text,
	`updated_by` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `shipping_batch_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`batch_id` text NOT NULL,
	`item_id` integer NOT NULL,
	`status` text NOT NULL,
	`error` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`succeeded_at` integer,
	CONSTRAINT `fk_shipping_batch_items_batch_id_shipping_batches_id_fk` FOREIGN KEY (`batch_id`) REFERENCES `shipping_batches`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_shipping_batch_items_item_id_pengajuan_items_id_fk` FOREIGN KEY (`item_id`) REFERENCES `pengajuan_items`(`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE `shipping_batches` (
	`id` text PRIMARY KEY,
	`actor_id` text,
	`status` text DEFAULT 'queued' NOT NULL,
	`note` text,
	`requested_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`completed_at` integer,
	CONSTRAINT `fk_shipping_batches_actor_id_user_id_fk` FOREIGN KEY (`actor_id`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `status_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`pengajuan_id` integer NOT NULL,
	`item_id` integer,
	`scope` text NOT NULL,
	`status_lama` text,
	`status_baru` text NOT NULL,
	`catatan` text,
	`actor_id` text,
	`dedupe_key` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT `fk_status_log_pengajuan_id_pengajuan_id_fk` FOREIGN KEY (`pengajuan_id`) REFERENCES `pengajuan`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_status_log_item_id_pengajuan_items_id_fk` FOREIGN KEY (`item_id`) REFERENCES `pengajuan_items`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_status_log_actor_id_user_id_fk` FOREIGN KEY (`actor_id`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `account` (
	`id` text PRIMARY KEY,
	`issuer` text NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT `fk_account_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	CONSTRAINT `fk_session_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`role` text DEFAULT 'admin' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_log_actor_id_idx` ON `audit_log` (`actor_id`);--> statement-breakpoint
CREATE INDEX `audit_log_action_idx` ON `audit_log` (`action`);--> statement-breakpoint
CREATE INDEX `audit_log_entity_idx` ON `audit_log` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `audit_log_created_at_idx` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `model_produk_model_uidx` ON `model_produk` (`model`);--> statement-breakpoint
CREATE INDEX `model_produk_produk_idx` ON `model_produk` (`produk`);--> statement-breakpoint
CREATE INDEX `model_produk_status_idx` ON `model_produk` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `pengajuan_files_pengajuan_kind_sequence_uidx` ON `pengajuan_files` (`pengajuan_id`,`kind`,`sequence`);--> statement-breakpoint
CREATE UNIQUE INDEX `pengajuan_files_storage_key_uidx` ON `pengajuan_files` (`storage_key`);--> statement-breakpoint
CREATE INDEX `pengajuan_files_pengajuan_id_idx` ON `pengajuan_files` (`pengajuan_id`);--> statement-breakpoint
CREATE INDEX `pengajuan_files_kind_idx` ON `pengajuan_files` (`kind`);--> statement-breakpoint
CREATE INDEX `pengajuan_files_sha256_idx` ON `pengajuan_files` (`sha256`);--> statement-breakpoint
CREATE UNIQUE INDEX `pengajuan_items_pengajuan_no_item_uidx` ON `pengajuan_items` (`pengajuan_id`,`no_item`);--> statement-breakpoint
CREATE UNIQUE INDEX `pengajuan_items_model_serial_uidx` ON `pengajuan_items` (`model_normalized`,`nomor_seri_normalized`);--> statement-breakpoint
CREATE INDEX `pengajuan_items_pengajuan_id_idx` ON `pengajuan_items` (`pengajuan_id`);--> statement-breakpoint
CREATE INDEX `pengajuan_items_model_idx` ON `pengajuan_items` (`model_normalized`);--> statement-breakpoint
CREATE INDEX `pengajuan_items_serial_idx` ON `pengajuan_items` (`nomor_seri_normalized`);--> statement-breakpoint
CREATE INDEX `pengajuan_items_decision_idx` ON `pengajuan_items` (`keputusan_item`);--> statement-breakpoint
CREATE INDEX `pengajuan_items_print_status_idx` ON `pengajuan_items` (`status_cetak`);--> statement-breakpoint
CREATE INDEX `pengajuan_items_shipping_status_idx` ON `pengajuan_items` (`status_kirim`);--> statement-breakpoint
CREATE UNIQUE INDEX `pengajuan_id_pengajuan_uidx` ON `pengajuan` (`id_pengajuan`);--> statement-breakpoint
CREATE INDEX `pengajuan_status_idx` ON `pengajuan` (`status`);--> statement-breakpoint
CREATE INDEX `pengajuan_tanggal_form_idx` ON `pengajuan` (`tanggal_form`);--> statement-breakpoint
CREATE INDEX `pengajuan_bagian_cabang_idx` ON `pengajuan` (`bagian_cabang`);--> statement-breakpoint
CREATE INDEX `pengajuan_deleted_at_idx` ON `pengajuan` (`deleted_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `print_batch_items_batch_item_uidx` ON `print_batch_items` (`batch_id`,`item_id`);--> statement-breakpoint
CREATE INDEX `print_batch_items_batch_id_idx` ON `print_batch_items` (`batch_id`);--> statement-breakpoint
CREATE INDEX `print_batch_items_item_id_idx` ON `print_batch_items` (`item_id`);--> statement-breakpoint
CREATE INDEX `print_batch_items_status_idx` ON `print_batch_items` (`status`);--> statement-breakpoint
CREATE INDEX `print_batches_status_idx` ON `print_batches` (`status`);--> statement-breakpoint
CREATE INDEX `print_batches_actor_id_idx` ON `print_batches` (`actor_id`);--> statement-breakpoint
CREATE INDEX `print_batches_requested_at_idx` ON `print_batches` (`requested_at`);--> statement-breakpoint
CREATE INDEX `print_layouts_type_idx` ON `print_layouts` (`type`);--> statement-breakpoint
CREATE INDEX `print_layouts_builtin_idx` ON `print_layouts` (`is_builtin`);--> statement-breakpoint
CREATE UNIQUE INDEX `shipping_batch_items_batch_item_uidx` ON `shipping_batch_items` (`batch_id`,`item_id`);--> statement-breakpoint
CREATE INDEX `shipping_batch_items_batch_id_idx` ON `shipping_batch_items` (`batch_id`);--> statement-breakpoint
CREATE INDEX `shipping_batch_items_item_id_idx` ON `shipping_batch_items` (`item_id`);--> statement-breakpoint
CREATE INDEX `shipping_batch_items_status_idx` ON `shipping_batch_items` (`status`);--> statement-breakpoint
CREATE INDEX `shipping_batches_status_idx` ON `shipping_batches` (`status`);--> statement-breakpoint
CREATE INDEX `shipping_batches_actor_id_idx` ON `shipping_batches` (`actor_id`);--> statement-breakpoint
CREATE INDEX `shipping_batches_requested_at_idx` ON `shipping_batches` (`requested_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `status_log_dedupe_key_uidx` ON `status_log` (`dedupe_key`);--> statement-breakpoint
CREATE INDEX `status_log_pengajuan_id_idx` ON `status_log` (`pengajuan_id`);--> statement-breakpoint
CREATE INDEX `status_log_item_id_idx` ON `status_log` (`item_id`);--> statement-breakpoint
CREATE INDEX `status_log_scope_idx` ON `status_log` (`scope`);--> statement-breakpoint
CREATE INDEX `status_log_created_at_idx` ON `status_log` (`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `account_issuer_account_id_uidx` ON `account` (`issuer`,`account_id`);--> statement-breakpoint
CREATE INDEX `account_user_id_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_uidx` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_user_id_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_uidx` ON `user` (`email`);--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);