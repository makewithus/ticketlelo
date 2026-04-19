# TicketLelo — Feature Testing Guide

> Complete step-by-step verification flows for all 13 implemented SaaS features.
> Run these tests in order — some features depend on having an event and registration already created.

---

## Pre-Test Setup

Before running any tests, ensure the following are in place:

1. **Start the dev server**

   ```bash
   cd ticketlelo
   npm run dev
   ```

   App runs at `http://localhost:3000`

2. **Have two accounts ready**
   - A **superAdmin** account (email: `superadmin@ticketlelo.com`)
   - An **organiser** account (any `@ticketlelo.com` email, e.g. `testorg@ticketlelo.com`)

3. **Have at least one event created** under the organiser account with at least one registration (needed for messaging, analytics, reminders)

4. **Set environment variables** (check `.env.local`)
   - `NEXT_PUBLIC_APP_URL` = `http://localhost:3000`
   - `CRON_SECRET` = any string (e.g. `test123`)
   - Firebase config variables

---

## Feature 1 — Broadcast Messaging

**What was built:** Organisers can compose and send email messages to all event registrants, schedule future messages, retry failed sends, and view delivery stats.

### Files to verify exist

- `lib/messages.js`
- `src/app/api/messages/create/route.js`
- `src/app/api/messages/send/route.js`
- `src/app/api/messages/[eventId]/route.js`
- `src/app/api/messages/retry/route.js`
- `components/organiser/broadcast-messaging.jsx`
- `src/app/admin/messages/page.jsx`

### Test Flow

1. Log in as the organiser at `http://localhost:3000/organiser-login`
2. Navigate to **`/admin/messages`**
3. **Verify:** If you have more than one event, a dropdown appears. Select an event.
4. **Verify:** The `BroadcastMessaging` UI loads with filter tabs: All / Sent / Scheduled / Failed / Draft
5. **Verify:** Stats bar shows 0 for all counts initially
6. Click **"New Message"** (or compose button)
7. **Verify:** A modal opens with:
   - `Title` input field
   - `Content` textarea
   - Radio: "Send Now" vs "Schedule for later"
8. Fill in:
   - Title: `Test Broadcast`
   - Content: `This is a test message to all registrants.`
   - Select: **Send Now**
9. Click **Send**
10. **Verify:** Loading spinner appears, then message appears in the list with status badge **"Sent"**
11. **Verify:** The stats bar updates — Sent count = 1
12. Expand the message card
13. **Verify:** Shows `successCount`, `failureCount`, timestamp
14. **Schedule test:** Compose another message, select "Schedule for later", pick a future date/time, click Save
15. **Verify:** Message appears with **"Scheduled"** badge
16. **Retry test:** In Firestore console, manually set one receipt's `status` to `"failed"`, come back to the UI
17. **Verify:** A **"Retry"** button appears on the failed message card
18. Click **Retry**, verify status updates

### Pass Criteria

- Messages appear in list with correct status badges
- Sent count increments in stats bar
- Schedule saves without sending immediately
- Retry button appears on failed messages

---

## Feature 2 — Automated Email Reminders

**What was built:** A cron job API route that sends 1-day and 2-hour before reminders to all registrants, and processes scheduled broadcast messages.

### Files to verify exist

- `src/app/api/cron/process-reminders/route.js`
- `vercel.json` (cron schedule config)

### Test Flow

1. Open a terminal in the project root
2. **Verify `vercel.json` contents:**

   ```bash
   cat ticketlelo/vercel.json
   ```

   Should show:

   ```json
   {
     "crons": [
       {
         "path": "/api/cron/process-reminders",
         "schedule": "0,30 * * * *"
       }
     ]
   }
   ```

3. **Manually trigger the cron endpoint:**

   ```bash
   curl -X GET http://localhost:3000/api/cron/process-reminders \
     -H "Authorization: Bearer test123"
   ```

   (Replace `test123` with your `CRON_SECRET` value)

4. **Verify response:**

   ```json
   {
     "success": true,
     "processed": {
       "oneDayReminders": 0,
       "twoHourReminders": 0,
       "scheduledMessages": 0
     }
   }
   ```

5. **Test with a near-future event:**
   - In Firestore, temporarily set an event's `date` to 25 hours from now
   - Re-trigger the cron
   - **Verify:** `oneDayReminders` count > 0 in response
   - Check that emails were sent (check your email service logs)

6. **Deduplication test:**
   - Trigger cron twice in a row for the same event
   - **Verify:** Second run returns 0 for already-sent reminders (dedup via `scheduledJobs` collection in Firestore)

7. **Security test:**
   - Call without `Authorization` header:
     ```bash
     curl http://localhost:3000/api/cron/process-reminders
     ```
   - **Verify:** Returns `401 Unauthorized`

### Pass Criteria

- Cron returns `200` with valid JSON when called with correct secret
- Returns `401` without secret
- `scheduledJobs` collection gets entries after processing
- No duplicate sends on repeated cron calls

---

## Feature 3 — Analytics Dashboard

**What was built:** A recharts-based dashboard showing registrations over time, revenue trends, payment breakdown pie chart, top registration days, and capacity utilization.

### Files to verify exist

- `src/app/api/analytics/[eventId]/route.js`
- `components/organiser/analytics-dashboard.jsx`
- `src/app/admin/analytics/page.jsx`

### Test Flow

1. Log in as organiser, go to **`/admin/analytics`**
2. **Verify:** Page loads with header "Analytics" and BarChart2 icon
3. If multiple events exist, a dropdown appears — select an event that has registrations
4. **Verify:** `AnalyticsDashboard` component renders with:
   - 4 stat cards: Total Registrations, Total Revenue, Checked In, Capacity Used
   - Day range selector: 7 / 14 / 30 / 60 days
   - Area chart (registrations over time)
   - Toggle: Registrations / Revenue on the area chart
   - Pie chart: payment breakdown (paid vs free)
   - Bar chart: top registration days
5. **Test day range:** Click **7 days** → chart updates to show only last 7 days
6. **Test toggle:** Click **Revenue** toggle on area chart → Y-axis changes to ₹ values
7. **Test empty state:** Select an event with zero registrations
   - **Verify:** Empty state message shown, charts show flat/empty data
8. **Test API directly:**
   ```bash
   curl "http://localhost:3000/api/analytics/EVENT_ID_HERE?userId=USER_ID&days=30"
   ```
   **Verify response contains:** `summary`, `chartData`, `paymentBreakdown`, `ticketStats`, `topDays`

### Pass Criteria

- Charts render without errors
- Day range selector changes chart data
- Stat cards show real numbers from Firestore
- API returns valid JSON with all 5 data keys

---

## Feature 4 — Event Page Customization

**What was built:** Organisers can set a custom URL slug, upload a banner image, and choose a theme color for their event page.

### Files to verify exist

- `src/app/api/events/customize/route.js`
- `components/organiser/event-customization.jsx`
- `src/app/admin/customize/page.jsx`

### Test Flow

1. Log in as organiser, go to **`/admin/customize`**
2. Select an event from the dropdown
3. **Verify:** Two panels appear side-by-side:
   - Left: Event Customization (slug, banner, theme)
   - Right: Event Publish (covered in Feature 11)

4. **Slug test:**
   - In the slug field, observe the auto-generated slug from the event name
   - Clear it and type: `my-awesome-event`
   - Click outside (blur)
   - **Verify:** Green checkmark ✓ and "Available!" text appears
   - Type a slug already used by another event (check Firestore)
   - **Verify:** Red ✗ and "Already taken" text appears

5. **Banner upload test:**
   - Click the upload area or drag a PNG/JPG file
   - **Verify:** Image preview appears inside the upload box
   - **Verify:** File must be under 5MB — try a large file and confirm rejection message
   - Click the **×** button on the preview
   - **Verify:** Preview disappears and upload area shows again

6. **Theme color test:**
   - Click one of the 8 preset color swatches
   - **Verify:** CTA preview button at bottom updates to that color
   - Click the custom color picker
   - **Verify:** Color input opens, hex value is editable

7. **Save test:**
   - Click **Save Changes**
   - **Verify:** Loading spinner, then success toast
   - Refresh the page, re-select the event
   - **Verify:** Previously saved slug, theme color, and banner persist

8. **API slug uniqueness test:**
   ```bash
   curl -X POST http://localhost:3000/api/events/customize \
     -F "eventId=EVENT_ID" \
     -F "userId=USER_ID" \
     -F "slug=existing-slug"
   ```
   **Verify:** Returns `409 Conflict` if slug is taken

### Pass Criteria

- Slug availability indicator works in real-time
- Banner file upload shows preview
- Theme color preview updates live
- Saved values persist after page refresh

---

## Feature 5 — Pricing & Plan Enforcement

**What was built:** Three pricing tiers (Free/Starter/Pro) with enforcement middleware that blocks event creation when plan limits are exceeded.

### Files to verify exist

- `lib/plans.js`
- `src/app/api/plans/check/route.js`
- `src/app/pricing/page.jsx`

### Test Flow

1. Navigate to **`http://localhost:3000/pricing`**
2. **Verify:** Three plan cards render:
   - **Free** — ₹0, 1 event, 300 participants
   - **Starter** — ₹999/month, "Popular" badge, 3 events, 1000 participants
   - **Pro** — ₹2,499/month, "Best Value" badge, 10 events, unlimited participants
3. **Verify:** Current plan shows "Current Plan" badge (green, top-right of card)
4. **Verify:** Free plan button is disabled (can't downgrade)
5. **Verify:** Pro plan "Upgrade" button is purple, Starter is orange gradient

6. **Plan check API test (GET):**

   ```bash
   curl "http://localhost:3000/api/plans/check?userId=USER_ID&action=createEvent&currentCount=0"
   ```

   **Verify response:**

   ```json
   { "allowed": true, "code": "OK" }
   ```

   Then test at limit:

   ```bash
   curl "http://localhost:3000/api/plans/check?userId=USER_ID&action=createEvent&currentCount=1"
   ```

   **Verify response (for Free plan user):**

   ```json
   { "allowed": false, "upgradeRequired": true, "code": "EVENT_LIMIT_REACHED" }
   ```

7. **Plan upgrade API test (POST):**

   ```bash
   curl -X POST http://localhost:3000/api/plans/check \
     -H "Content-Type: application/json" \
     -d '{"userId":"USER_ID","planId":"starter"}'
   ```

   **Verify:** Returns `{ "success": true }` and user's plan in Firestore updates to "starter"

8. **Verify `lib/plans.js` exports:**
   - Open browser console on any admin page
   - The constants should be importable without errors

### Pass Criteria

- Pricing page renders 3 cards with correct prices/features
- Current plan badge shows correctly
- Plan check API returns correct `allowed` boolean
- Plan upgrade API updates Firestore

---

## Feature 6 — Event Unlock Flow (Plan Enforcement in UI)

**What was built:** When an organiser on a Free plan tries to create a second event, a branded upgrade CTA block replaces the creation form.

### Files updated

- `components/admin/event-management.jsx`

### Test Flow

1. Log in as an organiser on the **Free plan** who already has **1 event created**
2. Navigate to **`/admin/dashboard`** → click the **Events** tab
3. Click **"Create New Event"** (or whatever the creation trigger is)
4. **Verify:** Instead of the event creation form, an upgrade CTA block appears:
   - Shows the plan limit reason text (e.g. "You've reached your 1-event limit on the Free plan")
   - **"Upgrade Plan"** button with Zap icon
   - **"Submit Hosting Request"** button
5. Click **"Upgrade Plan"**
6. **Verify:** Redirects to `/pricing`
7. Go back, click **"Submit Hosting Request"**
8. **Verify:** Redirects to `/admin/hosting-requests`

9. **SuperAdmin bypass test:**
   - Log in as superAdmin
   - **Verify:** No upgrade CTA — can create unlimited events

10. **Free plan with 0 events:**
    - Log in as a fresh organiser with no events
    - **Verify:** Event creation form shows normally (not blocked)

### Pass Criteria

- Upgrade CTA only appears when plan limit is exceeded
- Both CTA buttons navigate to correct routes
- SuperAdmins are never blocked

---

## Feature 7 — Admin Dashboard Enhancements

**What was built:** Full admin dashboard with metric cards, tabbed navigation (Events / Hosting Requests / Activity Log), filter buttons, search, and relative timestamps.

### Files updated

- `src/app/admin/dashboard/page.jsx`

### Test Flow

1. Log in as organiser, go to **`/admin/dashboard`**
2. **Verify metric cards (top row):**
   - Total Requests
   - Pending (with "Needs review" sub-label if > 0)
   - Approved
   - Rejected
   - All show real numbers from Firestore

3. **Verify tabs:** Three tab buttons appear:
   - **Events** (default active)
   - **Hosting Requests (N)** — number badge if pending > 0
   - **Activity Log**

4. **Events tab:** Click it — **verify** `EventManagement` component renders inside a white card

5. **Hosting Requests tab:** Click it
   - **Verify:** Filter buttons: All / Pending / Approved / Rejected
   - **Verify:** Search input field appears top-right
   - Click **Pending** filter → only pending requests show
   - Click **Approved** → only approved show
   - Click **All** → all requests show
   - Type a name in the search box → list filters in real-time
   - **Verify:** Each row shows: event title, status badge, organiser name, email, relative time ("2h ago"), formatted timestamp
   - **Verify:** "Review" button links to `/superadmin/hosting-requests`

6. **Activity Log tab:** Click it
   - **Verify:** Shows last 8 approved/rejected requests sorted by most recent
   - Each entry shows: colored circle icon (green=approved, red=rejected), event title, "was approved/rejected", organiser name, relative time
   - If a request has a `rejectionReason`, it shows in italic below

7. **Refresh button:** Click the refresh icon (top right)
   - **Verify:** Metrics reload and `RefreshCw` icon spins briefly

8. **Empty state:** Filter to "Rejected" when there are none
   - **Verify:** Inbox icon + "No requests found" message

### Pass Criteria

- 4 metric cards show real numbers
- All 3 tabs navigate correctly
- Filter buttons update the request list
- Search filters by name/title/email
- Activity log shows recent actions with timestamps

---

## Feature 8 — Global Loading / Error / Empty States

**What was built:** Consistent loading spinners, error messages, and empty states across all new components.

### Test Flow

1. **Loading state test:**
   - Throttle network in Chrome DevTools (Network → Slow 3G)
   - Navigate to `/admin/analytics`
   - **Verify:** "Loading events…" with `Loader2` spinning animation appears before data loads

2. **Empty state test — Analytics:**
   - Select an event with zero registrations
   - **Verify:** Charts show flat/zero data, no JavaScript errors in console

3. **Empty state test — Messages:**
   - Navigate to `/admin/messages`, select an event with no messages
   - **Verify:** Empty state shows with message icon and "No messages yet" text

4. **Empty state test — Hosting Requests:**
   - On `/admin/dashboard` → Hosting Requests tab, filter to a status with no results
   - **Verify:** Inbox icon with "No requests found" text (not blank whitespace)

5. **Empty state test — Account page:**
   - Log in as an organiser with no events
   - Navigate to `/account`
   - **Verify:** In the "Your Events" card: calendar icon + "No events yet" + "Create your first event" link

6. **Error state test:**
   - Temporarily break an API route (add `throw new Error()` at top, save, test, then revert)
   - **Verify:** Error appears in UI without crashing the whole page

### Pass Criteria

- Loading spinners appear during data fetches
- Empty states show icons + helpful messages (not blank screens)
- No unhandled errors crash pages

---

## Feature 9 — Mobile Optimization

**What was built:** Responsive layouts using Tailwind `sm:` / `md:` / `lg:` breakpoints on all new pages and components.

### Test Flow

1. Open Chrome DevTools → Toggle Device Toolbar (mobile view, 375px width)

2. **Pricing page `/pricing`:**
   - **Verify:** 3 plan cards stack vertically (not side by side)
   - **Verify:** Text is readable, no horizontal overflow

3. **Account page `/account`:**
   - **Verify:** Plan banner stacks vertically (icon + name on top, button below)
   - **Verify:** Usage cards stack to 1 column (not 2-col grid)
   - **Verify:** Plan comparison table scrolls horizontally with `overflow-x-auto`

4. **Admin Dashboard `/admin/dashboard`:**
   - **Verify:** Metric cards show 2 per row (2×2 grid on mobile)
   - **Verify:** Tab buttons are scrollable or wrap properly
   - **Verify:** Filter buttons wrap to next line on small screens
   - **Verify:** Search bar stacks below filter buttons

5. **Broadcast Messaging `/admin/messages`:**
   - **Verify:** Compose modal is full-screen / scrollable on mobile
   - **Verify:** Message cards stack properly

6. **Test 768px (tablet):**
   - Switch DevTools to iPad size
   - **Verify:** Customize page shows 2 panels side-by-side (`lg:grid-cols-2`)
   - At 767px and below — **verify** they stack to 1 column

### Pass Criteria

- No horizontal scroll on any page at 375px
- Cards/grids stack to single column on mobile
- Buttons and text are touch-friendly (min 44px tap targets)

---

## Feature 10 — Form Preview (Live)

**What was built:** (Already existed in `components/admin/form-generator.jsx`) — Live preview panel on the right side of the form builder that mirrors fields in real-time.

### Files to verify

- `components/admin/form-generator.jsx` — right-side preview panel at line ~837

### Test Flow

1. Log in as organiser, go to **`/admin/form-generator`**
2. Select an event (dropdown or auto-selected)
3. **Verify:** Two-column layout:
   - Left: "Form Builder" panel
   - Right: "Live Preview" panel
4. In the left panel, add a **Text** field named `Full Name`, mark Required
5. **Verify (instantly):** Right panel shows `Full Name *` label with a text input below it
6. Add a **Dropdown** field named `T-Shirt Size` with options: S, M, L, XL
7. **Verify:** Right panel shows `T-Shirt Size` with a dropdown input
8. Add a **Radio** field named `Payment Mode` with options: Online, Offline
9. **Verify:** Right panel shows radio buttons for Online and Offline
10. Enable **Paid** checkbox, enter amount `₹500`
11. **Verify:** Right panel shows an orange `Amount: ₹500` info box
12. Enable **Coupons**
13. **Verify:** Right panel shows a coupon code input + Apply button
14. Enable **Custom Theme**, pick a color (e.g. purple)
15. **Verify:** Right panel background tints to that color, Submit button uses that color
16. Remove a field using the trash icon
17. **Verify:** Right panel removes that field immediately

### Pass Criteria

- Preview updates instantly on every field add/remove
- Amount, coupon, and theme sections appear/disappear in preview when toggled
- Preview is a read-only non-interactive mirror

---

## Feature 11 — Event Publishing

**What was built:** Publish button generates a unique shareable URL (`/e/{slug}`), copy-to-clipboard, native share API, and unpublish toggle.

### Files to verify exist

- `src/app/api/events/publish/route.js`
- `components/organiser/event-publish.jsx`

### Test Flow

1. Navigate to **`/admin/customize`**, select an event
2. Find the **"Event Publishing"** card (right panel)
3. **Verify (unpublished state):**
   - Status badge NOT showing "Live"
   - Description text shown: "Publish this event to generate a shareable registration link."
   - **"Publish Event"** button with Globe icon

4. Click **"Publish Event"**
5. **Verify:**
   - Loading spinner appears
   - State changes to published
   - A share link box appears: `https://ticketlelo.in/e/event-slug-xxxxxx`
   - Green **"Live"** badge in the card header
   - **Copy** button and **external link** (↗) icon appear

6. Click **Copy**
7. **Verify:** Button shows "Copied!" for 2 seconds then reverts to "Copy"

8. Open the copied URL in a new tab
9. **Verify:** (If `/e/[slug]/page.jsx` exists) Public event page loads. If not yet built, it returns 404 — that's OK for now.

10. Click **Unpublish**
11. **Verify:** Confirmation dialog appears
12. Confirm — **verify** card returns to "Publish Event" state, "Live" badge disappears

13. **API test:**

    ```bash
    curl -X POST http://localhost:3000/api/events/publish \
      -H "Content-Type: application/json" \
      -d '{"eventId":"EVENT_ID","userId":"USER_ID"}'
    ```

    **Verify response:**

    ```json
    {
      "success": true,
      "slug": "event-name-abc123",
      "shareUrl": "https://...",
      "publishedAt": "..."
    }
    ```

14. **Firestore verification:**
    - Open Firestore console
    - Check `events/{eventId}` — verify `published: true`, `shareUrl`, `slug` fields
    - Check `eventPublications/{eventId}` — verify document created

### Pass Criteria

- Publish generates slug and shareUrl
- Copy button copies to clipboard
- Unpublish sets `published: false`
- Firestore `events` and `eventPublications` both updated

---

## Feature 12 — Revenue Tracking

**What was built:** Revenue data tracked via the Analytics API (`totalRevenue`, `revenueByDay`, `paymentBreakdown`) and displayed in the Analytics Dashboard component.

### Test Flow

1. Ensure you have at least one **paid registration** (registration with `amount > 0`)
2. Navigate to **`/admin/analytics`**, select the event
3. **Verify:** "Total Revenue" stat card shows ₹ amount (not ₹0)
4. On the area chart, click **"Revenue"** toggle
5. **Verify:** Chart Y-axis now shows ₹ values, area color changes
6. Check the **Pie chart** — **verify** it shows segments for:
   - Paid registrations
   - Free registrations
7. **Trend percentage:** If revenue increased over the period, stat card shows +X% in green. If decreased, shows -X% in red.

8. **API test:**

   ```bash
   curl "http://localhost:3000/api/analytics/EVENT_ID?userId=USER_ID&days=30"
   ```

   Check `summary.totalRevenue` and `chartData` array — each day object should have `revenue` field.

9. **Zero revenue test:**
   - Select an event where all registrations are free (amount = 0)
   - **Verify:** Revenue card shows ₹0, pie chart shows 100% free

### Pass Criteria

- Revenue shows real sum from Firestore registrations
- Area chart switches between Registration count and Revenue ₹
- Pie chart breaks down paid vs free
- Trend % calculates vs previous period

---

## Feature 13 — Account & Plan Management

**What was built:** A dedicated account page showing current plan, usage meters (events used/allowed, participants cap), recent events list, plan comparison table, and upgrade CTA.

### Files to verify exist

- `src/app/(user)/account/page.jsx`

### Test Flow

1. Log in as organiser, navigate to **`http://localhost:3000/account`**
   - (Or via Admin sidebar → "Plan & Account" link)

2. **Verify header section:**
   - Page title: "Account & Plan"
   - Refresh icon (top right)

3. **Verify plan banner:**
   - Shows organiser's full name
   - "Free Plan" badge (or Starter/Pro depending on current plan)
   - Plan icon: Star (Free), Zap (Starter), Crown (Pro)
   - If not on Pro: **"Upgrade Plan"** orange gradient button visible

4. **Verify usage cards:**
   - **Events card:** "X of Y events" usage bar (e.g. 1 of 1 for Free)
   - Progress bar fills proportionally (e.g. 100% if at limit)
   - Near-limit (≥80%): red progress bar + "Approaching limit" warning
   - At-limit: remaining count shows "0 events remaining"
   - **Participants card:** Shows the cap (`300`, `1,000`, or `Unlimited`)

5. **Recent Events card:**
   - Shows up to 5 events in a list
   - Each row: event name, venue, status badge (active/approved/draft)
   - "Manage →" link top-right → goes to `/admin/dashboard`
   - Empty state: Calendar icon + "No events yet" + "Create your first event →"

6. **Plan comparison table:**
   - 4 columns: Feature / Free / Starter / Pro
   - Current plan column header is bold and colored
   - ✓ (green) for included features, — for excluded
   - Upgrade CTA bar at bottom (unless on Pro)

7. **Upgrade CTA:** Click "View Plans →"
   - **Verify:** Navigates to `/pricing`

8. **Danger Zone:**
   - "Sign Out" button visible
   - Click it — **verify** redirects to `/user-login`

9. **Refresh button:** Click the refresh icon
   - **Verify:** Events list reloads

10. **Starter plan user test:**
    - Upgrade a test user to starter via API (Feature 5, step 7)
    - Revisit `/account`
    - **Verify:** Badge shows "Starter Plan", Zap icon, orange styling
    - Events allowed shows "3", Participants shows "1,000"

### Pass Criteria

- Page loads without errors for all plan types
- Usage bars fill proportionally to actual event count
- Plan badge matches user's current plan from Firestore
- All navigation links work correctly

---

## End-to-End Flow Test (All Features Together)

Run this combined flow to verify everything works as a system:

1. **Sign up** as a fresh organiser → redirected to `/admin/dashboard`
2. Go to **`/account`** → verify Free plan, 0 events used
3. **Create an event** (via Events tab) → form submits successfully
4. Go back to **`/account`** → verify events used = 1 of 1
5. Try to **create a second event** → upgrade CTA appears (Feature 6)
6. Click **"Upgrade Plan"** → lands on **`/pricing`** (Feature 5)
7. Go to **`/admin/form-generator`** → build a form, watch live preview update (Feature 10)
8. Go to **`/admin/customize`** → set custom slug, upload banner, pick theme color, click Save (Feature 4)
9. Click **"Publish Event"** → share URL generated (Feature 11)
10. Register a test participant via the form
11. Go to **`/admin/analytics`** → verify registration count = 1 (Feature 3 + 12)
12. Go to **`/admin/messages`** → compose and send a broadcast to all registrants (Feature 1)
13. Manually call cron endpoint → verify reminder flow runs (Feature 2)
14. Check **`/admin/dashboard`** → Activity Log tab shows recent actions (Feature 7)
15. At 375px mobile width → verify all pages are readable without horizontal scroll (Feature 9)
16. **Log out** → session ends correctly

---

## Quick API Smoke Tests

Run these curl commands to verify all API routes are reachable (replace placeholders):

```bash
# Analytics
curl "http://localhost:3000/api/analytics/EVENT_ID?userId=USER_ID&days=30"

# Messages - list
curl "http://localhost:3000/api/messages/EVENT_ID"

# Messages - create
curl -X POST http://localhost:3000/api/messages/create \
  -H "Content-Type: application/json" \
  -d '{"eventId":"EVENT_ID","userId":"USER_ID","title":"Test","content":"Hello"}'

# Plan check
curl "http://localhost:3000/api/plans/check?userId=USER_ID&action=createEvent&currentCount=0"

# Cron (needs CRON_SECRET)
curl http://localhost:3000/api/cron/process-reminders \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Publish event
curl -X POST http://localhost:3000/api/events/publish \
  -H "Content-Type: application/json" \
  -d '{"eventId":"EVENT_ID","userId":"USER_ID"}'

# Customize event
curl -X POST http://localhost:3000/api/events/customize \
  -F "eventId=EVENT_ID" \
  -F "userId=USER_ID" \
  -F "slug=my-test-event" \
  -F "themeColor=#FE760B"
```

Expected: All return `200` with valid JSON (no 500 errors).

---

## Known Limitations & Notes

| Feature                       | Note                                                                                                               |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Cron (Feature 2)              | Runs automatically only on Vercel. Test manually with curl locally.                                                |
| Event Publishing (Feature 11) | `/e/[slug]` public page route not yet created — share URL returns 404 until built.                                 |
| Plan Upgrade (Feature 5)      | No payment gateway integrated — upgrade is direct Firestore write for testing. Hook up Razorpay before production. |
| Banner Upload (Feature 4)     | Requires `adminStorage` exported from `lib/firebase-admin.js` and Firebase Storage enabled in console.             |
| Native Share (Feature 11)     | "Share" button only appears on devices where `navigator.share` is available (mobile browsers).                     |
| Analytics Charts              | Requires `recharts` installed: run `npm install recharts` if charts don't render.                                  |
