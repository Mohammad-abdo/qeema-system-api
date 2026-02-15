"use strict";

const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middleware/auth");
const notificationsController = require("../controllers/notificationsController");

router.use(authMiddleware);

router.get("/notifications", notificationsController.list);
router.get("/notifications/unread-count", notificationsController.getUnreadCount);
router.patch("/notifications/:id/read", notificationsController.markAsRead);
router.post("/notifications/mark-all-read", notificationsController.markAllAsRead);
router.delete("/notifications/:id", notificationsController.remove);

module.exports = router;
