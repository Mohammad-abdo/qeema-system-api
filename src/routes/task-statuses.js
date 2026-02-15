"use strict";

const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middleware/auth");
const taskStatusesController = require("../controllers/taskStatusesController");

router.use(authMiddleware);

router.get("/task-statuses", taskStatusesController.list);
router.post("/task-statuses/reorder", taskStatusesController.reorder);
router.get("/task-statuses/:id", taskStatusesController.getOne);
router.post("/task-statuses", taskStatusesController.create);
router.put("/task-statuses/:id", taskStatusesController.update);
router.delete("/task-statuses/:id", taskStatusesController.remove);
router.patch("/task-statuses/:id/toggle", taskStatusesController.toggle);

module.exports = router;
