var mysql = require("mysql2");
require("dotenv").config();
const { QUERIES } = require("../src/constants");

let connectionCreated = null;
let connectionFailed = null;

const connectionPromise = new Promise((res, rej) => {
  connectionCreated = res;
  connectionFailed = rej;
});

var con = mysql.createConnection(process.env.DATABASE_URL_DEVELOP);

con.connect(function (err) {
  if (err) {
    connectionFailed(err);
    return;
  } else {
    console.log("Connection established with Database");
    try {
      con.query(QUERIES.CREATE_USER_DETAILS, function (err, result) {
        if (err) throw err;
        console.log("Database Table - User details Created");
      });
      con.query(QUERIES.CREATE_EMPLOYEE_DETAILS, function (err, result) {
        if (err) throw err;
        console.log("Database Table - Employee details Created");
      });
      con.query(QUERIES.CREATE_STOCK_DETAILS, function (err, result) {
        if (err) throw err;
        console.log("Database Table - Stock details Created");
      });
      con.query(QUERIES.CREATE_STOCK_HISTORY, function (err, result) {
        if (err) throw err;
        console.log("Database Table - Stock history Created");
      });
      con.query(QUERIES.CREATE_FEEDBACK_DETAILS, function (err, result) {
        if (err) throw err;
        console.log("Database Table - Feedback details Created");
      });
      con.query(QUERIES.CREATE_SESSION_CHECK, function (err, result) {
        if (err) throw err;
        console.log("Database Table - Session check Created");
      });
    } catch (e) {
      console.log(e);
    }
    connectionCreated();
  }
});

setTimeout(function() {
  con.end();
  console.log("Connection with Database closed");
}, 3000);