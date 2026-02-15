"use strict";

const express = require("express");
const multer = require("multer");
const router = express.Router();
const { authMiddleware } = require("../middleware/auth");
const systemSettingsController = require("../controllers/systemSettingsController");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

// Public: branding for login page and sidebar (no auth)
router.get("/settings/branding", systemSettingsController.getBrandingPublic);

router.use(authMiddleware);

router.get("/settings/system", systemSettingsController.getByKey);
router.put("/settings/system", systemSettingsController.setByKey);
router.post("/settings/upload-logo", upload.single("logo"), systemSettingsController.uploadLogo);

module.exports = router;
