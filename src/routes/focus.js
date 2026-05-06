"use strict";

const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { sendSuccess, sendError, CODES } = require("../lib/errorResponse");
const { logActivity } = require("../lib/activityLogger");
const { notifyUsers } = require("../lib/notifyUsers");
const { subDays } = require("date-fns");
const { formatInTimeZone } = require("date-fns-tz");
const fs = require("fs");
const path = require("path");
const { authMiddleware } = require("../middleware/auth");
const { hasPermissionWithoutRoleBypass, isAdmin } = require("../lib/rbac");
const { toZonedTime, fromZonedTime, getTimezoneOffset } = require("date-fns-tz");

const router = express.Router();

/** Allow clear-all/auto-reset only for users with today_task.assign or admin role (RBAC). */
async function canManageFocusReset(userId) {
    if (!userId) return false;
    const id = Number(userId);
    const hasPerm = await hasPermissionWithoutRoleBypass(id, "today_task.assign");
    if (hasPerm) return true;
    return isAdmin(id);
}

const { prisma } = require("../lib/prisma");

const CAIRO_TIMEZONE = "Africa/Cairo";
/** Egypt uses UTC+2 (no DST since 2015) */
const CAIRO_UTC_OFFSET_HOURS = 2;
const TRACKER_FILE = path.join(process.cwd(), ".last-focus-reset");

/**
 * Get current date in Cairo timezone (YYYY-MM-DD format)
 */
function getCairoDateString() {
    return formatInTimeZone(new Date(), CAIRO_TIMEZONE, "yyyy-MM-dd");
}

/**
 * Get Cairo date string for N days ago in Cairo
 */
function getCairoDateStringDaysAgo(days) {
    const d = subDays(new Date(), days);
    return formatInTimeZone(d, CAIRO_TIMEZONE, "yyyy-MM-dd");
}

/**
 * Get start and end of a Cairo calendar day in UTC (for DB queries).
 * Uses timezone-aware date-fns-tz logic to handle daylight saving time (DST).
 * @param {string} dateStr - YYYY-MM-DD in Cairo
 * @returns {{ start: Date, end: Date }}
 */
function getCairoDayRangeUtc(dateStr) {
    if (fromZonedTime) {
        const start = fromZonedTime(`${dateStr}T00:00:00`, CAIRO_TIMEZONE);
        const end = fromZonedTime(`${dateStr}T23:59:59.999`, CAIRO_TIMEZONE);
        return { start, end };
    }
    
    // Fallback if fromZonedTime is not available in this version of date-fns-tz
    const [y, m, d] = dateStr.split("-").map(Number);
    // Approximate midnight UTC for the target date
    const approxMidnightUtc = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
    // Determine the active offset for that day in Cairo in milliseconds
    const offsetMs = getTimezoneOffset(CAIRO_TIMEZONE, approxMidnightUtc);
    const offsetHours = offsetMs / (1000 * 60 * 60);

    const start = new Date(Date.UTC(y, m - 1, d, -offsetHours, 0, 0, 0));
    const end = new Date(Date.UTC(y, m - 1, d, 24 - offsetHours - 1, 59, 59, 999));
    return { start, end };
}

function parseShiftDate(dateStr) {
    if (!dateStr) return getCairoDateString();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
    return dateStr;
}

function parseDateTimeField(value) {
    if (value === null || value === undefined || value === "") return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
}

/**
 * Working duration excluding pause time (wall clock minus paused segments).
 */
function computeEffectiveDurationMinutes(shift) {
    if (!shift?.startAt) return null;
    const now = new Date();
    const end = shift.endAt || now;
    const wallMs = end.getTime() - shift.startAt.getTime();
    let pauseMs = (shift.pausedSecondsTotal || 0) * 1000;
    if (shift.pausedAt) {
        const pauseEnd = shift.endAt || now;
        pauseMs += pauseEnd.getTime() - shift.pausedAt.getTime();
    }
    return Math.max(0, Math.round((wallMs - pauseMs) / 60000));
}

function buildShiftStatus(shift) {
    if (!shift) {
        return {
            status: "not_started",
            shift: null,
            durationMinutes: null,
        };
    }

    let status = "started";
    if (shift.endAt) status = "ended";
    else if (shift.pausedAt) status = "paused";

    const durationMinutes = computeEffectiveDurationMinutes(shift);

    return {
        status,
        shift,
        durationMinutes,
    };
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
 * If we've crossed midnight Cairo since last reset, persist the new reset date only.
 * We do NOT clear plannedDate here so that unfinished focus tasks from yesterday remain
 * queryable for GET /focus/unfinished-yesterday and user can roll them to today via POST /focus/rollover.
 */
async function checkAndRunMidnightCairoReset(req) {
    const todayCairo = getCairoDateString();
    const lastReset = getLastResetDate();
    const needsReset = !lastReset || lastReset !== todayCairo;
    if (!needsReset) return;
    saveLastResetDate(todayCairo);
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

        await checkAndRunMidnightCairoReset(req);

        const todayCairo = getCairoDateString();
        const { start: todayStart, end: todayEnd } = getCairoDayRangeUtc(todayCairo);

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
 * GET /api/v1/focus/unfinished-yesterday
 * Tasks planned for yesterday (Cairo) that are not completed and user is assignee or creator.
 * Used by Focus page banner for rollover.
 */
router.get("/focus/unfinished-yesterday", authMiddleware, async (req, res) => {
    try {
        const userId = Number(req.user?.id);
        if (!userId) {
            return sendError(res, 401, "Unauthorized", { code: CODES.UNAUTHORIZED });
        }
        const yesterdayCairo = getCairoDateStringDaysAgo(1);
        const { start: yestStart, end: yestEnd } = getCairoDayRangeUtc(yesterdayCairo);

        const tasks = await prisma.task.findMany({
            where: {
                plannedDate: { gte: yestStart, lte: yestEnd },
                completedAt: null,
                AND: [
                    { OR: [ { taskStatusId: null }, { taskStatus: { isFinal: false } } ] },
                    { OR: [ { assignees: { some: { id: userId } } }, { createdById: userId } ] },
                ],
            },
            select: {
                id: true,
                title: true,
                projectId: true,
                status: true,
                taskStatusId: true,
                project: { select: { id: true, name: true } },
            },
            orderBy: { updatedAt: "desc" },
        });

        sendSuccess(res, { tasks });
    } catch (error) {
        console.error("GET /focus/unfinished-yesterday Error:", error);
        sendError(res, 500, "Failed to load unfinished yesterday tasks", {
            code: CODES.INTERNAL_ERROR,
            details: error.message,
        });
    }
});

/**
 * POST /api/v1/focus/rollover
 * Roll current user's unfinished-yesterday tasks to today (Cairo). Sets plannedDate to today and increments rolloverCount.
 */
router.post("/focus/rollover", authMiddleware, async (req, res) => {
    try {
        const userId = Number(req.user?.id);
        if (!userId) {
            return sendError(res, 401, "Unauthorized", { code: CODES.UNAUTHORIZED });
        }
        const yesterdayCairo = getCairoDateStringDaysAgo(1);
        const { start: yestStart, end: yestEnd } = getCairoDayRangeUtc(yesterdayCairo);
        const todayCairo = getCairoDateString();
        const { start: todayStart } = getCairoDayRangeUtc(todayCairo);

        const toRoll = await prisma.task.findMany({
            where: {
                plannedDate: { gte: yestStart, lte: yestEnd },
                completedAt: null,
                AND: [
                    { OR: [ { taskStatusId: null }, { taskStatus: { isFinal: false } } ] },
                    { OR: [ { assignees: { some: { id: userId } } }, { createdById: userId } ] },
                ],
            },
            select: { id: true, assignees: { select: { id: true } } },
        });

        if (toRoll.length === 0) {
            return sendSuccess(res, { rolledCount: 0, tasks: [] });
        }

        const taskIds = toRoll.map((t) => t.id);
        await prisma.task.updateMany({
            where: { id: { in: taskIds } },
            data: {
                plannedDate: todayStart,
                rolloverCount: { increment: 1 },
            },
        });

        await logActivity({
            actionType: "focus_rollover",
            actionCategory: "today_task",
            entityType: "task",
            entityId: taskIds[0],
            performedById: userId,
            actionSummary: `Rolled ${toRoll.length} unfinished focus task(s) to today`,
            actionDetails: {
                taskIds,
                rolledCount: toRoll.length,
                fromDate: yesterdayCairo,
                toDate: todayCairo,
                timezone: CAIRO_TIMEZONE,
            },
        }, req);

        const assigneeIds = [...new Set(toRoll.flatMap((t) => (t.assignees || []).map((a) => a.id)))].filter(Boolean);
        if (assigneeIds.length > 0) {
            await notifyUsers(
                assigneeIds.map((id) => ({
                    userId: id,
                    title: "Focus tasks rolled to today",
                    message: `${toRoll.length} task(s) from yesterday were rolled to today's focus.`,
                    type: "focus_rollover",
                    linkUrl: "/dashboard/focus",
                }))
            );
        }

        const rolled = await prisma.task.findMany({
            where: { id: { in: taskIds } },
            select: {
                id: true,
                title: true,
                projectId: true,
                project: { select: { name: true } },
                status: true,
                plannedDate: true,
                rolloverCount: true,
            },
        });

        sendSuccess(res, { rolledCount: rolled.length, tasks: rolled });
    } catch (error) {
        console.error("POST /focus/rollover Error:", error);
        sendError(res, 500, "Failed to roll over focus tasks", {
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
        const { start: todayStart, end: todayEnd } = getCairoDayRangeUtc(getCairoDateString());

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
            await logActivity({
                actionType: "user_cleared_focus",
                actionCategory: "today_task",
                performedById: userId,
                actionSummary: `Cleared my today's focus (${tasksToClear.length} task(s))`,
                actionDetails: { tasksCleared: tasksToClear.length },
            }, req);
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
 * Check if we need to reset today's focus (authenticated only).
 */
router.get("/focus/should-reset", authMiddleware, async (req, res) => {
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
 * Clear all users' today's focus tasks. Requires auth and today_task.assign or admin.
 */
router.post("/focus/clear-all", authMiddleware, async (req, res) => {
    try {
        const userId = Number(req.user?.id);
        const allowed = await canManageFocusReset(userId);
        if (!allowed) {
            return sendError(res, 403, "Permission denied", { code: CODES.FORBIDDEN, requestId: req.id });
        }
        const { start: todayStart, end: todayEnd } = getCairoDayRangeUtc(getCairoDateString());

        // Find all tasks scheduled for today (Cairo) with assignees for notifications
        const tasksToClear = await prisma.task.findMany({
            where: {
                plannedDate: {
                    gte: todayStart,
                    lte: todayEnd,
                },
            },
            select: { id: true, assignees: { select: { id: true } } },
        });

        if (tasksToClear.length > 0) {
            const taskIds = tasksToClear.map((t) => t.id);
            const assigneeIds = [...new Set(tasksToClear.flatMap((t) => (t.assignees || []).map((a) => a.id)))];

            // Clear plannedDate
            await prisma.task.updateMany({
                where: { id: { in: taskIds } },
                data: { plannedDate: null },
            });

            if (assigneeIds.length > 0) {
                await notifyUsers(
                    assigneeIds.map((userId) => ({
                        userId,
                        title: "Today's focus was cleared",
                        message: "Your today's focus tasks have been cleared (by admin or system reset).",
                        type: "focus_cleared",
                        linkUrl: "/dashboard/focus",
                    }))
                );
            }

            await logActivity({
                actionType: "system_reset_focus",
                actionCategory: "today_task",
                entityType: "system",
                entityId: 0,
                performedById: req.user?.id ?? null,
                actionSummary: `System reset cleared ${tasksToClear.length} tasks from today's focus`,
                actionDetails: {
                    resetTime: new Date().toISOString(),
                    cairoDate: getCairoDateString(),
                    tasksCleared: tasksToClear.length,
                    timezone: CAIRO_TIMEZONE,
                },
            }, req);
        }

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
 * Automatically check and reset if needed. Requires auth and today_task.assign or admin.
 */
router.post("/focus/auto-reset", authMiddleware, async (req, res) => {
    try {
        const userId = Number(req.user?.id);
        const allowed = await canManageFocusReset(userId);
        if (!allowed) {
            return sendError(res, 403, "Permission denied", { code: CODES.FORBIDDEN, requestId: req.id });
        }
        const todayCairo = getCairoDateString();
        const lastReset = getLastResetDate();
        const needsReset = !lastReset || lastReset !== todayCairo;

        if (needsReset) {
            const cairoTime = formatInTimeZone(new Date(), CAIRO_TIMEZONE, "PPpp");
            console.log(`🔄 New day detected in Cairo timezone: ${cairoTime}`);
            console.log("Triggering automatic reset of today's focus...");

            const dayToClear = lastReset || getCairoDateStringDaysAgo(1);
            const { start: clearStart, end: clearEnd } = getCairoDayRangeUtc(dayToClear);

            const tasksToClear = await prisma.task.findMany({
                where: {
                    plannedDate: {
                        gte: clearStart,
                        lte: clearEnd,
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

                await logActivity({
                    actionType: "system_reset_focus",
                    actionCategory: "today_task",
                    entityType: "system",
                    entityId: 0,
                    performedById: null,
                    actionSummary: `Automatic daily reset cleared ${tasksToClear.length} tasks from today's focus`,
                    actionDetails: {
                        resetTime: new Date().toISOString(),
                        cairoDate: getCairoDateString(),
                        tasksCleared: tasksToClear.length,
                        timezone: CAIRO_TIMEZONE,
                    },
                }, req);
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

/**
 * POST /api/v1/focus/shift/start
 * Start current user's shift for a date (default: today in Cairo)
 */
router.post("/focus/shift/start", authMiddleware, async (req, res) => {
    try {
        const userId = Number(req.user?.id);
        if (!userId) {
            return sendError(res, 401, "Unauthorized", { code: CODES.UNAUTHORIZED, requestId: req.id });
        }

        const shiftDate = parseShiftDate(req.body?.date);
        if (!shiftDate) {
            return sendError(res, 400, "Invalid date format. Expected YYYY-MM-DD", { code: CODES.BAD_REQUEST, requestId: req.id });
        }

        const existing = await prisma.workShift.findUnique({
            where: { userId_shiftDate: { userId, shiftDate } },
        });
        if (existing) {
            return sendError(
                res,
                409,
                existing.endAt ? "Shift already completed for this date" : "Shift already started for this date",
                { code: CODES.CONFLICT, requestId: req.id }
            );
        }

        const shift = await prisma.workShift.create({
            data: {
                userId,
                shiftDate,
                startAt: new Date(),
                pausedAt: null,
                pausedSecondsTotal: 0,
                notes: req.body?.notes || null,
            },
        });

        await logActivity({
            actionType: "work_shift_started",
            actionCategory: "today_task",
            entityType: "work_shift",
            entityId: shift.id,
            performedById: userId,
            actionSummary: "User started a daily shift",
            actionDetails: {
                shiftDate,
                startAt: shift.startAt.toISOString(),
            },
        }, req);

        sendSuccess(res, buildShiftStatus(shift));
    } catch (error) {
        if (error?.code === "P2002") {
            return sendError(res, 409, "Shift already started for this date", { code: CODES.CONFLICT, requestId: req.id });
        }
        console.error("POST /focus/shift/start Error:", error);
        sendError(res, 500, "Failed to start shift", {
            code: CODES.INTERNAL_ERROR,
            requestId: req.id,
        });
    }
});

/**
 * POST /api/v1/focus/shift/end
 * End current user's started shift for a date (default: today in Cairo)
 */
router.post("/focus/shift/end", authMiddleware, async (req, res) => {
    try {
        const userId = Number(req.user?.id);
        if (!userId) {
            return sendError(res, 401, "Unauthorized", { code: CODES.UNAUTHORIZED, requestId: req.id });
        }

        const shiftDate = parseShiftDate(req.body?.date);
        if (!shiftDate) {
            return sendError(res, 400, "Invalid date format. Expected YYYY-MM-DD", { code: CODES.BAD_REQUEST, requestId: req.id });
        }

        const existing = await prisma.workShift.findUnique({
            where: { userId_shiftDate: { userId, shiftDate } },
        });

        if (!existing) {
            return sendError(res, 404, "No started shift found for this date", { code: CODES.NOT_FOUND, requestId: req.id });
        }
        if (existing.endAt) {
            return sendError(res, 409, "Shift already ended for this date", { code: CODES.CONFLICT, requestId: req.id });
        }

        const now = new Date();
        let extraPauseSec = 0;
        if (existing.pausedAt) {
            extraPauseSec = Math.floor((now.getTime() - existing.pausedAt.getTime()) / 1000);
        }
        const shift = await prisma.workShift.update({
            where: { id: existing.id },
            data: {
                endAt: now,
                pausedAt: null,
                pausedSecondsTotal: (existing.pausedSecondsTotal || 0) + extraPauseSec,
            },
        });

        await logActivity({
            actionType: "work_shift_ended",
            actionCategory: "today_task",
            entityType: "work_shift",
            entityId: shift.id,
            performedById: userId,
            actionSummary: "User ended a daily shift",
            actionDetails: {
                shiftDate,
                startAt: shift.startAt?.toISOString?.() || null,
                endAt: shift.endAt?.toISOString?.() || null,
            },
        }, req);

        sendSuccess(res, buildShiftStatus(shift));
    } catch (error) {
        console.error("POST /focus/shift/end Error:", error);
        sendError(res, 500, "Failed to end shift", {
            code: CODES.INTERNAL_ERROR,
            requestId: req.id,
        });
    }
});

/**
 * POST /api/v1/focus/shift/pause
 * Pause an active shift (break, meeting, etc.). Duration excludes paused time.
 */
router.post("/focus/shift/pause", authMiddleware, async (req, res) => {
    try {
        const userId = Number(req.user?.id);
        if (!userId) {
            return sendError(res, 401, "Unauthorized", { code: CODES.UNAUTHORIZED, requestId: req.id });
        }

        const shiftDate = parseShiftDate(req.body?.date);
        if (!shiftDate) {
            return sendError(res, 400, "Invalid date format. Expected YYYY-MM-DD", { code: CODES.BAD_REQUEST, requestId: req.id });
        }

        const existing = await prisma.workShift.findUnique({
            where: { userId_shiftDate: { userId, shiftDate } },
        });

        if (!existing) {
            return sendError(res, 404, "No shift found for this date", { code: CODES.NOT_FOUND, requestId: req.id });
        }
        if (existing.endAt) {
            return sendError(res, 409, "Shift already ended", { code: CODES.CONFLICT, requestId: req.id });
        }
        if (existing.pausedAt) {
            return sendError(res, 409, "Shift is already paused", { code: CODES.CONFLICT, requestId: req.id });
        }

        const shift = await prisma.workShift.update({
            where: { id: existing.id },
            data: { pausedAt: new Date() },
        });

        await logActivity({
            actionType: "work_shift_paused",
            actionCategory: "today_task",
            entityType: "work_shift",
            entityId: shift.id,
            performedById: userId,
            actionSummary: "User paused a daily shift",
            actionDetails: { shiftDate, pausedAt: shift.pausedAt.toISOString() },
        }, req);

        sendSuccess(res, buildShiftStatus(shift));
    } catch (error) {
        console.error("POST /focus/shift/pause Error:", error);
        sendError(res, 500, "Failed to pause shift", {
            code: CODES.INTERNAL_ERROR,
            requestId: req.id,
        });
    }
});

/**
 * POST /api/v1/focus/shift/resume
 * Resume a paused shift; accumulates pause time into pausedSecondsTotal.
 */
router.post("/focus/shift/resume", authMiddleware, async (req, res) => {
    try {
        const userId = Number(req.user?.id);
        if (!userId) {
            return sendError(res, 401, "Unauthorized", { code: CODES.UNAUTHORIZED, requestId: req.id });
        }

        const shiftDate = parseShiftDate(req.body?.date);
        if (!shiftDate) {
            return sendError(res, 400, "Invalid date format. Expected YYYY-MM-DD", { code: CODES.BAD_REQUEST, requestId: req.id });
        }

        const existing = await prisma.workShift.findUnique({
            where: { userId_shiftDate: { userId, shiftDate } },
        });

        if (!existing) {
            return sendError(res, 404, "No shift found for this date", { code: CODES.NOT_FOUND, requestId: req.id });
        }
        if (existing.endAt) {
            return sendError(res, 409, "Shift already ended", { code: CODES.CONFLICT, requestId: req.id });
        }
        if (!existing.pausedAt) {
            return sendError(res, 409, "Shift is not paused", { code: CODES.CONFLICT, requestId: req.id });
        }

        const now = new Date();
        const deltaSec = Math.floor((now.getTime() - existing.pausedAt.getTime()) / 1000);
        const shift = await prisma.workShift.update({
            where: { id: existing.id },
            data: {
                pausedAt: null,
                pausedSecondsTotal: (existing.pausedSecondsTotal || 0) + deltaSec,
            },
        });

        await logActivity({
            actionType: "work_shift_resumed",
            actionCategory: "today_task",
            entityType: "work_shift",
            entityId: shift.id,
            performedById: userId,
            actionSummary: "User resumed a daily shift",
            actionDetails: { shiftDate, pauseSegmentSeconds: deltaSec },
        }, req);

        sendSuccess(res, buildShiftStatus(shift));
    } catch (error) {
        console.error("POST /focus/shift/resume Error:", error);
        sendError(res, 500, "Failed to resume shift", {
            code: CODES.INTERNAL_ERROR,
            requestId: req.id,
        });
    }
});

/**
 * GET /api/v1/focus/shift/me?date=YYYY-MM-DD
 */
router.get("/focus/shift/me", authMiddleware, async (req, res) => {
    try {
        const userId = Number(req.user?.id);
        if (!userId) {
            return sendError(res, 401, "Unauthorized", { code: CODES.UNAUTHORIZED, requestId: req.id });
        }

        const shiftDate = parseShiftDate(req.query?.date);
        if (!shiftDate) {
            return sendError(res, 400, "Invalid date format. Expected YYYY-MM-DD", { code: CODES.BAD_REQUEST, requestId: req.id });
        }

        const shift = await prisma.workShift.findUnique({
            where: { userId_shiftDate: { userId, shiftDate } },
        });

        sendSuccess(res, {
            date: shiftDate,
            ...buildShiftStatus(shift),
        });
    } catch (error) {
        console.error("GET /focus/shift/me Error:", error);
        sendError(res, 500, "Failed to load shift status", {
            code: CODES.INTERNAL_ERROR,
            requestId: req.id,
        });
    }
});

/**
 * GET /api/v1/focus/shift/daily?date=YYYY-MM-DD
 */
router.get("/focus/shift/daily", authMiddleware, async (req, res) => {
    try {
        const requesterId = Number(req.user?.id);
        if (!requesterId) {
            return sendError(res, 401, "Unauthorized", { code: CODES.UNAUTHORIZED, requestId: req.id });
        }

        const canView = await hasPermissionWithoutRoleBypass(requesterId, "focus.shift.daily.view");
        if (!canView) {
            return sendError(res, 403, "Permission denied", { code: CODES.FORBIDDEN, requestId: req.id });
        }

        const shiftDate = parseShiftDate(req.query?.date);
        if (!shiftDate) {
            return sendError(res, 400, "Invalid date format. Expected YYYY-MM-DD", { code: CODES.BAD_REQUEST, requestId: req.id });
        }

        const rows = await prisma.workShift.findMany({
            where: { shiftDate },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        role: true,
                        team: { select: { name: true } },
                        roles: { select: { role: { select: { name: true } } } },
                    },
                },
            },
            orderBy: { startAt: "asc" },
        });

        const data = rows.map((row) => {
            const roleNames = (row.user?.roles || []).map((entry) => entry.role?.name).filter(Boolean);
            const durationMinutes = computeEffectiveDurationMinutes(row);
            return {
                id: row.id,
                shiftDate: row.shiftDate,
                startAt: row.startAt,
                endAt: row.endAt,
                pausedAt: row.pausedAt,
                durationMinutes,
                notes: row.notes,
                user: {
                    id: row.user?.id,
                    username: row.user?.username || "Unknown",
                    role: roleNames[0] || row.user?.role || "developer",
                    team: row.user?.team?.name || null,
                },
            };
        });

        await logActivity({
            actionType: "work_shift_daily_report_viewed",
            actionCategory: "today_task",
            entityType: "work_shift",
            performedById: requesterId,
            actionSummary: "User viewed daily shift report",
            actionDetails: {
                shiftDate,
                rowsCount: data.length,
            },
        }, req);

        sendSuccess(res, { date: shiftDate, rows: data });
    } catch (error) {
        console.error("GET /focus/shift/daily Error:", error);
        sendError(res, 500, "Failed to load daily shift report", {
            code: CODES.INTERNAL_ERROR,
            requestId: req.id,
        });
    }
});

/**
 * PATCH /api/v1/focus/shift/:id
 * Admin/PM correction endpoint for shift date/time/notes.
 */
router.patch("/focus/shift/:id", authMiddleware, async (req, res) => {
    try {
        const requesterId = Number(req.user?.id);
        if (!requesterId) {
            return sendError(res, 401, "Unauthorized", { code: CODES.UNAUTHORIZED, requestId: req.id });
        }

        const canEdit = await hasPermissionWithoutRoleBypass(requesterId, "focus.shift.edit");
        if (!canEdit) {
            return sendError(res, 403, "Permission denied", { code: CODES.FORBIDDEN, requestId: req.id });
        }

        const shiftId = Number(req.params?.id);
        if (!shiftId) {
            return sendError(res, 400, "Invalid shift id", { code: CODES.BAD_REQUEST, requestId: req.id });
        }

        const existing = await prisma.workShift.findUnique({ where: { id: shiftId } });
        if (!existing) {
            return sendError(res, 404, "Shift record not found", { code: CODES.NOT_FOUND, requestId: req.id });
        }

        const nextShiftDate = req.body?.shiftDate !== undefined ? parseShiftDate(req.body.shiftDate) : existing.shiftDate;
        if (!nextShiftDate) {
            return sendError(res, 400, "Invalid shiftDate format. Expected YYYY-MM-DD", { code: CODES.BAD_REQUEST, requestId: req.id });
        }

        const parsedStartAt = req.body?.startAt !== undefined ? parseDateTimeField(req.body.startAt) : existing.startAt;
        if (!parsedStartAt) {
            return sendError(res, 400, "Invalid startAt datetime", { code: CODES.BAD_REQUEST, requestId: req.id });
        }

        const parsedEndAt = req.body?.endAt !== undefined
            ? (req.body.endAt === null || req.body.endAt === "" ? null : parseDateTimeField(req.body.endAt))
            : existing.endAt;
        if (req.body?.endAt !== undefined && req.body.endAt !== null && req.body.endAt !== "" && !parsedEndAt) {
            return sendError(res, 400, "Invalid endAt datetime", { code: CODES.BAD_REQUEST, requestId: req.id });
        }
        if (parsedEndAt && parsedStartAt > parsedEndAt) {
            return sendError(res, 400, "startAt must be earlier than or equal to endAt", { code: CODES.BAD_REQUEST, requestId: req.id });
        }

        const nextNotes = req.body?.notes !== undefined ? (req.body.notes || null) : existing.notes;

        const nextPausedAt = req.body?.pausedAt !== undefined
            ? (req.body.pausedAt === null || req.body.pausedAt === "" ? null : parseDateTimeField(req.body.pausedAt))
            : existing.pausedAt;
        if (req.body?.pausedAt !== undefined && req.body.pausedAt !== null && req.body.pausedAt !== "" && !nextPausedAt) {
            return sendError(res, 400, "Invalid pausedAt datetime", { code: CODES.BAD_REQUEST, requestId: req.id });
        }

        let nextPausedSecondsTotal = existing.pausedSecondsTotal ?? 0;
        if (req.body?.pausedSecondsTotal !== undefined) {
            const n = Number(req.body.pausedSecondsTotal);
            if (!Number.isFinite(n) || n < 0 || n > 86400 * 365) {
                return sendError(res, 400, "Invalid pausedSecondsTotal", { code: CODES.BAD_REQUEST, requestId: req.id });
            }
            nextPausedSecondsTotal = Math.floor(n);
        }

        const updated = await prisma.workShift.update({
            where: { id: shiftId },
            data: {
                shiftDate: nextShiftDate,
                startAt: parsedStartAt,
                endAt: parsedEndAt,
                notes: nextNotes,
                pausedAt: nextPausedAt,
                pausedSecondsTotal: nextPausedSecondsTotal,
            },
        });

        await logActivity({
            actionType: "work_shift_updated",
            actionCategory: "today_task",
            entityType: "work_shift",
            entityId: updated.id,
            performedById: requesterId,
            affectedUserId: updated.userId,
            actionSummary: "User corrected a daily shift record",
            actionDetails: {
                shiftId: updated.id,
                editedBy: requesterId,
                correctedAt: new Date().toISOString(),
                oldValues: {
                    shiftDate: existing.shiftDate,
                    startAt: existing.startAt?.toISOString?.() || null,
                    endAt: existing.endAt?.toISOString?.() || null,
                    notes: existing.notes || null,
                    pausedAt: existing.pausedAt?.toISOString?.() || null,
                    pausedSecondsTotal: existing.pausedSecondsTotal ?? 0,
                },
                newValues: {
                    shiftDate: updated.shiftDate,
                    startAt: updated.startAt?.toISOString?.() || null,
                    endAt: updated.endAt?.toISOString?.() || null,
                    notes: updated.notes || null,
                    pausedAt: updated.pausedAt?.toISOString?.() || null,
                    pausedSecondsTotal: updated.pausedSecondsTotal ?? 0,
                },
            },
        }, req);

        sendSuccess(res, buildShiftStatus(updated));
    } catch (error) {
        if (error?.code === "P2002") {
            return sendError(res, 409, "A shift already exists for this user and date", { code: CODES.CONFLICT, requestId: req.id });
        }
        console.error("PATCH /focus/shift/:id Error:", error);
        return sendError(res, 500, "Failed to update shift", { code: CODES.INTERNAL_ERROR, requestId: req.id });
    }
});

module.exports = router;
