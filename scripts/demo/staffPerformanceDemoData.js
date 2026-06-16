"use strict";

const { computeFinalScore, ratingFromScore } = require("../../src/services/performance/performanceCalculation");

const DEMO_DEV_PASSWORD = "Demo@12345678";

const DEMO_TEAM = {
  name: "Development Team",
  description: "Demo development team for staff performance seed data.",
};

const DEMO_PERIOD = {
  title: "Developer Performance Report",
  startDate: "2026-02-23",
  endDate: "2026-05-10",
  status: "active",
};

/** Calendar days in period (matches loadPerformancePeriod expectedWorkingDays). */
const EXPECTED_WORKING_DAYS = 77;

const DEMO_PROJECTS = [
  {
    name: "PMS Core Platform",
    description: "Core project management platform features and workflows.",
  },
  {
    name: "API Gateway",
    description: "Central API gateway and integration layer.",
  },
  {
    name: "Mobile App Backend",
    description: "Backend services supporting the mobile client.",
  },
];

const DEMO_EMPLOYEES = [
  {
    username: "amany.hamdy",
    email: "amany.hamdy@demo.local",
    displayName: "Amany Hamdy",
    jobTitle: "Full-Stack Developer",
    review: {
      updatesCount: 58,
      projectsCount: 3,
      activeDays: 62,
      regularityScore: 84,
      qualityScore: 91,
      speedScore: 87,
      communicationScore: 89,
      updateQualityScore: 88,
      complexityScore: 86,
      strengths:
        "Delivers end-to-end features with strong frontend and backend integration\nConsistently high code quality and thorough PR reviews\nReliable daily updates with clear progress notes",
      improvementPoints:
        "Can delegate more routine tasks to improve focus on complex work\nOccasionally underestimates cross-module integration effort",
      managerNotes: "Full-Stack Developer — strong contributor across the stack.",
    },
    dailyUpdates: [
      {
        updateDate: "2026-03-15",
        projectName: "PMS Core Platform",
        updateText: "Completed user dashboard widgets and wired API pagination.",
        status: "done",
      },
      {
        updateDate: "2026-04-20",
        projectName: "API Gateway",
        updateText: "Integrated auth middleware and added rate-limiting rules.",
        status: "in_progress",
      },
    ],
  },
  {
    username: "ahmed.raouf",
    email: "ahmed.raouf@demo.local",
    displayName: "Ahmed Raouf",
    jobTitle: "Full-Stack Developer",
    review: {
      updatesCount: 52,
      projectsCount: 2,
      activeDays: 58,
      regularityScore: 78,
      qualityScore: 86,
      speedScore: 82,
      communicationScore: 84,
      updateQualityScore: 80,
      complexityScore: 78,
      strengths:
        "Solid full-stack delivery on assigned modules\nGood collaboration with QA during release cycles\nMaintains readable, well-structured components",
      improvementPoints:
        "Increase update frequency during blocked tasks\nImprove estimation accuracy on multi-sprint features",
      managerNotes: "Full-Stack Developer — dependable on feature delivery.",
    },
    dailyUpdates: [
      {
        updateDate: "2026-03-10",
        projectName: "PMS Core Platform",
        updateText: "Fixed task filter bugs and updated unit tests.",
        status: "done",
      },
      {
        updateDate: "2026-04-08",
        projectName: "PMS Core Platform",
        updateText: "Working on reports export modal and filter persistence.",
        status: "in_progress",
      },
    ],
  },
  {
    username: "ahmed.mahmoud",
    email: "ahmed.mahmoud@demo.local",
    displayName: "Ahmed Mahmoud",
    jobTitle: "Full-Stack Developer",
    review: {
      updatesCount: 45,
      projectsCount: 2,
      activeDays: 54,
      regularityScore: 74,
      qualityScore: 80,
      speedScore: 76,
      communicationScore: 78,
      updateQualityScore: 74,
      complexityScore: 72,
      strengths:
        "Steady progress on UI polish and form validation\nResponsive to code review feedback\nGood documentation of component usage",
      improvementPoints:
        "Needs more proactive communication when scope changes\nDaily updates sometimes lack blocker details",
      managerNotes: "Full-Stack Developer — growing steadily with clear coaching areas.",
    },
    dailyUpdates: [
      {
        updateDate: "2026-03-22",
        projectName: "API Gateway",
        updateText: "Added request logging and error response normalization.",
        status: "done",
      },
      {
        updateDate: "2026-04-25",
        projectName: "PMS Core Platform",
        updateText: "Implementing settings page layout and i18n keys.",
        status: "in_progress",
        blockers: "Waiting on final copy for Arabic labels.",
      },
    ],
  },
  {
    username: "mohamed.abdo",
    email: "mohamed.abdo@demo.local",
    displayName: "Mohamed Abdo",
    jobTitle: "Backend Developer",
    review: {
      updatesCount: 61,
      projectsCount: 3,
      activeDays: 65,
      regularityScore: 90,
      qualityScore: 93,
      speedScore: 91,
      communicationScore: 90,
      updateQualityScore: 92,
      complexityScore: 89,
      strengths:
        "Excellent API design and database query optimization\nHigh reliability on backend services and migrations\nStrong ownership of performance-critical endpoints",
      improvementPoints:
        "Could share more architecture decisions in team syncs\nOccasionally takes on too many parallel backend tasks",
      managerNotes: "Backend Developer — top performer on API and data layer work.",
    },
    dailyUpdates: [
      {
        updateDate: "2026-03-05",
        projectName: "API Gateway",
        updateText: "Shipped caching layer for read-heavy report endpoints.",
        status: "done",
      },
      {
        updateDate: "2026-04-12",
        projectName: "Mobile App Backend",
        updateText: "Built push notification webhook handlers.",
        status: "done",
      },
    ],
  },
  {
    username: "mohamed.khaled",
    email: "mohamed.khaled@demo.local",
    displayName: "Mohamed Khaled",
    jobTitle: "Backend Developer",
    review: {
      updatesCount: 38,
      projectsCount: 2,
      activeDays: 48,
      regularityScore: 66,
      qualityScore: 72,
      speedScore: 70,
      communicationScore: 68,
      updateQualityScore: 65,
      complexityScore: 64,
      strengths:
        "Completes assigned backend tickets within agreed timelines\nShows improvement in test coverage for service modules\nWilling to pair on debugging production issues",
      improvementPoints:
        "Increase daily update consistency during the period\nNeeds deeper attention to edge cases in API validation\nImprove response time on code review threads",
      managerNotes: "Backend Developer — acceptable performance with clear improvement plan.",
      actionPlan:
        "Submit daily updates by end of day\nPair with Mohamed Abdo on API review checklist\nTarget 2 additional active days per month",
    },
    dailyUpdates: [
      {
        updateDate: "2026-03-18",
        projectName: "Mobile App Backend",
        updateText: "Implemented user session refresh endpoint.",
        status: "done",
      },
      {
        updateDate: "2026-04-02",
        projectName: "API Gateway",
        updateText: "Investigating timeout issues on legacy integration routes.",
        status: "blocked",
        blockers: "Need staging credentials from DevOps.",
      },
    ],
  },
];

/**
 * Attach computed finalScore and rating to each employee review fixture.
 */
function getEmployeesWithComputedReviews() {
  return DEMO_EMPLOYEES.map((emp) => {
    const scores = {
      regularityScore: emp.review.regularityScore,
      qualityScore: emp.review.qualityScore,
      speedScore: emp.review.speedScore,
      communicationScore: emp.review.communicationScore,
      updateQualityScore: emp.review.updateQualityScore,
      complexityScore: emp.review.complexityScore,
    };
    const finalScore = computeFinalScore(scores);
    const rating = ratingFromScore(finalScore);
    return {
      ...emp,
      review: {
        ...emp.review,
        expectedWorkingDays: EXPECTED_WORKING_DAYS,
        finalScore,
        rating,
      },
    };
  });
}

module.exports = {
  DEMO_DEV_PASSWORD,
  DEMO_TEAM,
  DEMO_PERIOD,
  EXPECTED_WORKING_DAYS,
  DEMO_PROJECTS,
  DEMO_EMPLOYEES,
  getEmployeesWithComputedReviews,
};
