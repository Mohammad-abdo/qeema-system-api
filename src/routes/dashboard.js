"use strict";

const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middleware/auth");
const dashboardController = require("../controllers/dashboardController");
const reportsController = require("../controllers/reportsController");

router.use(authMiddleware);

router.get("/dashboard/summary", dashboardController.summary);
router.get("/dashboard/reports/projects", reportsController.projectsReport);
router.get("/dashboard/reports/progress", reportsController.progressReport);
router.get("/dashboard/reports/focus", reportsController.todaysFocusReport);

module.exports = router;
