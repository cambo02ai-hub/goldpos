CREATE TABLE `cash_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entryDate` varchar(10) NOT NULL,
	`entryType` enum('income','expense','capital','drawing') NOT NULL,
	`category` varchar(100) NOT NULL,
	`counterparty` varchar(255),
	`amount` bigint NOT NULL,
	`paymentMethod` enum('cash','bank','kbzpay','wavepay','other') NOT NULL DEFAULT 'cash',
	`note` varchar(500),
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cash_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payment_settlements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`transactionId` int NOT NULL,
	`settlementDate` varchar(10) NOT NULL,
	`settlementType` enum('collection','payment') NOT NULL,
	`amount` bigint NOT NULL,
	`paymentMethod` enum('cash','bank','kbzpay','wavepay','other') NOT NULL DEFAULT 'cash',
	`note` varchar(500),
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payment_settlements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `gold_transactions` ADD `paymentMethod` enum('cash','bank','kbzpay','wavepay','other') DEFAULT 'cash' NOT NULL;
--> statement-breakpoint
ALTER TABLE `gold_transactions` ADD `paidAmount` bigint DEFAULT 0 NOT NULL;
--> statement-breakpoint
-- Existing transactions predate credit tracking and are treated as fully settled.
UPDATE `gold_transactions` SET `paidAmount` = `amount`;
