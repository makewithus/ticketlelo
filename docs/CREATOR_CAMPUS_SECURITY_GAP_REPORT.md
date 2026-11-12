# Creator Campus — Security Gap Report (2026-11-12)

Static review of the actual code and `firestore.rules`. Nothing was exploited; no test proves absence or presence of any item below (no Creator Campus tests exist). Admin-SDK API routes bypass Firestore rules, so API checks are the real boundary.

Requirement IDs refer to `CREATOR_CAMPUS_REQUIREMENT_TRACEABILITY.md`.

## Critical

| ID | Req | Vulnerability | Location | Trigger | Impact | Fix |
|---|---|---|---|---|---|---|
| SEC-C1 | CC-08 | Any authenticated user can add/remove points for any ambassador | `api/organizer/programs/[programId]/points/adjust/route.js:5-31`; `points-engine.js:304-357` | POST `{ambassadorId, pointsAdjustment, reason}` | Free rewards, leaderboard manipulation; audit row shows attacker uid | Verify caller owns program and ambassador.programId matches |
| SEC-C2 | CC-11 | Reward claim spends another user's points | `ambassador/rewards/[rewardId]/claim/route.js:19-27`; `rewards-service.js:70-139` | POST with victim's `ambassadorId` | Theft of points/rewards | Check ambassador.userId == caller, program match |
| SEC-C3 | CC-05 | Applicant PII exposed (email, phone, college) for any program | `.../applications/route.js:5-21` | GET `/api/organizer/programs/<id>/applications` as any user | Privacy breach, DPDP/GDPR exposure | Ownership check |
| SEC-C4 | CC-06, CC-44 | Import into any program, optionally auto-approving | `.../import/route.js`; `bulk-importer.js:111-190` | Upload CSV with `autoApprove=true` | Creates active ambassadors/codes in someone else's program | Ownership + remove autoApprove for non-owners |
| SEC-C5 | CC-07 | Overwrite any program's points rules | `.../points/rules/route.js:37-71` | POST rules with huge `paidRegistrationPoints` | Unlimited points inflation | Ownership; server-side version/validation |
| SEC-C6 | CC-10 | Create rewards in any program | `.../rewards/route.js:20-47` | POST reward with programId of victim | Fake rewards shown to ambassadors via `/me`; redemptions consume their points | Ownership |

## High

| ID | Req | Vulnerability | Location | Impact | Fix |
|---|---|---|---|---|---|
| SEC-H1 | CC-04 | `referralCodes` and `programEvents` readable by everyone | `firestore.rules:296, 334-338` | Full enumeration of codes with userId/organizerId/ambassadorId | Server-only reads |
| SEC-H2 | CC-09 | Any user reads any program's full ledger and code list | `points/ledger/route.js`, `referral-codes/route.js` | Leaks order/registration ids, user ids | Ownership, pagination |
| SEC-H3 | CC-45 | Untrusted spreadsheet parsed with `xlsx@0.18.5` (CVE-2023-30533 prototype pollution, CVE-2024-22363 ReDoS); no size/row/type limits | `bulk-importer.js:31`, `import/route.js` | DoS / memory exhaustion by any user | Limits, upgrade or alternative parser |
| SEC-H4 | CC-64, CC-66 | Race conditions in points award (idempotency query and balance read outside transaction) | `points-engine.js:117-131, 154, 204-219` | Double awards, lost updates | Deterministic doc id + `FieldValue.increment` in the transaction |
| SEC-H5 | CC-16, CC-51 | Paused/draft/archived programs and suspended ambassadors still attribute and earn | `create-order:227-259`, `register-free:274-306`, `referral-registry.js:123-130` | Business-rule bypass | Central validation incl. program and profile status |
| SEC-H6 | CC-77 | `/api/ambassador/me` leaks orderId, registrationId, organizer uid, idempotency key, rule snapshot | `ambassador/me/route.js:28-46` | Violates "points and sharing data only" | DTO whitelist |
| SEC-H7 | CC-76 | Dashboard shows clicks/revenue | `dashboard/page.jsx:391-416` | Spec violation | Remove |
| SEC-H8 | CC-33, CC-44 | Imported pending ambassadors get an **active** registry code before approval | `bulk-importer.js:150-160` with `referral-registry.js:76` | Codes valid at checkout for unapproved people (no points, but attribution recorded) | Reserve as inactive |

## Medium

| ID | Req | Issue | Location |
|---|---|---|---|
| SEC-M1 | CC-13 | Any attendee account can create programs (no organiser role check) | `organizer/programs/route.js:37` |
| SEC-M2 | CC-52 | Self-referral email/phone checks ineffective (registry returns no email/phone); guests can use own code | `create-order:246`, `register-free:292` |
| SEC-M3 | CC-96 | Public validate/apply/leaderboard endpoints have no rate limit; validate returns ambassadorId/programId | `referral/validate/route.js` |
| SEC-M4 | CC-02 | Rules constrain only `status` on create, other fields client-writable | `firestore.rules:313-316, 396-400` |
| SEC-M5 | CC-14 | Super-admin recognised by hard-coded email addresses | approve/reject/programs routes |
| SEC-M6 | CC-27, CC-24 | Approval not transactional: double approval issues two active codes | `programs-service.js:290-380` |
| SEC-M7 | CC-82 | Error responses return `err.message` to the public | `public/leaderboard/.../route.js` |
| SEC-M8 | CC-69 | Reversal executes inside a transaction callback with non-transactional writes | `webhooks/razorpay/route.js:89-94` |

## Low / informational

- Application answers are stored unvalidated and unbounded (`submitAmbassadorApplication`).
- Formula-injection sanitising prefixes `'` on input, which silently alters imported names beginning with `-` or `+`; no export exists, so the risk is currently theoretical.
- Role auto-promotion in `lib/auth-server.js:80-93` was noticed but not analysed.

## Verified-by-reading controls (not execution-verified)

Organizer-ownership checks exist in `programs-service.js` (update, status, connect, disconnect, toggle, approve, reject), `programs` list/get routes, and server-side event-connection validation in `create-order` and `register-free`. Ledger, redemptions and registry are server-write-only in the rules.
