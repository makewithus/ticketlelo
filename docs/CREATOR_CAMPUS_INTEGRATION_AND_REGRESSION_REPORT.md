# Creator Campus — Integration and Regression Report (2026-11-12)

Basis: static inspection of integration points plus `npm test` (394 pass). Nothing was exercised against live Razorpay, email or Firebase; no payment, refund or notification was triggered.

| Area | Integration with Creator Campus | Finding | Regression risk | Verified? |
|---|---|---|---|---|
| Authentication | `getAuthenticatedUser` (`lib/auth-server.js`) used on all routes; `/api/ambassador/me` uses `verifySessionFromRequest`, a thin wrapper added in uncommitted `lib/access-policy.js` | Works only with the uncommitted helper | Low if committed together; HEAD alone breaks `/me` | No |
| Roles | Approval appends `ambassador` to `users.roles` and sets `isAmbassador` without touching `role` | Multi-role data model OK; no switcher; `access-policy.js` still validates a single role string | Medium: other code reading `role` unaffected, code reading `roles` unknown | No |
| Organizer dashboard | `organiser-shell.jsx` adds a `/admin/programs` link (modified, uncommitted) | Link present; `organiser-shell.jsx` has other uncommitted edits | Low | No |
| Event creation / editing | `connectEventsToProgram` reads `events` (`createdBy/userId/organizerId`) | Read-only on events; no event schema change | Low | No |
| Registration forms | `dynamic-registration-form.jsx` adds referral field (6 places send `referralCode`); duplicated key `referralCode` in one payload (line ~1018-1019) | Eligible-only display is gated by an extra API call per form load; shown also for any `?ref=` | Medium (extra request, UX when API fails: field hidden) | No |
| Guest registration | `register-free` resolves attribution then awards points after the registration transaction, errors swallowed | Existing flow continues if referral lookup fails (try/catch) — good; points can be silently lost | Low for registrations, medium for points | No |
| Checkout / order creation | `create-order` validates the code, stores `referralCode` and `referralAttribution` on the pending order | Server-side, not client-trusted; invalid code silently removed; no program/ambassador status check | Low (wrapped in try/catch) | No |
| Razorpay verification | `verify-payment` awards points from the stored order attribution after fulfilment | Same swallow-errors pattern; awards only when the client/verifier path runs | Low for tickets, medium for delayed payments | No |
| Webhooks | `payment.captured` unchanged; `refund.processed` now calls `reversePointsForOrder` inside the Firestore transaction callback | Side effects inside a transaction body; any refund reverses all points; failures swallowed | **Medium-high**: transaction retries re-run reversal logic; partial refunds mis-handled | No |
| Refunds | order `refunded`/`partially_refunded` logic unchanged; points reversal added | see above | as above | No |
| Cancellations | no hook | missing | n/a | No |
| Existing referral links | `?ref=` on `/e/[slug]`, `/register/[id]`, `/embed/[id]` still read; legacy `ambassadors` codes still resolved when `status=approved` | Compatible; legacy organizers lose rule-based read of legacy docs (no `organizerId`) | Medium | No |
| Existing ambassador records / commissions | legacy `ambassadors`, `commissions` untouched; `recordCommission` still has no caller | unchanged | Low | No |
| Notifications | `enqueueEmail` reused | 5/6 triggers wired; fire-and-forget after response can be cut off on serverless | Low | No |
| Firestore rules / indexes | rules rewritten for ambassador collections only (committed `b1688fd`); indexes added | `ambassadors` read now requires `organizerId`; leaderboard composite index missing | Medium | No |
| Existing test suite | `npm test`: 394 pass / 0 fail | no failures introduced; no test covers the hooks' behaviour | n/a | Yes (suite), no (behaviour) |
| Build | not run | unknown | unknown | No |
| Repository hygiene | 75 uncommitted paths, many unrelated (`account`, `my-tickets`, organisers, superadmin) | cannot isolate Creator Campus changes in a deploy | High | n/a |

Regression verdict: no failing regression test, but the hooks sit in the payment path and have no behavioural tests; treat as unverified.
