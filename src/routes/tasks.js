"use strict";

const express = require("express");
const multer = require("multer");
const router = express.Router();
const { authMiddleware } = require("../middleware/auth");
const { requirePermission } = require("../middleware/requirePermission");
const tasksController = require("../controllers/tasksController");
const attachmentsController = require("../controllers/attachmentsController");

const attachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.use(authMiddleware);

router.get("/tasks", tasksController.list);
router.get("/tasks/:id/dependency-candidates", tasksController.getDependencyCandidates);
router.post("/tasks/:id/attachments", attachmentUpload.single("file"), attachmentsController.uploadForTask);
router.post("/tasks/:id/dependencies", tasksController.addDependency);
router.delete("/tasks/:id/dependencies/:dependsOnTaskId", tasksController.removeDependency);
router.post("/tasks/:id/subtasks", tasksController.createSubtask);
router.patch("/tasks/:id/subtasks/:subtaskId", tasksController.updateSubtask);
router.delete("/tasks/:id/subtasks/:subtaskId", tasksController.removeSubtask);
router.post("/tasks/:id/comments", tasksController.createComment);
router.delete("/tasks/:id/comments/:commentId", tasksController.deleteComment);
router.post("/tasks/:id/time-logs", requirePermission("task.update", "params", "id", "task"), tasksController.createTimeLog);
router.delete("/tasks/:id/time-logs/:logId", requirePermission("task.update", "params", "id", "task"), tasksController.deleteTimeLog);
router.get("/tasks/:id", tasksController.getOne);
router.post("/tasks", requirePermission("task.create", "body", "projectId"), tasksController.create);
router.patch("/tasks/:id", requirePermission("task.update", "params", "id", "task"), tasksController.update);
router.delete("/tasks/:id", requirePermission("task.delete", "params", "id", "task"), tasksController.remove);

module.exports = router;

