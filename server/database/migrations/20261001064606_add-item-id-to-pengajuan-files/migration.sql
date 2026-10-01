ALTER TABLE `pengajuan_files`
ADD `item_id` integer REFERENCES `pengajuan_items`(`id`) ON DELETE CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS `pengajuan_files_pengajuan_kind_sequence_uidx`;
--> statement-breakpoint
CREATE UNIQUE INDEX `pengajuan_files_pengajuan_kind_sequence_uidx`
ON `pengajuan_files` (`pengajuan_id`, `kind`, `item_id`, `sequence`);
--> statement-breakpoint
CREATE INDEX `pengajuan_files_item_id_idx`
ON `pengajuan_files` (`item_id`);