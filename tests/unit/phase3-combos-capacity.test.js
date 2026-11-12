const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

describe("Phase 3: Ticketing Engine, Combos, and Capacity Formula", () => {
  const {
    calculateAvailableCombos,
    resolveTicketEntitlements,
  } = require("../../lib/combos.js");

  describe("Dynamic Bottleneck Capacity Formula", () => {
    const testCombo = {
      id: "combo_tech_1",
      title: "TECH COMBO: AI Workshop + 24hr Hackathon",
      dedicatedQuota: 100,
      allocatedCount: 10, // 90 dedicated remaining
      includedSubEventIds: ["sub_workshop", "sub_hackathon"],
      isPublished: true,
    };

    test("Available combos correctly governed by lowest sub-event remaining capacity", () => {
      const subEventsMap = {
        sub_workshop: { id: "sub_workshop", title: "AI Workshop", capacity: 150, allocatedSeats: 110 }, // 40 remaining
        sub_hackathon: { id: "sub_hackathon", title: "24hr Hackathon", capacity: 500, allocatedSeats: 200 }, // 300 remaining
      };

      // Dedicated remaining is 90; Workshop remaining is 40; Hackathon remaining is 300
      // MIN(90, MIN(40, 300)) = 40
      const available = calculateAvailableCombos(testCombo, subEventsMap);
      assert.equal(available, 40);
    });

    test("Combo immediately sells out if ANY included sub-event reaches full capacity", () => {
      const subEventsMap = {
        sub_workshop: { id: "sub_workshop", title: "AI Workshop", capacity: 150, allocatedSeats: 150 }, // 0 remaining
        sub_hackathon: { id: "sub_hackathon", title: "24hr Hackathon", capacity: 500, allocatedSeats: 200 }, // 300 remaining
      };

      const available = calculateAvailableCombos(testCombo, subEventsMap);
      assert.equal(available, 0);
    });

    test("Combo sells out if its dedicated quota is reached even if sub-events have room", () => {
      const fullyAllocatedCombo = {
        ...testCombo,
        allocatedCount: 100, // 0 dedicated remaining
      };
      const subEventsMap = {
        sub_workshop: { id: "sub_workshop", capacity: 150, allocatedSeats: 20 }, // 130 remaining
        sub_hackathon: { id: "sub_hackathon", capacity: 500, allocatedSeats: 20 }, // 480 remaining
      };

      const available = calculateAvailableCombos(fullyAllocatedCombo, subEventsMap);
      assert.equal(available, 0);
    });

    test("Combo returns 0 if an included sub-event is missing", () => {
      const partialMap = {
        sub_workshop: { id: "sub_workshop", capacity: 150, allocatedSeats: 20 },
        // sub_hackathon is missing
      };

      const available = calculateAvailableCombos(testCombo, partialMap);
      assert.equal(available, 0);
    });
  });

  describe("Entitlement Snapshot Resolution", () => {
    test("Resolves exact array of authorized sub-events for the issued ticket", () => {
      const comboConfig = {
        id: "combo_fest_pass",
        title: "ALL-ACCESS FEST PASS",
        includedSubEventIds: ["sub_ai", "sub_hack", "sub_concert"],
      };

      const subEventsMap = {
        sub_ai: { title: "AI & ML Workshop" },
        sub_hack: { title: "National Hackathon" },
        sub_concert: { title: "Pro Show EDM Night" },
      };

      const snapshot = resolveTicketEntitlements(comboConfig, subEventsMap);
      assert.deepEqual(snapshot.entitledSubEventIds, ["sub_ai", "sub_hack", "sub_concert"]);
      assert.deepEqual(snapshot.entitledTrackNames, [
        "AI & ML Workshop",
        "National Hackathon",
        "Pro Show EDM Night",
      ]);
    });
  });
});
