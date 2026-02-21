"use strict";

const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middleware/auth");
const tasksController = require("../controllers/tasksController");

router.use(authMiddleware);

router.get("/tasks", tasksController.list);
router.get("/tasks/:id/dependency-candidates", tasksController.getDependencyCandidates);
router.post("/tasks/:id/dependencies", tasksController.addDependency);
router.delete("/tasks/:id/dependencies/:dependsOnTaskId", tasksController.removeDependency);
router.post("/tasks/:id/subtasks", tasksController.createSubtask);
router.patch("/tasks/:id/subtasks/:subtaskId", tasksController.updateSubtask);
router.delete("/tasks/:id/subtasks/:subtaskId", tasksController.removeSubtask);
router.post("/tasks/:id/comments", tasksController.createComment);
router.delete("/tasks/:id/comments/:commentId", tasksController.deleteComment);
router.get("/tasks/:id", tasksController.getOne);
router.post("/tasks", tasksController.create);
router.patch("/tasks/:id", tasksController.update);
router.delete("/tasks/:id", tasksController.remove);

module.exports = router;
