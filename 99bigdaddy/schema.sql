-- Best-effort MySQL schema inferred from application queries.
-- This is a starter schema and may require adjustments for exact production parity.

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
  UNIQUE KEY `uq_users_code` (`code`),
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
  `id_product` VARCHAR(64) DEFAULT NULL,
  `phone` VARCHAR(20) NOT NULL,
  `code` VARCHAR(64) DEFAULT NULL,
  `invite` VARCHAR(64) DEFAULT NULL,
  `game` VARCHAR(32) DEFAULT 'wingo',
  `stage` VARCHAR(64) DEFAULT NULL,
  `bet` VARCHAR(64) DEFAULT NULL,
  `join` VARCHAR(64) DEFAULT NULL,
  `level` VARCHAR(64) DEFAULT NULL,
  `money` DECIMAL(20,2) NOT NULL DEFAULT 0,
  `amount` DECIMAL(20,2) NOT NULL DEFAULT 0,
  `fee` DECIMAL(20,2) NOT NULL DEFAULT 0,
  `result` VARCHAR(64) DEFAULT '0',
  `get` DECIMAL(20,2) NOT NULL DEFAULT 0,
  `status` TINYINT NOT NULL DEFAULT 0,
  `today` VARCHAR(64) DEFAULT NULL,
  `time` BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_minutes_1_phone_status` (`phone`, `status`)
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
  `join_bet` VARCHAR(32) DEFAULT NULL,
  `typeGame` VARCHAR(64) DEFAULT NULL,
  `bet` VARCHAR(64) DEFAULT NULL,
  `result` VARCHAR(64) DEFAULT '0',
  `get` DECIMAL(20,2) NOT NULL DEFAULT 0,
  `status` TINYINT NOT NULL DEFAULT 0,
  `time` BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_result_k3_game_status` (`game`, `status`),
  KEY `idx_result_k3_phone` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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

CREATE TABLE IF NOT EXISTS `fixed_deposits` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `phone` VARCHAR(20) NOT NULL,
  `amount` DECIMAL(20,2) NOT NULL DEFAULT 0,
  `tenure_days` INT NOT NULL,
  `daily_rate` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `total_interest` DECIMAL(20,2) NOT NULL DEFAULT 0,
  `maturity_amount` DECIMAL(20,2) NOT NULL DEFAULT 0,
  `status` VARCHAR(20) NOT NULL DEFAULT 'active',
  `start_time` BIGINT NOT NULL DEFAULT 0,
  `maturity_time` BIGINT NOT NULL DEFAULT 0,
  `withdrawn_time` BIGINT NOT NULL DEFAULT 0,
  `created_at` BIGINT NOT NULL DEFAULT 0,
  `referral_transaction_id` VARCHAR(100) DEFAULT NULL,
  `referral_processed` TINYINT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_fixed_deposits_phone_status` (`phone`, `status`),
  KEY `idx_fixed_deposits_maturity` (`maturity_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `referral_level_income` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `transaction_id` VARCHAR(100) NOT NULL,
  `fixed_deposit_id` INT NOT NULL,
  `from_phone` VARCHAR(20) NOT NULL,
  `from_code` VARCHAR(64) DEFAULT NULL,
  `to_phone` VARCHAR(20) NOT NULL,
  `to_code` VARCHAR(64) DEFAULT NULL,
  `level_no` INT NOT NULL,
  `percentage` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `package_amount` DECIMAL(20,2) NOT NULL DEFAULT 0,
  `income_amount` DECIMAL(20,2) NOT NULL DEFAULT 0,
  `status` VARCHAR(20) NOT NULL DEFAULT 'credited',
  `created_at` BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_referral_level_transaction` (`transaction_id`, `level_no`),
  KEY `idx_referral_level_to_phone` (`to_phone`),
  KEY `idx_referral_level_from_phone` (`from_phone`),
  KEY `idx_referral_level_deposit` (`fixed_deposit_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
