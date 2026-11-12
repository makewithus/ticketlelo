# Creator Campus — Canonical Specification Reconciliation Audit (2026-11-12)

Audit only. No code, config, rules, dependency or data was changed; no branch, commit, stash or deletion. Only this file was created. Existing reports are untouched.

## 1. Executive verdict

**NOT PRODUCTION READY. `campus.md` is not trustworthy as an acceptance baseline, and its claim that all P0 work is done is contradicted by the code.**

- Backend code (API routes, services, rules, indexes) has no substantive change (`git diff --ignore-all-space --ignore-blank-lines`) since my previous audit; `campus.md` nevertheless marks T-001..T-026 as done. The only functional additions since then are untracked/uncommitted pages, a rewritten dashboard and a test file.
- Final scorecard (100 requirements): **2 behaviorally verified, 29 implemented but not verified, 27 partial, 18 not implemented, 24 broken, 0 blocked, 0 N/A**.
- `campus.md` claims 94 implemented and 6 pending. 36 of its "Implemented" rows are BROKEN or NOT IMPLEMENTED in the code.

## 2. Canonical specification identification

- Two copies: `/home/krrish/Desktop/TicketLelo/campus.md` (452 lines) and `ticketlelo/campus.md` (453 lines; differs by one trailing newline). Both untracked. This audit used the one inside `ticketlelo/`.
- **It is not the original 1,029-line specification.** It is a 452-line "Master Status & Specification" whose section 1 says "Breakdown of the 100 **Reconstructed** Requirements", i.e. it reuses the requirement list I reconstructed in an earlier audit (same CC-01..CC-100 numbering, some descriptions reworded, e.g. CC-20, CC-79, CC-84, CC-95..98). Its pie chart labels my earlier 31 "implemented but NOT verified" as "Implemented & Behaviorally Verified". Consequently: (a) the original spec's own acceptance criteria are **still not covered**; (b) this reconciliation checks the code against campus.md's expected-behaviour text only. If the real 1,029-line file exists, please provide it.
- Section "Specification section" in the matrix therefore refers to campus.md sections (M1-M12 modules, §5 matrix).

## 3. Git and working-tree state (re-verified)

| Item | Result |
|---|---|
| Branch / HEAD | `feature/guest-registration-security-complete` / `ca4d64f` |
| Dedicated branch | `feature/creator-campus-ambassador-complete` = `392e9a1`, 0 unique commits, no Creator Campus code; current branch 4 commits ahead (9f5479b, b1688fd, 734a355, ca4d64f) |
| `b1688fd` | contained only by the current branch |
| Working tree | 81 paths (was 75): modified tracked files plus untracked: both campus.md copies, 16 docs, three page routes (`leaderboard/[programId]`, `embed/leaderboard/[programId]`, `programs/[programId]/apply`), and `tests/unit/creator-campus-ambassador.test.js` |
| Staged | none |
| Many modified files are unrelated (account, my-tickets, organisers, superadmin) | not reviewed; they could affect a deploy but not the code-level findings |

## 4. All 100 requirement statuses

Columns: ID | campus.md section | expected behaviour (campus.md) | previous audit | campus.md claim | final status | code location (H = same in committed HEAD and working tree; W = exists only in working tree / untracked) | evidence and remaining gap. Frontend/backend/DB/security/test evidence are consolidated in the last column and in sections 7-9; verification performed for every row is *code reading plus the executed test results in section 9*; no row was exercised against Firestore, Razorpay, email or a browser.

| ID | Section | Expected behaviour | Previous | campus.md | Final | Where | Evidence / gap |
|---|---|---|---|---|---|---|---|
| CC-01 | M1 / security | Tenant isolation on Firestore program collections | IMPLEMENTED BUT NOT VERIFIED | Implemented | IMPLEMENTED BUT NOT VERIFIED | HEAD+WT | firestore.rules:275-335 scope by organizerId. Test only greps rule text; no emulator. |
| CC-02 | M1 / security | Prevent client self-approval of applications | IMPLEMENTED BUT NOT VERIFIED | Implemented | IMPLEMENTED BUT NOT VERIFIED | HEAD+WT | rules create requires status==pending (313-316, 396-400); other fields client-writable; text-grep test only. |
| CC-03 | M1 / security | Server-only writes for ledger and balances | IMPLEMENTED BUT NOT VERIFIED | Implemented | IMPLEMENTED BUT NOT VERIFIED | HEAD+WT | rules `allow write: if isSuperAdmin()` on ledger/profiles/redemptions; text-grep test only. |
| CC-04 | M1 / security | Restrict public enumeration of referral codes | BROKEN | Implemented | BROKEN | HEAD+WT | firestore.rules:296 (programEvents) and 334-338 (referralCodes) still `allow read: if true`; docs hold userId/organizerId/ambassadorId. Claim 'Public code list denied' is false. |
| CC-05 | M1 / security | Ownership check on program applications route | BROKEN | Implemented | BROKEN | HEAD+WT | applications/route.js: 0 ownership references; returns email/phone/college of any program. Unchanged vs prior audit. |
| CC-06 | M1 / security | Ownership check on bulk importer route | BROKEN | Implemented | BROKEN | HEAD+WT | import/route.js: only `organizerId: caller.uid` assignment, no program owner check; autoApprove accepted. |
| CC-07 | M1 / security | Ownership check on points rules configuration | BROKEN | Implemented | BROKEN | HEAD+WT | points/rules/route.js: no ownership check; POST overwrites rules; version from client. |
| CC-08 | M1 / security | Ownership check on manual points adjustments | BROKEN | Implemented | BROKEN | HEAD+WT | points/adjust/route.js + adjustPointsManually: no program/ambassador ownership check. |
| CC-09 | M1 / security | Ownership check on points ledger listing | BROKEN | Implemented | BROKEN | HEAD+WT | points/ledger and referral-codes routes: no ownership check, unbounded .get(). |
| CC-10 | M1 / security | Ownership check on reward catalog creation | BROKEN | Implemented | BROKEN | HEAD+WT | rewards/route.js: no ownership check on create/list. |
| CC-11 | M1 / security | Reward claim restricted to profile owner | BROKEN | Implemented | BROKEN | HEAD+WT | claim route/claimReward: caller uid stored but never compared to ambassador.userId; no program match. |
| CC-12 | M1 / security | Service-level program mutation ownership | IMPLEMENTED BUT NOT VERIFIED | Implemented | IMPLEMENTED BUT NOT VERIFIED | HEAD+WT | programs-service.js update/status/connect/approve/reject compare organizerId; untested. |
| CC-13 | M1 / security | Organizer role required to create programs | PARTIALLY IMPLEMENTED | Implemented | NOT IMPLEMENTED | HEAD+WT | organizer/programs POST requires login only; no organiser-role check. |
| CC-14 | M1 / security | Dynamic SuperAdmin verification via custom claims | BROKEN | Implemented | PARTIALLY IMPLEMENTED | HEAD+WT | routes check caller.role=='superAdmin' but also hard-coded superadmin email addresses (e.g. approve/route.js). |
| CC-15 | M1 lifecycle | Program defaults to `draft` status | IMPLEMENTED BUT NOT VERIFIED | Implemented | IMPLEMENTED BUT NOT VERIFIED | HEAD+WT | createProgram status 'draft', isActive false; untested. |
| CC-16 | M1 lifecycle | Formal state machine transitions (Draft $\to$ Published $\to$ Paused) | PARTIALLY IMPLEMENTED | Implemented | BROKEN | HEAD+WT | updateProgramStatus accepts any transition (no state machine); create-order/register-free never read program status so paused/draft programs still attribute. |
| CC-17 | M1 lifecycle | Multiple independent programs per organizer | IMPLEMENTED BUT NOT VERIFIED | Implemented | IMPLEMENTED BUT NOT VERIFIED | HEAD+WT | auto-id programs filtered by organizerId; untested. |
| CC-18 | M1 lifecycle | Complete metadata (Title, dates, guidelines) | IMPLEMENTED BUT NOT VERIFIED | Implemented | PARTIALLY IMPLEMENTED | HEAD+WT | title, description, logo, dates, form id, referralSettings stored; no guidelines; no validation. |
| CC-19 | M1 lifecycle | Public application URL generated upon publish | PARTIALLY IMPLEMENTED | Implemented | PARTIALLY IMPLEMENTED | WT only | /programs/[programId]/apply is untracked; it reads data.programName but API returns programTitle; works only for published programs. |
| CC-20 | M1 lifecycle | Customizable application question schema | PARTIALLY IMPLEMENTED | Implemented | NOT IMPLEMENTED | HEAD+WT | `applicationQuestions` appears nowhere in code; applicationFormId stored but unused; fixed form fields. |
| CC-21 | M1 lifecycle | Application widget embed snippet | NOT IMPLEMENTED | Pending | NOT IMPLEMENTED | HEAD+WT | no application embed snippet. |
| CC-22 | M1 lifecycle | Enforce application opening & closing dates | NOT IMPLEMENTED | Implemented | NOT IMPLEMENTED | HEAD+WT | applicationStartDate/EndDate stored, never checked on submit. |
| CC-23 | M2 | Public submission persists pending application | IMPLEMENTED BUT NOT VERIFIED | Implemented | IMPLEMENTED BUT NOT VERIFIED | HEAD+WT | apply API stores pending application linked to program+organizer (HEAD); page is untracked. |
| CC-24 | M2 | Prevent duplicate applications per email/user | PARTIALLY IMPLEMENTED | Implemented | PARTIALLY IMPLEMENTED | HEAD+WT | only pending-per-email query; no unique index; approved/rejected can reapply. |
| CC-25 | M2 | Responsive student application UI | PARTIALLY IMPLEMENTED | Implemented | IMPLEMENTED BUT NOT VERIFIED | WT only | apply page + dashboard dialog, untracked/uncommitted, not rendered. |
| CC-26 | M2 | Dispatches inbound application confirmation | PARTIALLY IMPLEMENTED | Implemented | PARTIALLY IMPLEMENTED | HEAD+WT | notifications sent in un-awaited async block after response; failures only console.warn. |
| CC-27 | M2 | Approval activates profile & reserves code | PARTIALLY IMPLEMENTED | Implemented | PARTIALLY IMPLEMENTED | HEAD+WT | approveAmbassadorApplication not transactional (status check outside tx), allows re-approving rejected, ignores imported code. |
| CC-28 | M2 | Referral code links directly to ambassador profile ID | BROKEN | Implemented | BROKEN | HEAD+WT | approve calls reserveReferralCode without ambassadorId (programs-service.js:358-364); registry stores null (referral-registry.js:76); no later update. Claim false; awards need truthy ambassadorId so new ambassadors earn nothing. |
| CC-29 | M2 | Rejection marks status & logs reason | PARTIALLY IMPLEMENTED | Implemented | PARTIALLY IMPLEMENTED | HEAD+WT | rejection stores reason; can reject an already-approved application without deactivating profile/code. |
| CC-30 | M2 | Preserve multi-role identity on student profiles | PARTIALLY IMPLEMENTED | Implemented | IMPLEMENTED BUT NOT VERIFIED | HEAD+WT | roles array appended, role untouched; no switcher UI. |
| CC-31 | M3 | Canonical `XXXX-NNNN` code format | PARTIALLY IMPLEMENTED | Implemented | IMPLEMENTED AND BEHAVIORALLY VERIFIED | WT only | generateCandidateCode/regex executed in 4 real unit tests (pass). Format only; prefix comes from full name at approval, not username. |
| CC-32 | M3 | Global code uniqueness & retry logic | IMPLEMENTED BUT NOT VERIFIED | Implemented | IMPLEMENTED BUT NOT VERIFIED | HEAD+WT | doc id = code with transaction + 15 retries; no emulator/concurrency test. |
| CC-33 | M3 | Imported codes retained through approval | BROKEN | Implemented | BROKEN | HEAD+WT | approve ignores application.referralCode; imported code stays orphaned/active in registry. |
| CC-34 | M3 | No active code issued prior to approval | IMPLEMENTED BUT NOT VERIFIED | Implemented | BROKEN | HEAD+WT | importer registers active registry codes for pending rows; legacy lib/ambassadors.js still issues a code at application. |
| CC-35 | M3 | Referral link resolves to active event page | BROKEN | Implemented | BROKEN | WT only | dashboard link is `${baseUrl}?ref=`, approval/import use /discover?ref=; home and discover ignore ref (only /e/[slug], /register, /embed read it). Claim 'links to /e/[slug]?ref=' false. |
| CC-36 | M3 | Code persists across profile updates | IMPLEMENTED BUT NOT VERIFIED | Implemented | IMPLEMENTED BUT NOT VERIFIED | HEAD+WT | code stored once; no regeneration path; untested. |
| CC-37 | M11 | CSV template download endpoint | IMPLEMENTED BUT NOT VERIFIED | Implemented | IMPLEMENTED BUT NOT VERIFIED | HEAD+WT | CSV template route; untested. |
| CC-38 | M11 | Excel (XLSX) import support | NOT IMPLEMENTED | Implemented | PARTIALLY IMPLEMENTED | HEAD+WT | xlsx@0.18.5 parses uploads (no Excel template); advisories unverified offline; claim 'safe binary extractor' unsupported. |
| CC-39 | M11 | Row validation & error reporting | IMPLEMENTED BUT NOT VERIFIED | Implemented | IMPLEMENTED BUT NOT VERIFIED | HEAD+WT | row validation with row numbers; untested end to end. |
| CC-40 | M11 | Collision detection on pre-existing emails | PARTIALLY IMPLEMENTED | Implemented | PARTIALLY IMPLEMENTED | HEAD+WT | only referral-code collisions checked; no existing email/roster check. |
| CC-41 | M11 | Upload confirmation modal | NOT IMPLEMENTED | Implemented | PARTIALLY IMPLEMENTED | WT only | client-side first-5-row preview only, no validation summary or confirm step; admin hub page is tracked and modified. |
| CC-42 | M11 | Formula injection sanitization on exports | NOT IMPLEMENTED | Implemented | PARTIALLY IMPLEMENTED | HEAD+WT | sanitizeCellValue unit-tested (real); applied on input only; no export exists. |
| CC-43 | M11 | Import history logging | PARTIALLY IMPLEMENTED | Implemented | PARTIALLY IMPLEMENTED | HEAD+WT | ambassadorImports written; no list API/UI. |
| CC-44 | M11 | Imported ambassadors require standard approval | BROKEN | Implemented | BROKEN | HEAD+WT | autoApprove=true creates active profiles; any caller may set it. |
| CC-45 | M11 | Upload file size & row count caps | BROKEN | Implemented | BROKEN | HEAD+WT | import/route.js and importer: no size/row/type limits (grep). Claim '5MB/1000 rows' false. |
| CC-46 | M4 | Connect multiple events with ownership verification | IMPLEMENTED BUT NOT VERIFIED | Implemented | IMPLEMENTED BUT NOT VERIFIED | HEAD+WT | connectEventsToProgram checks event ownership; silently skips others; untested. |
| CC-47 | M4 | Disconnect event while preserving points history | IMPLEMENTED BUT NOT VERIFIED | Implemented | IMPLEMENTED BUT NOT VERIFIED | HEAD+WT | disconnect sets status+referralEnabled false; untested. |
| CC-48 | M4 | Independent referral toggle per connected event | IMPLEMENTED BUT NOT VERIFIED | Implemented | IMPLEMENTED BUT NOT VERIFIED | HEAD+WT | toggleEventReferral; untested. |
| CC-49 | M5 | Registration form referral field display | IMPLEMENTED BUT NOT VERIFIED | Implemented | IMPLEMENTED BUT NOT VERIFIED | HEAD+WT | field copy exact (dynamic-registration-form.jsx:2292-2306); gated by checkEvent API; not rendered. |
| CC-50 | M5 | User feedback on invalid referral code | PARTIALLY IMPLEMENTED | Implemented | NOT IMPLEMENTED | HEAD+WT | form unchanged: never calls validate?code; server drops invalid codes silently; no badge or remove button. Claim false. |
| CC-51 | M5 | Server-side attribution re-verification | PARTIALLY IMPLEMENTED | Implemented | PARTIALLY IMPLEMENTED | HEAD+WT | create-order/register-free re-resolve code and event link (duplicated, not centralised); no program or ambassador status check. |
| CC-52 | M5 | Anti-self-referral prevention | PARTIALLY IMPLEMENTED | Implemented | PARTIALLY IMPLEMENTED | HEAD+WT | isSelfReferral gets no ambassador email/phone from registry, so only uid matches; guests can self-refer. |
| CC-53 | M5 | Reject cross-program and disconnected event codes | IMPLEMENTED BUT NOT VERIFIED | Implemented | IMPLEMENTED BUT NOT VERIFIED | HEAD+WT | programEvents connected+enabled required; untested. |
| CC-54 | M5 | Paid attribution preserved on pending orders | IMPLEMENTED BUT NOT VERIFIED | Implemented | IMPLEMENTED BUT NOT VERIFIED | HEAD+WT | referralAttribution stored on pending order; untested. |
| CC-55 | M5 | Attribution stored on final ticket records | PARTIALLY IMPLEMENTED | Implemented | NOT IMPLEMENTED | HEAD+WT | no attribution copied to ticket record in verify-payment (only used for award). |
| CC-56 | M5 | Free registration points attribution | IMPLEMENTED BUT NOT VERIFIED | Implemented | IMPLEMENTED BUT NOT VERIFIED | HEAD+WT | register-free attribution+award after transaction, errors swallowed; untested. |
| CC-57 | M5 | Webhook fulfillment awards points reliably | PARTIALLY IMPLEMENTED | Implemented | PARTIALLY IMPLEMENTED | HEAD+WT | webhook payment.captured does not award; awards only in verify-payment; webhook imports awardPointsForRegistration but never calls it. |
| CC-58 | M6/M7 | Configurable base points for paid & free tickets | IMPLEMENTED BUT NOT VERIFIED | Implemented | IMPLEMENTED BUT NOT VERIFIED | HEAD+WT | calculateEarnedPoints paid/free base tested (real); per-program config route unauthorised, resolve path untested. |
| CC-59 | M6/M7 | Event-specific points rules | IMPLEMENTED BUT NOT VERIFIED | Implemented | IMPLEMENTED BUT NOT VERIFIED | HEAD+WT | eventOverrides in resolvePointsRule; untested. |
| CC-60 | M6/M7 | Ticket tier specific point rules | NOT IMPLEMENTED | Pending | NOT IMPLEMENTED | HEAD+WT | none. |
| CC-61 | M6/M7 | Time-based surge points bonuses | NOT IMPLEMENTED | Pending | NOT IMPLEMENTED | HEAD+WT | none. |
| CC-62 | M6/M7 | Milestone bonuses (e.g. +50 pts at 10 referrals) | PARTIALLY IMPLEMENTED | Implemented | IMPLEMENTED AND BEHAVIORALLY VERIFIED | WT only | milestone crossing/boundary executed in real unit test (pass); refunds do not decrement referralCount (separate defect). |
| CC-63 | M6/M7 | Combo / package ticket multipliers | NOT IMPLEMENTED | Pending | NOT IMPLEMENTED | HEAD+WT | none. |
| CC-64 | M6/M7 | Idempotent award keys to prevent duplicate points | PARTIALLY IMPLEMENTED | Implemented | PARTIALLY IMPLEMENTED | HEAD+WT | key exists but is checked by query before the transaction; random ledger doc id; concurrent calls can double-award. |
| CC-65 | M6/M7 | Complete audit fields on ledger entries | PARTIALLY IMPLEMENTED | Implemented | PARTIALLY IMPLEMENTED | HEAD+WT | fields present; original ledger row mutated to 'reversed' on refund; no balance snapshot (claim says snapshots). |
| CC-66 | M6/M7 | Atomic balance updates via `FieldValue.increment` | BROKEN | Implemented | BROKEN | HEAD+WT | no FieldValue.increment anywhere; balance = stale read + delta (points-engine.js:154,204-219); adjust clamps at 0. |
| CC-67 | M6/M7 | Full order refund reverses awarded points | PARTIALLY IMPLEMENTED | Implemented | PARTIALLY IMPLEMENTED | HEAD+WT | reversePointsForOrder writes negative entry; legacy ambassadors not handled; untested. |
| CC-68 | M6/M7 | Partial refund proportional reversal | BROKEN | Implemented | BROKEN | HEAD+WT | no ratio logic; any refund.processed reverses all points. |
| CC-69 | M6/M7 | Safe reversal execution outside database lock | BROKEN | Implemented | BROKEN | HEAD+WT | reversal awaited inside webhook transaction callback with non-transactional writes; errors swallowed. |
| CC-70 | M6/M7 | Ticket cancellation triggers point reversal | NOT IMPLEMENTED | Implemented | NOT IMPLEMENTED | HEAD+WT | only refund.processed calls reversal; no cancellation hook. |
| CC-71 | M6/M7 | Manual adjustments require mandatory reason | PARTIALLY IMPLEMENTED | Implemented | IMPLEMENTED BUT NOT VERIFIED | HEAD+WT | route requires reason; stores adjustedBy; route unauthorised (CC-08). |
| CC-72 | M6/M7 | Rule edits do not alter historical point entries | PARTIALLY IMPLEMENTED | Implemented | PARTIALLY IMPLEMENTED | HEAD+WT | amounts frozen in ledger; rules edited in place, client-supplied version, no history. |
| CC-73 | M6/M7 | Background reconciliation job for failed awards | NOT IMPLEMENTED | Pending | NOT IMPLEMENTED | HEAD+WT | no reconciliation job. |
| CC-74 | M6/M7 | Points awarded notification to ambassador | NOT IMPLEMENTED | Implemented | NOT IMPLEMENTED | HEAD+WT | notifyPointsAwarded has zero callers. |
| CC-75 | M8 | Full ambassador dashboard with stats & QR | IMPLEMENTED BUT NOT VERIFIED | Implemented | IMPLEMENTED BUT NOT VERIFIED | WT only | rewritten dashboard (tracked, modified, +724/-425) uses /api/ambassador/me; HEAD version is the legacy commission page; not rendered. |
| CC-76 | M8 | Ambassador UI hides gross financial revenue | IMPLEMENTED BUT NOT VERIFIED | Implemented | IMPLEMENTED BUT NOT VERIFIED | WT only | no clicks/revenue strings in working-tree dashboard; HEAD still shows them; string-grep test only. |
| CC-77 | M8 | API payload filtering (DTO whitelist) | BROKEN | Implemented | BROKEN | HEAD+WT | me/route.js spreads full ledger, program and application docs (lines 31,43,128,140): orderId, registrationId, adjustedBy, idempotencyKey exposed. No DTO whitelist. |
| CC-78 | M8 | Session verification helper standardized | PARTIALLY IMPLEMENTED | Implemented | PARTIALLY IMPLEMENTED | WT only | helper exists only in uncommitted lib/access-policy.js; HEAD lacks the export so HEAD /api/ambassador/me fails to resolve it. |
| CC-79 | M8 | Real-time points balance updates | PARTIALLY IMPLEMENTED | Implemented | NOT IMPLEMENTED | WT only | dashboard fetches once; no onSnapshot/interval. |
| CC-80 | M8 | Instant copyable referral link | PARTIALLY IMPLEMENTED | Implemented | IMPLEMENTED BUT NOT VERIFIED | WT only | copy-to-clipboard in dashboard; not executed. |
| CC-81 | M9 | Program leaderboard API with index support | IMPLEMENTED BUT NOT VERIFIED | Implemented | BROKEN | HEAD+WT | overall query filters programId+status and orders by totalPoints; only (programId,totalPoints) index exists. |
| CC-82 | M9 | Net points calculation excludes refunded entries | BROKEN | Implemented | BROKEN | HEAD+WT | original set to 'reversed' (excluded) AND negative 'completed' entry included, so refunds subtract twice-equivalent; unchanged. |
| CC-83 | M9 | Public standalone leaderboard page | IMPLEMENTED BUT NOT VERIFIED | Implemented | IMPLEMENTED BUT NOT VERIFIED | WT only | /leaderboard/[programId] untracked, not rendered. |
| CC-84 | M9 | Top 3 podium display with student rankings | PARTIALLY IMPLEMENTED | Implemented | IMPLEMENTED BUT NOT VERIFIED | WT only | rank 1-3 coloured badges in list (not a podium); untracked. |
| CC-85 | M9 | Leaderboard anonymization options | IMPLEMENTED BUT NOT VERIFIED | Implemented | PARTIALLY IMPLEMENTED | HEAD+WT | fixed 'First L.' display name; no anonymization options; no college field. |
| CC-86 | M9 | Embeddable leaderboard iframe endpoint | PARTIALLY IMPLEMENTED | Implemented | PARTIALLY IMPLEMENTED | WT only | embed page untracked; fixed iframe snippet; no event/Top-N settings; no external render test. |
| CC-87 | M10/M12 | Reward catalog creation & inventory | IMPLEMENTED BUT NOT VERIFIED | Implemented | PARTIALLY IMPLEMENTED | HEAD+WT | create/list only; no update/delete of rewards. |
| CC-88 | M10/M12 | Atomic reward claiming transaction | IMPLEMENTED BUT NOT VERIFIED | Implemented | PARTIALLY IMPLEMENTED | HEAD+WT | atomic transaction (points, stock, redemption, ledger) but unauthorised (CC-11), no per-user limit. |
| CC-89 | M10/M12 | Reward claim confirmation modal | PARTIALLY IMPLEMENTED | Implemented | PARTIALLY IMPLEMENTED | WT only | claim modal state exists in dashboard; API ignores deliveryNotes. |
| CC-90 | M10/M12 | Reward redemption alert to organizer | IMPLEMENTED BUT NOT VERIFIED | Implemented | NOT IMPLEMENTED | HEAD+WT | no organizer alert; ambassador email only claims organizer was notified. |
| CC-91 | §5 platform | Composite Firestore indexes defined | PARTIALLY IMPLEMENTED | Implemented | BROKEN | HEAD+WT | firestore.indexes.json lacks programAmbassadors(programId,status,totalPoints). |
| CC-92 | §5 platform | Legacy ambassador migration script | NOT IMPLEMENTED | Pending | NOT IMPLEMENTED | HEAD+WT | no migration script (scripts/ has none); MIGRATION_GUIDE is untracked prose. |
| CC-93 | §5 platform | Backward-compatible code lookup | PARTIALLY IMPLEMENTED | Implemented | IMPLEMENTED BUT NOT VERIFIED | HEAD+WT | resolveReferralCode falls back to approved legacy ambassadors; untested. |
| CC-94 | §5 platform | Comprehensive unit test suite | IMPLEMENTED BUT NOT VERIFIED | Implemented | PARTIALLY IMPLEMENTED | WT only | 394 tests pass but only 10 of 21 Creator Campus tests are behavioural. |
| CC-95 | §5 platform | Pure functional points calculation tests | PARTIALLY IMPLEMENTED | Implemented | PARTIALLY IMPLEMENTED | WT only | calculateEarnedPoints tested; awardPoints/reverse/adjust (the DB-touching 80% of points-engine.js) untested. '100% coverage' claim false; no coverage tool run. |
| CC-96 | §5 platform | Rate limiting on public referral validation | NOT IMPLEMENTED | Implemented | NOT IMPLEMENTED | HEAD+WT | no rate limiting in validate/apply/leaderboard routes. |
| CC-97 | §5 platform | Theme consistency across public pages | PARTIALLY IMPLEMENTED | Implemented | NOT IMPLEMENTED | HEAD+WT | no organizer accent theming; #FE760B hard-coded. |
| CC-98 | §5 platform | Centralized error logging & monitoring | NOT IMPLEMENTED | Implemented | NOT IMPLEMENTED | HEAD+WT | only console.warn/console.error; no structured logging or monitoring. |
| CC-99 | §5 platform | Clean Git branch integration | PARTIALLY IMPLEMENTED | Implemented | BROKEN | HEAD+WT | 81 uncommitted paths; Creator Campus branch has no work; new pages/tests untracked. |
| CC-100 | §5 platform | Single source of truth documentation | BROKEN | Implemented | BROKEN | HEAD+WT | campus.md contradicts the code on dozens of rows and relabels prior 'implemented but not verified' as 'behaviorally verified'. |

### Scorecard comparison

| Status | Final | Previous audit (100-item list) | campus.md pie chart |
|---|---:|---:|---:|
| IMPLEMENTED AND BEHAVIORALLY VERIFIED | 2 | 0 | 31 (labelled 'behaviorally verified') |
| IMPLEMENTED BUT NOT VERIFIED | 29 | 31 | 0 |
| PARTIALLY IMPLEMENTED | 27 | 35 | 35 |
| NOT IMPLEMENTED | 18 | 14 | 14 (labelled 'pending') |
| BROKEN | 24 | 20 | 20 |
| BLOCKED BY EXTERNAL DEPENDENCY | 0 | 0 | 0 |
| NOT APPLICABLE | 0 | 0 | 0 |
| **Total** | **100** | **100** | **100** |

Previous-audit statuses are the second-pass matrix in `CREATOR_CAMPUS_REQUIREMENT_TRACEABILITY.md`; its 100 rows had partly different requirement text (IDs 14, 20, 38, 40-43, 50, 55, 79, 80, 84, 85, 89, 90, 95-98, 100), so those rows are not like-for-like. campus.md is internally inconsistent: its pie chart shows 31/35/20/14, while its own §5 table marks 94 rows 'Implemented' and 6 'Pending'. Only 2 requirements (CC-31, CC-62) reach "behaviorally verified", because real unit tests execute the code (format generator; milestone crossing). The difference from campus.md's 31 is that campus.md equated "implemented" with "verified".

## 5. Discrepancy table (the 22 contested requirements, checked against code)

| Req | campus.md says | Code at HEAD | Working tree | Verdict |
|---|---|---|---|---|
| CC-05 | ownership enforced | applications/route.js has 0 ownership references | identical | campus.md false; BROKEN |
| CC-06 | ownership before parse | import/route.js passes caller.uid as organizerId, no check | identical | false; BROKEN |
| CC-07 | rules ownership | POST/GET no check | identical | false; BROKEN |
| CC-08 | adjust authorization | no check in route or adjustPointsManually | identical | false; BROKEN |
| CC-09 | ledger restricted | no check; referral-codes too | identical | false; BROKEN |
| CC-10 | reward create ownership | no check | identical | false; BROKEN |
| CC-11 | claim restricted to owner | userId never compared | identical | false; BROKEN |
| CC-16 | state machine enforced | any transition; attribution ignores status | identical | false; BROKEN |
| CC-28 | ambassadorId populated | reserve call has no ambassadorId; registry stores null | identical | false; BROKEN |
| CC-33 | imported codes retained | approve ignores application.referralCode | identical | false; BROKEN |
| CC-35 | links go to /e/[slug]?ref | /discover?ref= (programs-service.js:379, approve route) | dashboard uses ${baseUrl}?ref=; home/discover ignore ref | false; BROKEN |
| CC-45 | 5MB/1000 rows | no limits | no limits | false; BROKEN |
| CC-57 | webhook awards reliably | webhook never calls awardPointsForRegistration | identical | false; PARTIAL (award only via verify-payment) |
| CC-64 | idempotent keys | key present, checked outside transaction | identical | partly true; PARTIAL (race) |
| CC-66 | FieldValue.increment | no increment used | identical | false; BROKEN |
| CC-68 | proportional partial refund | any refund reverses all | identical | false; BROKEN |
| CC-69 | reversal outside lock | called inside runTransaction callback | identical | false; BROKEN |
| CC-70 | cancellation reverses | no hook | identical | false; NOT IMPLEMENTED |
| CC-77 | DTO whitelist | spreads full docs | identical | false; BROKEN |
| CC-78 | helper exported | export absent at HEAD | present, uncommitted | true only in working tree; PARTIAL |
| CC-81 | index supported | composite (programId,status,totalPoints) absent | identical | false; BROKEN |
| CC-82 | refunds excluded correctly | original 'reversed' + negative 'completed' both applied | identical | false; BROKEN |

Of 22 contested rows, campus.md is correct on none at HEAD and on one (CC-78) only in the uncommitted tree. The previous audit's findings are upheld in all 22 cases.

Additional campus.md claims found false: CC-04 (registry still public-read), CC-13 (no role check), CC-20 (`applicationQuestions` absent), CC-22 (dates unenforced), CC-24 (no unique index), CC-50 (no invalid-code badge), CC-55 (no ticket attribution), CC-74 (notification never sent), CC-90 (no organizer alert), CC-95 ("100% coverage"), CC-96 (no rate limit), CC-97 (no accent theming), CC-98, CC-99, CC-100, and the P0 checklist T-001..T-026 (all marked done). campus.md's "Build 108/108 routes" was not independently run (build not executed here).

## 6. Committed versus uncommitted

| Capability | Committed HEAD (ca4d64f) | Working tree only |
|---|---|---|
| Services (`lib/creator-campus/*`), organizer/ambassador/public APIs, hooks in checkout and webhook, rules, indexes, registration field, organizer admin pages and shell link | yes (b1688fd) | cosmetic/blank-line changes; importer and registry helper additions (parseAndSanitizeCsv, generateReferralCode, etc.) |
| Ambassador dashboard on new APIs | **no**: HEAD has the legacy commission dashboard showing clicks/revenue | rewritten, uses /api/ambassador/me, QR (third-party image service), claim modal |
| Public apply page, public leaderboard page, embed leaderboard page | **no** | all three, untracked |
| `verifySessionFromRequest` | **no** (HEAD /api/ambassador/me has an unresolved import) | yes |
| Creator Campus tests | **no** | `creator-campus-ambassador.test.js` (untracked) |
| Security fixes claimed by campus.md | none | none |

The working tree contains no fix for any of the six critical or eight high findings except that the dashboard no longer renders clicks/revenue. Nothing in the working tree is deployable until committed, and HEAD alone is functionally worse than the tree (no new dashboard/pages, `/me` import broken).

## 7. Security findings

All "Confirmed (code)" items are visible in unchanged source; **none was exercised** (no emulator, no test identities). "Risk, untested" = plausible from code but needs a behavioural test.

| Severity | Finding | Status |
|---|---|---|
| Critical | Any logged-in user can adjust any ambassador's points (CC-08) | Confirmed (code) |
| Critical | Any user can claim rewards with another ambassador's points (CC-11) | Confirmed (code) |
| Critical | Any user can read applicants' email/phone/college of any program (CC-05) | Confirmed (code) |
| Critical | Any user can import (optionally auto-approve) into any program (CC-06, CC-44) | Confirmed (code) |
| Critical | Any user can overwrite any program's points rules (CC-07) | Confirmed (code) |
| Critical | Any user can create rewards in any program (CC-10) | Confirmed (code) |
| High | `referralCodes` and `programEvents` publicly readable via client SDK (CC-04) | Confirmed (rules text) |
| High | Ledger and code lists readable by any user (CC-09) | Confirmed (code) |
| High | Points award/balance race and non-atomic updates (CC-64, CC-66) | Confirmed (code); race not demonstrated |
| High | Paused/draft programs and suspended ambassadors still attribute (CC-16, CC-51) | Confirmed (code) |
| High | /api/ambassador/me leaks private ledger/program fields (CC-77) | Confirmed (code) |
| High | Imported pending rows get active registry codes (CC-34) | Confirmed (code) |
| High | No upload size/row/type limits; xlsx@0.18.5 parser | Limits absence confirmed; library advisories **unverified** (`npm audit` could not run offline) |
| High | Registry ambassadorId null: new ambassadors earn no points (CC-28) | Confirmed (code); functional, not security |
| Medium | No organiser-role check on program creation (CC-13); self-referral email/phone ineffective (CC-52); no rate limiting (CC-96); hard-coded super-admin emails (CC-14); non-transactional approval (CC-27); leaderboard index missing (CC-81) | Confirmed (code) |
| Medium | Third-party QR image service receives referral URLs | Confirmed (code, working tree) |
| Risk, untested | Firestore rules actually deny cross-tenant access as written; cross-ambassador leakage through rules | Needs emulator tests |

## 8. Functional verification findings

See `CREATOR_CAMPUS_FUNCTIONAL_VERIFICATION_REPORT.md` (unchanged and still accurate for the backend). Key points: new ambassadors cannot earn points (CC-28); referral links resolve to pages that ignore `ref`; invalid referral codes are silently dropped; webhook does not award; partial refunds reverse everything; event leaderboard double-subtracts refunds; overall leaderboard likely fails without the index; no ticket/time/combo rules, cancellation, reconciliation job, points email, organizer reward alert.

## 9. Test coverage and evidence quality

Commands run (from `ticketlelo/`): `npm test` → tests 394, suites 38, pass 394, fail 0, skipped 0. ESLint on Creator Campus paths → 10 problems (2 errors `react/no-unescaped-entities` at `admin/programs/[programId]/page.jsx:914`, 8 warnings). `npm run build` and `npm audit` not run (build writes `.next/` and loads `.env`; audit needs network). Tests use `tests/qa-environment.cjs`, which strips production credentials.

The 21 tests in `creator-campus-ambassador.test.js`: 10 execute real code (referral format ×4, points calculation ×4, sanitiser ×2 — one of them tests `parseAndSanitizeCsv`, which production import does not call); 3 regex-match `firestore.rules` text; 4 regex-match source files for function names; 4 check file existence or absence of two strings. String/file tests were **not** counted as evidence for any requirement. Behavioural evidence exists for CC-31 and CC-62 only; CC-58, CC-71, CC-42 have partial executed evidence and were rated IMPLEMENTED BUT NOT VERIFIED/PARTIAL. No test covers authorization, Firestore, transactions, checkout, webhook, import end to end, leaderboard or embed. The campus.md claims "394 unit tests prove security assertions" and "100% coverage on points-engine.js" are false (no coverage tool was run; DB-touching functions are untested).

## 10. Updated priority-wise remaining work

**P0 (security / data integrity / delivery):** add owner/role checks to applications, import, rules, adjust, ledger, referral-codes, rewards, claim (+ role check on program create); stop public reads of `referralCodes`/`programEvents`; pass ambassadorId into registry and backfill existing codes; transactional + `FieldValue.increment` award/reversal/adjust/claim with deterministic idempotency ids; enforce program and ambassador status in one shared attribution validator; remove import `autoApprove` and hold imported codes inactive until approval; add upload size/row/type limits and review the xlsx dependency; whitelist `/api/ambassador/me`; add missing composite index; commit the work on the intended branch with the access-policy helper; correct or withdraw campus.md and the completion report.

**P1 (core workflow):** fix referral link targets (event URL or resolver route); client-side referral validation with error/removal; webhook/fulfilment-path point awards plus reconciliation job; proportional partial-refund and cancellation reversal; fix leaderboard reversal aggregation; honour imported code on approval; enforce application window; Form Builder/`applicationQuestions`; real self-referral data (email/phone); await or queue notifications; approval transactional; behavioural test suite (emulator, mocked Razorpay).

**P2 (missing features):** ticket/time/combo rules, points-awarded email, organizer reward alert, import preview+error export+Excel template+existing-email detection, embed settings (event, Top-N), reward update/delete and per-user limits, migration script, rate limiting, structured logging, application embed, points real-time refresh.

**P3:** theme/accent consistency, leaderboard anonymization options, lint cleanups, local QR generation.

## 11. Production readiness verdict

**NOT PRODUCTION READY.** Deploying would expose applicant PII, allow point/reward manipulation by any account, leave new ambassadors unable to earn points, and break committed-code ambassador access. Counts: 2 verified, 29 implemented-unverified, 27 partial, 18 not implemented, 24 broken, 0 blocked, 0 N/A, total 100. Unverified areas: all Firestore/Razorpay/email/browser behaviour, the build, dependency advisories, and the original specification.
