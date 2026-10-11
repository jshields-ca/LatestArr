CREATE TABLE `recipient_imports` (
	`id` text PRIMARY KEY NOT NULL,
	`created_by` text,
	`created_at` integer NOT NULL,
	`changes` text NOT NULL,
	`undone_at` integer,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
