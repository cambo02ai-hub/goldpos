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
CREATE TABLE `hlaw_oo_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`serviceDate` varchar(10) NOT NULL,
	`customerName` varchar(255) NOT NULL,
	`hlawKyat` int NOT NULL DEFAULT 0,
	`hlawPae` int NOT NULL DEFAULT 0,
	`hlawYway` double NOT NULL DEFAULT 0,
	`tinKyat` int NOT NULL DEFAULT 0,
	`tinPae` int NOT NULL DEFAULT 0,
	`tinHtwe` double NOT NULL DEFAULT 0,
	`serviceFee` bigint NOT NULL DEFAULT 0,
	`note` varchar(500),
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `hlaw_oo_entries_id` PRIMARY KEY(`id`)
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
CREATE TABLE `shop_daily_closings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`closingDate` varchar(10) NOT NULL,
	`openingCash` bigint NOT NULL DEFAULT 0,
	`openingGoldKyat` int NOT NULL DEFAULT 0,
	`openingGoldPae` int NOT NULL DEFAULT 0,
	`openingGoldYway` double NOT NULL DEFAULT 0,
	`openingGoldValue` bigint NOT NULL DEFAULT 0,
	`closingGoldKyat` int NOT NULL DEFAULT 0,
	`closingGoldPae` int NOT NULL DEFAULT 0,
	`closingGoldYway` double NOT NULL DEFAULT 0,
	`closingGoldRate` bigint NOT NULL DEFAULT 0,
	`countedCash` bigint,
	`note` varchar(500),
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shop_daily_closings_id` PRIMARY KEY(`id`),
	CONSTRAINT `shop_daily_closings_date_unique` UNIQUE(`closingDate`)
);
--> statement-breakpoint
CREATE TABLE `shop_journal_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entryDate` varchar(10) NOT NULL,
	`side` enum('debit','credit') NOT NULL,
	`accountCode` varchar(20) NOT NULL,
	`details` varchar(255) NOT NULL,
	`kyat` int NOT NULL DEFAULT 0,
	`pae` int NOT NULL DEFAULT 0,
	`yway` double NOT NULL DEFAULT 0,
	`rate` bigint NOT NULL DEFAULT 0,
	`price` bigint NOT NULL DEFAULT 0,
	`amount` bigint NOT NULL,
	`sourceType` varchar(32),
	`sourceId` int,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shop_journal_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `staff_leave_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leaveDate` varchar(10) NOT NULL,
	`employeeName` varchar(255) NOT NULL,
	`leaveType` enum('leave','absent','late','other') NOT NULL DEFAULT 'leave',
	`dayUnits` double NOT NULL DEFAULT 1,
	`note` varchar(500),
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `staff_leave_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `gold_transactions` ADD `paymentMethod` enum('cash','bank','kbzpay','wavepay','other') DEFAULT 'cash' NOT NULL;--> statement-breakpoint
ALTER TABLE `gold_transactions` ADD `paidAmount` bigint DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE `gold_transactions` SET `paidAmount` = `amount`;
--> statement-breakpoint
INSERT INTO `shop_journal_entries` (`entryDate`, `side`, `accountCode`, `details`, `kyat`, `pae`, `yway`, `rate`, `price`, `amount`, `sourceType`, `sourceId`, `createdBy`)
SELECT `tradeDate`, CASE WHEN `transactionType` = 'sell' THEN 'debit' ELSE 'credit' END, CASE WHEN `transactionType` = 'sell' THEN '1001' ELSE '2001' END, CONCAT(CASE WHEN `transactionType` = 'sell' THEN 'အရောင်း · ' ELSE 'အဝယ် · ' END, `partyName`, IF(`itemName` IS NULL OR `itemName` = '', '', CONCAT(' · ', `itemName`))), `kyat`, `pae`, `yway`, `rate`, `amount`, `paidAmount`, 'gold_transaction', `id`, `createdBy`
FROM `gold_transactions` WHERE `paidAmount` > 0;
--> statement-breakpoint
INSERT INTO `shop_journal_entries` (`entryDate`, `side`, `accountCode`, `details`, `kyat`, `pae`, `yway`, `rate`, `price`, `amount`, `sourceType`, `sourceId`, `createdBy`)
SELECT `entryDate`, CASE WHEN `entryType` IN ('income','capital') THEN 'debit' ELSE 'credit' END, CASE `entryType` WHEN 'income' THEN '1004' WHEN 'capital' THEN '1006' WHEN 'expense' THEN '2010' ELSE '2006' END, CONCAT(`category`, IF(`counterparty` IS NULL OR `counterparty` = '', '', CONCAT(' · ', `counterparty`))), 0, 0, 0, 0, 0, `amount`, 'cash_entry', `id`, `createdBy`
FROM `cash_entries`;
--> statement-breakpoint
INSERT INTO `shop_journal_entries` (`entryDate`, `side`, `accountCode`, `details`, `kyat`, `pae`, `yway`, `rate`, `price`, `amount`, `sourceType`, `sourceId`, `createdBy`)
SELECT `settlementDate`, CASE WHEN `settlementType` = 'collection' THEN 'debit' ELSE 'credit' END, CASE WHEN `settlementType` = 'collection' THEN CASE WHEN `payment_settlements`.`paymentMethod` = 'cash' THEN '1006' ELSE '1005' END ELSE CASE WHEN `payment_settlements`.`paymentMethod` = 'cash' THEN '2006' ELSE '2005' END END, CONCAT(CASE WHEN `settlementType` = 'collection' THEN 'အကြွေးလက်ခံ · ' ELSE 'အကြွေးပေးချေ · ' END, COALESCE(`gold_transactions`.`partyName`, CONCAT('စာရင်း #', `payment_settlements`.`transactionId`))), 0, 0, 0, 0, 0, `payment_settlements`.`amount`, 'settlement', `payment_settlements`.`id`, `payment_settlements`.`createdBy`
FROM `payment_settlements` LEFT JOIN `gold_transactions` ON `gold_transactions`.`id` = `payment_settlements`.`transactionId`;
