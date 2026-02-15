"use strict";

const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middleware/auth");
const tasksController = require("../controllers/tasksController");

router.use(authMiddleware);

router.get("/tasks", tasksController.list);
router.get("/tasks/:id", tasksController.getOne);
router.post("/tasks", tasksController.create);
router.patch("/tasks/:id", tasksController.update);
router.delete("/tasks/:id", tasksController.remove);

module.exports = router;
