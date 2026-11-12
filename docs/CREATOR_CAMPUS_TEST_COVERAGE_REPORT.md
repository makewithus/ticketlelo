# Creator Campus — Test Coverage Report (2026-11-12)

## Commands executed (from `ticketlelo/`)

| Command | Result |
|---|---|
| `npm test` (`node --require ./tests/qa-environment.cjs --test --test-isolation=none 'tests/**/*.test.js'`) | tests 394, suites 38, pass 394, fail 0, cancelled 0, skipped 0 (373 existing + 21 new) |
| `node --require ./tests/qa-environment.cjs --test --test-isolation=none tests/unit/creator-campus-ambassador.test.js` | 21 pass, 0 fail, 0 skipped |
| `npx eslint lib/creator-campus src/app/(app)/programs src/app/(app)/leaderboard src/app/(app)/embed/leaderboard src/app/(app)/(user)/ambassador src/app/(app)/admin/programs tests/unit/creator-campus-ambassador.test.js` | 10 problems: 2 errors (`react/no-unescaped-entities`, `admin/programs/[programId]/page.jsx:914`), 8 warnings |
| `npm audit --json` | Could not run: no network/registry access in this environment. Dependency advisories are **unverified** |
| `npm run build` | **Not run**: would write `.next/` (existing artifacts) and load `.env`. Not executed to respect the no-modification rule |
| Firestore emulator / E2E / browser | Not available; not run. `scripts/qa/*` are legacy audit scripts, not run |

Safety: `tests/qa-environment.cjs` strips Firebase/Razorpay/SMTP credentials and sets fake project values, so these runs could not reach production.

## Inventory of Creator Campus tests (file `tests/unit/creator-campus-ambassador.test.js`, 21 tests)

| Group | Tests | Nature | What it proves |
|---|---:|---|---|
| 1 Referral code | 4 | real unit tests of pure functions | code format, uppercase/trim, regex, self-referral helper on in-memory objects |
| 2 Points calc | 4 | real unit tests of `calculateEarnedPoints` | base, multiplier, milestone crossing, defaults |
| 3 Import sanitiser | 2 | unit tests | `sanitizeCellValue`; `parseAndSanitizeCsv`, which production does **not** call (import uses `xlsx`) |
| 4 Firestore rules | 3 | **regex over `firestore.rules` text** | the rule blocks exist; does not evaluate rules, cannot catch cross-tenant access or public reads |
| 5 Attribution hooks | 4 | **regex over source files** | identifiers such as `awardPointsForRegistration` appear in `verify-payment`, `register-free`, `create-order`, webhook; no execution |
| 6 UI completeness | 4 | file-exists / string checks | shell link string, files exist, absence of two strings in the dashboard |

Genuine behavioural coverage: 10 of 21. Everything else is source-text matching and would pass with broken logic.

Legacy: `tests/unit/phase2-forms-ambassadors.test.js` (8 tests) covers the old commission helpers and form validator only.

## Category report

| Category | Exists? | Count / result | Remaining untested |
|---|---|---|---|
| Unit, Creator Campus | yes | 10 real, all pass | ticket/time/combo rules (not implemented), ledger math, code uniqueness |
| API / authorization | no | 0 | all 13 organizer routes, claim, adjust, import, /me |
| Firestore rules emulator | no (regex only) | 0 real | tenant isolation, public reads |
| Integration (checkout/webhook/refund) | no | 0 | referral persistence, retries, duplicate webhooks, partial refunds |
| Concurrency / idempotency | no | 0 (existing capacity test is unrelated) | code reservation race, double award |
| Import | no | 0 | file limits, malformed files, partial import |
| Registration attribution | no | 0 | field gating, invalid-code UX |
| Leaderboard privacy | no | 0 | response fields, event variant after refunds |
| E2E / browser | no | 0 | everything |
| Regression | partial | 373 existing pass, none touches new hooks behaviourally | |

## Conclusion

394 passing tests do not demonstrate Creator Campus works. At most they show that pure helper functions behave and that certain identifiers exist in files. Every requirement stays at IMPLEMENTED BUT NOT VERIFIED or lower.
