# Creator Campus Ambassador Program — Current Implementation Audit (2026-11-12)

Audit only. No application code, rules, config or data was changed. The earlier `CREATOR_CAMPUS_AMBASSADOR_AUDIT.md` is preserved unchanged; it describes the repo before the Creator Campus code existed and is now **superseded** by this report.

## 1. Git state (Phase 0)

- Repository root: `/home/krrish/Desktop/TicketLelo/ticketlelo` (the parent folder is not a git repo).
- Current branch: `feature/guest-registration-security-complete`. Other branches: `main`, `new-features`, `feature/creator-campus-ambassador-complete`.
- `feature/creator-campus-ambassador-complete` points at `392e9a1`, an older commit that contains **no** Creator Campus code. The Creator Campus code was committed on the current guest-registration branch inside `b1688fd "feat(ui): first-time setup UI, ticket access controls, and dashboard sync"`. That commit message does not describe it.
- Working tree: 32 modified tracked files, 0 untracked, 0 staged. Of these, 28 Creator Campus files differ from HEAD only by one trailing blank line. The substantive uncommitted edits are:
  - `lib/access-policy.js` (+5): adds `verifySessionFromRequest`, which `src/app/api/ambassador/me/route.js` imports. At HEAD the export does not exist (`git show HEAD:lib/access-policy.js | grep -c verifySessionFromRequest` = 0).
  - `src/app/api/superadmin/organisers/route.js` (102 lines) and `components/admin/organisers-management.jsx` (447 lines): unrelated to this program, not reviewed.
  - three docs (+1 line each).
- Latest commits: `ca4d64f` docs, `734a355` tests, `b1688fd` (Creator Campus code), `9f5479b` security.

## 2. Documentation found

Present: `CREATOR_CAMPUS_AMBASSADOR_AUDIT.md` (mine, previous), `_ARCHITECTURE.md`, `_IMPLEMENTATION_PLAN.md`, `_IMPLEMENTATION_ASSUMPTIONS.md`.
Absent: `_MIGRATION_GUIDE`, `_SECURITY_REPORT`, `_TEST_REPORT`, `_IMPLEMENTATION_COMPLETION_REPORT`.
Absent everywhere: the original 1,029-line specification and a separate "master implementation specification". **Limitation:** requirements come from the audit prompts, the Architecture and Plan documents. Items outside those are not covered. The existing documents were treated as claims, not evidence.

## 3. Implementation inventory

| Area | Files | State |
|---|---|---|
| Programs, events, applications, approval | `lib/creator-campus/programs-service.js` | Draft-first programs, multi-event connection, approval/rejection. Not transactional |
| Referral registry | `lib/creator-campus/referral-registry.js` | XXXX-NNNN generator, transactional reserve, resolve, self-referral helper. Registry rows lack ambassadorId |
| Points | `lib/creator-campus/points-engine.js` | Base + event override + count milestones, ledger, reversal, adjustment |
| Import | `lib/creator-campus/bulk-importer.js` | CSV/XLSX parse, partial import, history record |
| Rewards | `lib/creator-campus/rewards-service.js` | 8 types, atomic claim |
| Notifications | `lib/creator-campus/notifications.js` | 6 templates via `enqueueEmail`; one never called |
| Organizer APIs | `src/app/api/organizer/programs/**` (13 routes) | Many without ownership checks |
| Applicant / ambassador / public APIs | `api/programs/[id]/apply`, `api/ambassador/me`, `api/ambassador/rewards/[id]/claim`, `api/public/leaderboard/[id]`, `api/referral/validate` | Present |
| Checkout hooks | `create-order`, `register-free`, `verify-payment`, `webhooks/razorpay` | Referral resolve/persist/award/reverse wired |
| Organizer UI | `(app)/admin/programs/page.jsx`, `[programId]/page.jsx` (1.7k lines), nav link in `organiser-shell.jsx:240,442` | Wired to APIs; browser behaviour not tested |
| Registration field | `components/forms/dynamic-registration-form.jsx:2292-2306` | Exact copy present |
| Ambassador UI | `(user)/ambassador/dashboard/page.jsx` | **Legacy commission dashboard**, does not use new APIs |
| Missing UI | public apply page, public leaderboard page, embed page, QR | Do not exist |
| Rules / indexes | `firestore.rules:275-405`, `firestore.indexes.json` | Tenant scoping added; `referralCodes` and `programEvents` public-read; an index missing |
| Tests | none for Creator Campus | `tests/unit/phase2-forms-ambassadors.test.js` tests legacy commission helpers only |
| Migration | none | |

## 4. Headline results (99 requirements, see traceability report)

| Status | Count |
|---|---|
| Implemented and verified | 0 |
| Implemented but not verified | 28 |
| Partially implemented | 29 |
| Not implemented | 21 |
| Broken | 21 |
| Blocked | 0 |
| Not applicable | 0 |

Progress since the previous audit is real: programs, approval, registry, points ledger, rewards, import and checkout hooks now exist. But three defects mean the core promise does not work end to end:

1. **No points for new ambassadors** (CC-28): the registry stores `ambassadorId: null`, and every award path requires a truthy `ambassadorId`.
2. **Authorization missing on 8 organizer/ambassador endpoints** (CC-05..CC-11): any logged-in user can read applicant PII, edit rules, adjust points, import into any program, and spend another ambassador's points.
3. **The ambassador cannot use the product**: the dashboard is the old commission page, there is no apply page, the referral link points to `/discover?ref=` which ignores `ref`, and `/api/ambassador/me` is broken at committed HEAD.

## 5. Corrections to my previous audit

Previous findings S-1 to S-4 (cross-organizer rules, client-writable programs, unvalidated referral string, self-approval) are **fixed in rules/APIs for those paths** but new equivalents exist at the API layer. S-6 (dashboard shows clicks/revenue) is **still present**.

## 6. Verification limitations

- No emulator, staging credentials or browser tooling were used. Nothing was executed against Firestore, Razorpay or email. Firestore-dependent logic is judged from code only, hence 0 verified.
- `npm run build` was not run: it would write `.next/` and load `.env`. Lint was run on Creator Campus paths only.
- The test harness (`tests/qa-environment.cjs`) strips production credentials before running; the 373 existing tests that ran are mock-based.
