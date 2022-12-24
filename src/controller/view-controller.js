const dal = require('../dal/index.js');

async function loginRender(req, res) {
  var flag = 0;
  res.render("login", { flag: flag });
}

async function managerHomeRender(req, res) {
  try {
    dal.getStatus(req.params.userToken, async function (err, status) {
      if (err) throw err;
      if (status[0].currentStatus == 1) {
        dal.getEmpDetail(req.params.userToken, async function (err, name) {
          if (err) throw err;
          if (req.params.flag == 1) {
            await res.render("managerHome", { userToken: req.params.userToken, userName: name[0].employeeName, flag: 1 });
          }
          else {
            await res.render("managerHome", { userToken: req.params.userToken, userName: name[0].employeeName, flag: 0 });
          }
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

async function managerTeamRender(req, res) {
  try {
    dal.getStatus(req.params.userToken, async function (err, status) {
      if (err) throw err;
      if (status[0].currentStatus == 1) {
        dal.getEmpDetail(req.params.userToken, async function (err, name) {
          if (err) throw err;
          dal.getTeam(name[0].employeeName, async function (err, team) {
            if (err) throw err;
            dal.getmembers(async function (err, members) {
              if (err) throw err;
              dal.getallmembers(async function (err, employee) {
                if (err) throw err;
                await res.render("createTeam", { userToken: req.params.userToken, team: team, members: members, userName: name[0].employeeName, flag: req.params.flag, employee: employee });
              });
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

async function managerMeetRender(req, res) {
  try {
    dal.getStatus(req.params.userToken, async function (err, status) {
      if (err) throw err;
      if (status[0].currentStatus == 1) {
        dal.startTime = new Date();
        dal.getEmpDetail(req.params.userToken, async function (err, name) {
          if (err) throw err;
          dal.getTeam(name[0].employeeName, async function (err, team) {
            if (err) throw err;
            await res.render("createMinutes", { userToken: req.params.userToken, userName: name[0].employeeName, flag: req.params.flag, team: team });
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

async function managerLinkRender(req, res) {
  try {
    dal.getStatus(req.params.userToken, async function (err, status) {
      if (err) throw err;
      if (status[0].currentStatus == 1) {
        dal.getEmpDetail(req.params.userToken, async function (err, name) {
          if (err) throw err;
          dal.getAllLink(async function (err, links) {
            if (err) throw err;
            await res.render("minuteLinks", { userToken: req.params.userToken, teamName: req.params.teamName, links: links, userName: name[0].employeeName, flag: req.params.flag });
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

async function managerContentRender(req, res) {
  try {
    dal.getStatus(req.params.userToken, async function (err, status) {
      if (err) throw err;
      if (status[0].currentStatus == 1) {
        dal.getEmpDetail(req.params.userToken, async function (err, name) {
          if (err) throw err;
          dal.getManagerMinutes(name[0].employeeName, async function (err, result) {
            if (err) throw err;
            await res.render("managerMinutesContent", { userToken: req.params.userToken, minutes: result, userName: name[0].employeeName, flag: req.params.flag });
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

async function editActionItems(req, res) {
  try {
    dal.getStatus(req.params.userToken, async function (err, status) {
      if (err) throw err;
      if (status[0].currentStatus == 1) {
        dal.getEmpDetail(req.params.userToken, async function (err, name) {
          if (err) throw err;
          dal.getTeam(name[0].employeeName, async function (err, team) {
            if (err) throw err;
            dal.getAllTask(async function (err, actionItem) {
              if (err) throw err;
              dal.getallmembers(async function (err, employee) {
                if (err) throw err;
                dal.getmembers(async function (err, members) {
                  if (err) throw err;
                  await res.render("editActionItems", { userToken: req.params.userToken, team: team, actionItem: actionItem, userName: name[0].employeeName, flag: req.params.flag, employee: employee, members: members });
                });
              });
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

async function managerLinksRender(req, res) {
  try {
    dal.getStatus(req.params.userToken, async function (err, status) {
      if (err) throw err;
      if (status[0].currentStatus == 1) {
        dal.getEmpDetail(req.params.userToken, async function (err, result) {
          if (err) throw err;
          dal.getteamName(result[0].employeeID, async function (err, team) {
            if (err) throw err;
            dal.getLinkDesc(async function (err, rows) {
              if (err) throw err;
              await res.render("managerMinutesLink", { userToken: req.params.userToken, team: team, links: rows, userName: result[0].employeeName, flag: req.params.flag });
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

async function managerQueryRender(req, res) {
  try {
    dal.getStatus(req.params.userToken, async function (err, status) {
      if (err) throw err;
      if (status[0].currentStatus == 1) {
        dal.getEmpDetail(req.params.userToken, async function (err, result) {
          if (err) throw err;
          dal.getQuery(result[0].employeeName, async function (err, rows) {
            if (err) throw err;
            await res.render("viewQueries", { userToken: req.params.userToken, queries: rows, userName: result[0].employeeName, flag: req.params.flag });
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

async function managerActionItemRender(req, res) {
  try {
    dal.getStatus(req.params.userToken, async function (err, status) {
      if (err) throw err;
      if (status[0].currentStatus == 1) {
        dal.getEmpDetail(req.params.userToken, async function (err, result) {
          if (err) throw err;
          dal.getActionItem(result[0].employeeID, async function (err, rows) {
            if (err) throw err;
            await res.render("managerActionItem", { userToken: req.params.userToken, actionItems: rows, userName: result[0].employeeName, flag: req.params.flag });
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

async function employeeHomeRender(req, res) {
  try {
    dal.getStatus(req.params.userToken, async function (err, status) {
      if (err) throw err;
      if (status[0].currentStatus == 1) {
        dal.getEmpDetail(req.params.userToken, async function (err, name) {
          if (err) throw err;
          await res.render("employeeHome", { userToken: req.params.userToken, userName: name[0].employeeName, flag: req.params.flag });
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

async function employeeMinutesRender(req, res) {
  try {
    dal.getStatus(req.params.userToken, async function (err, status) {
      if (err) throw err;
      if (status[0].currentStatus == 1) {
        dal.getEmpDetail(req.params.userToken, async function (err, result) {
          if (err) throw err;
          dal.getteamName(result[0].employeeID, async function (err, team) {
            if (err) throw err;
            dal.getAllMinutes(async function (err, rows) {
              if (err) throw err;
              await res.render("employeeMinutesContent", { userToken: req.params.userToken, minutes: rows, team: team, userName: result[0].employeeName, flag: req.params.flag });
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

async function employeeLinksRender(req, res) {
  try {
    dal.getStatus(req.params.userToken, async function (err, status) {
      if (err) throw err;
      if (status[0].currentStatus == 1) {
        dal.getEmpDetail(req.params.userToken, async function (err, result) {
          if (err) throw err;
          dal.getteamName(result[0].employeeID, async function (err, team) {
            if (err) throw err;
            dal.getLinkDesc(async function (err, rows) {
              if (err) throw err;
              await res.render("employeeMinutesLink", { userToken: req.params.userToken, team: team, links: rows, userName: result[0].employeeName, flag: req.params.flag });
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

async function employeeQueryRender(req, res) {
  try {
    dal.getStatus(req.params.userToken, async function (err, status) {
      if (err) throw err;
      if (status[0].currentStatus == 1) {
        dal.getEmpDetail(req.params.userToken, async function (err, name) {
          if (err) throw err;
          dal.getteamName(name[0].employeeID, async function (err, team) {
            if (err) throw err;
            await res.render("employeeQuery", { userToken: req.params.userToken, userName: name[0].employeeName, flag: req.params.flag, team: team });
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

async function employeeActionItemsRender(req, res) {
  try {
    dal.getStatus(req.params.userToken, async function (err, status) {
      if (err) throw err;
      if (status[0].currentStatus == 1) {
        dal.getEmpDetail(req.params.userToken, async function (err, result) {
          if (err) throw err;
          dal.getActionItem(result[0].employeeID, async function (err, rows) {
            if (err) throw err;
            await res.render("employeeActionItem", { userToken: req.params.userToken, actionItems: rows, userName: result[0].employeeName, flag: req.params.flag });
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

async function resetRender(req, res) {
  try {
    var flag = 0;
    await res.render("manageAccount", { flag: flag });
  }
  catch (e) {
    console.log(e);
    res.redirect("/error/" + req.params.userToken);
  }
}

async function errorRender(req, res) {
  try {
    dal.endSession(req.params.userToken, async function (err, status) {
      if (err) throw err;
      res.render("error");
    });
  }
  catch (e) {
    console.log(e);
    res.redirect("/error/" + req.params.userToken);
  }
}

module.exports = {
  employeeHomeRender, employeeMinutesRender, employeeLinksRender, employeeQueryRender,
  employeeActionItemsRender, loginRender, managerHomeRender, managerTeamRender, managerMeetRender,
  managerContentRender, editActionItems, managerLinksRender, managerQueryRender, managerActionItemRender,
  managerLinkRender, errorRender, resetRender
}
