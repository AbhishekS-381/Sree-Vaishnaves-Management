CREATE DATABASE IF NOT EXISTS MinutesofMeet;

CREATE TABLE IF NOT EXISTS user_details (employeeID INT PRIMARY KEY, employeeName VARCHAR(255), userToken VARCHAR(255), employeePassword VARCHAR(255), emailID VARCHAR(255), userType VARCHAR(255));
CREATE TABLE IF NOT EXISTS team_details (teamName VARCHAR(255) PRIMARY KEY, details TEXT, managerName VARCHAR(255), managerID INT);
CREATE TABLE IF NOT EXISTS team_mapping (employeeID INT, teamName VARCHAR(255));
CREATE TABLE IF NOT EXISTS action_items (task VARCHAR(255), assignedTo INT, teamName VARCHAR(255), currentStatus INT DEFAULT 0, assignedDate DATETIME);
CREATE TABLE IF NOT EXISTS meet_summary (teamName VARCHAR(255), startTime DATETIME, scrumMaster VARCHAR(255),content TEXT, endTime DATETIME);
CREATE TABLE IF NOT EXISTS query_details (employeeID INT, employeeName VARCHAR(255), teamName VARCHAR(255), managerName VARCHAR(255), meetDate DATETIME, querySubject VARCHAR(255), details TEXT);
CREATE TABLE IF NOT EXISTS minute_link (teamName VARCHAR(255), content VARCHAR(255), link VARCHAR(255), meetDate DATETIME);
CREATE TABLE IF NOT EXISTS session_check (userToken VARCHAR(255), currentStatus INT);