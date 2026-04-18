-- ============================================================
--  Shady Meadows B&B  –  Database Setup
--  Run once:  mysql -u root -p < setup.sql
-- ============================================================



CREATE DATABASE IF NOT EXISTS shadymeadows CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE shadymeadows;
 
-- ── Users ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  username        VARCHAR(50)  NOT NULL UNIQUE,
  email           VARCHAR(120) NOT NULL UNIQUE,
  password        VARCHAR(255) NOT NULL,
  email_verified  TINYINT(1)   NOT NULL DEFAULT 0,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
 
-- ── OTP tokens ───────────────────────────────────────────────
-- used for email verification at registration AND for login 2FA
CREATE TABLE IF NOT EXISTS otp_tokens (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  email      VARCHAR(120) NOT NULL,
  token      VARCHAR(8)   NOT NULL,
  purpose    ENUM('verify','login') NOT NULL DEFAULT 'verify',
  expires_at DATETIME NOT NULL,
  used       TINYINT(1)   NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email_purpose (email, purpose)
) ENGINE=InnoDB;
 
-- ── Rooms ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rooms (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  name      VARCHAR(50)  NOT NULL,
  price     DECIMAL(8,2) NOT NULL,
  amenities VARCHAR(200) NOT NULL,
  image     VARCHAR(100) NOT NULL
) ENGINE=InnoDB;
 
INSERT IGNORE INTO rooms (id, name, price, amenities, image) VALUES
  (1, 'Single', 100.00, 'TV,WiFi,Safe',       'imgs/room1.jpg'),
  (2, 'Double', 150.00, 'TV,Radio,Safe',       'imgs/room2.jpg'),
  (3, 'Suite',  225.00, 'Radio,WiFi,Safe',     'imgs/room3.jpg');
 
-- ── Bookings ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookings (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT NOT NULL,
  room_id      INT NOT NULL,
  checkin      DATE NOT NULL,
  checkout     DATE NOT NULL,
  guests       TINYINT NOT NULL DEFAULT 1,
  firstname    VARCHAR(60)  NOT NULL,
  lastname     VARCHAR(60)  NOT NULL,
  email        VARCHAR(120) NOT NULL,
  phone        VARCHAR(20)  NOT NULL,
  requests     TEXT,
  total        DECIMAL(10,2) NOT NULL,
  reference    VARCHAR(20)  NOT NULL UNIQUE,
  status       ENUM('pending','confirmed','cancelled') DEFAULT 'pending',
  admin_note   VARCHAR(500) DEFAULT NULL,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (room_id) REFERENCES rooms(id)
) ENGINE=InnoDB;
 
-- ── Contact Messages ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(100) NOT NULL,
  email        VARCHAR(120) NOT NULL,
  phone        VARCHAR(20),
  subject      VARCHAR(200) NOT NULL,
  body         TEXT NOT NULL,
  admin_reply  TEXT DEFAULT NULL,
  replied_at   DATETIME DEFAULT NULL,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
