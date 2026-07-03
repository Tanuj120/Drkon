-- Part 2 of 3
-- Best-effort MySQL schema inferred from application queries.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS `withdraw` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `id_order` VARCHAR(64) DEFAULT NULL,
  `phone` VARCHAR(20) NOT NULL,
  `money` DECIMAL(20,2) NOT NULL DEFAULT 0,
  `stk` VARCHAR(191) DEFAULT NULL,
  `name_bank` VARCHAR(191) DEFAULT NULL,
  `ifsc` VARCHAR(191) DEFAULT NULL,
  `name_user` VARCHAR(191) DEFAULT NULL,
  `status` TINYINT NOT NULL DEFAULT 0,
  `remark` VARCHAR(255) DEFAULT NULL,
  `today` DATE DEFAULT NULL,
  `time` BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_withdraw_phone_status` (`phone`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `user_bank` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `phone` VARCHAR(20) NOT NULL,
  `name_user` VARCHAR(191) DEFAULT NULL,
  `name_bank` VARCHAR(191) DEFAULT NULL,
  `stk` VARCHAR(64) DEFAULT NULL,
  `email` VARCHAR(191) DEFAULT NULL,
  `sdt` VARCHAR(20) DEFAULT NULL,
  `tp` VARCHAR(191) DEFAULT NULL,
  `tinh` VARCHAR(191) DEFAULT NULL,
  `chi_nhanh` VARCHAR(191) DEFAULT NULL,
  `time` BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_user_bank_phone` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `bank_recharge` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name_bank` VARCHAR(191) DEFAULT NULL,
  `name_user` VARCHAR(191) DEFAULT NULL,
  `stk` VARCHAR(191) DEFAULT NULL,
  `type` VARCHAR(50) NOT NULL,
  `qr_code_image` TEXT,
  `upi_id` VARCHAR(191) DEFAULT NULL,
  `time` BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_bank_recharge_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `level` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `level` INT NOT NULL DEFAULT 0,
  `f1` DECIMAL(10,4) NOT NULL DEFAULT 0,
  `f2` DECIMAL(10,4) NOT NULL DEFAULT 0,
  `f3` DECIMAL(10,4) NOT NULL DEFAULT 0,
  `f4` DECIMAL(10,4) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_level_level` (`level`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `minutes_1` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `phone` VARCHAR(20) NOT NULL,
  `game` VARCHAR(32) DEFAULT 'wingo',
  `stage` VARCHAR(64) DEFAULT NULL,
  `bet` VARCHAR(64) DEFAULT NULL,
  `join` VARCHAR(64) DEFAULT NULL,
  `level` VARCHAR(64) DEFAULT NULL,
  `money` DECIMAL(20,2) NOT NULL DEFAULT 0,
  `amount` DECIMAL(20,2) NOT NULL DEFAULT 0,
  `result` VARCHAR(64) DEFAULT '0',
  `status` TINYINT NOT NULL DEFAULT 0,
  `today` DATE DEFAULT NULL,
  `time` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_minutes_1_phone_status` (`phone`, `status`),
  KEY `idx_minutes_1_game_stage_status` (`game`, `stage`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `result_5d` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `id_product` VARCHAR(64) DEFAULT NULL,
  `phone` VARCHAR(20) NOT NULL,
  `code` VARCHAR(64) DEFAULT NULL,
  `invite` VARCHAR(64) DEFAULT NULL,
  `stage` VARCHAR(64) DEFAULT NULL,
  `level` INT NOT NULL DEFAULT 0,
  `money` DECIMAL(20,2) NOT NULL DEFAULT 0,
  `price` DECIMAL(20,2) NOT NULL DEFAULT 0,
  `amount` DECIMAL(20,2) NOT NULL DEFAULT 0,
  `fee` DECIMAL(20,2) NOT NULL DEFAULT 0,
  `game` INT NOT NULL DEFAULT 1,
  `join_bet` VARCHAR(32) DEFAULT NULL,
  `bet` VARCHAR(32) DEFAULT NULL,
  `result` VARCHAR(64) DEFAULT '0',
  `get` DECIMAL(20,2) NOT NULL DEFAULT 0,
  `status` TINYINT NOT NULL DEFAULT 0,
  `time` BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_result_5d_game_status` (`game`, `status`),
  KEY `idx_result_5d_game_stage_status` (`game`, `stage`, `status`),
  KEY `idx_result_5d_phone` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `result_k3` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `id_product` VARCHAR(64) DEFAULT NULL,
  `phone` VARCHAR(20) NOT NULL,
  `code` VARCHAR(64) DEFAULT NULL,
  `invite` VARCHAR(64) DEFAULT NULL,
  `stage` VARCHAR(64) DEFAULT NULL,
  `level` INT NOT NULL DEFAULT 0,
  `money` DECIMAL(20,2) NOT NULL DEFAULT 0,
  `price` DECIMAL(20,2) NOT NULL DEFAULT 0,
  `amount` DECIMAL(20,2) NOT NULL DEFAULT 0,
  `fee` DECIMAL(20,2) NOT NULL DEFAULT 0,
  `game` INT NOT NULL DEFAULT 1,
  `bet` VARCHAR(64) DEFAULT NULL,
  `result` VARCHAR(64) DEFAULT '0',
  `get` DECIMAL(20,2) NOT NULL DEFAULT 0,
  `status` TINYINT NOT NULL DEFAULT 0,
  `time` BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_result_k3_game_status` (`game`, `status`),
  KEY `idx_result_k3_game_stage_status` (`game`, `stage`, `status`),
  KEY `idx_result_k3_phone` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
