"use strict";

const express = require("express");
const { authMiddleware } = require("../middleware/auth");
const searchController = require("../controllers/searchController");

const router = express.Router();
router.use(authMiddleware);
router.get("/search", searchController.search);

module.exports = router;
