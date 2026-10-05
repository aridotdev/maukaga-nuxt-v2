CREATE TABLE `letter_sequence` (
	`letter_kind` text NOT NULL,
	`sequence_period` text NOT NULL,
	`current_value` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT `letter_sequence_pk` PRIMARY KEY(`letter_kind`, `sequence_period`)
);
--> statement-breakpoint
CREATE INDEX `letter_sequence_kind_idx` ON `letter_sequence` (`letter_kind`);--> statement-breakpoint
