"use strict";

const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middleware/auth");
const assignmentController = require("../controllers/assignmentController");

router.use(authMiddleware);

router.get("/assignment/users", assignmentController.getUsers);
router.get("/assignment/task-counts", assignmentController.getTaskCounts);
router.get("/assignment/projects-with-tasks", assignmentController.getProjectsWithTasks);
router.get("/assignment/user/:userId/projects", assignmentController.getUserProjects);
router.get("/assignment/user/:userId/project/:projectId/tasks", assignmentController.getUserProjectTasks);
router.post("/assignment/assign", assignmentController.assignToday);
router.post("/assignment/remove", assignmentController.removeToday);

module.exports = router;
