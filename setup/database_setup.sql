CREATE DATABASE IF NOT EXISTS VaishnavesDB;

CREATE TABLE IF NOT EXISTS user_details (employeeID INT PRIMARY KEY, employeeName VARCHAR(255), userToken VARCHAR(255), employeePassword VARCHAR(255), userType VARCHAR(255), current_status INT);
CREATE TABLE IF NOT EXISTS employee_details (employeeID INT PRIMARY KEY, employeeName VARCHAR(255), userToken VARCHAR(255), mobile INT, _address TEXT, salary INT, empType VARCHAR(255), joined DATETIME);
CREATE TABLE IF NOT EXISTS stock_details (stockName VARCHAR(255), available INT, unit VARCHAR(255), stockType VARCHAR(255));
CREATE TABLE IF NOT EXISTS stock_history (stockName VARCHAR(255), actionMade VARCHAR(255), change INT, unit VARCHAR(255), usedBy VARCHAR(255), changesDoneOn DATETIME);
CREATE TABLE IF NOT EXISTS feedback_details (customerName VARCHAR(255), mobile INT, feedbackSubject VARCHAR(255), details TEXT, queryDate DATETIME, feedbackStatus INT DEFAULT 0);
CREATE TABLE IF NOT EXISTS session_check (userToken VARCHAR(255), currentStatus INT);