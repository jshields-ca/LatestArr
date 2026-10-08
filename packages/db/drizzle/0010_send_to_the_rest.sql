CREATE TABLE `send_run_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`send_run_id` text NOT NULL,
	`cid` text NOT NULL,
	`filename` text NOT NULL,
	`content_type` text NOT NULL,
	`content` blob NOT NULL,
	FOREIGN KEY (`send_run_id`) REFERENCES `send_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `send_runs` ADD `subject` text;--> statement-breakpoint
ALTER TABLE `send_runs` ADD `rest_sent_at` integer;