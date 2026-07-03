-- Part 3 of 3
-- Best-effort MySQL schema inferred from application queries.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS `salary` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `phone` VARCHAR(20) NOT NULL,
  `amount` DECIMAL(20,2) NOT NULL DEFAULT 0,
  `type` VARCHAR(64) DEFAULT NULL,
  `time` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_salary_phone_time` (`phone`, `time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `roses` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `phone` VARCHAR(20) NOT NULL,
  `code` VARCHAR(64) DEFAULT NULL,
  `invite` VARCHAR(64) DEFAULT NULL,
  `f1` DECIMAL(20,2) NOT NULL DEFAULT 0,
  `f2` DECIMAL(20,2) NOT NULL DEFAULT 0,
  `f3` DECIMAL(20,2) NOT NULL DEFAULT 0,
  `f4` DECIMAL(20,2) NOT NULL DEFAULT 0,
  `time` BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_roses_phone_time` (`phone`, `time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `redenvelopes` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(64) DEFAULT NULL,
  `used` INT NOT NULL DEFAULT 0,
  `status` TINYINT NOT NULL DEFAULT 0,
  `time` BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_redenvelopes_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `redenvelopes_used` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `id_redenvelope` INT NOT NULL,
  `phone` VARCHAR(20) DEFAULT NULL,
  `phone_used` VARCHAR(20) DEFAULT NULL,
  `time` BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_redenvelopes_used_envelope` (`id_redenvelope`),
  KEY `idx_redenvelopes_used_phone` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `financial_details` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `phone` VARCHAR(20) NOT NULL,
  `bank_name` VARCHAR(191) DEFAULT NULL,
  `account_name` VARCHAR(191) DEFAULT NULL,
  `account_number` VARCHAR(64) DEFAULT NULL,
  `upi_id` VARCHAR(191) DEFAULT NULL,
  `ifsc` VARCHAR(32) DEFAULT NULL,
  `time` BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_financial_details_phone` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `balance_transfer` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `sender_phone` VARCHAR(20) NOT NULL,
  `receiver_phone` VARCHAR(20) NOT NULL,
  `phone` VARCHAR(20) DEFAULT NULL,
  `amount` DECIMAL(20,2) NOT NULL DEFAULT 0,
  `remark` VARCHAR(255) DEFAULT NULL,
  `time` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_balance_transfer_sender` (`sender_phone`),
  KEY `idx_balance_transfer_receiver` (`receiver_phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `turn_over` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `phone` VARCHAR(20) NOT NULL,
  `daily_turn_over` DECIMAL(20,2) NOT NULL DEFAULT 0,
  `total_turn_over` DECIMAL(20,2) NOT NULL DEFAULT 0,
  `time` BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_turn_over_phone` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
