"use strict";

const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middleware/auth");
const usersController = require("../controllers/usersController");

router.use(authMiddleware);

router.get("/users", usersController.list);
router.get("/users/:id/projects", usersController.getProjects);
router.get("/users/:id/tasks", usersController.getTasks);
router.get("/users/:id/teams", usersController.getTeams);
router.get("/users/:id", usersController.getOne);
router.post("/users", usersController.create);
router.patch("/users/:id", usersController.update);
router.delete("/users/:id", usersController.remove);

module.exports = router;
