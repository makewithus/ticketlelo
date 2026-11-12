import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Ambassador Referral Link Redirection and Non-Jumping Layout Suite", () => {
  test("Discover Page: eliminates jumping layout springs and sets stable grid", () => {
    const discoverCode = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/(app)/discover/page.jsx"),
      "utf8"
    );

    // 1. Clock interval is isolated in LiveISTClock so page root never re-renders every 1s
    assert.ok(
      discoverCode.includes("const LiveISTClock = memo(function LiveISTClock()"),
      "LiveISTClock component must be isolated and memoized"
    );
    assert.ok(
      !discoverCode.includes("const [currentTime, setCurrentTime] = useState(\"\");\n  const [mobileMenuOpen"),
      "DiscoverEventsPageContent must not hold 1-second clock in root state"
    );

    // 2. Framer motion layout springs removed from cards list
    assert.ok(
      !discoverCode.includes("<motion.div\n            layout\n            className=\"grid"),
      "Event cards grid must not use Framer Motion layout springs that recalculate bounding boxes"
    );

    // 3. Stable keys and fixed banner min-dimensions
    assert.ok(
      discoverCode.includes("const stableKey = ev.id || ev.slug || `event-${index}`;"),
      "Event cards must use stable keys (not raw index)"
    );
    assert.ok(
      discoverCode.includes("min-h-[76px]"),
      "Metrics cards must have fixed min-height to prevent layout shift during count hydration"
    );

    // 4. Client referral redirection
    assert.ok(
      discoverCode.includes("fetch(`/api/referral/validate?code="),
      "Discover page must resolve referral codes"
    );
    assert.ok(
      discoverCode.includes("router.replace(data.targetUrl)"),
      "Discover page must redirect directly to the resolved target URL"
    );
    assert.ok(
      discoverCode.includes("isRedirecting"),
      "Discover page must handle redirecting state with branded screen"
    );
  });

  test("Event Slug Page: registration drawer contains anchor IDs and auto-scroll", () => {
    const slugCode = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/(app)/e/[slug]/page.jsx"),
      "utf8"
    );

    // 1. ID hooks
    assert.ok(
      slugCode.includes('id="register"'),
      "Event page must have id='register' for direct referral navigation"
    );
    assert.ok(
      slugCode.includes('id="tickets"'),
      "Event page must have id='tickets' for direct ticket section navigation"
    );

    // 2. Auto-scroll effect
    assert.ok(
      slugCode.includes("el.scrollIntoView({ behavior: \"smooth\", block: \"start\" })"),
      "Event page must smoothly scroll to registration drawer when hash or ref is present"
    );

    // 3. Referral highlight badge
    assert.ok(
      slugCode.includes("Ambassador Referral Applied:"),
      "Event page must display referral badge indicating applied ambassador code"
    );
  });

  test("Ambassador Dashboard: referral links point directly to event with #register anchor", () => {
    const dashCode = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/(app)/(user)/ambassador/dashboard/page.jsx"),
      "utf8"
    );

    // 1. Appends #register
    assert.ok(
      dashCode.includes("?ref=${referralCode}#register"),
      "Ambassador referral URL must link to target event with #register anchor"
    );

    // 2. Fallback to primary event
    assert.ok(
      dashCode.includes("connectedEvents[0]"),
      "Ambassador dashboard must pick connected event or fallback to primary program event"
    );
  });

  test("Referral Validation API: resolves target event and targetUrl", () => {
    const apiCode = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/api/referral/validate/route.js"),
      "utf8"
    );

    assert.ok(
      apiCode.includes("targetUrl = `/e/${targetEvent.slug || targetEvent.id}?ref=${encodeURIComponent(resolved.code)}#register`;"),
      "API route must construct canonical targetUrl with #register"
    );
    assert.ok(
      apiCode.includes("matchingEvent = progTitleNorm"),
      "API route must resolve matching or active event for referral code's organizer"
    );
  });
});
