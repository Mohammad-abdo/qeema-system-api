"use strict";

const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middleware/auth");
const projectsController = require("../controllers/projectsController");
const projectNotificationsController = require("../controllers/projectNotificationsController");

router.use(authMiddleware);

router.get("/projects", projectsController.list);
router.get("/projects/:projectId/notifications", projectNotificationsController.list);
router.patch("/projects/:projectId/notifications/:notificationId/read", projectNotificationsController.markAsRead);
router.post("/projects/:projectId/notifications/mark-all-read", projectNotificationsController.markAllAsRead);
router.get("/projects/:id", projectsController.getOne);
router.post("/projects", projectsController.create);
router.patch("/projects/:id", projectsController.update);
router.delete("/projects/:id", projectsController.remove);

module.exports = router;
