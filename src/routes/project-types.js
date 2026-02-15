"use strict";

const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middleware/auth");
const projectTypesController = require("../controllers/projectTypesController");

router.use(authMiddleware);

router.get("/project-types", projectTypesController.list);
router.post("/project-types/reorder", projectTypesController.reorder);
router.get("/project-types/:id", projectTypesController.getOne);
router.post("/project-types", projectTypesController.create);
router.put("/project-types/:id", projectTypesController.update);
router.delete("/project-types/:id", projectTypesController.remove);
router.patch("/project-types/:id/toggle", projectTypesController.toggle);

module.exports = router;
