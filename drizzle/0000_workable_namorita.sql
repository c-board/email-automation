CREATE TABLE `applications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`gmail_message_id` text NOT NULL,
	`company` text,
	`position` text,
	`application_date` text,
	`summarized` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`dedup_key` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `applications_gmail_message_id_unique` ON `applications` (`gmail_message_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `applications_dedup_key_unique` ON `applications` (`dedup_key`);--> statement-breakpoint
CREATE TABLE `processed_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`gmail_message_id` text NOT NULL,
	`gmail_thread_id` text,
	`classification` text NOT NULL,
	`confidence` real NOT NULL,
	`processed_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `processed_messages_gmail_message_id_unique` ON `processed_messages` (`gmail_message_id`);--> statement-breakpoint
CREATE TABLE `summary_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`recipient` text NOT NULL,
	`application_count` integer NOT NULL,
	`success` integer NOT NULL
);
