"use strict";

const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middleware/auth");
const teamsController = require("../controllers/teamsController");

router.use(authMiddleware);

router.get("/teams", teamsController.list);
router.get("/teams/:teamId/members", teamsController.listMembers);
router.post("/teams/:teamId/members", teamsController.addMember);
router.delete("/teams/:teamId/members/:userId", teamsController.removeMember);
router.get("/teams/:teamId/tasks", teamsController.getTeamTasks);
router.get("/teams/:id", teamsController.getOne);
router.post("/teams", teamsController.create);
router.patch("/teams/:id", teamsController.update);
router.put("/teams/:id", teamsController.update);
router.delete("/teams/:id", teamsController.remove);

module.exports = router;
