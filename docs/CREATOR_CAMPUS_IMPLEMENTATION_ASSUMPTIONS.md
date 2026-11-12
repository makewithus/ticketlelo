# TICKETLELO — CREATOR CAMPUS AMBASSADOR PROGRAM
## Engineering Assumptions & Non-Supplied Decision Log

### 1. Specification Baseline & Assumptions
Because the original 1,029-line specification text was not checked into the repository, all engineering decisions have been grounded on:
1. `docs/CREATOR_CAMPUS_AMBASSADOR_AUDIT.md` (The comprehensive audit report).
2. The user's Master Prompt defining all 18 functional and security phases.
3. Established TicketLelo code conventions, security policies, and UI styling.

| Area | Decision / Assumption | Rationale | Backward Compatibility Guarantee |
|---|---|---|---|
| **Referral Code Format** | `XXXX-NNNN`: First 4 characters of normalized username (alphanumeric uppercase), hyphen, followed by 4 random digits (0000–9999) generated cryptographically (`crypto.randomInt`). If username < 4 letters, pad with deterministic uppercase characters from email or fallback "TLAM". | Follows audit specification precisely. Ensures readability, uniqueness, and prevents collision. | Existing legacy codes (e.g. `ADIL123`) remain preserved and active in `referralCodes` registry. |
| **Multi-Role Handling** | Users retain their `role` string (e.g. `"organiser"` or `"superAdmin"`), and an array `roles` / flag `isAmbassador: true` is added. In the shell header, if user has ambassador profiles, a quick switcher "Switch to Ambassador View" is rendered. | Avoids downgrading an organizer account to a regular ambassador role while enabling seamless dual participation. | Existing auth token checks (`isOrganiser()`, `user.role === "organiser"`) continue to work without modification. |
| **Points Rule Default & Precedence** | If no event-specific rule is configured, default is 10 points per paid registration, 2 points per free registration. Precedence: Event-Specific Rule > Ticket-Specific Override > Program Global Default. | Clear, predictable, deterministic resolution. Prevents ambiguous zero-point awards. | Custom rules can be overridden per program and per event by the organizer. |
| **Points Ledger Immutability** | Ledger entries in `pointsLedger` are strictly append-only. Reversals create a negative compensating entry referencing the original entry ID (`reversalRef`). | Standard double-entry financial/points accounting invariant. Guarantees audit compliance. | Historical calculations are never rewritten or deleted. |
| **Legacy Data Coexistence** | Legacy collections `ambassadors` and `commissions` are maintained. Any historical monetary commissions are preserved intact and not mutated into points. | Strict requirement of Phase 13. | No existing attendee, ambassador, or organizer records will be deleted or altered. |
| **Public Leaderboard Privacy** | Public queries return only: `rank`, `displayName` (derived from full name or username without surname if privacy mode enabled), and `totalPoints`. Email, phone, and attendee counts are strictly scrubbed on the server before response transmission. | Eliminates any chance of PII leakage or competitive intelligence gathering. | Embeds and public views adhere strictly to GDPR / Indian DPDP guidelines. |
| **Bulk Import Partial Success** | In CSV/XLSX imports, valid rows are processed and committed, while invalid rows (e.g. bad email format, duplicate code) are collected into an error report for download. | Organizers should not have a 100-row file rejected because of 1 typo. | Atomic per-row validation with clean error messages. |

