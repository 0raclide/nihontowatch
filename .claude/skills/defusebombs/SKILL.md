# /defusebombs — Production Readiness Audit

Audit any project against the "25 signs your vibe-coded app is a ticking bomb" checklist. Produces a scored report with evidence, verdicts, and prioritized action items.

## Invocation

```
/defusebombs
/defusebombs [path/to/project]
```

If no path is given, audit the current working directory.

## Process

Run **4 parallel exploration agents**, each covering a subset of the 25 checks. Each agent must gather **concrete evidence** (file paths, line numbers, code snippets) — never guess.

### Agent 1: Secrets & Configuration (Points 1, 13, 18, 23)

Search for:
- Hardcoded API keys, tokens, secrets in source files (not .env). Patterns: `sk_`, `SG.`, `Bearer`, `key=`, `secret=`, `password=`
- `.gitignore` coverage of `.env*` files
- `.env.example` completeness vs actual env vars in use (compare line counts)
- Feature flag implementation: env-var-based toggles vs commented code blocks
- Per-environment variable separation (dev/staging/prod different keys?)

Verdict per point: PASS (no secrets in source, complete .env.example, proper flags, isolated envs) or FAIL with evidence.

### Agent 2: Infrastructure & Operations (Points 2, 9, 15, 16, 17, 19, 22)

Search for:
- Health check endpoint (`/health`, `/api/health`, `/status`, `/readiness`)
- Staging/preview environment config (Vercel preview deploys, Netlify branch deploys, Docker Compose profiles)
- Monitoring integrations: Sentry DSN, DataDog agent, LogRocket, UptimeRobot config, PagerDuty webhooks
- Logger implementation: structured logging vs bare `console.log`, external log shipping (Axiom, LogTail)
- Backup documentation: disaster recovery docs, restore playbooks, RTO/RPO targets
- CI/CD pipelines: `.github/workflows/`, `.gitlab-ci.yml`, `Jenkinsfile`, Vercel/Netlify auto-deploy config
- Test infrastructure: test runner config (vitest, jest, pytest), test file count, CI test execution

Verdict per point: PASS / PARTIAL / FAIL with evidence.

### Agent 3: Code Quality & Architecture (Points 3, 4, 5, 10, 12, 14)

Search for:
- Database migrations: `migrations/`, `alembic/`, `prisma/migrations/`, `drizzle/` — count and verify ordering
- Query patterns: `SELECT *`, `.select('*')`, `.findAll()` without column specs. Sample 5-10 queries from different files
- Error handling: try/catch patterns in API routes, error response helpers, bare `console.log(e)` without response
- Component sizes: find the 5 largest `.tsx`/`.vue`/`.svelte` files by line count. Flag anything >500 lines
- TODO/FIXME/HACK count: grep across `src/` or equivalent source directory
- Third-party API calls: does the frontend call external APIs directly (client-side fetch to non-same-origin URLs with API keys)?

Verdict per point: PASS / PARTIAL / FAIL with evidence.

### Agent 4: Security & Reliability (Points 6, 7, 8, 20, 21, 24)

Search for:
- Rate limiting: middleware, per-route throttling, IP/user-based limiters on auth and write endpoints
- Timezone handling: `new Date()` vs `Date.now()` vs `.toISOString()` patterns, database timestamp types (TIMESTAMPTZ vs TIMESTAMP)
- README quality: exists? accurate? has setup instructions?
- Input validation: request body validation (Zod, Joi, manual checks), allowlists, type guards in API routes
- CORS configuration: `Access-Control-Allow-Origin: *`, CORS middleware, security headers (HSTS, X-Frame-Options, CSP)
- Documentation for onboarding: can a new developer clone + run + deploy without tribal knowledge?

Verdict per point: PASS / PARTIAL / FAIL with evidence.

### Point 11 (Analytics)

Covered by Agent 2 (monitoring) and Agent 3 (code quality). Look for:
- Event tracking infrastructure (activity events, click tracking, page views)
- Analytics dashboards or admin pages
- Third-party analytics (GA, Mixpanel, Amplitude, PostHog)

## Output Format

After all agents return, compile results into a single markdown document at `docs/AUDIT_VIBE_CODE_BOMBS.md` (or the project's docs directory) with this structure:

```markdown
# [Project Name]: 25-Point "Ticking Bomb" Audit

**Date:** [today]
**Auditor:** Claude Code (automated codebase analysis)

## Scorecard

| # | Check | Verdict | Severity |
|---|-------|---------|----------|
| 1 | API keys hardcoded | PASS/PARTIAL/FAIL | —/Low/Medium/High |
| ... | ... | ... | ... |

**Result: X PASS, Y PARTIAL, Z FAIL**

## Detailed Findings

### 1. [Check name] — [VERDICT]
[Evidence with file paths and line numbers]
[Risk assessment if PARTIAL or FAIL]
[Recommendation if PARTIAL or FAIL]

... (repeat for all 25)

## Priority Action Items

### High Priority
1. ...

### Medium Priority
2. ...

### Low Priority
3. ...
```

## Scoring Rules

- **PASS**: The project demonstrably avoids the anti-pattern with concrete evidence
- **PARTIAL**: Some defenses exist but gaps remain. Cite what works AND what's missing
- **FAIL**: The anti-pattern is present with no meaningful mitigation

Severity (for PARTIAL and FAIL only):
- **High**: Could cause outage, data loss, or security breach
- **Medium**: Increases maintenance burden or onboarding friction
- **Low**: Code smell, not an immediate risk

## Important

- Never guess — every verdict must cite a file path or the absence of expected files
- "No evidence found" for a positive check (e.g., no rate limiter found) = FAIL, not "unknown"
- Be honest about PASSes too — if the project does something well, say so with evidence
- The audit should be useful to a developer who has never seen the codebase
- Don't create or modify any project code — this is a read-only audit
