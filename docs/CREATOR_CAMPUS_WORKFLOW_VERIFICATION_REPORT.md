# Creator Campus — Workflow Verification (2026-11-12)

Each workflow traced through real code. "Executed" means run; nothing below was executed end to end, because no Firestore emulator, staging project or browser tooling was available and no Creator Campus tests exist. Marks: OK = code path present and plausible; PARTIAL; BROKEN; MISSING.

## A. Organizer creates a program — PARTIAL

| Step | Result | Evidence |
|---|---|---|
| Authentication | OK | `getAuthenticatedUser` on every route |
| Authorization | PARTIAL | create/update/status check ownership in `programs-service.js`; no organiser-role check (CC-13) |
| Create as draft | OK | `createProgram` status draft |
| Application form configuration | PARTIAL | `applicationFormId` stored, never used (CC-20) |
| Publish | OK | `PATCH .../status`; any transition allowed |
| Event connection | OK | ownership checked per event |
| Referral enablement | OK | `programEvents.referralEnabled` |
| Public application available | MISSING | no page, no URL (CC-19) |

## B. Applicant becomes ambassador — BROKEN at the end

| Step | Result | Evidence |
|---|---|---|
| Public page | MISSING | only API; legacy dashboard still hard-codes `prog_praroha_2027` |
| Submit and persist Pending | OK | `apply` route |
| Organizer + applicant notified | PARTIAL | fire-and-forget after response |
| Organizer review | PARTIAL | list route has no ownership check (SEC-C3) |
| Approve | PARTIAL | no transaction, imported codes ignored |
| Link existing user | OK | `getUserByEmail` |
| Unique code reservation | OK | transactional, doc id = code |
| Registry linked to ambassador | **BROKEN** | `ambassadorId: null` (CC-28) |
| Referral link | **BROKEN** | `/discover?ref=` ignored by discover (CC-35) |
| Dashboard access | **BROKEN** | page uses legacy API; `/me` fails at HEAD (CC-78) |
| Applicant notified | OK | `notifyAmbassadorApproved` |

## C. Referral attribution — PARTIAL

Event page -> field shown (OK, eligibility via checkEvent) -> invalid code never reported to user (PARTIAL) -> `create-order` / `register-free` re-validate server-side (OK, but no program/ambassador status check) -> order stores `referralAttribution` (OK) -> `verify-payment` reads attribution from the order, not the client (OK) -> webhook only marks `captured_pending_fulfillment`, points awarded only when verify-payment runs (PARTIAL) -> duplicate-webhook protection exists for the order state via `webhookEvents`, but points idempotency is racy (CC-64). Self-referral by email is ineffective (CC-52).

## D. Points and rewards — BROKEN

- Eligible registration -> attribution: `ambassadorId` is null for newly approved ambassadors, so awarding is skipped silently (CC-28). The only ambassadors that could earn points today are legacy ones.
- Rules: base + event override + count milestones. No ticket, time or combo rules.
- Ledger written; balance updated with a stale read (CC-66); idempotency checked outside the transaction.
- Refund: any refund reverses everything (CC-68); reversal inside a transaction callback (CC-69); original entry is mutated.
- Notification of points: never sent (CC-74).
- Reward claim is atomic but unauthorised (CC-11).

## E. Ambassador dashboard — MISSING for the new model

Legacy page only; shows clicks, orders and revenue; no points, rank, history, QR or leaderboard. `/api/ambassador/me` would provide points, ledger, rewards and rank but is unused by any page and over-exposes fields.

## F. Public leaderboard and embed — PARTIAL

API only. Overall query needs a missing composite index. Event variant double-subtracts refunds and includes suspended ambassadors. Public fields are rank, displayName ("First L."), points. No page, no embed route, no responsive check, no framing configuration.

## G. Legacy compatibility — PARTIAL

`resolveReferralCode` falls back to approved legacy ambassadors, so old codes still resolve. Legacy docs lack `organizerId`, so organizers lose rule-based read access. `recordCommission` is still never called, so legacy commissions are not produced by checkout. Existing 373 tests pass, none of which touches the new hooks.
