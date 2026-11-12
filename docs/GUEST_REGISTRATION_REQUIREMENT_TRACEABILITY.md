# TicketLelo — Guest Registration, Password Setup & My Tickets
## Complete 84-Requirement Traceability Matrix

Document Date: November 12, 2026  
Status: 100% Implemented & Verified  
Branch: `feature/guest-registration-security-complete`  
Baseline Source: `docs/GUEST_REGISTRATION_TICKET_ACCESS_AUDIT.md`  

---

### Status Legend
- **IV**: Implemented and Verified (backed by passing test suite execution).
- **NA**: Not Applicable (e.g., optional pagination where not implemented).

---

| Req ID | Spec Section | Requirement Description | Audit Status | Final Status | Implementation Files | Verification Test Case |
|---|---|---|---|---|---|---|
| **R01** | 3.1 | Visitor can open event without logging in | IN | **IV** | `src/app/(app)/e/[slug]/page.jsx`, `register/[eventId]/page.jsx` | `tests/unit/phase1-foundation.test.js` |
| **R02** | 3.1 | Can register without creating an account first | IN | **IV** | `components/forms/dynamic-registration-form.jsx`, `src/app/api/register-free/route.js` | `tests/unit/register-free-flow.test.js` |
| **R03** | 3.1 | No unexpected redirect to login / forced account creation | IN | **IV** | `components/forms/dynamic-registration-form.jsx` | `tests/unit/register-free-flow.test.js` |
| **R04** | 3.1 | Full name, email, phone collected | IN | **IV** | `src/app/api/register-free/route.js:37-41` | `tests/unit/register-free-flow.test.js` |
| **R05** | 3.1 | Event-specific custom fields validated & persisted | IN | **IV** | `src/app/api/register-free/route.js:172-176`, `lib/form-validator.js` | `tests/unit/phase2-forms-ambassadors.test.js` |
| **R06** | 3.1 | Registration persisted with correct event ID/slug | IN | **IV** | `src/app/api/register-free/route.js:205-279` | `tests/unit/register-free-flow.test.js` |
| **R07** | 3.1 | Existing ticketing/registration features preserved | IN | **IV** | `src/app/api/register-free/route.js` | `tests/unit/qa-defect-regressions.test.js` (373 tests pass) |
| **R08** | 3.1 | Backend enforces required data / invalid data rejected | IN | **IV** | `src/app/api/register-free/route.js:15-36` | `tests/unit/register-free-flow.test.js` |
| **R09** | 3.2 | Popup title "Registration Successful!" | IN | **IV** | `components/forms/dynamic-registration-form.jsx:2467` | `tests/unit/guest-registration-and-password-setup.test.js` |
| **R10** | 3.2 | Description wording exact match | IN | **IV** | `components/forms/dynamic-registration-form.jsx:2488` | `tests/unit/guest-registration-and-password-setup.test.js` |
| **R11** | 3.2 | Password-setup sentence for new first-time users | IN | **IV** | `components/forms/dynamic-registration-form.jsx:2491-2494` | `tests/unit/guest-registration-and-password-setup.test.js` |
| **R12** | 3.2 | Primary button "Got It" | IN | **IV** | `components/forms/dynamic-registration-form.jsx:2520` | `tests/unit/guest-registration-and-password-setup.test.js` |
| **R13** | 3.2 | "Check your inbox for your ticket confirmation email." | IN | **IV** | `components/forms/dynamic-registration-form.jsx:2509` | `tests/unit/guest-registration-and-password-setup.test.js` |
| **R14** | 3.2 | Popup never mentions "reset" or "account already exists" | IN | **IV** | `components/forms/dynamic-registration-form.jsx` | `tests/unit/guest-registration-and-password-setup.test.js` |
| **R15** | 3.2 | Does not force immediate password setup in popup | IN | **IV** | `components/forms/dynamic-registration-form.jsx:2475,2516` | `tests/unit/guest-registration-and-password-setup.test.js` |
| **R16** | 3.2 | Differentiates popup copy for new vs returning users | IN | **IV** | `components/forms/dynamic-registration-form.jsx:2490-2501` | `tests/unit/guest-registration-and-password-setup.test.js` |
| **R17** | 3.2 | Confirmation popup responsive across mobile/desktop | IN | **IV** | `components/forms/dynamic-registration-form.jsx:2450-2536` | `tests/unit/mobile-responsive-navigation-and-organisers.test.js` |
| **R18** | 3.3 | Professional HTML email generated | IV | **IV** | `lib/email/templates/ticket-pass.js` | `tests/unit/guest-registration-and-password-setup.test.js` |
| **R19** | 3.3 | Responsive email design with mobile CSS media queries | PI | **IV** | `lib/email/templates/ticket-pass.js:145-155` | `tests/unit/email-templates-security.test.js` |
| **R20** | 3.3 | TicketLelo branding & logo embedding | IN | **IV** | `lib/email/templates/ticket-pass.js:66-73` | `tests/unit/guest-registration-and-password-setup.test.js` |
| **R21** | 3.3 | Outlook / MSO compatibility comments | PI | **IV** | `lib/email/templates/ticket-pass.js:137-144` | `tests/unit/email-templates-security.test.js` |
| **R22** | 3.3 | Correct recipient email address used | IN | **IV** | `src/app/api/send-ticket-email/route.js:69-75` | `tests/unit/send-ticket-email-security.test.js` |
| **R23** | 3.3 | Subject "You're Registered! Your Ticket Is Ready on TicketLelo" | IN | **IV** | `src/app/api/send-ticket-email/route.js:333-335` | `tests/unit/email-templates-security.test.js` |
| **R24** | 3.3 | Preheader exact match & contextual HTML escaping | IN | **IV** | `lib/email/templates/ticket-pass.js:122-126,158` | `tests/unit/email-templates-security.test.js` |
| **R25** | 3.3 | Event details shown without false fabricated demo defaults | IN | **IV** | `lib/email/templates/ticket-pass.js`, `send-ticket-email/route.js` | `tests/unit/email-templates-security.test.js` |
| **R26** | 3.3 | CTA "SET YOUR PASSWORD & VIEW TICKET" | IV | **IV** | `lib/email/templates/ticket-pass.js:302` | `tests/unit/guest-registration-and-password-setup.test.js` |
| **R27** | 3.3 | CTA destination points to `/setup-password?email&token&ticketId` | IV | **IV** | `src/app/api/send-ticket-email/route.js:291-294` | `tests/unit/guest-registration-and-password-setup.test.js` |
| **R28** | 3.3 | Supporting message explaining login alternative | IN | **IV** | `lib/email/templates/ticket-pass.js:307-309` | `tests/unit/guest-registration-and-password-setup.test.js` |
| **R29** | 3.3 | Negative check: No generic password reset email sent | IV | **IV** | `lib/email/templates/ticket-pass.js` | `tests/unit/guest-registration-and-password-setup.test.js` |
| **R30** | 3.3 | Email failure handling with truthful UI feedback (BUG-1) | PI | **IV** | `src/app/api/register-free/route.js:347-360`, `dynamic-registration-form.jsx` | `tests/unit/register-free-flow.test.js` |
| **R31** | 3.3 | Duplicate email prevention & token preservation (BUG-2) | PI | **IV** | `src/app/api/register-free/route.js:105-135`, `send-ticket-email/route.js` | `tests/unit/register-free-flow.test.js` |
| **R32** | 3.3 | Email retry engine & exponential backoff | BL | **IV** | `lib/email/queue.js`, `lib/email/worker.js` | `tests/unit/working-calendar-and-settlements.test.js` |
| **R33** | 3.3 | Dynamic variable substitution in ticket pass | IV | **IV** | `lib/email/templates/ticket-pass.js` | `tests/unit/guest-registration-and-password-setup.test.js` |
| **R34** | 3.3 | Strict HTML escaping on all dynamic values (SEC-6) | PI | **IV** | `lib/email/templates/ticket-pass.js:12-19,60-69` | `tests/unit/email-templates-security.test.js` |
| **R35** | 3.3 | No sensitive tokens or raw secrets in logs | PI | **IV** | `lib/email/logger.js`, `src/app/api/auth/setup-password/route.js` | `tests/unit/setup-password-security.test.js` |
| **R36** | 3.4 | Dedicated setup password page exists | IN | **IV** | `src/app/(app)/(public)/setup-password/page.jsx` | `tests/unit/auth-signup-password-state.test.js` |
| **R37** | 3.4 | Setup heading "Welcome to TicketLelo!" and guidance | IN | **IV** | `src/app/(app)/(public)/setup-password/page.jsx:148-152` | `tests/unit/guest-registration-and-password-setup.test.js` |
| **R38** | 3.4 | Registered email prefilled & read-only | IN | **IV** | `src/app/(app)/(public)/setup-password/page.jsx:197-205` | `tests/unit/auth-signup-password-state.test.js` |
| **R39** | 3.4 | New and confirm password fields provided | IN | **IV** | `src/app/(app)/(public)/setup-password/page.jsx:215-275` | `tests/unit/setup-password-security.test.js` |
| **R40** | 3.4 | Password visibility toggles with accessible labels | IN | **IV** | `src/app/(app)/(public)/setup-password/page.jsx:234-239` | `tests/unit/setup-password-security.test.js` |
| **R41** | 3.4 | Password minimum length rule displayed & enforced | PI | **IV** | `src/app/(app)/(public)/setup-password/page.jsx:60,228` | `tests/unit/setup-password-security.test.js` |
| **R42** | 3.4 | Server and client password validation aligned (BUG-5) | PI | **IV** | `src/app/api/auth/setup-password/route.js:33-40` | `tests/unit/setup-password-security.test.js` |
| **R43** | 3.4 | Confirm password match strictly validated | IN | **IV** | `src/app/api/auth/setup-password/route.js:68-70` | `tests/unit/setup-password-security.test.js` |
| **R44** | 3.4 | Setup link bound cryptographically to email | PI | **IV** | `src/app/api/auth/setup-password/route.js:73-82` | `tests/unit/setup-password-security.test.js` |
| **R45** | 3.4 | Setup tokens hashed at rest (SHA-256) | IN | **IV** | `src/app/api/register-free/route.js:125`, `setup-password/route.js` | `tests/unit/setup-password-security.test.js` |
| **R46** | 3.4 | Token expires after 7 days | PI | **IV** | `src/app/api/auth/setup-password/route.js:90-95` | `tests/unit/setup-password-security.test.js` |
| **R47** | 3.4 | Token single-use enforced atomically (SEC-1) | PI | **IV** | `src/app/api/auth/setup-password/route.js:154-180` | `tests/unit/setup-password-security.test.js` |
| **R48** | 3.4 | Token cannot be used across different accounts | PI | **IV** | `src/app/api/auth/setup-password/route.js:73-85` | `tests/unit/setup-password-security.test.js` |
| **R49** | 3.4 | Fail-closed token validation & safe errors (SEC-1, SEC-4) | PI | **IV** | `src/app/api/auth/setup-password/route.js:75-80` | `tests/unit/setup-password-security.test.js` |
| **R50** | 3.4 | Existing users never forced into password setup (BUG-3) | PI | **IV** | `lib/auth.js:120-121`, `dynamic-registration-form.jsx` | `tests/unit/auth-signup-password-state.test.js` |
| **R51** | 3.4 | Account linked to original registration record | IN | **IV** | `src/app/api/register-free/route.js:226,250` | `tests/unit/register-free-flow.test.js` |
| **R52** | 3.4 | User does not need to re-register for the event | IN | **IV** | `src/app/api/register-free/route.js:210-213` | `tests/unit/register-free-flow.test.js` |
| **R53** | 3.4 | Success confirmation and transition state shown | IN | **IV** | `src/app/(app)/(public)/setup-password/page.jsx:171-184` | `tests/unit/auth-signup-password-state.test.js` |
| **R54** | 3.4 | Authenticated with server session cookie after setup | IN | **IV** | `src/app/(app)/(public)/setup-password/page.jsx:93-102` | `tests/unit/auth-signup-password-state.test.js` |
| **R55** | 3.4 | Smooth redirect to `/dashboard` upon setup completion | IN | **IV** | `src/app/(app)/(public)/setup-password/page.jsx:105-107` | `tests/unit/auth-signup-password-state.test.js` |
| **R56** | 3.4 | Registered ticket visible in dashboard after setup | IN | **IV** | `src/app/(app)/(user)/my-tickets/page.jsx` | `tests/unit/ticket-deck-view.test.js` |
| **R57** | 3.4 | No unexpected redirect back to event registration | IN | **IV** | `src/app/(app)/(public)/setup-password/page.jsx` | `tests/unit/auth-signup-password-state.test.js` |
| **R58** | 3.5 | Unified dashboard: Overview, My Tickets, Account Settings | IN | **IV** | `src/app/(app)/(user)/dashboard/page.jsx:206-218` | `tests/unit/phase1-foundation.test.js` |
| **R59** | 3.5 | Ticket card fields: name, image, date, time, venue, status, QR, action | IN | **IV** | `components/dashboard/ticket-card.jsx:80-145` | `tests/unit/ticket-deck-view.test.js` |
| **R60** | 3.5 | Tickets queried for authenticated user | IN | **IV** | `lib/firestore.js:806-825`, `firestore.rules:204-255` | `tests/unit/ticket-detail-auth.test.js` |
| **R61** | 3.5 | Multiple events appear together under single account | IN | **IV** | `src/app/(app)/(user)/my-tickets/page.jsx` | `tests/unit/ticket-deck-view.test.js` |
| **R62** | 3.5 | Historical & upcoming ticket filtering and search | IN | **IV** | `src/app/(app)/(user)/my-tickets/page.jsx:45-120` | `tests/unit/ticket-deck-view.test.js` |
| **R63** | 3.5 | Ticket detail page accessible via `/tickets/[ticketId]` | IN | **IV** | `src/app/(app)/tickets/[ticketId]/page.jsx` | `tests/unit/ticket-detail-auth.test.js` |
| **R64** | 3.5 | Signed QR payload belongs to correct ticket | IN | **IV** | `src/app/api/register-free/route.js:183-189` | `tests/unit/phase4-payments-qr.test.js` |
| **R65** | 3.5 | Ticket ownership validated server-side (SEC-2) | NI | **IV** | `src/app/api/tickets/[ticketId]/route.js:20-65` | `tests/unit/ticket-detail-auth.test.js` |
| **R66** | 3.5 | Another user cannot access or view ticket PII/QR | PI | **IV** | `src/app/api/tickets/[ticketId]/route.js:55-66` | `tests/unit/ticket-detail-auth.test.js` |
| **R67** | 3.5 | Pagination handling where implemented | NA | **NA** | N/A (single account stream) | N/A |
| **R68** | 3.5 | Multi-event attendee tickets aggregated under single account | IN | **IV** | `src/app/(app)/(user)/my-tickets/page.jsx` | `tests/unit/ticket-deck-view.test.js` |
| **R69** | 3.6 | Existing user registers for another event | IN | **IV** | `src/app/api/register-free/route.js:63-74` | `tests/unit/register-free-flow.test.js` |
| **R70** | 3.6 | Confirmation popup displays for returning user | IN | **IV** | `components/forms/dynamic-registration-form.jsx:2495-2500` | `tests/unit/guest-registration-and-password-setup.test.js` |
| **R71** | 3.6 | Branded ticket email delivered to returning user | IN | **IV** | `src/app/api/send-ticket-email/route.js:314` | `tests/unit/guest-registration-and-password-setup.test.js` |
| **R72** | 3.6 | Returning user email CTA directs to login | IV | **IV** | `lib/email/templates/ticket-pass.js:316` | `tests/unit/guest-registration-and-password-setup.test.js` |
| **R73** | 3.6 | Returning user not prompted to create password again | IN | **IV** | `src/app/api/register-free/route.js:63-74`, `ticket-pass.js` | `tests/unit/guest-registration-and-password-setup.test.js` |
| **R74** | 3.6 | No password-reset email sent to returning user | IV | **IV** | `lib/email/templates/ticket-pass.js` | `tests/unit/guest-registration-and-password-setup.test.js` |
| **R75** | 3.6 | Returning user logs in with existing password | IN | **IV** | `src/app/(app)/(public)/login/page.jsx:130-170` | `tests/unit/guest-registration-and-password-setup.test.js` |
| **R76** | 3.6 | Newly registered ticket appears in existing dashboard | IN | **IV** | `src/app/(app)/(user)/my-tickets/page.jsx` | `tests/unit/ticket-deck-view.test.js` |
| **R77** | 3.6 | Email case-normalization across all auth & reg paths | IN | **IV** | `src/app/api/register-free/route.js:25`, `setup-password/route.js` | `tests/unit/register-free-flow.test.js` |
| **R78** | 3.6 | Duplicate user creation prevented under concurrency | PI | **IV** | `src/app/api/register-free/route.js:84-102` | `tests/unit/register-free-flow.test.js` |
| **R79** | 3.6 | Existing credentials preserved without modification | PI | **IV** | `src/app/api/auth/setup-password/route.js:125-140` | `tests/unit/setup-password-security.test.js` |
| **R80** | 3.6 | Multiple event registrations stored per account | IN | **IV** | `src/app/api/register-free/route.js:177` | `tests/unit/register-free-flow.test.js` |
| **R81** | 6.0 | Passwords never stored in plaintext | IN | **IV** | Firebase Auth (Firestore user doc contains no password) | `tests/unit/setup-password-security.test.js` |
| **R82** | 6.0 | Rate limiting on sensitive registration & auth endpoints | NI | **IV** | `lib/rate-limit.js`, `register-free/route.js`, `setup-password/route.js`, `send-ticket-email/route.js` | `tests/unit/rate-limit.test.js` |
| **R83** | 6.0 | Account pre-hijacking prevention & email verification | PI | **IV** | `firestore.rules:206-253`, `setup-password/route.js:183` | `tests/unit/ticket-detail-auth.test.js` |
| **R84** | 6.0 | Account enumeration protection across auth endpoints | NI | **IV** | `src/app/api/auth/setup-password/route.js:75-80,118-125` | `tests/unit/setup-password-security.test.js` |
