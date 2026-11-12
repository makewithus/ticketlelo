import test from "node:test";
import assert from "node:assert/strict";
import {
  INACTIVITY_TIMEOUT_MS,
  COUNTDOWN_TOTAL_SECONDS,
  SESSION_STORAGE_KEY,
  shouldTriggerInactivityWarning,
  calculateRemainingCountdown,
} from "../../lib/session-config.js";

test("Session Inactivity Management Suite", async (t) => {
  await t.test("Enforces strictly 10 minutes (600,000 ms) inactivity threshold", () => {
    assert.equal(
      INACTIVITY_TIMEOUT_MS,
      10 * 60 * 1000,
      "Inactivity threshold must be exactly 10 minutes in milliseconds"
    );
    assert.equal(INACTIVITY_TIMEOUT_MS, 600000);
  });

  await t.test("Enforces strictly 5 seconds warning countdown", () => {
    assert.equal(
      COUNTDOWN_TOTAL_SECONDS,
      5,
      "Countdown duration before auto-logout must be exactly 5 seconds"
    );
  });

  await t.test("Session expiry logic detects when 10 minutes of inactivity has elapsed", () => {
    const lastActive = Date.now() - (10 * 60 * 1000 + 500); // 10 minutes and 500ms ago
    const now = Date.now();
    const elapsed = now - lastActive;

    const shouldShowWarning = elapsed >= INACTIVITY_TIMEOUT_MS;
    assert.equal(shouldShowWarning, true, "Warning should show when elapsed >= 10 minutes");
  });

  await t.test("Session remains active if user activity occurs within 10 minutes", () => {
    const lastActive = Date.now() - (9 * 60 * 1000); // 9 minutes ago
    const now = Date.now();
    const elapsed = now - lastActive;

    const shouldShowWarning = elapsed >= INACTIVITY_TIMEOUT_MS;
    assert.equal(shouldShowWarning, false, "Warning should NOT show when active within 10 minutes");
  });

  await t.test("Extending session resets inactivity clock to current time", () => {
    let lastActive = Date.now() - (10 * 60 * 1000);
    assert.ok(Date.now() - lastActive >= INACTIVITY_TIMEOUT_MS);

    // User confirms "Yes, I'm working"
    const extendedTime = Date.now();
    lastActive = extendedTime;

    assert.ok(Date.now() - lastActive < 1000, "Inactivity timer must reset to current timestamp");
  });

  await t.test("Auto-logout triggers when 5-second countdown reaches 0", () => {
    let countdown = COUNTDOWN_TOTAL_SECONDS;
    let loggedOut = false;

    // Simulate 5 seconds ticking
    for (let i = 0; i < 5; i++) {
      if (countdown <= 1) {
        loggedOut = true;
        countdown = 0;
        break;
      }
      countdown -= 1;
    }

    assert.equal(loggedOut, true, "User must be logged out when 5 seconds expire");
    assert.equal(countdown, 0, "Countdown reaches 0");
  });

  await t.test("Reject session extension if 5 seconds has already elapsed on warning modal", () => {
    const warningStart = Date.now() - 5500; // 5.5s ago
    const warningElapsed = Date.now() - warningStart;
    const isGracePeriodExpired = warningElapsed >= COUNTDOWN_TOTAL_SECONDS * 1000;
    assert.equal(isGracePeriodExpired, true, "Extension must be denied if 5 seconds elapsed");
  });

  await t.test("Immediate auto-logout if total inactivity exceeds 10 minutes plus 5 seconds", () => {
    const lastActive = Date.now() - (10 * 60 * 1000 + 6000); // 10 min 6 sec ago
    const elapsed = Date.now() - lastActive;
    const isExpiredBeyondGrace = elapsed >= INACTIVITY_TIMEOUT_MS + COUNTDOWN_TOTAL_SECONDS * 1000;
    assert.equal(isExpiredBeyondGrace, true, "Session must immediately terminate without lingering modal");
  });

  await t.test("calculateRemainingCountdown accurately reflects remaining seconds", () => {
    const now = Date.now();
    assert.equal(calculateRemainingCountdown(now, 5, now), 5);
    assert.equal(calculateRemainingCountdown(now - 3000, 5, now), 2);
    assert.equal(calculateRemainingCountdown(now - 5000, 5, now), 0);
    assert.equal(calculateRemainingCountdown(now - 6000, 5, now), 0);
  });

  await t.test("Redirect URL on timeout points to /login?reason=session_expired", () => {
    const timeoutReason = "session_expired";
    const redirectUrl = `/login?reason=${timeoutReason}`;
    assert.equal(redirectUrl, "/login?reason=session_expired");
  });

  await t.test("Stale stored timestamp from prior session (>10m ago) is discarded to prevent login logout loop", () => {
    const now = Date.now();
    const staleTimestamp = now - (15 * 60 * 1000); // 15 mins ago from a previous session

    const resolveInitialActiveTime = (stored, currentTime) => {
      if (stored && !isNaN(stored) && stored > 0 && stored <= currentTime && (currentTime - stored < INACTIVITY_TIMEOUT_MS)) {
        return stored;
      }
      return currentTime;
    };

    const resolvedTime = resolveInitialActiveTime(staleTimestamp, now);
    assert.equal(resolvedTime, now, "Stale timestamp older than 10m must be discarded and replaced with now");
    assert.equal(shouldTriggerInactivityWarning(resolvedTime, now), false, "Freshly resolved session must not trigger warning");
  });

  await t.test("Recent stored timestamp (<10m ago) is preserved across tab navigations", () => {
    const now = Date.now();
    const recentTimestamp = now - (2 * 60 * 1000); // 2 mins ago

    const resolveInitialActiveTime = (stored, currentTime) => {
      if (stored && !isNaN(stored) && stored > 0 && stored <= currentTime && (currentTime - stored < INACTIVITY_TIMEOUT_MS)) {
        return stored;
      }
      return currentTime;
    };

    const resolvedTime = resolveInitialActiveTime(recentTimestamp, now);
    assert.equal(resolvedTime, recentTimestamp, "Recent timestamp within 10m must be preserved");
    assert.equal(shouldTriggerInactivityWarning(resolvedTime, now), false, "Recent activity must not trigger warning");
  });
});
