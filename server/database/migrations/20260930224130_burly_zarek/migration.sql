ALTER TABLE `pengajuan` RENAME COLUMN `bagian_cabang` TO `cabang`;--> statement-breakpoint
ALTER TABLE `pengajuan` ADD `bagian` text NOT NULL DEFAULT '';--> statement-breakpoint
DROP INDEX IF EXISTS `pengajuan_bagian_cabang_idx`;--> statement-breakpoint
CREATE INDEX `pengajuan_bagian_idx` ON `pengajuan` (`bagian`);--> statement-breakpoint
CREATE INDEX `pengajuan_cabang_idx` ON `pengajuan` (`cabang`);
