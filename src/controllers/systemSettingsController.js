"use strict";

const path = require("path");
const fs = require("fs");
const { prisma } = require("../lib/prisma");
const { sendError, CODES } = require("../lib/errorResponse");

const UPLOADS_BRANDING = path.join(process.cwd(), "public", "uploads", "branding");
const ALLOWED_IMAGE_TYPES = /^image\/(jpeg|png|gif|webp|svg\+xml)$/;
const MAX_LOGO_SIZE = 2 * 1024 * 1024; // 2MB

/**
 * GET /api/v1/settings/branding (public)
 * Returns systemName and systemLogo for login/sidebar.
 */
async function getBrandingPublic(req, res) {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: "general" },
    });
    const defaultName = "Qeema Tech Management";
    const defaultLogo = "/assets/logo.png";
    if (!setting?.value) {
      return res.json({ systemName: defaultName, systemLogo: defaultLogo });
    }
    try {
      const parsed = JSON.parse(setting.value);
      return res.json({
        systemName: parsed.systemName ?? defaultName,
        systemLogo: parsed.systemLogo ?? defaultLogo,
      });
    } catch (_) {
      return res.json({ systemName: defaultName, systemLogo: defaultLogo });
    }
  } catch (err) {
    console.error("[systemSettingsController] getBrandingPublic:", err);
    sendError(res, 500, err.message || "Failed to fetch branding", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

async function getByKey(req, res) {
  try {
    const key = req.query.key;
    if (!key) {
      return sendError(res, 400, "Query parameter 'key' is required", { code: CODES.BAD_REQUEST, requestId: req.id });
    }
    const setting = await prisma.systemSetting.findUnique({
      where: { key: String(key) },
    });
    return res.json(setting);
  } catch (err) {
    console.error("[systemSettingsController] getByKey:", err);
    sendError(res, 500, err.message || "Failed to fetch system setting", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

/**
 * PUT /api/v1/settings/system
 * Set or update a system setting (e.g. branding: logo, site name).
 * Body: { key, value, category? }
 * For "general" key, value is JSON string: {"systemName":"...","systemLogo":"...","allowRegistration":true}
 */
async function setByKey(req, res) {
  try {
    const userId = Number(req.user?.id);
    if (!userId) {
      return sendError(res, 401, "Unauthorized", { code: CODES.UNAUTHORIZED, requestId: req.id });
    }
    const { key, value, category } = req.body || {};
    if (!key || value === undefined) {
      return sendError(res, 400, "key and value are required", { code: CODES.BAD_REQUEST, requestId: req.id });
    }
    const valueStr = typeof value === "string" ? value : JSON.stringify(value);
    const categoryStr = category && String(category).trim() ? String(category) : "general";

    const existing = await prisma.systemSetting.findUnique({
      where: { key: String(key) },
    });

    if (existing) {
      await prisma.systemSetting.update({
        where: { key: String(key) },
        data: { value: valueStr, category: categoryStr, updatedBy: userId },
      });
    } else {
      await prisma.systemSetting.create({
        data: {
          key: String(key),
          value: valueStr,
          category: categoryStr,
          updatedBy: userId,
        },
      });
    }
    return res.json({ success: true });
  } catch (err) {
    console.error("[systemSettingsController] setByKey:", err);
    sendError(res, 500, err.message || "Failed to save system setting", { code: CODES.INTERNAL_ERROR, requestId: req.id });
  }
}

/**
 * POST /api/v1/settings/upload-logo
 * Expects multipart file field "logo". Saves to public/uploads/branding/logo.<ext>, returns { url }.
 */
async function uploadLogo(req, res) {
  const requestId = req.id;
  const userId = Number(req.user?.id);
  if (!userId) {
    return sendError(res, 401, "Unauthorized", { code: CODES.UNAUTHORIZED, requestId });
  }
  const file = req.file;
  if (!file) {
    return sendError(res, 400, "No file uploaded; use field name 'logo'", { code: CODES.BAD_REQUEST, requestId });
  }
  if (!ALLOWED_IMAGE_TYPES.test(file.mimetype)) {
    return sendError(res, 400, "Invalid file type; use image (jpeg, png, gif, webp, svg)", { code: CODES.BAD_REQUEST, requestId });
  }
  if (file.size > MAX_LOGO_SIZE) {
    return sendError(res, 400, "Logo must be under 2MB", { code: CODES.BAD_REQUEST, requestId });
  }
  try {
    if (!fs.existsSync(UPLOADS_BRANDING)) {
      fs.mkdirSync(UPLOADS_BRANDING, { recursive: true });
    }
    const ext = path.extname(file.originalname) || (file.mimetype === "image/svg+xml" ? ".svg" : ".png");
    const safeExt = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"].includes(ext.toLowerCase()) ? ext : ".png";
    const filename = `logo${safeExt}`;
    const destPath = path.join(UPLOADS_BRANDING, filename);
    fs.writeFileSync(destPath, file.buffer);
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const url = `${baseUrl}/uploads/branding/${filename}`;
    return res.json({ url });
  } catch (err) {
    console.error("[systemSettingsController] uploadLogo:", err);
    sendError(res, 500, err.message || "Failed to save logo", { code: CODES.INTERNAL_ERROR, requestId });
  }
}

module.exports = {
  getBrandingPublic,
  getByKey,
  setByKey,
  uploadLogo,
};
