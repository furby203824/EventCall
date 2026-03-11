# EventCall Codebase Analysis — Using Internal Plugin Modules

**Date:** March 11, 2026
**Method:** Each analytical module (validation.js, error-handler-enhanced.js, rate-limiter.js, admin-debug.js, admin-dashboard.js) was studied for its detection criteria, then those criteria were applied across the entire codebase.

---

## Plugin Modules Used as Analyzers

| Module | Role | Key Criteria Applied |
|--------|------|---------------------|
| `validation.js` | Input validation | Email RFC 6531, phone libphonenumber, file magic-number checks, disposable-email blocklist, URL HTTPS enforcement |
| `error-handler-enhanced.js` | Error classification | Severity levels (CRITICAL/HIGH/MEDIUM/LOW), retry-eligibility, HTTP status pattern matching, silent-catch detection |
| `rate-limiter.js` | Request throttling | 4 concurrent max, 700ms min delay, per-endpoint windows, GitHub header observation, 429/403 detection |
| `admin-debug.js` | Diagnostic checks | Auth state verification, module availability, DOM presence, content completeness, sensitive data exposure |
| `admin-dashboard.js` | Analytics/KPIs | Role-based access control, attendance calculations, Chart.js availability, XSS-safe rendering |

---

## Findings Summary

| Category | Issues | Highest Severity |
|----------|--------|-----------------|
| Validation Gaps | 6 | HIGH |
| Error Handling Gaps | 7 | HIGH |
| Rate Limiting Gaps | 4 | MEDIUM |
| Debug / PII Leaks | 5 | MEDIUM |
| Additional (race conditions, fallbacks) | 5 | MEDIUM |
| **Total** | **27** | |

---

## 1. Validation Gaps (criteria from `validation.js`)

`validation.js` enforces RFC 6531 email checks, disposable-domain blocking, phone normalization, file magic-number verification, and URL HTTPS enforcement. Applying those same standards across the codebase reveals:

### V-001 — URL Parameter Prefill Without Validation
- **File:** `js/rsvp-handler.js:755-776`
- **Severity:** HIGH
- **Detail:** `prefillFormFromURL()` pulls `name`, `email`, and `phone` from URL query params via `decodeURIComponent()` and assigns them directly to form fields — no email/phone validation, no sanitization.
- **Risk:** Crafted URLs could pre-populate forms with malicious or garbage data, tricking users into submitting it.

### V-002 — Weak Email Regex Fallback in RSVP Handler
- **File:** `js/rsvp-handler.js:850-851`
- **Severity:** MEDIUM
- **Detail:** When the validation module is unavailable, falls back to `^[^\s@]+@[^\s@]+\.[^\s@]+$` — accepts `a@b.c`, skips TLD checks, ignores disposable domains.
- **Risk:** Invalid emails enter the system when the full validator isn't loaded.

### V-003 — CSV Import Repeats Weak Email Regex
- **File:** `js/csv-import.js:117-119`
- **Severity:** MEDIUM
- **Detail:** Identical weak regex as V-002. Bulk imports could contain hundreds of malformed addresses.

### V-004 — utils.js Has Extremely Permissive Email Check
- **File:** `js/utils.js:76-107`
- **Severity:** HIGH
- **Detail:** Fallback `isValidEmail()` only checks `email.includes('@') && email.includes('.')` — accepts nearly anything.
- **Risk:** Used as a last-resort fallback across many modules.

### V-005 — Profile Load Skips Phone Validation
- **File:** `js/early-functions.js:1059-1069`
- **Severity:** LOW
- **Detail:** Profile data loaded from auth is assigned to form fields without phone normalization or validation.

### V-006 — File Upload Filename Not Sanitized for Path Traversal
- **File:** `js/backend-api.js:595`
- **Severity:** MEDIUM
- **Detail:** `file_name: String(fileName || '').trim()` — no path-traversal filtering. Relies entirely on backend to reject `../` sequences.

---

## 2. Error Handling Gaps (criteria from `error-handler-enhanced.js`)

`error-handler-enhanced.js` classifies errors by severity, detects network/auth/rate-limit patterns, and provides retry with backoff. Applying those standards:

### E-001 — Silent Catch in Error Logging Endpoint
- **File:** `js/error-handler.js:116`
- **Severity:** HIGH
- **Detail:** `.catch(() => {})` on the error-reporting fetch call. If the logging endpoint is down, critical errors vanish silently.
- **Recommendation:** At minimum log to `console.error` as a fallback.

### E-002 — Empty Catch Block in Body Text Parsing
- **File:** `js/form-ux.js:271`
- **Severity:** MEDIUM
- **Detail:** `try { bodyText = await clone.text(); } catch {}` — no logging, no context, makes debugging impossible.

### E-003 — User Data Load Failure Silenced
- **File:** `js/manager-system.js:706`
- **Severity:** HIGH
- **Detail:** `.catch(() => null)` swallows user data fetch failures. Dashboard may show empty/stale data with no user notification.

### E-004 — Backend API Errors Lose Context
- **Files:** `js/backend-api.js:405, 502, 572, 609, 623, 640, 657, 704, 732, 758, 820, 833, 859, 878`
- **Severity:** HIGH
- **Detail:** Pattern `const err = await resp.json().catch(() => ({}))` discards the original HTTP error if body parsing fails. Users see generic messages like "RSVP submission failed".
- **Count:** 14 occurrences across the file.

### E-005 — Login Error Handling Lacks Specificity
- **File:** `js/login-ui.js:275-277`
- **Severity:** MEDIUM
- **Detail:** Network errors, timeouts, and auth failures all produce the same generic toast. `error-handler-enhanced.js` classifies these distinctly — that logic is not used here.

### E-006 — localStorage JSON Parse Errors Lack Context
- **File:** `js/user-rsvps.js:48-76`
- **Severity:** LOW
- **Detail:** JSON.parse errors are caught but logged as generic "Error parsing RSVPs" — no indication of which storage key or what the corrupted value was.

### E-007 — No Retry Logic on Critical Fetch Paths
- **Files:** `js/github-api.js` (multiple methods)
- **Severity:** MEDIUM
- **Detail:** `error-handler-enhanced.js` provides `withRetry()` with exponential backoff, but many GitHub API calls in `github-api.js` don't use it — they fail once and give up.

---

## 3. Rate Limiting Gaps (criteria from `rate-limiter.js`)

`rate-limiter.js` enforces 4 concurrent requests, 700ms min delay, per-endpoint windows, and GitHub header monitoring. Checking where those rules are bypassed:

### R-001 — GitHub Connection Test Bypasses Rate Limiter
- **File:** `js/github-api.js:170-196`
- **Severity:** MEDIUM
- **Detail:** `testConnection()` uses `window.safeFetchGitHub()` directly instead of routing through the rate limiter queue.

### R-002 — Rate Limiter Has Conditional Bypass Path
- **File:** `js/github-api.js:120-127`
- **Severity:** MEDIUM
- **Detail:** The request method falls back through a chain: `rateLimiter.fetch()` → `safeFetchGitHub()` → raw `fetch()`. If `rateLimiter` is undefined, all requests bypass throttling.

### R-003 — CSV Import Ignores Rate Limits
- **File:** `js/csv-import.js:23-34`
- **Severity:** MEDIUM
- **Detail:** Bulk CSV parsing triggers API calls for each row but doesn't route through the rate limiter. Large imports could exhaust GitHub API limits.

### R-004 — Bulk Photo Operations Not Queued
- **File:** `js/backend-api.js:630-644`
- **Severity:** LOW
- **Detail:** `deletePhoto()` uses `_fetch()` which checks for the rate limiter, but batch deletion operations don't enforce concurrency limits.

---

## 4. Debug & PII Leak Issues (criteria from `admin-debug.js`)

`admin-debug.js` logs user objects to the console for diagnostic purposes. Applying the same scrutiny to find PII leaks across the codebase:

### D-001 — User Emails Logged on Email Actions
- **File:** `js/early-functions.js:1702`
- **Severity:** MEDIUM
- **Detail:** `console.log('Opening email client for: ${email}')` — user email addresses visible in browser console.

### D-002 — Recipient Emails in Error Logs
- **File:** `js/event-manager.js:905`
- **Severity:** MEDIUM
- **Detail:** `console.error('Failed to send reminder to ${recipient.email}:', error)` — PII in error output.

### D-003 — Full User Object Dumped to Console
- **File:** `js/admin-debug.js:25-28`
- **Severity:** MEDIUM
- **Detail:** `console.log('Full user object:', currentUser)` — includes username, name, role, and potentially email. Accessible globally via `checkAdminStatus()`.

### D-004 — RSVP Email Addresses Logged
- **File:** `js/github-api.js` (RSVP processing methods)
- **Severity:** MEDIUM
- **Detail:** Logs like `console.log('Updated existing RSVP for ${rsvpData.email}')` expose attendee emails.

### D-005 — Rate Limit State Logged
- **File:** `js/rate-limiter.js:108-121`
- **Severity:** LOW
- **Detail:** `console.log('GitHub API: ${remaining}/${limit} requests remaining')` — helps attackers gauge API usage patterns.

---

## 5. Additional Findings

### A-001 — innerHTML Without sanitizeHTML Wrapper
- **Files:** `js/user-rsvps.js:120`, `js/admin-dashboard.js:128`
- **Severity:** LOW
- **Detail:** Static HTML strings assigned via `innerHTML` without using the project's `window.utils.sanitizeHTML()` wrapper. Currently safe (no dynamic data), but breaks the established pattern and could become a vulnerability if someone later interpolates user data.

### A-002 — Race Condition in localStorage RSVP Storage
- **File:** `js/rsvp-handler.js:345-392`
- **Severity:** MEDIUM
- **Detail:** Read-modify-write on the same localStorage key without locking. Concurrent submissions could overwrite each other.

### A-003 — No HTTPS Enforcement on App Load
- **File:** `js/early-functions.js` (initialization)
- **Severity:** MEDIUM
- **Detail:** No check to redirect HTTP to HTTPS. `validation.js` enforces HTTPS for URLs, but the app itself doesn't enforce it for its own loading.

### A-004 — Disposable Email Blocklist Too Small
- **File:** `js/validation.js:19-22`
- **Severity:** MEDIUM (as also noted in Security Audit SEC-006)
- **Detail:** Only 8 domains blocked. Thousands of disposable email services exist. RSVP spam is trivially achievable with any unlisted service.

### A-005 — Sequential API Calls in Dashboard Load
- **File:** `js/manager-system.js:355-365`
- **Severity:** LOW (performance, not security)
- **Detail:** `loadEvents()` and `loadResponses()` are awaited sequentially. Both are independent — could use `Promise.all()` to save 300-500ms per login. (Also noted in Performance Analysis report.)

---

## Cross-Reference with Existing Reports

| Finding | Also in Security Audit? | Also in Performance Report? |
|---------|------------------------|----------------------------|
| V-004 (weak email) | SEC-006 (partial) | — |
| R-003 (CSV rate limit) | SEC-003 (related) | — |
| D-003 (user object dump) | — | — |
| E-004 (swallowed errors) | — | — |
| A-004 (disposable emails) | SEC-006 | — |
| A-005 (sequential API) | — | Solution 1 |

**New findings not in prior reports:** 22 of 27 issues are newly identified by this analysis.

---

## Recommendations by Priority

### P0 — Fix Immediately
1. **V-001:** Add validation to URL parameter prefill
2. **E-001:** Add fallback logging when error endpoint fails
3. **E-003:** Surface user data load failures to the UI
4. **E-004:** Preserve HTTP error context in backend-api.js

### P1 — Fix Soon
5. **V-004:** Replace `utils.js` email check with proper RFC validation
6. **R-002:** Ensure rate limiter is always initialized before API calls
7. **D-001/D-002/D-004:** Strip PII from all console.log/error calls
8. **A-002:** Add localStorage write locking for RSVP storage

### P2 — Fix When Possible
9. **V-002/V-003:** Upgrade fallback email regex in rsvp-handler and csv-import
10. **R-003:** Route CSV import API calls through rate limiter
11. **A-003:** Add HTTPS redirect in app initialization
12. **A-004:** Expand disposable email blocklist
13. **E-007:** Apply `withRetry()` to critical GitHub API fetch paths

---

*Analysis performed by applying the detection criteria from EventCall's own analytical modules (validation.js, error-handler-enhanced.js, rate-limiter.js, admin-debug.js, admin-dashboard.js) against the full codebase.*
