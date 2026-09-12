CREATE TABLE `newsletter_recipient_groups` (
	`newsletter_id` text NOT NULL,
	`group_id` text NOT NULL,
	PRIMARY KEY(`newsletter_id`, `group_id`),
	FOREIGN KEY (`newsletter_id`) REFERENCES `newsletters`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`group_id`) REFERENCES `recipient_groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `newsletter_sources` (
	`newsletter_id` text NOT NULL,
	`source_connection_id` text NOT NULL,
	`media_type_filter` text,
	`library_filter` text,
	PRIMARY KEY(`newsletter_id`, `source_connection_id`),
	FOREIGN KEY (`newsletter_id`) REFERENCES `newsletters`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_connection_id`) REFERENCES `source_connections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `newsletters` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`template_id` text,
	`smtp_profile_id` text,
	`sender_identity` text,
	`subject_template` text DEFAULT '' NOT NULL,
	`schedule_cron` text NOT NULL,
	`timezone` text DEFAULT 'UTC' NOT NULL,
	`is_enabled` integer DEFAULT true NOT NULL,
	`lookback_days` integer DEFAULT 7 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`template_id`) REFERENCES `templates`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`smtp_profile_id`) REFERENCES `smtp_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `oidc_identities` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`issuer` text NOT NULL,
	`subject` text NOT NULL,
	`provider_label` text,
	`linked_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oidc_identities_issuer_subject_idx` ON `oidc_identities` (`issuer`,`subject`);--> statement-breakpoint
CREATE TABLE `recipient_group_members` (
	`recipient_id` text NOT NULL,
	`group_id` text NOT NULL,
	PRIMARY KEY(`recipient_id`, `group_id`),
	FOREIGN KEY (`recipient_id`) REFERENCES `recipients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`group_id`) REFERENCES `recipient_groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `recipient_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text
);
--> statement-breakpoint
CREATE TABLE `recipients` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text,
	`is_active` integer DEFAULT true NOT NULL,
	`unsubscribe_token` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recipients_email_unique` ON `recipients` (`email`);--> statement-breakpoint
CREATE TABLE `send_run_recipient_results` (
	`id` text PRIMARY KEY NOT NULL,
	`send_run_id` text NOT NULL,
	`recipient_id` text NOT NULL,
	`status` text NOT NULL,
	`provider_message_id` text,
	`error` text,
	FOREIGN KEY (`send_run_id`) REFERENCES `send_runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recipient_id`) REFERENCES `recipients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `send_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`newsletter_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`started_at` integer,
	`finished_at` integer,
	`item_count_included` integer DEFAULT 0 NOT NULL,
	`recipient_count` integer DEFAULT 0 NOT NULL,
	`error` text,
	FOREIGN KEY (`newsletter_id`) REFERENCES `newsletters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`ip` text,
	`user_agent` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text
);
--> statement-breakpoint
CREATE TABLE `smtp_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`host` text NOT NULL,
	`port` integer NOT NULL,
	`secure` integer DEFAULT true NOT NULL,
	`auth_user_encrypted` text,
	`auth_pass_encrypted` text,
	`default_from_name` text NOT NULL,
	`default_from_email` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `source_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`base_url` text NOT NULL,
	`credentials_encrypted` text NOT NULL,
	`config` text,
	`status` text DEFAULT 'unconfigured' NOT NULL,
	`last_checked_at` integer,
	`last_error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `templates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`design_json` text,
	`compiled_mjml` text,
	`compiled_html` text,
	`created_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`password_hash` text,
	`role` text DEFAULT 'admin' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`last_login_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);