"use strict";

/**
 * Types / shapes used by the Today's Focus Analytical Report.
 * Kept in one place for consistency between data layer, KPIs, and API response.
 */

/**
 * "Today's Focus" task definition (documented for UI tooltips):
 * - plannedDate === selectedDate, OR
 * - completed on selectedDate (completedAt in day), OR
 * - started on selectedDate (startedAt in day), OR
 * - has time logged on selectedDate (timeLogs for that day), OR
 * - active (not completed) with dueDate === selectedDate
 */
const TODAYS_FOCUS_DEFINITION =
  "Tasks planned for the day, or started/completed on the day, or with time logged that day, or due that day and still active.";

/**
 * Raw task row as returned from DB (minimal fields needed for KPIs).
 * @typedef {Object} TaskRow
 * @property {number} id
 * @property {number} projectId
 * @property {Date|null} plannedDate
 * @property {Date|null} dueDate
 * @property {Date|null} createdAt
 * @property {Date|null} startedAt
 * @property {Date|null} completedAt
 * @property {number[]} assigneeIds
 * @property {Array<{ userId: number, hoursLogged: number }>} timeLogs
 */

/**
 * Per-day raw data for a single date (used for selected date, yesterday, and each of last 7 days).
 * @typedef {Object} DayRawData
 * @property {string} date - "YYYY-MM-DD"
 * @property {TaskRow[]} tasks
 */

module.exports = {
  TODAYS_FOCUS_DEFINITION,
};
