"use strict";

const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middleware/auth");
const projectStatusesController = require("../controllers/projectStatusesController");

router.use(authMiddleware);

router.get("/project-statuses", projectStatusesController.list);
router.post("/project-statuses/reorder", projectStatusesController.reorder);
router.get("/project-statuses/:id", projectStatusesController.getOne);
router.post("/project-statuses", projectStatusesController.create);
router.put("/project-statuses/:id", projectStatusesController.update);
router.delete("/project-statuses/:id", projectStatusesController.remove);
router.patch("/project-statuses/:id/toggle", projectStatusesController.toggle);

module.exports = router;
