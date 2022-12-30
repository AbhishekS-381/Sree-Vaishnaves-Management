const dal = require('../dal/index.js');

async function loginRender(req, res) {
  res.render("comingSoon");
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
    // dal.endSession(req.params.userToken, async function (err, status) {
      // if (err) throw err;
      res.render("error");
    // });
  }
  catch (e) {
    console.log(e);
    res.redirect("/error/" + req.params.userToken);
  }
}

module.exports = {
  loginRender, managerHomeRender,errorRender, resetRender
}
