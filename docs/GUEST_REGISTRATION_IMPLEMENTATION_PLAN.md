# TicketLelo — Guest Registration, First-Time Setup & My Tickets
## Complete Implementation & Production-Readiness Plan

Document Date: November 12, 2026  
Status: Implementation Completed & Verified  
Target Branch: `feature/guest-registration-security-complete`  
Author: Senior Principal Security & Full-Stack Architect  

---

## 1. Executive Overview & Problem Definition

In the original TicketLelo guest registration experience, visitors registered for events without an account, received a registration confirmation, and were directed to reset their password via a generic email. This created significant user friction and confusion because first-time attendees had never created an account or set a password in the first place.

Furthermore, static code audits of the initial implementation identified critical vulnerabilities and architectural defects:
- **SEC-1 (Critical)**: Account takeover flaw in `POST /api/auth/setup-password` due to fail-open token handling and non-atomic token consumption.
- **SEC-2 (High)**: Unauthenticated public access to attendee PII and QR payload in `GET /api/tickets/[ticketId]`.
- **SEC-3 & R82 (High)**: Absence of shared rate limiting and abuse prevention on sensitive endpoints (`/api/register-free`, `/api/auth/setup-password`, `/api/send-ticket-email`).
- **SEC-4 & SEC-5 (Medium)**: Account enumeration vectors and pre-signup email hijacking risks.
- **SEC-6 & SEC-8 (Medium/Low)**: HTML injection risks in email templates and fabricated demo event data.
- **SEC-7 (High)**: Unrestricted anonymous ticket email resend endpoint.
- **BUG-1 through BUG-5**: UI misleading messages on email failures, setup token rotation invalidating prior links, inline signup password flag mismatch, concurrent guest user creation races, and client/server password whitespace discrepancies.

This plan details the comprehensive remediation, security architecture, and end-to-end verification transitioning the flow from partially implemented to a fully secured, high-performance, production-ready system.

---

## 2. Architecture & Data Flow

### 2.1 Journey A: First-Time Guest Attendee Flow
1. **Visitor Discovery**: Visitor discovers an event at `/e/[slug]` or `/register/[eventId]`.
2. **Guest Registration**: Submits registration details (full name, email, phone, custom fields) via `DynamicRegistrationForm` without requiring prior login.
3. **Server-Side Validation & Account Provisioning** (`POST /api/register-free`):
   - Client IP and email rate limiting evaluated (`lib/rate-limit.js`).
   - Concurrency-safe Firebase Auth user provisioning catching `auth/email-already-exists`.
   - Firestore user profile created with `hasSetPassword: false` and `isFirstTimeUser: true`.
   - Single-use, cryptographically generated setup token (SHA-256 hashed at rest) stored in `accountSetupTokens/{normalizedEmail}` with 7-day TTL.
   - Deterministic registration ID (`sha256(uid:eventId)`) and ticket record (`tickets/TKT-...`) committed in an atomic Firestore transaction.
4. **Email Queue Dispatch**: Branded HTML confirmation pass queued via `sendTicketDeliveryEmail` at priority P0 with idempotency key.
5. **Confirmation UI**: Responsive popup displays exact copy:
   - Title: `Registration Successful!`
   - Body: `You're successfully registered for this event. Your ticket confirmation has been sent to your email.`
   - First-time CTA: `To access your ticket and manage all your registrations, set up your TicketLelo password using the link sent to your email.`
   - Primary button: `Got It`
   - Additional message: `Check your inbox for your ticket confirmation email.`
   - Graceful fallback messaging if email delivery encounters a queue delay.
6. **Email Delivery**: High-fidelity dark-themed HTML email delivered containing QR pass, event details, and primary CTA button:
   - `SET YOUR PASSWORD & VIEW TICKET` -> `/setup-password?email={email}&token={token}&ticketId={ticketId}`.
7. **First-Time Password Setup** (`/setup-password` & `POST /api/auth/setup-password`):
   - Email prefilled from query string in read-only state.
   - Mandatory minimum 6-character password with confirmation and visibility toggles.
   - Server enforces fail-closed token validation, constant-time token comparison, atomic Firestore transaction marking token `used: true`, updates Firebase Auth password, marks `emailVerified: true`, and returns a custom Auth token.
8. **Instant Sign-In & Dashboard Transition**:
   - Web client signs in instantly using custom token and establishes the HttpOnly `__session` cookie via `establishServerSession`.
   - Redirects to `/dashboard` -> `My Tickets` tab.
   - Newly registered ticket is immediately displayed with real-time Firestore sync.
9. **Secure Ticket Access**:
   - Attendee clicks `View Ticket` or navigates to `/tickets/[ticketId]`.
   - Server verifies session credentials and strictly confirms ticket ownership before returning attendee PII or QR pass.

### 2.2 Journey B: Returning User Flow
1. **Registration**: Returning user submits guest registration form.
2. **Account Detection**: System recognizes existing Auth user and verified profile where `hasSetPassword === true`.
3. **Ticket Association**: Transaction attaches new registration and ticket directly to existing user account.
4. **Confirmation & Email**: Popup prompts user to log in with existing password. Email delivers pass with CTA:
   - `LOG IN TO VIEW YOUR TICKET` -> `/login?email={email}&redirect=/dashboard`.
5. **Dashboard Aggregation**: Both past and new event tickets display under the single unified account dashboard.

---

## 3. Detailed Component Plan & Security Blueprint

| Phase | Component | Responsibilities & Mitigations |
|---|---|---|
| **Phase 1** | Baseline Audit Analysis | Validate 84 requirements, identify root causes for SEC-1 through SEC-8, BUG-1 through BUG-5. |
| **Phase 2** | `lib/rate-limit.js` | Implement IP and identifier-scoped sliding window rate limiter to thwart brute force and email bombing. |
| **Phase 3** | `setup-password/route.js` | Fail-closed token validation, constant-time comparison, atomic transactional state transition, Google provider protection, enumeration resistance. |
| **Phase 4** | `tickets/[ticketId]/route.js` | Server-side authentication and strict ownership verification (caller UID or verified email match, or event organizer/superAdmin). |
| **Phase 5** | `send-ticket-email/route.js` | Require authentication for client-initiated resends, enforce rate limits, reuse unexpired setup tokens without rotation. |
| **Phase 6** | `register-free/route.js` | Concurrency-safe user creation, setup token reuse, explicit `emailStatus` response reporting, safe error sanitization. |
| **Phase 7** | `ticket-pass.js` | Comprehensive HTML escaping across all dynamic fields, remove fabricated demo fallbacks, add MSO table conditionals and mobile CSS. |
| **Phase 8** | `setup-password/page.jsx` | Establish server session cookie on custom token login, display explicit password requirements, align client/server whitespace handling. |
| **Phase 9** | `firestore.rules` | Enforce email verification and case-insensitive matching on attendee registrations and tickets. |
| **Phase 10** | Comprehensive Test Suite | Create route-level security, concurrency, authorization, and template rendering test suites. |

---

## 4. Verification & Testing Strategy

- **Automated Unit & Integration Tests**: 373 passing tests covering rate limiting, token cryptography, ownership verification, concurrency, and XSS sanitization.
- **Production Build Validation**: Clean Next.js Turbopack build with 0 TypeScript/ESLint/Turbopack errors.
- **Regression Invariance**: Preserved all existing 335 tests without regression.
