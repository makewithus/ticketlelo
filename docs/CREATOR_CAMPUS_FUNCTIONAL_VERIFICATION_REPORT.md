# Creator Campus — Functional Verification Report (2026-11-12)

Method key: **S** = static code reading of the working tree (HEAD ca4d64f + uncommitted); **T** = automated test executed; **X** = executed end to end. No workflow was run end to end (X): no Firestore emulator, staging project, test identities or browser tooling was available, and I did not use production credentials. Hence every "actual behaviour" below is derived from code (S), and nothing is IMPLEMENTED AND VERIFIED. Section numbers follow your Phase 6.

## 6.1 Organizer program management

| Check | Expected | Actual (S) | Result |
|---|---|---|---|
| Access / navigation | Organizer reaches Creator Campus | `organiser-shell.jsx` links `/admin/programs` (lines ~240, 442); a test greps for that string | Present, not rendered |
| Multiple programs | independent programs | one doc per program, organizerId filter | OK (S) |
| Draft stays unpublished | no auto-publish | `createProgram` status draft | OK (S) |
| Application URL on publish | URL exposed | page `/programs/[id]/apply` exists; admin hub exposes URLs (not rendered) | Partial |
| Open/close dates | enforced | stored only; `submitAmbassadorApplication` ignores them | Missing |
| Pause/resume | paused program stops everything | status changes, but `create-order`/`register-free` never read program status | Broken |
| Ownership | enforced | enforced in service functions; no organiser role check on create | Partial |
| Many events per program | yes | `programEvents` per pair | OK (S) |

## 6.2 Applications

Form Builder not reused (`applicationFormId` unused; apply page uses fixed fields). Submission stored with status `pending`, linked to program and organizer. Duplicate rule: only pending-per-email. Notifications to organizer/applicant are sent in a fire-and-forget async block after the response. Approval links an existing user by email, reserves a code, writes the profile. Not activated before approval for the new flow; imported pending rows get an active registry code (SEC-H8). Result: Partial.

## 6.3 Referral codes (T for pure parts)

`generateCandidateCode`, regex and normalisation are unit-tested (executed, 4 tests pass). Uniqueness uses doc id = code in a transaction (S). Username: approval uses `fullName`, not username. Concurrency, retention after username change and imported-code preservation are not tested; imported-code preservation is broken (approval ignores `referralCode` on the application).

## 6.4 Bulk import

Expected: template, CSV+XLSX, validation, preview, confirmation, partial success, row errors, history, no overwrite, not auto-approved. Actual (S): CSV template only (no XLSX template); parser is `xlsx@0.18.5`; row-numbered errors; partial import; history written, no list UI; no preview/confirmation; error report is not downloadable; `autoApprove=true` accepted from any caller; no size, type or row limits; no ownership check. Dependency note: `xlsx@0.18.5` is the last npm-published SheetJS version and is subject to published advisories (prototype pollution, ReDoS) — `npm audit` could not be run (no network), so this is unverified here. The test `Parses CSV rows correctly` exercises `parseAndSanitizeCsv`, which production code does not call.

## 6.5 Program-event relationship

Connect (ownership per event, silently skipping others), disconnect (status + `referralEnabled=false`, history untouched), toggle: implemented, untested. Attribution requires `programEvents/{programId}_{eventId}` connected and enabled in `create-order` and `register-free`.

## 6.6 Attendee registration

Field text matches exactly (`dynamic-registration-form.jsx:2292-2306`); eligibility via `GET /api/referral/validate?checkEvent=`; also shown whenever `?ref=` is present. Optional (S). Invalid codes: the component never validates a typed code; the server drops it silently, so there is no error and no chance to correct. Attribution is stored on the order server-side and read by `verify-payment` from the order (good); no program-status or ambassador-status check. Not executed.

## 6.7 Points engine

| Item | Actual (S) |
|---|---|
| Global / event / milestone | implemented (unit tests cover base and milestone math: pass) |
| Ticket-specific, time bonus, combo | not implemented |
| Free vs paid | implemented |
| Duplicate prevention | idempotency key checked before, not inside, the transaction; random ledger doc id |
| Payment success | `verify-payment` only; webhook `payment.captured` does not award |
| Payment failure | no award (OK) |
| Duplicate webhook | webhook event ids deduped, but points idempotency racy |
| Full refund | reversal entry created; legacy ambassadors not handled |
| Partial refund | any refund reverses all points |
| Cancellation | not implemented |
| Manual adjustment | reason required; balance clamped at 0 so ledger != balance; no authorization |
| Rule changes | amounts frozen in ledger; rules edited in place, version client-supplied |
| Transactionality | balance read outside the transaction; lost updates possible |
| **New ambassadors earn points?** | **No**: `referralCodes.ambassadorId` is null (programs-service.js:317-323 vs referral-registry.js:76), and awards require a truthy `ambassadorId` |

## 6.8 Ambassador dashboard

Working tree: consumes `/api/ambassador/me`, shows points, rank, ledger tab, rewards, leaderboard link, copy actions, QR (third-party image service). No clicks/revenue strings (a string test asserts that). `/api/ambassador/me` exists; its `verifySessionFromRequest` import resolves only in the working tree (HEAD lacks it). The API still returns orderId, registrationId, adjustedBy, idempotencyKey, ruleSnapshot and full program docs. Role switching: only `users.roles` is extended; no switcher. Event-wise points not shown separately. Not rendered.

## 6.9 Leaderboard

Overall: needs composite index `programs+status+totalPoints` which `firestore.indexes.json` lacks, so it is likely to fail in production (suspected, not executed). Event: sums `completed` ledger rows; refunds are counted twice (original set to `reversed`, plus a negative completed row). Public fields: rank, displayName ("First L."), totalPoints (S). `limit` 1-100 gives Top N; no pagination or tie policy. Requires a published program.

## 6.10 Embedding

Fixed iframe snippet in the organizer hub; page reads the same API; no event/Top-N configuration, no external-site rendering test; no X-Frame-Options/CSP frame headers in `next.config.mjs` (embedding is not blocked, but also not designed).

## 6.11 Rewards

Eight types accepted. Claim runs in one transaction (points debit, inventory, redemption, ledger). Missing: ownership check (any user can claim for any `ambassadorId`), per-ambassador duplicate limit, program match, commission payout, event association. Referral codes are a separate registry from attendee coupons (OK).

## 6.12 Notifications

Templates via the existing `enqueueEmail`. Wired: organizer-new-application, applicant-confirmation, approved, rejected, reward-claimed. Not wired: points-awarded (`notifyPointsAwarded` has no caller). No delivery log, no preference toggles, no retry de-duplication. No notification was sent during this audit.
