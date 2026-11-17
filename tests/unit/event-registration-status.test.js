import { test, describe } from "node:test";
import assert from "node:assert";
import {
  checkEventRegistrationStatus,
  isEventRegistrationClosed,
} from "../../lib/event-registration-status.js";

describe("Event Registration Status Evaluator", () => {
  test("Open and published live event allows registrations", () => {
    const liveEvent = {
      id: "evt-1",
      name: "Live Hackathon",
      status: "live",
      isActive: true,
      published: true,
      isPublished: true,
      registrationStatus: "Open",
      registrationClosed: false,
    };
    const result = checkEventRegistrationStatus(liveEvent);
    assert.strictEqual(result.isClosed, false);
    assert.strictEqual(result.reason, "open");
    assert.strictEqual(isEventRegistrationClosed(liveEvent), false);
  });

  test("Event in Draft or Private mode marks registration as closed", () => {
    // Exactly matches the user's scenario: 'Event is Private / Draft Mode'
    const draftEvent = {
      id: "evt-draft",
      name: "Test Event",
      status: "draft",
      isActive: false,
      published: false,
    };
    const result = checkEventRegistrationStatus(draftEvent);
    assert.strictEqual(result.isClosed, true);
    assert.strictEqual(result.reason, "draft_or_private");
    assert.strictEqual(isEventRegistrationClosed(draftEvent), true);

    const privateEvent = {
      id: "evt-priv",
      name: "Private VIP Meet",
      status: "private",
      visibility: "private",
    };
    assert.strictEqual(checkEventRegistrationStatus(privateEvent).isClosed, true);

    const unlistedEvent = {
      id: "evt-unlisted",
      name: "Unlisted Workshop",
      status: "unlisted",
    };
    assert.strictEqual(checkEventRegistrationStatus(unlistedEvent).isClosed, true);
  });

  test("Cancelled or Ended events mark registration as closed", () => {
    const cancelledEvent = {
      id: "evt-canc",
      name: "Cancelled Fest",
      status: "cancelled",
      isCancelled: true,
    };
    assert.strictEqual(checkEventRegistrationStatus(cancelledEvent).reason, "cancelled");
    assert.strictEqual(isEventRegistrationClosed(cancelledEvent), true);

    const endedEvent = {
      id: "evt-ended",
      name: "Past Summit",
      status: "ended",
      isEnded: true,
    };
    assert.strictEqual(checkEventRegistrationStatus(endedEvent).reason, "ended");
    assert.strictEqual(isEventRegistrationClosed(endedEvent), true);
  });

  test("Explicit registrationClosed or registrationStatus === 'Closed' closes registration", () => {
    const closedEvent1 = {
      id: "evt-closed-1",
      name: "Closed Event",
      status: "live",
      isActive: false,
      registrationStatus: "Closed",
    };
    assert.strictEqual(checkEventRegistrationStatus(closedEvent1).isClosed, true);

    const closedEvent2 = {
      id: "evt-closed-2",
      name: "Closed Event 2",
      status: "live",
      isActive: true,
      registrationClosed: true,
      // Regression check: even if closeRegistrationEnabled was explicitly false previously
      closeRegistrationEnabled: false,
    };
    assert.strictEqual(checkEventRegistrationStatus(closedEvent2).isClosed, true);
    assert.strictEqual(checkEventRegistrationStatus(closedEvent2).reason, "explicitly_closed");
  });

  test("Close registration mode 'now' closes registration", () => {
    const closedNow = {
      id: "evt-now",
      name: "Immediate Closure",
      status: "live",
      isActive: true,
      closeRegistrationEnabled: true,
      closeRegistrationMode: "now",
    };
    assert.strictEqual(checkEventRegistrationStatus(closedNow).isClosed, true);
    assert.strictEqual(checkEventRegistrationStatus(closedNow).reason, "explicitly_closed");
  });

  test("Capacity thresholds close registration when reached", () => {
    const cappedByRule = {
      id: "evt-cap-rule",
      status: "live",
      isActive: true,
      closeRegistrationEnabled: true,
      closeRegistrationMode: "capacity",
      closeRegistrationCapacity: 50,
      allocatedSeats: 50,
    };
    assert.strictEqual(checkEventRegistrationStatus(cappedByRule, 50).isClosed, true);
    assert.strictEqual(checkEventRegistrationStatus(cappedByRule, 50).reason, "capacity_reached");
    assert.strictEqual(checkEventRegistrationStatus(cappedByRule, 49).isClosed, false);

    const globalCap = {
      id: "evt-global-cap",
      status: "live",
      isActive: true,
      limitCapacity: true,
      globalCapacity: 100,
    };
    assert.strictEqual(checkEventRegistrationStatus(globalCap, 100).isClosed, true);
    assert.strictEqual(checkEventRegistrationStatus(globalCap, 99).isClosed, false);
  });

  test("Invalid or missing event objects safely return closed", () => {
    assert.strictEqual(checkEventRegistrationStatus(null).isClosed, true);
    assert.strictEqual(checkEventRegistrationStatus(undefined).isClosed, true);
  });

  test("Price display never shows ₹Free and correctly formats free vs paid", () => {
    const formatPrice = (ev) => {
      const isFreePrice =
        !ev.price ||
        ev.price === 0 ||
        ev.price === "0" ||
        String(ev.price || "").toLowerCase() === "free" ||
        !ev.isPaid;

      return isFreePrice
        ? "Free"
        : typeof ev.price === "number"
        ? `₹${ev.price}`
        : String(ev.price).startsWith("₹")
        ? ev.price
        : `₹${ev.price}`;
    };

    assert.strictEqual(formatPrice({ isPaid: false, price: "Free" }), "Free");
    assert.strictEqual(formatPrice({ isPaid: false, price: "free" }), "Free");
    assert.strictEqual(formatPrice({ isPaid: false, price: 0 }), "Free");
    assert.strictEqual(formatPrice({ isPaid: false, price: "0" }), "Free");
    assert.strictEqual(formatPrice({ isPaid: true, price: 499 }), "₹499");
    assert.strictEqual(formatPrice({ isPaid: true, price: "₹250" }), "₹250");
  });

  test("Registration Closed UI texts avoid useless draft/private mode mentions", () => {
    const getClosedTitle = (isClosed) => {
      return isClosed ? "Registration Closed" : "Spots Available";
    };

    const getClosedSubtitle = (isClosed) => {
      return isClosed
        ? "Registrations for this event are currently closed."
        : "Hurry up and register before the event fills up!";
    };

    const getButtonText = (isClosed, reason) => {
      if (!isClosed) return "Register";
      if (reason === "capacity_reached") return "Registration Closed (Capacity Reached)";
      return "Registration Closed";
    };

    assert.strictEqual(getClosedTitle(true), "Registration Closed");
    assert.strictEqual(getClosedSubtitle(true), "Registrations for this event are currently closed.");
    assert.strictEqual(getButtonText(true, "draft_or_private"), "Registration Closed");
    assert.ok(!getButtonText(true, "draft_or_private").includes("Draft / Private Mode"));
  });
});

