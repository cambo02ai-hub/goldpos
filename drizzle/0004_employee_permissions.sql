ALTER TABLE `users` ADD `permissions` json;--> statement-breakpoint
ALTER TABLE `users` ADD `isActive` boolean DEFAULT true NOT NULL;