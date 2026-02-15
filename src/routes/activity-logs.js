"use strict";

const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middleware/auth");
const activityLogsController = require("../controllers/activityLogsController");

router.use(authMiddleware);

router.get("/activity-logs", activityLogsController.list);

module.exports = router;
