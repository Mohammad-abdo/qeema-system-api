"use strict";

const { prisma } = require("../lib/prisma");
const { notifyUsers } = require("../lib/notifyUsers");
const { subDays } = require("date-fns");
const { formatInTimeZone } = require("date-fns-tz");

const CAIRO_TIMEZONE = "Africa/Cairo";
const CAIRO_UTC_OFFSET_HOURS = 2;

function getCairoDateStringDaysAgo(days) {
  const d = subDays(new Date(), days);
  return formatInTimeZone(d, CAIRO_TIMEZONE, "yyyy-MM-dd");
}

function getCairoDayRangeUtc(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, d, -CAIRO_UTC_OFFSET_HOURS, 0, 0, 0));
  const end = new Date(Date.UTC(y, m - 1, d, 24 - CAIRO_UTC_OFFSET_HOURS - 1, 59, 59, 999));
  return { start, end };
}

/**
 * Notify each user who has at least one unfinished task from yesterday (Cairo).
 * Call this from a daily cron at 00:00 (server or Cairo).
 */
async function runUnfinishedYesterdayNotifications() {
  const yesterdayCairo = getCairoDateStringDaysAgo(1);
  const { start: yestStart, end: yestEnd } = getCairoDayRangeUtc(yesterdayCairo);

  const tasks = await prisma.task.findMany({
    where: {
      plannedDate: { gte: yestStart, lte: yestEnd },
      completedAt: null,
      AND: [
        { OR: [{ taskStatusId: null }, { taskStatus: { isFinal: false } }] },
      ],
    },
    select: {
      id: true,
      createdById: true,
      assignees: { select: { id: true } },
    },
  });

  const userIds = new Set();
  for (const t of tasks) {
    if (t.createdById) userIds.add(t.createdById);
    for (const a of t.assignees || []) userIds.add(a.id);
  }

  if (userIds.size === 0) return 0;

  const count = await notifyUsers(
    Array.from(userIds).map((userId) => ({
      userId,
      title: "Unfinished focus tasks from yesterday",
      message: "You have focus tasks from yesterday that were not completed. Open Focus to roll them to today.",
      type: "focus_rollover_reminder",
      linkUrl: "/dashboard/focus",
    }))
  );
  return count;
}

module.exports = { runUnfinishedYesterdayNotifications };
