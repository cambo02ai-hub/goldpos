CREATE TABLE `gold_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tradeDate` varchar(10) NOT NULL,
	`transactionType` enum('sell','buy') NOT NULL,
	`partyName` varchar(255) NOT NULL,
	`itemName` varchar(255),
	`kyat` int NOT NULL DEFAULT 0,
	`pae` int NOT NULL DEFAULT 0,
	`yway` double NOT NULL DEFAULT 0,
	`rate` bigint NOT NULL DEFAULT 0,
	`amount` bigint NOT NULL DEFAULT 0,
	`note` varchar(500),
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `gold_transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `name` varchar(255);