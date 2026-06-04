"use strict";

const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middleware/auth");
const { requirePermission } = require("../middleware/requirePermission");
const projectsController = require("../controllers/projectsController");
const projectExtrasController = require("../controllers/projectExtrasController");
const projectNotificationsController = require("../controllers/projectNotificationsController");

router.use(authMiddleware);

router.get("/projects", projectsController.list);
router.get("/projects/:projectId/notifications", projectNotificationsController.list);
router.patch("/projects/:projectId/notifications/:notificationId/read", projectNotificationsController.markAsRead);
router.post("/projects/:projectId/notifications/mark-all-read", projectNotificationsController.markAllAsRead);
router.get("/projects/:id", projectsController.getOne);
router.get("/projects/:id/deliverables", projectExtrasController.listDeliverables);
router.post("/projects/:id/deliverables", requirePermission("project.update", "params", "id"), projectExtrasController.createDeliverable);
router.patch("/projects/:id/deliverables/:deliverableId", requirePermission("project.update", "params", "id"), projectExtrasController.updateDeliverable);
router.delete("/projects/:id/deliverables/:deliverableId", requirePermission("project.update", "params", "id"), projectExtrasController.removeDeliverable);
router.get("/projects/:id/phases", projectExtrasController.listPhases);
router.post("/projects/:id/phases", requirePermission("project.update", "params", "id"), projectExtrasController.createPhase);
router.patch("/projects/:id/phases/:phaseId", requirePermission("project.update", "params", "id"), projectExtrasController.updatePhase);
router.post("/projects/:id/phases/reorder", requirePermission("project.update", "params", "id"), projectExtrasController.reorderPhases);
router.delete("/projects/:id/phases/:phaseId", requirePermission("project.update", "params", "id"), projectExtrasController.removePhase);
router.post("/projects", requirePermission("project.create"), projectsController.create);
router.patch("/projects/:id", requirePermission("project.update", "params", "id"), projectsController.update);
router.delete("/projects/:id", requirePermission("project.delete", "params", "id"), projectsController.remove);

module.exports = router;

