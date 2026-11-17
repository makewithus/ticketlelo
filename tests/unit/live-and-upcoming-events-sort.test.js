const test = require("node:test");
const assert = require("node:assert/strict");
const {
  getEventLiveStatus,
  getEventDateRange,
  parseFirestoreDate,
} = require("../../lib/date-utils");

test("live-and-upcoming-events-sort: getEventLiveStatus correctly detects live, upcoming, and ended events", () => {
  const referenceNow = new Date("2026-11-17T12:00:00.000Z");

  // 1. Live event (currently running)
  const liveEv = {
    title: "Live Hackathon Now",
    startDate: "2026-11-17",
    startTime: "10:00 AM",
    endDate: "2026-11-17",
    endTime: "08:00 PM",
  };
  const liveStatus = getEventLiveStatus(liveEv, referenceNow);
  assert.equal(liveStatus.isLive, true);
  assert.equal(liveStatus.isUpcoming, false);
  assert.equal(liveStatus.isEnded, false);

  // 2. Upcoming event (starts tomorrow)
  const upcomingEv = {
    title: "Developers Meetup Tomorrow",
    startDate: "2026-11-18",
    startTime: "10:00 AM",
    endDate: "2026-11-18",
    endTime: "05:00 PM",
  };
  const upcomingStatus = getEventLiveStatus(upcomingEv, referenceNow);
  assert.equal(upcomingStatus.isUpcoming, true);
  assert.equal(upcomingStatus.isLive, false);
  assert.equal(upcomingStatus.isEnded, false);

  // 3. Ended event (concluded in October)
  const endedEv = {
    title: "October Concluded Conference",
    startDate: "2026-10-29",
    startTime: "10:00 AM",
    endDate: "2026-10-29",
    endTime: "05:00 PM",
  };
  const endedStatus = getEventLiveStatus(endedEv, referenceNow);
  assert.equal(endedStatus.isEnded, true);
  assert.equal(endedStatus.isLive, false);
  assert.equal(endedStatus.isUpcoming, false);

  // 4. Explicit manual live toggle takes priority
  const manualLive = {
    title: "Manual Live Stream",
    isLive: true,
    startDate: "2026-12-01",
  };
  const manualStatus = getEventLiveStatus(manualLive, referenceNow);
  assert.equal(manualStatus.isLive, true);

  // 5. Cancelled event is marked as ended/cancelled
  const cancelledEv = {
    title: "Cancelled Event",
    status: "cancelled",
    startDate: "2026-12-01",
  };
  const cancelledStatus = getEventLiveStatus(cancelledEv, referenceNow);
  assert.equal(cancelledStatus.status, "cancelled");
  assert.equal(cancelledStatus.isLive, false);
  assert.equal(cancelledStatus.isEnded, true);
});

test("live-and-upcoming-events-sort: parses Firestore Timestamp objects with _seconds and seconds", () => {
  const tsWithUnderscore = { _seconds: 1772236800, _nanoseconds: 0 };
  const parsed1 = parseFirestoreDate(tsWithUnderscore);
  assert.ok(parsed1 instanceof Date);
  assert.ok(!isNaN(parsed1.getTime()));

  const tsWithoutUnderscore = { seconds: 1772236800, nanoseconds: 0 };
  const parsed2 = parseFirestoreDate(tsWithoutUnderscore);
  assert.ok(parsed2 instanceof Date);
  assert.equal(parsed1.getTime(), parsed2.getTime());
});

test("live-and-upcoming-events-sort: sorts Live events first, Upcoming soonest next, and Ended at bottom", () => {
  const referenceNow = new Date("2026-11-17T12:00:00.000Z");

  const events = [
    {
      id: "ev-ended-oct29",
      name: "TEST MEET EVENT - ENDED",
      startDate: "2026-10-29",
      startTime: "10:00 AM",
      endDate: "2026-10-29",
      endTime: "02:00 PM",
    },
    {
      id: "ev-upcoming-dec15",
      name: "TECH FEST 2026",
      startDate: "2026-12-15",
      startTime: "09:00 AM",
    },
    {
      id: "ev-live-now",
      name: "LIVE GAMING SHOWDOWN",
      startDate: "2026-11-17",
      startTime: "09:00 AM",
      endDate: "2026-11-17",
      endTime: "09:00 PM",
    },
    {
      id: "ev-upcoming-nov18",
      name: "Developers Meetup",
      startDate: "2026-11-18",
      startTime: "10:00 AM",
    },
    {
      id: "ev-ended-nov04",
      name: "Test Event November",
      startDate: "2026-11-04",
      startTime: "10:00 AM",
      endDate: "2026-11-04",
      endTime: "06:00 PM",
    },
    {
      id: "ev-upcoming-nov21",
      name: "Honey Singh Concert",
      startDate: "2026-11-21",
      startTime: "07:00 PM",
    },
  ];

  const getStatusRank = (ev) => {
    const timing = getEventLiveStatus(ev, referenceNow);
    if (timing.isLive) return 0;
    if (timing.isUpcoming) return 1;
    return 2;
  };

  const getEventTimestamp = (ev, useEnd = false) => {
    const range = getEventDateRange(ev);
    if (useEnd && range.end) return range.end.getTime();
    if (range.start) return range.start.getTime();
    const parsed = parseFirestoreDate(ev.startDate || ev.date);
    if (parsed) return parsed.getTime();
    return useEnd ? 0 : Number.MAX_SAFE_INTEGER;
  };

  const sorted = [...events].sort((a, b) => {
    const rankA = getStatusRank(a);
    const rankB = getStatusRank(b);

    if (rankA !== rankB) {
      return rankA - rankB;
    }

    if (rankA === 0) {
      return getEventTimestamp(a) - getEventTimestamp(b);
    }

    if (rankA === 1) {
      return getEventTimestamp(a) - getEventTimestamp(b);
    }

    return getEventTimestamp(b, true) - getEventTimestamp(a, true);
  });

  const titles = sorted.map((e) => e.name);

  // 1. LIVE event MUST be at index 0 (Top of the list)
  assert.equal(titles[0], "LIVE GAMING SHOWDOWN");

  // 2. Upcoming events follow in chronological order (Nov 18 -> Nov 21 -> Dec 15)
  assert.equal(titles[1], "Developers Meetup");
  assert.equal(titles[2], "Honey Singh Concert");
  assert.equal(titles[3], "TECH FEST 2026");

  // 3. Ended events are relegated to the bottom, newest ended first (Nov 04 before Oct 29)
  assert.equal(titles[4], "Test Event November");
  assert.equal(titles[5], "TEST MEET EVENT - ENDED");
});
