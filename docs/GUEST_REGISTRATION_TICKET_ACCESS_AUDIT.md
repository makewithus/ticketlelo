# TicketLelo — Guest Registration, First-Time Setup & My Tickets: Implementation Audit

Audit date: 2026-11-12. Audit only: no source, config, schema or data was modified. This file is the only file created.

**Important scope note:** the audit prompt refers to a "supplied specification", but only the audit prompt itself was provided. I derived requirements from the exact strings and flows it quotes (popup copy, email subject, preheader, CTA, supporting message, flows). Where the prompt gives no exact copy (setup page heading and text, returning-user popup and subject), I checked behaviour only, not wording.

**Evidence method:** nearly everything below is from static code reading. The only executed tests are the existing suite (335 pass), and just 2 of them touch this feature. Both render the email template in isolation. I could not run Firebase, Resend or a browser, so no flow was exercised end to end. Anything not covered by those 2 tests is therefore at best IMPLEMENTED BUT NOT VERIFIED.

Status codes: **IV** = Implemented and verified (executed test), **IN** = Implemented but not verified, **PI** = Partially implemented, **NI** = Not implemented, **BL** = Blocked by external dependency, **NA** = Not applicable.

---

## 8.1 Executive Summary

| Measure | Count |
|---|---|
| Requirements identified (R01-R84; R85 only points to 8.7) | 84 |
| Implemented and verified (executed test, template-level only) | 6 |
| Implemented but not verified (static code reading only) | 55 |
| Partially implemented | 18 |
| Not implemented | 3 (R65 ticket ownership, R82 rate limiting, R84 enumeration protection) |
| Blocked by external dependency | 1 (R32 email retry against Resend/Redis) |
| Not applicable | 1 (R67 pagination) |

R27 and R72 are counted as verified only for the template, and R27's URL builder is unverified. "Verified" means a passing executed test, not a visual check.

**Critical issues:** 1. **High-priority issues:** 5. Details are in 8.5 and 8.8.

**Verdict: PARTIALLY IMPLEMENTED.** The happy path is largely built: guest registration, automatic account creation, a first-time or returning-user email, the setup page, redirect to `/dashboard`, and a multi-event ticket list. However, the setup-password endpoint has an account-takeover flaw. Ticket detail access is unauthenticated, which contradicts the ownership requirement. There is no rate limiting. A token-rotation bug can leave the emailed setup link invalid. Very little of the flow has execution-level test coverage.

---

## 8.2 Detailed Requirement Matrix

Abbreviations — FE: frontend; BE: backend; DB: Firestore. File paths are relative to `ticketlelo/`.

| ID | Spec section | Requirement | Status | Frontend evidence | Backend evidence | Database evidence | Test evidence | Gap |
|---|---|---|---|---|---|---|---|---|
| R01 | 3.1 | Visitor can open an event without logging in | IN | `src/app/(app)/e/[slug]/page.jsx`, `register/[eventId]/page.jsx` render `DynamicRegistrationForm` | none required | events | none | Not run in a browser |
| R02 | 3.1 | Can register without creating an account first | IN | `dynamic-registration-form.jsx:1106` posts without a token if signed out | `api/register-free/route.js:14-95` handles `caller == null` | creates `users` doc + Auth user | none | Not run |
| R03 | 3.1 | No unexpected redirect to login / forced account creation | IN | Login modal exists (`dynamic-registration-form.jsx:2388`), but guest path calls `register-free` directly | no auth gate in route | — | none | The conditions under which the login modal opens were not fully traced |
| R04 | 3.1 | Name, email, phone collected | IN | form fields; `registration-form.jsx` (unused, see R16) | route:34-40 extracts name/email/phone | `registrations.fullName/email/whatsappPhone` | none | — |
| R05 | 3.1 | Event-specific fields handled | IN | custom form fields | `validateFormSubmission` (route:178) | `formData`, `customFieldResponses` | none | — |
| R06 | 3.1 | Registration persisted with the correct event | IN | — | transaction route:200-273; slug→id resolution route:109-119 | `registrations/{sha256(uid:eventId)}`, `tickets/TKT-…` | none | — |
| R07 | 3.1 | Existing registration/ticketing preserved | IN | — | — | — | 335 suite tests pass, none target `register-free` | No regression evidence for this route |
| R08 | 3.1 | Backend enforces required data / invalid data rejected | IN | — | 400 on bad eventId/formData/email (route:15-30); form validation 400 | — | none | Phone is not required server-side and its format is unchecked |
| R09 | 3.2 | Popup title "Registration Successful!" | IN | `dynamic-registration-form.jsx:2467` | — | — | none | Approval-required events show "Registration Submitted" (not in spec) |
| R10 | 3.2 | Description wording exact | IN | `:2488`, exact match | — | — | none | — |
| R11 | 3.2 | Password-setup sentence (new users) | IN | `:2490-2493`, exact | `isFirstTimeUser` from API | — | none | — |
| R12 | 3.2 | Primary button "Got It" | IN | `:2520`, closes modal | — | — | none | — |
| R13 | 3.2 | "Check your inbox for your ticket confirmation email." | IN | `:2509` | — | — | none | — |
| R14 | 3.2 | Popup never says "reset" or "account already exists" | IN | grep on both popups | — | — | none | — |
| R15 | 3.2 | Does not force immediate password setup | IN | dismissible via X and "Got It" | — | — | none | — |
| R16 | 3.2 | Correct for new and returning users | IN | Dynamic form swaps the sentence for returning users (`:2490-2499`) | `isFirstTimeUser` returned | `hasSetPassword` | none | `components/forms/registration-form.jsx` has a hard-coded setup sentence for everyone, but it is not imported by any page (dead code) |
| R17 | 3.2 | Popup responsive | IN | `max-h-[90dvh] overflow-y-auto`, `max-w-lg` | — | — | none | Not rendered at any breakpoint |
| R18 | 3.3 | Professional HTML email | IV | `lib/email/templates/ticket-pass.js` | — | — | `tests/unit/guest-registration-and-password-setup.test.js` renders it | Visual quality not inspected |
| R19 | 3.3 | Responsive email | PI | single 560px fluid table | — | — | none | No media queries or Outlook (MSO) fallbacks |
| R20 | 3.3 | TicketLelo branding | IN | cid logo + text fallback | logo attached in `send-ticket-email` | — | none | — |
| R21 | 3.3 | Works in common email clients | PI | gradients, box-shadow, border-radius, cid images | — | — | none | Not tested in any client |
| R22 | 3.3 | Correct recipient | IN | — | `send-ticket-email/route.js:58-63` takes the email from the registration, lowercased | `registrations.email` | none | — |
| R23 | 3.3 | Subject "You're Registered! Your Ticket Is Ready on TicketLelo" | IN | — | route:333-335, exact for first-time users | — | none asserting the subject | Returning users get a different subject: "…Your Ticket for {event} is Ready" (spec silent) |
| R24 | 3.3 | Preheader exact | IN | template:96-98, exact | — | — | not asserted | Preheader text is not HTML-escaped (static, so low risk) |
| R25 | 3.3 | Event name/date/time/venue/registration ID shown | IN | template:206-250 | route:96-107 | `events`, `tickets` | test checks name and ID only | Date/time/venue not asserted. Fallback defaults ("Thu, 29 Oct 2026", "Main Auditorium…") appear when data is missing, which would show false event details |
| R26 | 3.3 | CTA "SET YOUR PASSWORD & VIEW TICKET" | IV | template:269 | — | — | test asserts text | — |
| R27 | 3.3 | CTA destination is the setup route with token | IV (template) / IN (builder) | — | route:309-313 builds `/setup-password?email&token&ticketId` | `accountSetupTokens/{email}` | test asserts a passed-in URL appears | URL construction in the route is untested |
| R28 | 3.3 | Supporting message text | IN | template:276 | — | — | test checks only "Already have a TicketLelo password?" | The sentence after the question is itself the link text, which is unusual but the words are present |
| R29 | 3.3 | No generic password-reset email | IV | — | uses the `TICKET_DELIVERY` type | — | negative assertions on "reset your password" | — |
| R30 | 3.3 | Email failure handling | PI | — | register-free route:277-285 catches and logs. The registration is kept and the HTTP response is still success; the client also calls `/api/send-ticket-email` | registration committed first | none | The user is told "confirmation has been sent" even if the enqueue failed. Retry depends on the queue worker (not executed) |
| R31 | 3.3 | Duplicate email prevention | PI | — | idempotency key `idemp_ticket_{ticketId}` (job-repository:74-96) | `emailJobs` | none | Works for the email itself, but see BUG-2: the token is rotated while the duplicate email is suppressed |
| R32 | 3.3 | Retry behaviour | BL | — | `lib/email/worker.js`, `queue.js` exist | `emailJobs` | email suite passes (mock provider) | Not verified against Resend or Redis |
| R33 | 3.3 | Dynamic variable substitution | IV | — | — | — | test renders sample data | — |
| R34 | 3.3 | HTML escaping of user values | PI | template:49-55 escapes event, name, venue, ticketId, tier, price | — | — | none | `formattedTime` (raw `event.time`), `formattedDate` fallback, and `directPassUrl` (raw ticketId) are inserted unescaped. `event.time` is organiser-controlled (see SEC-6) |
| R35 | 3.3 | No sensitive tokens in logs | PI | — | `lib/email/logger.js` redacts keys containing "token" and bearer strings | The full setup URL is stored in `emailJobs.html/text` | none | The token sits in plaintext in the job doc (SuperAdmin-read only) and in the Firestore `accountSetupTokens` doc |
| R36 | 3.4 | Dedicated setup page exists | IN | `src/app/(app)/(public)/setup-password/page.jsx` | — | — | none | — |
| R37 | 3.4 | Correct heading / supporting text | IN | "Welcome to TicketLelo!" + support paragraph | — | — | none | Wording not given in the prompt, so not compared |
| R38 | 3.4 | Registered email populated / associated | IN | read-only prefilled from `?email=` | email required in API | token doc keyed by email | none | — |
| R39 | 3.4 | New and confirm password fields | IN | page:170-231 | — | — | none | — |
| R40 | 3.4 | Visibility toggle | IN | per-field toggle with aria-label | — | — | none | Not run |
| R41 | 3.4 | Password requirements displayed | PI | "Must be at least 6 characters long." | `length < 6` | — | none | Minimal policy only (6 chars, no complexity) |
| R42 | 3.4 | Password validation | PI | client min 6 | route:24-26 | — | none | Server `.trim()`s the password but the client logs in with the untrimmed value, so a password with leading or trailing spaces sets fine but the auto-login fails |
| R43 | 3.4 | Confirm-password validated | IN | page:56 + route:28 | — | — | none | — |
| R44 | 3.4 | Setup link secure | PI | token in query string | — | — | none | Token and email in the URL (history/Referer exposure). The email is not bound cryptographically |
| R45 | 3.4 | Token generated securely | IN | — | `crypto.randomBytes(24)` (register-free:99, send-ticket-email:297) | stored plaintext | none | Not hashed at rest |
| R46 | 3.4 | Token expires | PI | — | 7-day expiry stored; checked at `setup-password/route.js:78` | `expiresAt` | none | Only enforced when the token doc exists and the check does not throw (SEC-1) |
| R47 | 3.4 | Token single-use | PI | — | `used:true` set after success (route:107-118) | `used` | none | Write is non-transactional and errors are swallowed. A concurrent request can race. Registering again while the user is still unset rewrites the doc with `used:false` |
| R48 | 3.4 | Token cannot be used for another account | PI | — | Doc keyed by email, and the token must match the email in the request | `accountSetupTokens/{email}` | none | Bypassed when no token doc exists (SEC-1) |
| R49 | 3.4 | Invalid/expired tokens handled safely | PI | error banner | distinct 400/403 messages | — | none | Fails open on lookup error (SEC-1). Distinct messages and the 404 "No account found" response leak account state (SEC-4) |
| R50 | 3.4 | Existing users not forced into setup | PI | — | register-free: `hasSetPassword === false` triggers setup | `users.hasSetPassword` | none | The inline `signup()` in the registration form (`dynamic-registration-form.jsx:1569`, `lib/auth.js:120`) stores `hasSetPassword:false` for users who just chose a password, so they get "set your password" emails (BUG-3). Google and legacy users have no flag |
| R51 | 3.4 | Account linked to original registration | IN | — | `userId` on registration and ticket; dashboard also matches by email | `registrations.userId/email` | none | — |
| R52 | 3.4 | User need not register again | IN | — | account is created at registration time | `users` | none | — |
| R53 | 3.4 | Success confirmation shown | IN | page:150-164 | — | — | none | — |
| R54 | 3.4 | Authenticated after setup | IN | `signInWithCustomToken`, fallback `login()` | `createCustomToken` | — | none | The custom-token path does not call `establishServerSession`, so the server session cookie behaviour is unverified |
| R55 | 3.4 | Redirect to general dashboard | IN | `router.replace("/dashboard")` | — | — | none | — |
| R56 | 3.4 | Registered ticket visible after setup | IN | `/dashboard` and `/my-tickets` read `registrations` | — | `userId` + `email` queries | none | Not executed |
| R57 | 3.4 | No redirect to the event registration page | IN | no such redirect found | — | — | none | — |
| R58 | 3.5 | Single account-level dashboard: Overview / My Tickets / Account Settings | IN | `(user)/dashboard/page.jsx:206-218`; also `/my-tickets`, `/account` | — | — | none | `/tickets` just redirects to `/dashboard` |
| R59 | 3.5 | Ticket fields: name, image, date, venue, status, QR, view action | IN | `components/dashboard/ticket-card.jsx:81-169` | — | `tickets/registrations` | none | I did not confirm "ticket type" or "time" in the card |
| R60 | 3.5 | Tickets fetched for the authenticated account | IN | `subscribeToUserRegistrations` (`lib/firestore.js:806`) | Firestore rules `registrations` read | `userId == uid` OR `email == user.email` | none | The email query depends on the `users.email` value |
| R61 | 3.5 | Multiple events appear together | IN | the query is not event-scoped | — | — | none | No execution test |
| R62 | 3.5 | Historical + upcoming + filtering | IN | filter and search in `my-tickets/page.jsx` | — | — | none | Not run |
| R63 | 3.5 | Each ticket opens the correct detail page | IN | `/tickets/[ticketId]` | `GET /api/tickets/[ticketId]` | — | none | — |
| R64 | 3.5 | QR belongs to the correct ticket | IN | — | signed payload from `ticketId` (register-free:140) | `tickets.qrPayload` | none | QR falls back to the plain ticketId if signing fails |
| R65 | 3.5 | Ticket ownership validated server-side | **NI** | the page fetches with no credentials | `src/app/api/tickets/[ticketId]/route.js` has no auth | — | none | See SEC-2 |
| R66 | 3.5 | Another user cannot see a ticket | PI | the list is protected by Firestore rules (`firestore.rules:204-255`) | the detail API is public | — | none | The list is protected, the detail view is not |
| R67 | 3.5 | Pagination (where implemented) | NA | none implemented | — | — | — | — |
| R68 | 3.5 | METCON + PRAROHA + TechFest example under one account | IN | no per-event scoping | `registrationId = sha256(uid:eventId)` gives one registration per user per event | — | none | Not executed |
| R69 | 3.6 | Existing user registers another event | IN | — | `getUserByEmail` then reuse uid (route:60-78) | — | none | — |
| R70 | 3.6 | Popup shown | IN | — | — | — | none | — |
| R71 | 3.6 | Email sent | IN | — | `sendTicketDeliveryEmail` | — | none | — |
| R72 | 3.6 | Email CTA goes to login | IV (template) | template:292 | `/login?email&redirect=/dashboard` | — | test asserts "LOG IN TO VIEW YOUR TICKET" | — |
| R73 | 3.6 | Not asked to create a password again | IN | — | `isFirstTimeUser=false` when `hasSetPassword !== false` | — | template test only | — |
| R74 | 3.6 | No password-reset email sent | IV (template) | — | — | — | test | — |
| R75 | 3.6 | Login with the existing password | IN | `login/page.jsx` reads `email` and `redirect` | — | — | none | — |
| R76 | 3.6 | New ticket appears in the existing dashboard | IN | same list query | — | — | none | — |
| R77 | 3.6 | Email case normalization | IN | — | lowercase on register-free, send-ticket-email, setup-password | stored lowercase | none | Legacy `users.email` values with mixed case could miss the email query |
| R78 | 3.6 | Duplicate user creation prevented | PI | — | `getUserByEmail` first, then `createUser` | — | none | Race: two simultaneous guest requests → second `createUser` throws "email-already-exists" → 500 (BUG-4) |
| R79 | 3.6 | Existing credentials remain unchanged | PI | — | the register path does not touch passwords | — | none | `setup-password` can overwrite them (SEC-1) |
| R80 | 3.6 | Multiple registrations under one account | IN | — | per-event doc id | — | none | — |
| R81 | 6 | Passwords never stored in plaintext | IN | — | Firebase Auth only; the Firestore user doc contains no password | — | none | Placeholder random password (32 bytes) is used for guest accounts |
| R82 | 6 | Rate limiting on sensitive endpoints | **NI** | — | no rate limit in any route (grep found nothing in `src`, `lib`) | — | none | See SEC-3 |
| R83 | 6 | Guest registration cannot hijack an existing account | PI | — | an authenticated caller must match the form email; a guest merely attaches a registration to the existing uid | — | none | Pre-hijack scenario (SEC-5) |
| R84 | 6 | Account enumeration protection | **NI** | setup page shows server messages | 404 "No account found…", "password has already been set" | — | none | SEC-4 |
| R85 | 5 | Test scenarios 1–22 | see 8.7 | — | — | — | 2 unit tests only | Almost none executed |

---

## 8.3 User Journey Audit

**New visitor:** event page → `DynamicRegistrationForm` → `POST /api/register-free` → creates the Auth user (random secret), the `users` doc (`hasSetPassword:false`), the `accountSetupTokens/{email}` doc, and the registration + ticket (Firestore transaction) → enqueues the ticket email → popup with the setup sentence → email CTA `/setup-password?email&token&ticketId` → `POST /api/auth/setup-password` → custom-token sign-in → `/dashboard` → My Tickets → `/tickets/[id]` (QR). **All transitions exist in code. None were executed.**

**Existing user:** same route; `getUserByEmail` finds the account, `isFirstTimeUser=false`, a login-CTA email, `/login?email&redirect=/dashboard`, then the same dashboard query. Transitions exist. The decision logic is untested.

**Multi-event:** one registration doc per `(uid, event)`. The dashboard queries by `userId` or `email`, with no event filter. Implemented, unexecuted.

**Password setup:** the happy path is complete. Defects: the validation can be bypassed (SEC-1), the token can be rotated (BUG-2), and there is no rate limiting.

**Ticket / QR access:** the dashboard list is protected by rules. The ticket detail API is public (SEC-2).

```
Guest -> Event page -> register-free -> [User+Token+Reg+Ticket] -> Email queue -> Popup
                                              |                       |
                                    (existing user)           First-time? -> /setup-password -> setup API [!SEC-1] -> /dashboard
                                              |                       |
                                              +------- Login CTA ---->+--> /login -> /dashboard -> My Tickets -> /tickets/[id] [!public API]
Missing transitions: no rate limit anywhere; no ownership check on ticket detail; no email-verification step.
```

---

## 8.4 Database and Data Integrity Audit

- **Models:** `users/{uid}`, `accountSetupTokens/{email}`, `registrations/{sha256(uid:eventId)}`, `tickets/TKT-{28 hex}`, `events`, `emailJobs`. Users link to registrations by `userId`; the dashboard also matches on `email`.
- **Guest users are created immediately** at registration time with Auth + a `users` doc, not lazily. Unverified emails therefore get real accounts.
- **One token per email** (doc id = email), shared by every ticket. See BUG-2.
- **Duplicate-registration guard:** the deterministic doc id makes repeat registration idempotent (`alreadyRegistered`), but the route still enqueues email and rotates the token on the repeat.
- **Race:** `getUserByEmail` followed by `createUser` is not atomic (BUG-4). The user doc is written after `createUser`, so a crash between the two leaves an Auth user with no `users` doc.
- **Approval-required events:** tickets get "Pending Approval", the email is skipped, and the setup token is still created and never emailed until approval. Whether approval later sends the setup link was not traced.
- **Indexes:** the `registrations` equality queries (`userId`, `email`) are single-field, so they need no composite index. `firestore.indexes.json` was not exhaustively checked.
- **Migration:** users without `hasSetPassword` are treated as "has password" by `register-free` but as "not set" by `setup-password`. This inconsistency is the root of SEC-1. A backfill is recommended.
- **Orphans:** none found by inspection. No data was queried.

---

## 8.5 Authentication and Security Audit

| ID | Severity | Finding |
|---|---|---|
| SEC-1 | **CRITICAL** | `POST /api/auth/setup-password` (`src/app/api/auth/setup-password/route.js:41-100`) can set the password of any existing account whose `hasSetPassword` is not literally `true`, using only the email. (a) If no `accountSetupTokens` doc exists, any non-empty `token` string passes (the code only rejects when the token is also empty, line ~83). (b) The whole token check is inside a `try/catch` that only logs a warning, so a Firestore error fails open. Affected accounts: legacy users and Google sign-ins (neither stores the flag), and any user without a token doc. The attacker only needs the victim's email. Not executed (code-read), but the logic is unambiguous. |
| SEC-2 | **HIGH** | `GET /api/tickets/[ticketId]` is unauthenticated. It returns the full registration (name, email, phone, `formData`, QR) to anyone with the ticket ID. The ticket page fetches it without credentials. This fails "ownership validated server-side" and also lets the email's "View Pass Online" link bypass the password setup. IDs are 112-bit hashes (hard to guess), but they appear in URLs and emails. |
| SEC-3 | **HIGH** | No rate limiting or CAPTCHA anywhere (`setup-password`, `register-free`, `send-ticket-email`, `forgot-password`). `register-free` creates a Firebase Auth user and sends an email for any address, so it can be used for mass account creation and email bombing. |
| SEC-4 | **MEDIUM** | Account enumeration: `setup-password` returns 404 for unknown emails and a different message for "already set". `register-free` reveals no state to the client beyond `isFirstTimeUser`, which indirectly reveals whether an account has a password. |
| SEC-5 | **MEDIUM** | Account pre-hijack: email/password signup does not verify email. An attacker can sign up with a victim's email first; the victim's later guest registration is attached to the attacker's uid and appears in the attacker's dashboard (including PII). Firestore rules match tickets and registrations on `token.email` without requiring `email_verified`. |
| SEC-6 | **MEDIUM** | `formattedTime` (organiser-controlled `event.time`) is inserted into the email HTML unescaped. |
| SEC-7 | **HIGH** | `POST /api/send-ticket-email` accepts unauthenticated callers and reissues the ticket email (including the setup token) for any known `ticketId`. It goes only to the owner's address, but it allows email spam and token re-sends with no throttle. The client calls this route without a token on the guest path. |
| SEC-8 | **LOW** | Setup tokens are stored in plaintext and compared with `!==` (not constant-time). The setup password is capped at 6 characters minimum, trimmed on the server. |
| SEC-9 | **LOW** | `register-free` returns raw `error.message` with 500. |
| SEC-10 | **INFO** | Passwords are handled by Firebase Auth (hashed there). Firestore rules deny client access to `accountSetupTokens`. Tokens are redacted in the logger by key name. |

(Counting note: the executive summary counts SEC-1 as the critical issue and SEC-2, SEC-3, SEC-7 plus BUG-1 and BUG-2 below as high.)

---

## 8.6 Email Audit

- **Template:** `lib/email/templates/ticket-pass.js`. HTML plus a plain-text alternative. Table layout, dark theme, cid-embedded logo and QR, PDF attachment, a calendar link and a map link.
- **Subjects:** first-time: "You're Registered! Your Ticket Is Ready on TicketLelo" (matches). Returning: "You're Registered! Your Ticket for {event} is Ready".
- **Preheader:** matches the spec for first-time users. Returning users get "Log in to access your ticket".
- **Dynamic data:** event, date, time, venue, registration ID, tier and price. Missing data is replaced by hard-coded demo defaults ("Tech Fest 2026", "Main Auditorium…", "Thu, 29 Oct 2026"), which could show wrong event information.
- **CTA:** first-time users get the setup URL with a token; returning users get a login URL. The secondary login sentence appears for first-time users.
- **Delivery:** queued through `enqueueEmail` at P0 with an idempotency key. The worker, retry and webhook paths exist but were run only against the mock provider.
- **Gaps:** BUG-2 (the emailed token can be invalidated), SEC-6 and the escaping gaps, no Outlook-safe markup, and two triggers per registration (server-side, plus the client calling the API again).

---

## 8.7 Test Execution Report

- **Command:** `npm test` (`node --require ./tests/qa-environment.cjs --test --test-isolation=none 'tests/**/*.test.js'`)
- **Environment:** local Linux, Node test runner. `qa-environment.cjs` strips production Firebase, Resend and SMTP credentials and uses demo values. The email provider is the mock one, and no real mail was sent. Firebase Admin was not available, so no route handler ran against a database.
- **Result:** 335 tests, 24 suites; **335 passed, 0 failed, 0 skipped.**
- **Relevant tests:** `tests/unit/guest-registration-and-password-setup.test.js` (2 tests, template rendering only). No test exercises `register-free`, `setup-password`, ticket ownership, token expiry or reuse, or the dashboard.

| # | Scenario | Result |
|---|---|---|
| 1-2 | New visitor registers, persists | Not executed (needs Firebase) |
| 3 | Popup displays | Not executed (code-read only) |
| 4 | First-time email generated | Executed (template only) |
| 5 | CTA points to setup route | Template executed with a supplied URL; route-built URL not executed |
| 6-8 | Valid, expired, reused token | Not executed |
| 9 | Password mismatch rejected | Not executed (code-read) |
| 10-12 | Account usable, tickets visible | Not executed |
| 13-16 | Existing user registers, email, login, password unchanged | Template executed (login CTA); rest not executed |
| 17 | New ticket in My Tickets | Not executed |
| 18 | Another user cannot access the ticket | Not executed; code-read shows the detail API is public |
| 19 | QR matches ticket | Not executed |
| 20 | Invalid data rejected | Not executed (code-read) |
| 21 | Email failure does not corrupt registration | Not executed (code-read: the registration is committed first) |
| 22 | Duplicate requests | Not executed (code-read: deterministic doc ids) |

---

## 8.8 Missing Features and Bugs

| ID | Req | Sev | Description | Files | Root cause | Expected / Actual | Fix |
|---|---|---|---|---|---|---|---|
| SEC-1 | R46-49, R79 | CRITICAL | Password takeover via `setup-password` | `src/app/api/auth/setup-password/route.js` | Token check passes when the doc is missing, fails open on error, and the "already set" test treats an absent flag as unset | Expected: reject unless a valid unused unexpired token exists for this email. Actual: accepted with any string | Require a matching token doc (reject otherwise), fail closed on error, use a transaction, and backfill `hasSetPassword` |
| SEC-2 | R65-66 | HIGH | Public ticket-detail API | `src/app/api/tickets/[ticketId]/route.js`, `(app)/tickets/[ticketId]/page.jsx` | No auth check | Expected: only the owner, organiser or admin. Actual: anyone with the ID | Verify the session, compare `userId`/verified email, and send the token from the page |
| SEC-3 | R82 | HIGH | No rate limiting | all auth and registration routes | Not implemented | — | Add per-IP and per-email limits and bot protection |
| SEC-7 | R31 | HIGH | Unauthenticated email resend | `src/app/api/send-ticket-email/route.js` | The auth check is skipped for anonymous callers | — | Make the endpoint server-internal, or require ownership plus throttling |
| BUG-1 | R13/R30 | HIGH | The popup says "sent" even if the enqueue failed | `register-free/route.js:277-285` | The error is swallowed | Expected: a visible failure or a retry. Actual: silent | Return an `emailQueued` flag and show it in the UI |
| BUG-2 | R31, R46 | HIGH | The setup token is overwritten on every registration while the user is still unset, so an earlier link becomes invalid. A repeat registration also rotates the token while the new email is dropped as a duplicate | `register-free/route.js:97-110` | One token per email, always rewritten | Expected: the link stays valid until it is used or expires. Actual: the earlier link fails with "Invalid token" | Reuse the existing unexpired token |
| BUG-3 | R50 | MEDIUM | Inline signup stores `hasSetPassword:false` for users who chose a password | `dynamic-registration-form.jsx:1569`, `lib/auth.js:120` | Missing options | Such users get "set your password" emails | Pass `hasSetPassword:true` |
| BUG-4 | R78 | MEDIUM | Concurrent guest requests can return a 500 | `register-free/route.js:60-90` | `getUserByEmail` then `createUser` is not atomic | — | Catch `email-already-exists` and re-fetch |
| BUG-5 | R42 | LOW | The server trims the password, the client does not | `setup-password/route.js:19`, `page.jsx:96` | Mismatch | The auto-login can fail | Remove the trim |
| GAP-1 | R19, R21 | LOW | The email has no responsive CSS or Outlook support | `ticket-pass.js` | — | — | Add MSO and media queries |
| GAP-2 | R41 | LOW | Weak password requirements | setup page/API | — | — | Raise the minimum and show the rules |
| GAP-3 | R25 | LOW | Demo default values in the email | `send-ticket-email/route.js` | — | — | Fail or omit instead of inventing details |
| GAP-4 | R85 | MEDIUM | No test for `register-free`, `setup-password`, ticket access or dashboard queries | `tests/` | — | — | Add route-level tests with a mocked admin SDK |

---

## 8.9 Final Implementation Verdict

**PARTIALLY IMPLEMENTED.**

The feature set requested is present end to end in code: guest registration, auto-created accounts, the first-time vs returning email, the setup page, and an account-level My Tickets dashboard. The exact copy for the popup, subject, preheader, CTA and supporting line matches. However:

1. The password-setup endpoint can be abused to take over accounts (CRITICAL).
2. Ticket detail access has no ownership check, which fails an explicit requirement.
3. There is no rate limiting.
4. The token rotation bug can invalidate the emailed link.
5. Execution evidence is almost absent: apart from 2 email-template tests, nothing in this flow was run, so I cannot mark any behavioural requirement "verified".
