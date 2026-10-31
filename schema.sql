CREATE DATABASE IF NOT EXISTS appointment_system;
USE appointment_system;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('student', 'admin') NOT NULL DEFAULT 'student',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS appointments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    service VARCHAR(100) NOT NULL,
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    status ENUM('Pending', 'Confirmed', 'Completed', 'Cancelled') NOT NULL DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Passwords are hashed for 'password123'
INSERT INTO users (name, email, password, role) VALUES
('Samantha Reyes', 'samantha@student.com', '$2y$10$wN1G1Z6W8/b3SgWk3qK5.O4vJ7F5oF9PzU7P2J6K8L0M1N2O3P4Qe', 'student'),
('Admin User', 'admin@system.com', '$2y$10$wN1G1Z6W8/b3SgWk3qK5.O4vJ7F5oF9PzU7P2J6K8L0M1N2O3P4Qe', 'admin')
ON DUPLICATE KEY UPDATE id=id;
