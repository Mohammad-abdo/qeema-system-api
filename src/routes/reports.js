"use strict";

const express = require("express");
const { authMiddleware } = require("../middleware/auth");
const reportsController = require("../controllers/reportsController");

const router = express.Router();
router.use(authMiddleware);

router.get("/todays-focus", reportsController.todaysFocusAnalyticalReport);
router.get("/staff-performance", reportsController.staffPerformanceReport);

module.exports = router;
