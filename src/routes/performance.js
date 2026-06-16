"use strict";

const express = require("express");
const { authMiddleware } = require("../middleware/auth");
const performanceReviewController = require("../controllers/performanceReviewController");

const router = express.Router();
router.use(authMiddleware);

router.get("/access", performanceReviewController.getAccess);
router.get("/periods", performanceReviewController.getPeriods);
router.get("/dashboard", performanceReviewController.getDashboard);
router.get("/periods/:periodId/profiles/:userId", performanceReviewController.getProfile);
router.get("/periods/:periodId/reviews", performanceReviewController.getReviews);
router.post("/periods/:periodId/reviews/generate", performanceReviewController.generateReviews);
router.put("/periods/:periodId/reviews/:userId", performanceReviewController.updateReview);
router.put("/periods/:periodId/reviews/:userId/manager", performanceReviewController.saveManagerReview);
router.put("/periods/:periodId/reviews/:userId/feedback", performanceReviewController.updateFeedback);
router.post("/daily-updates", performanceReviewController.createDailyUpdate);
router.put("/daily-updates/:id", performanceReviewController.updateDailyUpdate);
router.delete("/daily-updates/:id", performanceReviewController.deleteDailyUpdate);

module.exports = router;
