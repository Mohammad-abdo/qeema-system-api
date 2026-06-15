"use strict";

const { subDays } = require("date-fns");
const { formatInTimeZone, fromZonedTime, getTimezoneOffset } = require("date-fns-tz");

const CAIRO_TIMEZONE = "Africa/Cairo";

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
 * @param {string} dateStr - YYYY-MM-DD in Cairo
 * @returns {{ start: Date, end: Date }}
 */
function getCairoDayRangeUtc(dateStr) {
  if (fromZonedTime) {
    const start = fromZonedTime(`${dateStr}T00:00:00`, CAIRO_TIMEZONE);
    const end = fromZonedTime(`${dateStr}T23:59:59.999`, CAIRO_TIMEZONE);
    return { start, end };
  }

  const [y, m, d] = dateStr.split("-").map(Number);
  const approxMidnightUtc = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  const offsetMs = getTimezoneOffset(CAIRO_TIMEZONE, approxMidnightUtc);
  const offsetHours = offsetMs / (1000 * 60 * 60);

  const start = new Date(Date.UTC(y, m - 1, d, -offsetHours, 0, 0, 0));
  const end = new Date(Date.UTC(y, m - 1, d, 24 - offsetHours - 1, 59, 59, 999));
  return { start, end };
}

/**
 * Parse assignment/focus date input to YYYY-MM-DD in Cairo.
 * Defaults to Cairo today when missing or invalid.
 * @param {string|Date|null|undefined} dateStr
 * @returns {string}
 */
function parseAssignmentDate(dateStr) {
  if (!dateStr) return getCairoDateString();
  if (typeof dateStr === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const parsed = dateStr instanceof Date ? dateStr : new Date(dateStr);
  if (!Number.isNaN(parsed.getTime())) {
    return formatInTimeZone(parsed, CAIRO_TIMEZONE, "yyyy-MM-dd");
  }
  return getCairoDateString();
}

/**
 * Parse shift date; returns null when format is invalid (for validation).
 * @param {string|null|undefined} dateStr
 * @returns {string|null}
 */
function parseShiftDate(dateStr) {
  if (!dateStr) return getCairoDateString();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  return dateStr;
}

/**
 * Normalize a plannedDate value to Cairo day start (UTC instant).
 * @param {string|Date|null|undefined} value
 * @returns {Date|null}
 */
function normalizePlannedDateToCairoDayStart(value) {
  if (value === null || value === undefined || value === "") return null;
  const dateStr = parseAssignmentDate(value);
  return getCairoDayRangeUtc(dateStr).start;
}

module.exports = {
  CAIRO_TIMEZONE,
  getCairoDateString,
  getCairoDateStringDaysAgo,
  getCairoDayRangeUtc,
  parseAssignmentDate,
  parseShiftDate,
  normalizePlannedDateToCairoDayStart,
};
