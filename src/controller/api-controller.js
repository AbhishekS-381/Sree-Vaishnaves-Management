const dal = require('../dal/index.js');
var { v1: uuidv1 } = require('uuid');
const bcrypt = require("bcrypt");

async function loginRedirect(req, res) {
  res.redirect("/login");
}

async function logout(req, res) {
  try {
    dal.endSession(req.params.userToken, async function (err, status) {
      if (err) throw err;
      await res.redirect("/");
    });
  }
  catch (e) {
    console.log(e);
    res.redirect("/error/" + req.params.userToken);
  }
}

async function addUser(req, res) {
  try {
    var flag = 0;
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    let usertype = req.body.type.toLowerCase();
    var userToken = uuidv1();
    dal.createNewUser(req.body.id, req.body.name, userToken, hashedPassword, req.body.email, usertype, async function (err, result) {
      if (err) throw err;
      dal.createSession(userToken, async function (err, result) {
        if (err) throw err;
      });
      await res.render("login", { flag: flag });
    });
  }
  catch (e) {
    console.log(e);
    res.redirect("/error/" + req.params.userToken);
  }
}

async function homepageRender(req, res) {
  try {
   dal.forLogin(req.body.employeeID, async function (err, result) {
      if (err) throw err;
      if (typeof (result[0]?.employeePassword) != "undefined") {
        if (await bcrypt.compare(req.body.password, result[0]?.employeePassword)) {
          dal.addSession(result[0].userToken, async function (err, result) {
            if (err) throw err;
          });
          if (result[0].userType === "employee") {
            await res.redirect("/employee/home/" + result[0].userToken + "/0");
          } else {
            await res.redirect("/manager/home/" + result[0].userToken + "/0");
          }
        }
        else {
          var flag = 1;
          await res.render("login", { flag: flag });
        }
      }
      else {
        var flag = 1;
        await res.render("login", { flag: flag });
      }
    });
  }
  catch (e) {
    console.log(e);
    res.redirect("/error/" + req.params.userToken);
  }
}

async function manageAccount(req, res) {
  try {
    dal.forLogin(req.body.employeeID, async function (err, result) {
      if (err) throw err;
      if (await bcrypt.compare(req.body.password, result[0].employeePassword)) {
        dal.updatePassword(await bcrypt.hash(req.body.newpassword, 10), req.body.employeeID, async function (err, result) {
          if (err) throw err;
          var flag = 2;
          await res.render("manageaccount", { flag: flag });
        });
      }
      else {
        var flag = 1;
        await res.render("manageaccount", { flag: flag });
      }
    });
  }
  catch (e) {
    console.log(e);
    res.redirect("/error/" + req.params.userToken);
  }
}

async function addQuery(req, res) {
  try {
    dal.getStatus(req.params.userToken, async function (err, status) {
      if (err) throw err;
      if (status[0].currentStatus == 1) {
        let currentDate = new Date();
        dal.getEmpDetail(req.params.userToken, async function (err, result) {
          if (err) throw err;
          dal.getManager(req.body.team, async function (err, result1) {
            if (err) throw err;
            dal.newQuery(result[0].employeeID, result[0].employeeName, req.body.team, result1[0].managerName, currentDate, req.body.querySubject, req.body.queryDetails, async function (err, result3) {
              if (err) throw err;
              await res.redirect("/employee/queries/" + req.params.userToken + "/" + req.params.flag);
            });
          });
        });
      }
      else {
        res.redirect("/error/" + req.params.userToken);
      }
    });
  }
  catch (e) {
    console.log(e);
    res.redirect("/error/" + req.params.userToken);
  }
}

async function addMinute(req, res) {
  try {
    dal.getStatus(req.params.userToken, async function (err, status) {
      if (err) throw err;
      if (status[0].currentStatus == 1) {
        let endTime = new Date();
        dal.getEmpDetail(req.params.userToken, async function (err, result) {
          if (err) throw err;
          dal.newMinute(req.body.teamName, dal.startTime, result[0].employeeName, req.body.divText, endTime, async function (err, result1) {
            if (err) throw err;


            await res.redirect("/manager/link/" + req.params.userToken + "/" + req.body.teamName + "/" + req.params.flag);
          });
        });
      }
      else {
        res.redirect("/error/" + req.params.userToken);
      }
    });
  }
  catch (e) {
    console.log(e);
    res.redirect("/error/" + req.params.userToken);
  }
}

async function createTeam(req, res) {
  try {
    dal.getStatus(req.params.userToken, async function (err, status) {
      if (err) throw err;
      if (status[0].currentStatus == 1) {
        dal.getEmpDetail(req.params.userToken, async function (err, result) {
          if (err) throw err;
          dal.addNewMember(result[0].employeeID, req.body.teamName, async function (err, result) {
            if (err) throw err;
          });
          dal.addNewTeam(req.body.teamName, req.body.details, result[0].employeeName, result[0].employeeID, async function (err, result) {
            if (err) throw err;
            await res.redirect("/manager/team/" + req.params.userToken + "/" + req.params.flag);
          });
        });
      }
      else {
        res.redirect("/error/" + req.params.userToken);
      }
    });
  }
  catch (e) {
    console.log(e);
    res.redirect("/error/" + req.params.userToken);
  }
}

async function addMember(req, res) {
  try {
    dal.getStatus(req.params.userToken, async function (err, status) {
      if (err) throw err;
      if (status[0].currentStatus == 1) {
        dal.addNewMember(req.body.newEmployee, req.params.teamName, async function (err, result) {
          if (err) throw err;
          await res.redirect("/manager/team/" + req.params.userToken + "/" + req.params.flag);
        });
      }
      else {
        res.redirect("/error/" + req.params.userToken);
      }
    });
  }
  catch (e) {
    console.log(e);
    res.redirect("/error/" + req.params.userToken);
  }
}

async function addNewActionItem(req, res) {
  try {
    dal.getStatus(req.params.userToken, async function (err, status) {
      if (err) throw err;
      if (status[0].currentStatus == 1) {
        var currentTime = new Date();
        dal.addNewTask(req.body.newActionItem, req.body.assignedEmployee, req.params.teamName, currentTime, async function (err, result) {
          if (err) throw err;
          await res.redirect("/manager/meet/editActionItem/" + req.params.userToken + "/" + req.params.flag);
        });
      }
      else {
        res.redirect("/error/" + req.params.userToken);
      }
    });
  }
  catch (e) {
    console.log(e);
    res.redirect("/error/" + req.params.userToken);
  }
}

async function addLink(req, res) {
  try {
    dal.getStatus(req.params.userToken, async function (err, status) {
      if (err) throw err;
      if (status[0].currentStatus == 1) {
        dal.getTime(req.params.teamName, async function (err, result) {
          if (err) throw err;
          dal.addNewLink(req.params.teamName, req.body.content, req.body.link, result[0].startTime, async function (err, result) {
            if (err) throw err;
            await res.redirect("/manager/link/" + req.params.userToken + "/" + req.params.teamName + "/" + req.params.flag);
          });
        });
      }
      else {
        res.redirect("/error/" + req.params.userToken);
      }
    });
  }
  catch (e) {
    console.log(e);
    res.redirect("/error/" + req.params.userToken);
  }
}

async function removeMember(req, res) {
  try {
    dal.getStatus(req.params.userToken, async function (err, status) {
      if (err) throw err;
      if (status[0].currentStatus == 1) {
        dal.removeTeamMember(req.params.empID, req.params.teamName, async function (err, result) {
          if (err) throw err;
          await res.redirect("/manager/team/" + req.params.userToken + "/" + req.params.flag);
        });
      }
      else {
        res.redirect("/error/" + req.params.userToken);
      }
    });
  }
  catch (e) {
    console.log(e);
    res.redirect("/error/" + req.params.userToken);
  }
}

async function removeTeam(req, res) {
  try {
    dal.getStatus(req.params.userToken, async function (err, status) {
      if (err) throw err;
      if (status[0].currentStatus == 1) {
        dal.removeTeam(req.params.teamName, async function (err, result) {
          if (err) throw err;
          dal.removeTeamAndMembers(req.params.teamName, async function (err, result) {
            if (err) throw err;
            await res.redirect("/manager/team/" + req.params.userToken + "/" + req.params.flag);
          });
        });
      }
      else {
        res.redirect("/error/" + req.params.userToken);
      }
    });
  }
  catch (e) {
    console.log(e);
    res.redirect("/error/" + req.params.userToken);
  }
}

async function removeTask(req, res) {
  try {
    dal.getStatus(req.params.userToken, async function (err, status) {
      if (err) throw err;
      if (status[0].currentStatus == 1) {
        dal.removeActionItem(req.params.teamName, req.body.task, async function (err, result) {
          if (err) throw err;
          await res.redirect("/manager/meet/editActionItem/" + req.params.userToken + "/" + req.params.flag);
        });
      }
      else {
        res.redirect("/error/" + req.params.userToken);
      }
    });
  }
  catch (e) {
    console.log(e);
    res.redirect("/error/" + req.params.userToken);
  }
}

async function removeLink(req, res) {
  try {
    dal.getStatus(req.params.userToken, async function (err, status) {
      if (err) throw err;
      if (status[0].currentStatus == 1) {
        dal.removeMinuteLink(req.params.teamName, req.body.link, async function (err, result) {
          if (err) throw err;
          await res.redirect("/manager/link/" + req.params.userToken + "/" + req.params.teamName + "/" + req.params.flag);
        });
      }
      else {
        res.redirect("/error/" + req.params.userToken);
      }
    });
  }
  catch (e) {
    console.log(e);
    res.redirect("/error/" + req.params.userToken);
  }
}

module.exports = {
  loginRedirect, addUser, homepageRender, addQuery, addMinute, createTeam, addMember,
  removeMember, removeTeam, addNewActionItem, removeTask, addLink, removeLink, logout,
  manageAccount
}
