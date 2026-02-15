"use strict";

const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { sendSuccess, sendError, CODES } = require("../lib/errorResponse");
const { startOfDay, endOfDay } = require("date-fns");
const { formatInTimeZone } = require("date-fns-tz");
const fs = require("fs");
const path = require("path");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

const CAIRO_TIMEZONE = "Africa/Cairo";
const TRACKER_FILE = path.join(process.cwd(), ".last-focus-reset");

/**
 * Get current date in Cairo timezone (YYYY-MM-DD format)
 */
function getCairoDateString() {
    return formatInTimeZone(new Date(), CAIRO_TIMEZONE, "yyyy-MM-dd");
}

/**
 * Get last reset date from file
 */
function getLastResetDate() {
    try {
        if (!fs.existsSync(TRACKER_FILE)) {
            return null;
        }
        return fs.readFileSync(TRACKER_FILE, "utf-8").trim();
    } catch {
        return null;
    }
}

/**
 * Save last reset date to file
 */
function saveLastResetDate(date) {
    try {
        fs.writeFileSync(TRACKER_FILE, date, "utf-8");
    } catch (error) {
        console.error("Failed to save reset date:", error);
    }
}

/**
 * GET /api/v1/focus/data
 * Get current user's focus tasks and library tasks (requires auth)
 */
router.get("/focus/data", authMiddleware, async (req, res) => {
    try {
        const userId = Number(req.user?.id);
        if (!userId) {
            return sendError(res, 401, "Unauthorized", { code: CODES.UNAUTHORIZED });
        }
        const todayStart = startOfDay(new Date());
        const todayEnd = endOfDay(new Date());

        const [focusTasks, libraryTasks] = await Promise.all([
            prisma.task.findMany({
                where: {
                    assignees: { some: { id: userId } },
                    plannedDate: { gte: todayStart, lte: todayEnd },
                    status: { not: "completed" },
                },
                select: {
                    id: true,
                    title: true,
                    status: true,
                    priority: true,
                    estimatedHours: true,
                    project: { select: { name: true } },
                },
                orderBy: { priority: "desc" },
            }),
            prisma.task.findMany({
                where: {
                    assignees: { some: { id: userId } },
                    status: { not: "completed" },
                    OR: [
                        { plannedDate: null },
                        { plannedDate: { lt: todayStart } },
                        { plannedDate: { gt: todayEnd } },
                    ],
                },
                select: {
                    id: true,
                    title: true,
                    status: true,
                    priority: true,
                    estimatedHours: true,
                    project: { select: { name: true } },
                },
                orderBy: { updatedAt: "desc" },
            }),
        ]);

        sendSuccess(res, { focusTasks, libraryTasks });
    } catch (error) {
        console.error("GET /focus/data Error:", error);
        sendError(res, 500, "Failed to load focus data", {
            code: CODES.INTERNAL_ERROR,
            details: error.message,
        });
    }
});

/**
 * POST /api/v1/focus/clear-my
 * Clear current user's today's focus (requires auth)
 */
router.post("/focus/clear-my", authMiddleware, async (req, res) => {
    try {
        const userId = Number(req.user?.id);
        if (!userId) {
            return sendError(res, 401, "Unauthorized", { code: CODES.UNAUTHORIZED });
        }
        const todayStart = startOfDay(new Date());
        const todayEnd = endOfDay(new Date());

        const tasksToClear = await prisma.task.findMany({
            where: {
                assignees: { some: { id: userId } },
                plannedDate: { gte: todayStart, lte: todayEnd },
            },
            select: { id: true },
        });

        if (tasksToClear.length > 0) {
            await prisma.task.updateMany({
                where: { id: { in: tasksToClear.map((t) => t.id) } },
                data: { plannedDate: null },
            });
        }

        sendSuccess(res, {
            success: true,
            tasksCleared: tasksToClear.length,
        });
    } catch (error) {
        console.error("POST /focus/clear-my Error:", error);
        sendError(res, 500, "Failed to clear focus", {
            code: CODES.INTERNAL_ERROR,
            details: error.message,
        });
    }
});

/**
 * GET /api/v1/focus/should-reset
 * Check if we need to reset today's focus
 */
router.get("/focus/should-reset", async (req, res) => {
    try {
        const todayCairo = getCairoDateString();
        const lastReset = getLastResetDate();

        const shouldReset = !lastReset || lastReset !== todayCairo;

        sendSuccess(res, {
            shouldReset,
            todayCairo,
            lastReset,
        });
    } catch (error) {
        console.error("Error checking if reset needed:", error);
        sendError(res, 500, "Failed to check reset status", {
            code: CODES.INTERNAL_ERROR,
        });
    }
});

/**
 * POST /api/v1/focus/clear-all
 * Clear all users' today's focus tasks
 */
router.post("/focus/clear-all", async (req, res) => {
    try {
        const todayStart = startOfDay(new Date());
        const todayEnd = endOfDay(new Date());

        // Find all tasks scheduled for today
        const tasksToClear = await prisma.task.findMany({
            where: {
                plannedDate: {
                    gte: todayStart,
                    lte: todayEnd,
                },
            },
            select: { id: true },
        });

        if (tasksToClear.length > 0) {
            // Clear plannedDate
            await prisma.task.updateMany({
                where: {
                    id: { in: tasksToClear.map((t) => t.id) },
                },
                data: { plannedDate: null },
            });

            // Log activity
            await prisma.activityLog.create({
                data: {
                    actionType: "system_reset_focus",
                    actionCategory: "today_task",
                    actionSummary: `Automatic daily reset cleared ${tasksToClear.length} tasks from today's focus`,
                    actionDetails: JSON.stringify({
                        resetTime: new Date().toISOString(),
                        cairoDate: getCairoDateString(),
                        tasksCleared: tasksToClear.length,
                        timezone: CAIRO_TIMEZONE,
                    }),
                    entityType: "system",
                    entityId: 0,
                },
            });
        }

        // Update tracker file
        saveLastResetDate(getCairoDateString());

        console.log(`✅ Auto-reset: Cleared ${tasksToClear.length} tasks from today's focus`);

        sendSuccess(res, {
            success: true,
            message: `Cleared ${tasksToClear.length} tasks from today's focus`,
            tasksCleared: tasksToClear.length,
        });
    } catch (error) {
        console.error("clearAllUsersFocus Error:", error);
        sendError(res, 500, "Failed to clear all users' focus", {
            code: CODES.INTERNAL_ERROR,
            details: error.message,
        });
    }
});

/**
 * POST /api/v1/focus/auto-reset
 * Automatically check and reset if needed
 */
router.post("/focus/auto-reset", async (req, res) => {
    try {
        const todayCairo = getCairoDateString();
        const lastReset = getLastResetDate();
        const needsReset = !lastReset || lastReset !== todayCairo;

        if (needsReset) {
            const cairoTime = formatInTimeZone(new Date(), CAIRO_TIMEZONE, "PPpp");
            console.log(`🔄 New day detected in Cairo timezone: ${cairoTime}`);
            console.log("Triggering automatic reset of today's focus...");

            const todayStart = startOfDay(new Date());
            const todayEnd = endOfDay(new Date());

            const tasksToClear = await prisma.task.findMany({
                where: {
                    plannedDate: {
                        gte: todayStart,
                        lte: todayEnd,
                    },
                },
                select: { id: true },
            });

            if (tasksToClear.length > 0) {
                await prisma.task.updateMany({
                    where: {
                        id: { in: tasksToClear.map((t) => t.id) },
                    },
                    data: { plannedDate: null },
                });

                await prisma.activityLog.create({
                    data: {
                        actionType: "system_reset_focus",
                        actionCategory: "today_task",
                        actionSummary: `Automatic daily reset cleared ${tasksToClear.length} tasks from today's focus`,
                        actionDetails: JSON.stringify({
                            resetTime: new Date().toISOString(),
                            cairoDate: getCairoDateString(),
                            tasksCleared: tasksToClear.length,
                            timezone: CAIRO_TIMEZONE,
                        }),
                        entityType: "system",
                        entityId: 0,
                    },
                });
            }

            saveLastResetDate(getCairoDateString());

            sendSuccess(res, {
                resetPerformed: true,
                message: `Cleared ${tasksToClear.length} tasks from today's focus`,
                tasksCleared: tasksToClear.length,
                cairoTime,
            });
        } else {
            sendSuccess(res, {
                resetPerformed: false,
                message: "No reset needed - already reset today",
                lastReset,
            });
        }
    } catch (error) {
        console.error("Error in autoCheckAndReset:", error);
        sendError(res, 500, "Failed to perform auto-reset", {
            code: CODES.INTERNAL_ERROR,
            details: error.message,
        });
    }
});

module.exports = router;
