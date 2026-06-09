CREATE TABLE `approvals` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`paperless_doc_id` int NOT NULL,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`actor_id` int,
	`comment` text,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `approvals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`user_id` int,
	`action` varchar(50) NOT NULL,
	`target_id` varchar(255),
	`details` text,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chart_statuses` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`color` varchar(50) NOT NULL DEFAULT 'gray',
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `chart_statuses_id` PRIMARY KEY(`id`),
	CONSTRAINT `chart_statuses_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `document_chart_status` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`paperless_id` int NOT NULL,
	`status_id` int,
	`updated_at` timestamp DEFAULT (now()),
	CONSTRAINT `document_chart_status_id` PRIMARY KEY(`id`),
	CONSTRAINT `document_chart_status_paperless_id_unique` UNIQUE(`paperless_id`)
);
--> statement-breakpoint
CREATE TABLE `document_permissions` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`paperless_id` int NOT NULL,
	`user_id` int,
	`can_download` boolean NOT NULL DEFAULT true,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `document_permissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `document_tracking` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`paperless_id` int NOT NULL,
	`uploader_id` int,
	`expires_at` timestamp,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `document_tracking_id` PRIMARY KEY(`id`),
	CONSTRAINT `document_tracking_paperless_id_unique` UNIQUE(`paperless_id`)
);
--> statement-breakpoint
CREATE TABLE `user_requests` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`paperless_id` int NOT NULL,
	`user_id` int,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`comment` text,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `user_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`username` varchar(255) NOT NULL,
	`password` varchar(255) NOT NULL,
	`role` enum('admin','staff','approver','user') NOT NULL DEFAULT 'user',
	`name` varchar(255),
	`thaid_pid` varchar(255),
	`authentik_sub` varchar(255),
	`discord_webhook` varchar(512),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_username_unique` UNIQUE(`username`)
);
--> statement-breakpoint
ALTER TABLE `approvals` ADD CONSTRAINT `approvals_actor_id_users_id_fk` FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `document_chart_status` ADD CONSTRAINT `document_chart_status_status_id_chart_statuses_id_fk` FOREIGN KEY (`status_id`) REFERENCES `chart_statuses`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `document_permissions` ADD CONSTRAINT `document_permissions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `document_tracking` ADD CONSTRAINT `document_tracking_uploader_id_users_id_fk` FOREIGN KEY (`uploader_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_requests` ADD CONSTRAINT `user_requests_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;