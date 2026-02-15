"use strict";

const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middleware/auth");
const dashboardController = require("../controllers/dashboardController");

router.use(authMiddleware);

router.get("/dashboard/summary", dashboardController.summary);

module.exports = router;
