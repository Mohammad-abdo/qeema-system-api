# Load and scenario tests (k6)

Run these against a running instance of the app (or backend) to validate capacity and key flows.

## Prerequisites

- [k6](https://k6.io/docs/get-started/installation/) installed (e.g. `winget install k6`, or download from k6.io).
- App running (e.g. `npm run dev` for Next.js on http://localhost:3000).
- A valid user (create via register or seed). Default script uses `USER=admin` and `PASSWORD=admin`; override with env.

## Scenarios

### login-and-api.js

Logs in via NextAuth credentials, obtains JWT, then runs project list, task list, and task CRUD (create, get, patch, delete) when at least one project exists.

**Run against Next.js (same-origin API):**

```bash
k6 run scripts/load/login-and-api.js
```

**Override base URL and credentials:**

```bash
k6 run -e BASE_URL=http://localhost:3000 -e USER=youruser -e PASSWORD=yourpass scripts/load/login-and-api.js
```

**Run against staging:**

```bash
k6 run -e BASE_URL=https://staging.example.com -e USER=loaduser -e PASSWORD=secret scripts/load/login-and-api.js
```

**Options:** 5 VUs, 30s duration; thresholds p95 < 3s and failure rate < 10%. Adjust in the script `options` or via CLI (e.g. `k6 run --vus 10 --duration 60s scripts/load/login-and-api.js`).

## Backend-only

To target the standalone backend (e.g. http://localhost:4000), you need a JWT. Either run the login-and-api flow against the Next.js app first and reuse the token, or add a scenario that logs in via Next.js then uses the token for backend URLs only.
