-- Part 1 of 3
-- Best-effort MySQL schema inferred from application queries.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS `users` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `id_user` VARCHAR(32) DEFAULT NULL,
  `phone` VARCHAR(20) NOT NULL,
  `name_user` VARCHAR(191) DEFAULT NULL,
  `password` VARCHAR(255) DEFAULT NULL,
  `plain_password` VARCHAR(255) DEFAULT NULL,
  `token` VARCHAR(255) DEFAULT NULL,
  `code` VARCHAR(64) DEFAULT NULL,
  `invite` VARCHAR(64) DEFAULT NULL,
  `f1_code` VARCHAR(64) DEFAULT NULL,
  `f2_code` VARCHAR(64) DEFAULT NULL,
  `f3_code` VARCHAR(64) DEFAULT NULL,
  `level` INT NOT NULL DEFAULT 0,
  `rank` INT NOT NULL DEFAULT 0,
  `status` TINYINT NOT NULL DEFAULT 1,
  `veri` TINYINT NOT NULL DEFAULT 0,
  `money` DECIMAL(20,2) NOT NULL DEFAULT 0,
  `total_money` DECIMAL(20,2) NOT NULL DEFAULT 0,
  `money_value` DECIMAL(20,2) NOT NULL DEFAULT 0,
  `free_bonus` DECIMAL(20,2) NOT NULL DEFAULT 0,
  `first_deposit` TINYINT NOT NULL DEFAULT 0,
  `roses` DECIMAL(20,2) NOT NULL DEFAULT 0,
  `roses_f` DECIMAL(20,2) NOT NULL DEFAULT 0,
  `roses_f1` DECIMAL(20,2) NOT NULL DEFAULT 0,
  `roses_today` DECIMAL(20,2) NOT NULL DEFAULT 0,
  `list_mem_today` INT NOT NULL DEFAULT 0,
  `ip` VARCHAR(64) DEFAULT NULL,
  `ip_address` VARCHAR(64) DEFAULT NULL,
  `time_otp` BIGINT NOT NULL DEFAULT 0,
  `time` BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_phone` (`phone`),
  KEY `idx_users_code` (`code`),
  KEY `idx_users_invite` (`invite`),
  KEY `idx_users_token` (`token`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `admin` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `app` VARCHAR(255) DEFAULT '#',
  `myapp_web` VARCHAR(255) DEFAULT NULL,
  `telegram` VARCHAR(255) DEFAULT NULL,
  `cskh` VARCHAR(255) DEFAULT NULL,
  `recharge_bonus` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `recharge_bonus_2` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `value` VARCHAR(255) DEFAULT NULL,
  `bs` VARCHAR(255) DEFAULT NULL,
  `wingo1` VARCHAR(255) DEFAULT '-1',
  `wingo3` VARCHAR(255) DEFAULT '-1',
  `wingo5` VARCHAR(255) DEFAULT '-1',
  `wingo10` VARCHAR(255) DEFAULT '-1',
  `k5d` VARCHAR(255) DEFAULT '-1',
  `k5d3` VARCHAR(255) DEFAULT '-1',
  `k5d5` VARCHAR(255) DEFAULT '-1',
  `k5d10` VARCHAR(255) DEFAULT '-1',
  `k3d` VARCHAR(255) DEFAULT '-1',
  `k3d3` VARCHAR(255) DEFAULT '-1',
  `k3d5` VARCHAR(255) DEFAULT '-1',
  `k3d10` VARCHAR(255) DEFAULT '-1',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `wingo` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `period` VARCHAR(64) NOT NULL,
  `game` VARCHAR(32) NOT NULL,
  `amount` DECIMAL(20,2) NOT NULL DEFAULT 0,
  `result` VARCHAR(64) DEFAULT '0',
  `status` TINYINT NOT NULL DEFAULT 0,
  `time` BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_wingo_game_status_period` (`game`, `status`, `period`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `5d` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `period` VARCHAR(64) NOT NULL,
  `result` VARCHAR(64) DEFAULT '0',
  `game` INT NOT NULL,
  `status` TINYINT NOT NULL DEFAULT 0,
  `time` BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_5d_game_status_period` (`game`, `status`, `period`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `k3` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `period` VARCHAR(64) NOT NULL,
  `result` VARCHAR(64) DEFAULT '0',
  `game` INT NOT NULL,
  `status` TINYINT NOT NULL DEFAULT 0,
  `time` BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_k3_game_status_period` (`game`, `status`, `period`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `point_list` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `phone` VARCHAR(20) NOT NULL,
  `money` DECIMAL(20,2) NOT NULL DEFAULT 0,
  `money_us` DECIMAL(20,2) NOT NULL DEFAULT 0,
  `level` INT NOT NULL DEFAULT 0,
  `total1` DECIMAL(20,2) NOT NULL DEFAULT 0,
  `total2` DECIMAL(20,2) NOT NULL DEFAULT 0,
  `total3` DECIMAL(20,2) NOT NULL DEFAULT 0,
  `total4` DECIMAL(20,2) NOT NULL DEFAULT 0,
  `total5` DECIMAL(20,2) NOT NULL DEFAULT 0,
  `total6` DECIMAL(20,2) NOT NULL DEFAULT 0,
  `total7` DECIMAL(20,2) NOT NULL DEFAULT 0,
  `time` BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_point_list_phone` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `recharge` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `id_order` VARCHAR(100) DEFAULT NULL,
  `order_id` VARCHAR(100) DEFAULT NULL,
  `transaction_id` VARCHAR(191) DEFAULT NULL,
  `client_txn_id` VARCHAR(100) DEFAULT NULL,
  `utr` VARCHAR(64) DEFAULT NULL,
  `phone` VARCHAR(20) NOT NULL,
  `money` DECIMAL(20,2) NOT NULL DEFAULT 0,
  `amount` DECIMAL(20,2) NOT NULL DEFAULT 0,
  `type` VARCHAR(50) DEFAULT NULL,
  `typeid` VARCHAR(50) DEFAULT NULL,
  `status` TINYINT NOT NULL DEFAULT 0,
  `url` TEXT,
  `today` DATE DEFAULT NULL,
  `time` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_recharge_phone_status_type` (`phone`, `status`, `type`),
  KEY `idx_recharge_order` (`id_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
