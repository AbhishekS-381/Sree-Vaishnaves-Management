const express = require('express');
const ViewController = require('../controller/view-controller');
const ApiController = require('../controller/api-controller');

const router = express.Router();

router.get("/login", ViewController.loginRender);
router.get("/error/:userToken", ViewController.errorRender);
router.get("/", ApiController.loginRedirect);
router.get("/logout/:userToken", ApiController.logout);
router.get("/reset", ViewController.resetRender);

router.post("/signup", ApiController.addUser);
router.post("/home", ApiController.homepageRender);
router.post("/manage", ApiController.manageAccount);
router.post("/employee/queries/addQuery/:userToken/:flag", ApiController.addQuery);
router.post("/manager/meet/minute/:userToken/:flag", ApiController.addMinute);
router.post("/manager/createTeam/:userToken/:flag", ApiController.createTeam);
router.post("/manager/team/newMember/:teamName/:userToken/:flag", ApiController.addMember);
router.post("/manager/team/removeMember/:teamName/:empID/:userToken/:flag", ApiController.removeMember);
router.post("/manager/team/delete/:teamName/:userToken/:flag", ApiController.removeTeam);
router.post("/manager/meet/newActionItem/:teamName/:userToken/:flag", ApiController.addNewActionItem);
router.post("/manager/meet/removeActionItem/:teamName/:userToken/:flag", ApiController.removeTask);
router.post("/manager/meet/removeLink/:teamName/:userToken/:flag", ApiController.removeLink);
router.post("/manager/meet/addLink/:teamName/:userToken/:flag", ApiController.addLink);

router.get("/manager/home/:userToken/:flag", ViewController.managerHomeRender);
router.get("/manager/team/:userToken/:flag", ViewController.managerTeamRender);
router.get("/manager/meet/:userToken/:flag", ViewController.managerMeetRender);
router.get("/manager/link/:userToken/:teamName/:flag", ViewController.managerLinkRender);
router.get("/manager/minutes/content/:userToken/:flag", ViewController.managerContentRender);
router.get("/manager/meet/editActionItem/:userToken/:flag", ViewController.editActionItems);
router.get("/manager/minutes/links/:userToken/:flag", ViewController.managerLinksRender);
router.get("/manager/queries/:userToken/:flag", ViewController.managerQueryRender);
router.get("/manager/actionitems/:userToken/:flag", ViewController.managerActionItemRender);

router.get("/employee/home/:userToken/:flag", ViewController.employeeHomeRender);
router.get("/employee/minutes/content/:userToken/:flag", ViewController.employeeMinutesRender);
router.get("/employee/minutes/links/:userToken/:flag", ViewController.employeeLinksRender);
router.get("/employee/queries/:userToken/:flag", ViewController.employeeQueryRender);
router.get("/employee/actionitems/:userToken/:flag", ViewController.employeeActionItemsRender);

module.exports = router;