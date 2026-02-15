"use strict";

const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middleware/auth");
const rbacController = require("../controllers/rbacController");

router.use(authMiddleware);

router.get("/rbac/check", rbacController.check);
router.post("/rbac/check", rbacController.check);
router.get("/rbac/permissions", rbacController.permissions);
router.get("/rbac/is-admin", rbacController.isAdminUser);
router.get("/rbac/roles", rbacController.listRoles);
router.get("/rbac/permissions/list", rbacController.listAllPermissions);
router.post("/rbac/roles", rbacController.createRole);
router.patch("/rbac/roles/:id", rbacController.updateRole);
router.get("/rbac/roles/:id/permissions", rbacController.getRolePermissions);
router.put("/rbac/roles/:id/permissions", rbacController.setRolePermissions);
router.delete("/rbac/roles/:id", rbacController.deleteRole);

module.exports = router;
