"use strict";

/**
 * Date utilities for report period boundaries (UTC day).
 * Use for consistent day ranges in analytical reports.
 */

/**
 * @param {string} dateStr - "YYYY-MM-DD"
 * @returns {{ start: Date, end: Date }} UTC start/end of that calendar day
 */
function getDayRange(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
  return { start, end };
}

/**
 * @param {string} dateStr - "YYYY-MM-DD"
 * @param {number} daysAgo
 * @returns {string} "YYYY-MM-DD"
 */
function getDateDaysAgo(dateStr, daysAgo) {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

/**
 * @param {string} dateStr - "YYYY-MM-DD"
 * @returns {string} yesterday in YYYY-MM-DD
 */
function getYesterday(dateStr) {
  return getDateDaysAgo(dateStr, 1);
}

/**
 * @param {string} dateStr - "YYYY-MM-DD"
 * @returns {string[]} last 7 days including dateStr (oldest first)
 */
function getLast7Days(dateStr) {
  const out = [];
  for (let i = 6; i >= 0; i--) {
    out.push(getDateDaysAgo(dateStr, i));
  }
  return out;
}

module.exports = {
  getDayRange,
  getDateDaysAgo,
  getYesterday,
  getLast7Days,
};
