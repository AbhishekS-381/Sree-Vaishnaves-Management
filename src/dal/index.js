var mysql = require('mysql2');
require('dotenv').config();
const { QUERIES } = require('../constants/index')

let connectionCreated = null;
let connectionFailed = null;

const connectionPromise = new Promise((res, rej) => {
  connectionCreated = res;
  connectionFailed = rej;
})
var con = mysql.createConnection({
//   host: "sql.freedb.tech",
//   port: 3306,
//   user: "freedb_abhishek",
//   password: "KeK&aH@PeTX&K3Y",
//   database: "freedb_MinutesofMeet"
  host: "sql6.freemysqlhosting.net",
  port: 3306,
  user: "sql6529296",
  password: "EEQcBXVuQX",
  database: "sql6529296"
});

con.connect(function (err) {
  if (err) {
    connectionFailed(err);
    return;
  }
  else {
    try {
      con.query('CREATE DATABASE IF NOT EXISTS sql6529296', function (err, result) {
        if (err) throw err;
        con.query(QUERIES.CREATE_USER_DETAILS, function (err, result) {
          if (err) throw err;
        });
        con.query(QUERIES.CREATE_TEAM_DETAILS, function (err, result) {
          if (err) throw err;
        });
        con.query(QUERIES.CREATE_TEAM_MAPPING, function (err, result) {
          if (err) throw err;
        });
        con.query(QUERIES.CREATE_ACTION_ITEMS, function (err, result) {
          if (err) throw err;
        });
        con.query(QUERIES.CREATE_MEET_SUMMARY, function (err, result) {
          if (err) throw err;
        });
        con.query(QUERIES.CREATE_QUERY_DETAILS, function (err, result) {
          if (err) throw err;
        });
        con.query(QUERIES.CREATE_MINUTE_LINK, function (err, result) {
          if (err) throw err;
        });
        con.query(QUERIES.CREATE_SESSION_CHECK, function (err, result) {
          if (err) throw err;
        });
      });
    }
    catch (e) {
      console.log(e);
    }
    connectionCreated();
  }
});

var startTime;

function createNewUser(id, name, token, password, email, type, callback) {
  connectionPromise
    .then(() => {
      con.query(QUERIES.CREATE_NEW_USER, [id, name, token, password, email, type], callback);
    })
    .catch((err) => callback(err));
}

function forLogin(id, callback) {
  connectionPromise
    .then(() => {
      con.query(QUERIES.GET_PASSWORD, id, callback);
    })
    .catch((err) => callback(err));
}

function createSession(token, callback) {
  connectionPromise
    .then(() => {
      con.query(QUERIES.CREATE_USER_SESSION, token, callback);
    })
    .catch((err) => callback(err));
}

function addSession(token, callback) {
  connectionPromise
    .then(() => {
      con.query(QUERIES.ADD_SESSION, token, callback);
    })
    .catch((err) => callback(err));
}

function endSession(token, callback) {
  connectionPromise
    .then(() => {
      con.query(QUERIES.END_SESSION, token, callback);
    })
    .catch((err) => callback(err));
}

function updatePassword(password, id, callback) {
  connectionPromise
    .then(() => {
      con.query(QUERIES.UPDATE_PASSWORD, [password, id], callback);
    })
    .catch((err) => callback(err));
}

function getStatus(token, callback) {
  connectionPromise
    .then(() => {
      con.query(QUERIES.GET_STATUS, token, callback);
    })
    .catch((err) => callback(err));
}

function getEmpDetail(token, callback) {
  connectionPromise
    .then(() => {
      con.query(QUERIES.GET_EMP_DETAIL, token, callback);
    })
    .catch((err) => callback(err));
}

function getQuery(token, callback) {
  connectionPromise
    .then(() => {
      con.query(QUERIES.GET_QUERIES, token, callback);
    })
    .catch((err) => callback(err));
}

function getActionItem(token, callback) {
  connectionPromise
    .then(() => {
      con.query(QUERIES.GET_ACTION_ITEMS, token, callback);
    })
    .catch((err) => callback(err));
}

function getteamName(id, callback) {
  connectionPromise
    .then(() => {
      con.query(QUERIES.GET_TEAMNAME, id, callback);
    })
    .catch((err) => callback(err));
}

function getTeam(name, callback) {
  connectionPromise
    .then(() => {
      con.query(QUERIES.GET_TEAM, name, callback);
    })
    .catch((err) => callback(err));
}

function getAllTask(callback) {
  connectionPromise
    .then(() => {
      con.query(QUERIES.GET_TASK, callback);
    })
    .catch((err) => callback(err));
}

function getLinkDesc(callback) {
  connectionPromise
    .then(() => {
      con.query(QUERIES.GET_LINK_DESC, callback);
    })
    .catch((err) => callback(err));
}

function addNewTeam(name, details, id, empName, callback) {
  connectionPromise
    .then(() => {
      con.query(QUERIES.CREATE_NEW_TEAM, [name, details, id, empName], callback);
    })
    .catch((err) => callback(err));
}

function addNewMember(id, name, callback) {
  connectionPromise
    .then(() => {
      con.query(QUERIES.ADD_NEW_MEMBER, [id, name], callback);
    })
    .catch((err) => callback(err));
}

function addNewTask(task, id, team, time, callback) {
  connectionPromise
    .then(() => {
      con.query(QUERIES.ADD_NEW_TASK, [task, id, team, 0, time], callback);
    })
    .catch((err) => callback(err));
}

function addNewLink(team, content, link, time, callback) {
  connectionPromise
    .then(() => {
      con.query(QUERIES.ADD_NEW_LINK, [team, content, link, time], callback);
    })
    .catch((err) => callback(err));
}

function removeTeamMember(id, name, callback) {
  connectionPromise
    .then(() => {
      con.query(QUERIES.REMOVE_MEMBER, [id, name], callback);
    })
    .catch((err) => callback(err));
}

function removeTeam(name, callback) {
  connectionPromise
    .then(() => {
      con.query(QUERIES.REMOVE_TEAM, name, callback);
    })
    .catch((err) => callback(err));
}

function removeTeamAndMembers(name, callback) {
  connectionPromise
    .then(() => {
      con.query(QUERIES.REMOVE_TEAM_MEMBER, name, callback);
    })
    .catch((err) => callback(err));
}

function removeActionItem(team, task, callback) {
  connectionPromise
    .then(() => {
      con.query(QUERIES.REMOVE_ACTION_ITEM, [team, task], callback);
    })
    .catch((err) => callback(err));
}

function removeMinuteLink(team, link, callback) {
  connectionPromise
    .then(() => {
      con.query(QUERIES.REMOVE_MINUTE_LINK, [team, link], callback);
    })
    .catch((err) => callback(err));
}

function getManager(name, callback) {
  connectionPromise
    .then(() => {
      con.query(QUERIES.GET_MANAGER, name, callback);
    })
    .catch((err) => callback(err));
}

function getmembers(callback) {
  connectionPromise
    .then(() => {
      con.query(QUERIES.GET_MEMBERS, callback);
    })
    .catch((err) => callback(err));
}

function getallmembers(callback) {
  connectionPromise
    .then(() => {
      con.query(QUERIES.GET_ALL_EMPLOYEE, callback);
    })
    .catch((err) => callback(err));
}

function getMinutes(callback) {
  connectionPromise
    .then(() => {
      con.query(QUERIES.GET_MINUTES, callback);
    })
    .catch((err) => callback(err));
}

function getAllMinutes(callback) {
  connectionPromise
    .then(() => {
      con.query(QUERIES.GET_ALL_MINUTES, callback);
    })
    .catch((err) => callback(err));
}

function getManagerMinutes(name, callback) {
  connectionPromise
    .then(() => {
      con.query(QUERIES.GET_MANAGER_MINUTES, name, callback);
    })
    .catch((err) => callback(err));
}

function getAllLink(callback) {
  connectionPromise
    .then(() => {
      con.query(QUERIES.GET_ALL_LINK, callback);
    })
    .catch((err) => callback(err));
}

function getTime(team, callback) {
  connectionPromise
    .then(() => {
      con.query(QUERIES.GET_TIME, team, callback);
    })
    .catch((err) => callback(err));
}

function newQuery(id, name, team, manager, date, subject, details, callback) {
  connectionPromise
    .then(() => {
      con.query(QUERIES.CREATE_NEW_QUERY, [id, name, team, manager, date, subject, details], callback);
    })
    .catch((err) => callback(err));
}

function newMinute(team, start, manager, content, end, callback) {
  connectionPromise
    .then(() => {
      con.query(QUERIES.CREATE_NEW_MINUTE, [team, start, manager, content, end], callback);
    })
    .catch((err) => callback(err));
}

module.exports = {
  createNewUser, forLogin, getEmpDetail, getManager, getteamName, startTime, getLinkDesc, getAllLink,
  getMinutes, getAllMinutes, getTeam, newQuery, newMinute, addNewTeam, getQuery, getActionItem, addNewMember,
  getmembers, removeTeamMember, removeTeam, removeTeamAndMembers, addNewTask, getAllTask, removeActionItem,
  addNewLink, removeMinuteLink, getTime, getManagerMinutes, addSession, getStatus, createSession, endSession,
  updatePassword, getallmembers
};
