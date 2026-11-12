# Creator Campus — Security Audit (second re-audit, 2026-11-12)

Scope: working tree on `feature/guest-registration-security-complete` (HEAD `ca4d64f` + uncommitted). Method: code reading. **No negative authorization test was executed** (no safe test identities, no emulator). "Confirmed (static)" means the vulnerable code path is visible and the files are unchanged since last audit (verified by `git diff --ignore-all-space` showing no change in these routes); it is not a demonstrated exploit. Nothing was exploited and no production system was touched. Item numbering continues from `CREATOR_CAMPUS_SECURITY_GAP_REPORT.md`, which is preserved.

## Rechecks of the six specifically requested issues

| # | Question | Result | Evidence |
|---|---|---|---|
| 1 | Can any logged-in user adjust another ambassador's points? | **Yes — Confirmed (static)** | `api/organizer/programs/[programId]/points/adjust/route.js` checks only login; `adjustPointsManually` (points-engine.js:304) never checks program owner or ambassador/program match |
| 2 | Can a user claim rewards with another ambassador's points? | **Yes — Confirmed (static)** | `ambassador/rewards/[rewardId]/claim/route.js` takes `ambassadorId` from the body; `claimReward` never compares `ambassador.userId` with the caller or reward.programId with ambassador.programId |
| 3 | Read applications of unrelated programs? | **Yes — Confirmed (static)** | `applications/route.js` has no ownership check; returns email, phone, college |
| 4 | Import into programs they don't own? | **Yes — Confirmed (static)** | `import/route.js` passes `programId` from the URL and `caller.uid` as organizerId; `autoApprove` also accepted |
| 5 | Modify another program's points rules? | **Yes — Confirmed (static)** | `points/rules/route.js` POST: no ownership check, version from client body |
| 6 | Create rewards in another program? | **Yes — Confirmed (static)** | `rewards/route.js` POST: no ownership check |

## Previously reported high-severity issues

| ID | Issue | Status now |
|---|---|---|
| SEC-H1 | `referralCodes`/`programEvents` public read (`firestore.rules:296, 334-338`) | Confirmed (static), unchanged |
| SEC-H2 | Ledger and code list readable by any user (`points/ledger`, `referral-codes` routes) | Confirmed (static), unchanged |
| SEC-H3 | Untrusted spreadsheet parsing with `xlsx@0.18.5`, no limits | Limits absence confirmed (static); the library CVEs are from memory, `npm audit` unavailable offline: **unverified** |
| SEC-H4 | Race conditions in award (idempotency check and balance read outside transaction) | Confirmed (static) |
| SEC-H5 | Paused/draft programs and suspended ambassadors still attribute | Confirmed (static): `create-order`/`register-free` read only `referralCodes` + `programEvents` |
| SEC-H6 | `/api/ambassador/me` over-exposes fields | Confirmed (static); UI hides some fields, API unchanged |
| SEC-H7 | Dashboard shows clicks/revenue | **Fixed in working tree (uncommitted)**: no such strings in the rewritten dashboard; only string-grep tests |
| SEC-H8 | Imported pending ambassadors get an active registry code | Confirmed (static) |

## New or changed findings

| ID | Severity | Finding | Status |
|---|---|---|---|
| SEC-N1 | Medium | Dashboard QR uses `api.qrserver.com`, sending each referral URL to a third party | Confirmed (static) |
| SEC-N2 | Medium | Committed HEAD `/api/ambassador/me` imports a function that exists only in an uncommitted edit; deploying committed code breaks authenticated ambassador access | Confirmed (git show) |
| SEC-N3 | Low | Apply page trusts API for program metadata; field-name mismatch (`programName` vs `programTitle`) | Confirmed (static) |
| SEC-N4 | Informational | Completion report asserts security issues resolved; not true for API layer | Confirmed |

## Other open items (unchanged)

Medium: any user can create programs (no organiser role check); self-referral email/phone checks ineffective because registry returns no email/phone; no rate limit on public `validate`/`apply`/`leaderboard`; rules constrain only `status` on create; hard-coded super-admin emails; approval not transactional (double approval gives two codes); public error responses return `err.message`; refund reversal executed inside a transaction callback.

## Severity summary

Critical 6 (items 1-6 above), High 8 (SEC-H1..H8; H7 now fixed in the working tree, H3 partly unverified), plus the Medium/Low items listed (not separately counted). Confirmed by execution: 0.

## Recommended corrections (not applied)

Central `assertProgramOwner(caller, programId)` for every organizer route; server-only referral lookups; ambassador identity derived from session, never the request body; whitelisted DTOs; transactional award/claim/adjust with `FieldValue.increment` and deterministic ids; Firestore emulator tests for each negative case; remove third-party QR; upgrade or replace the spreadsheet parser and cap upload size and rows.
