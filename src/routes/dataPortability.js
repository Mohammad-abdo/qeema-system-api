"use strict";

const express = require("express");
const router = express.Router();
const multer = require("multer");
const { authMiddleware } = require("../middleware/auth");
const { requirePermission } = require("../middleware/requirePermission");
const dataPortabilityController = require("../controllers/dataPortabilityController");

// Use multer memory storage for handling Excel file uploads in-memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // Limit uploads to 10MB
  },
});

router.use(authMiddleware);
// Enforce settings permission or admin status for data portability features
router.use(requirePermission("settings.global.write"));

// Export endpoints
router.get("/data-portability/export/excel", dataPortabilityController.exportExcel);
router.get("/data-portability/export/pdf", dataPortabilityController.exportPDF);

// Import endpoint
router.post(
  "/data-portability/import/excel",
  upload.single("file"),
  dataPortabilityController.importExcel
);

// Database backup and restore endpoints
router.get("/data-portability/database/export", dataPortabilityController.exportDatabase);
router.post(
  "/data-portability/database/import",
  upload.single("file"),
  dataPortabilityController.importDatabase
);
router.get("/data-portability/database/backups", dataPortabilityController.listLocalBackups);
router.post("/data-portability/database/backups/create", dataPortabilityController.createLocalBackup);
router.post("/data-portability/database/backups/:filename/restore", dataPortabilityController.restoreLocalBackup);
router.delete("/data-portability/database/backups/:filename", dataPortabilityController.deleteLocalBackup);

module.exports = router;
