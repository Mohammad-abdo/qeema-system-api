"use strict";

const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middleware/auth");
const statsController = require("../controllers/statsController");

router.use(authMiddleware);

router.get("/stats/projects", statsController.getAllProjectsStats);
router.get("/stats/projects/:projectId", statsController.getProjectStats);

module.exports = router;
