"use strict";

const REVIEW_SCORE_WEIGHTS = {
  regularityScore: 0.2,
  qualityScore: 0.25,
  speedScore: 0.2,
  communicationScore: 0.15,
  updateQualityScore: 0.1,
  complexityScore: 0.1,
};

const MANUAL_SCORE_FIELDS = [
  "qualityScore",
  "speedScore",
  "communicationScore",
  "updateQualityScore",
  "complexityScore",
];

module.exports = {
  REVIEW_SCORE_WEIGHTS,
  MANUAL_SCORE_FIELDS,
};
