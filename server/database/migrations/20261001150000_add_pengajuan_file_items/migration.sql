CREATE TABLE `pengajuan_file_items` (
	`file_id` text NOT NULL,
	`item_id` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`file_id`) REFERENCES `pengajuan_files`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `pengajuan_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pengajuan_file_items_file_item_uidx` ON `pengajuan_file_items` (`file_id`,`item_id`);
--> statement-breakpoint
CREATE INDEX `pengajuan_file_items_file_id_idx` ON `pengajuan_file_items` (`file_id`);
--> statement-breakpoint
CREATE INDEX `pengajuan_file_items_item_id_idx` ON `pengajuan_file_items` (`item_id`);
