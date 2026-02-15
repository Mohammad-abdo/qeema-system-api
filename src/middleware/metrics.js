"use strict";

const prometheus = require("express-prometheus-middleware");

/**
 * Prometheus metrics: request count by route/method/status, request duration histogram.
 * Exposed at GET /metrics (no auth for scraping).
 */
const metricsMiddleware = prometheus({
  metricsPath: "/metrics",
  collectDefaultMetrics: false,
  requestDurationBuckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  requestLengthBuckets: [100, 1000, 10000, 100000],
  responseLengthBuckets: [100, 1000, 10000, 100000],
});

module.exports = { metricsMiddleware };
