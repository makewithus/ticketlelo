# Creator Campus — Test Coverage Audit (2026-11-12)

## Commands actually run (from `ticketlelo/`)

| Command | Result |
|---|---|
| `npm test` (`node --require ./tests/qa-environment.cjs --test --test-isolation=none 'tests/**/*.test.js'`) | tests 373, suites 31, pass 373, fail 0, cancelled 0, skipped 0, duration about 1.5 s |
| `npx eslint lib/creator-campus src/app/api/organizer/programs src/app/api/programs src/app/api/public src/app/api/ambassador src/app/api/referral "src/app/(app)/admin/programs"` | 6 problems: 2 errors (both `react/no-unescaped-entities`, `[programId]/page.jsx:914`), 4 warnings (e.g. `react-hooks/purity` at line 570, `set-state-in-effect` in `page.jsx:70`) |
| `npm run build` | **Not run**: writes `.next/` and loads `.env`; recorded as a verification limitation |
| Earlier, same session | `tests/unit/phase2-forms-ambassadors.test.js`: 8 pass |

Environment safety: `tests/qa-environment.cjs` deletes `FIREBASE_*`, `RAZORPAY_*`, `SMTP_*`, etc. and sets fake Firebase values, so tests cannot reach production. Test output shows mock email jobs (`mock_*` provider ids).

## Coverage of the specification

Creator Campus tests found: **0**. `git ls-files tests` has no file referencing `creator-campus`, programs, points ledger, leaderboard, import or the referral registry. The only ambassador test (`phase2-forms-ambassadors.test.js`) exercises legacy `calculateCommissionAmount` and `isSelfReferral` from `lib/commissions.js`, plus the form validator.

| Test type | Present for Creator Campus | Notes |
|---|---|---|
| Unit (points calc, code format, sanitiser) | No | Pure functions (`calculateEarnedPoints`, `normalizeUsernamePrefix`, `sanitizeCellValue`) are easy to test and untested |
| API / authorization | No | Would have caught SEC-C1..C6 |
| Firestore rules (emulator) | No | No `@firebase/rules-unit-testing` usage; package has no emulator config |
| Integration (checkout, webhook, refund) | No | 373 existing tests do not touch the new hooks |
| Concurrency / idempotency | No | `tests/integration/concurrency-capacity.test.js` covers ticket capacity only |
| Import (CSV/XLSX) | No | |
| E2E / browser | No | `scripts/qa/*` are legacy audit scripts and were not run |
| Regression of existing flows | Partial | Existing suites pass but are mock-based |

## Implication

A green build and 373 passing tests say nothing about this feature. Every Creator Campus requirement is therefore at best IMPLEMENTED BUT NOT VERIFIED, and none could be marked IMPLEMENTED AND VERIFIED.

## Suggested minimum suite (P0/P1)

1. Unit: points calc, milestone boundaries, code generation/regex, sanitiser.
2. API authorization matrix: each organizer route as non-owner, non-organiser, anonymous.
3. Emulator: rules (cross-organizer, public reads), unique-code race, double-award race, refund reversal (full and partial), reward-claim races.
4. Integration with mocked Razorpay: referral survives create-order -> verify-payment -> webhook retry.
5. Import: valid/invalid rows, oversize file, malicious sheet.
