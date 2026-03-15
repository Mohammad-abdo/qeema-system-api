"use strict";

const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middleware/auth");
const attachmentsController = require("../controllers/attachmentsController");

router.use(authMiddleware);

router.get("/attachments/:id", attachmentsController.download);
router.delete("/attachments/:id", attachmentsController.remove);

module.exports = router;
