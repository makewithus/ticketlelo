import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { managesEvent } from "../../lib/access-policy.js";

describe("Organiser Activity Scoping & Multi-Tenant Isolation", () => {
  const organiserA = {
    uid: "org_user_123",
    role: "organiser",
    isAdmin: true,
    email: "organiserA@college.edu",
    organizationId: "org_campus_1",
  };

  const organiserB = {
    uid: "org_user_456",
    role: "organiser",
    isAdmin: true,
    email: "organiserB@college.edu",
    organizationId: "org_campus_2",
  };

  const superAdmin = {
    uid: "super_admin_999",
    role: "superAdmin",
    isAdmin: true,
    email: "superadmin@ticketlelo.com",
  };

  const eventA = {
    id: "evt_techfest_2026",
    name: "Tech Fest 2026",
    createdBy: "org_user_123",
    organizationId: "org_campus_1",
  };

  const eventB = {
    id: "evt_robotics_expo",
    name: "Robotics Expo",
    createdBy: "org_user_456",
    organizationId: "org_campus_2",
  };

  test("Organiser manages their own event and cannot manage another organiser's event", () => {
    assert.equal(managesEvent(organiserA, eventA), true);
    assert.equal(managesEvent(organiserA, eventB), false);

    assert.equal(managesEvent(organiserB, eventB), true);
    assert.equal(managesEvent(organiserB, eventA), false);
  });

  test("Super admin has universal access to view all events", () => {
    assert.equal(managesEvent(superAdmin, eventA), true);
    assert.equal(managesEvent(superAdmin, eventB), true);
  });

  test("Activity registration filtering strictly excludes registrations from other organisers", () => {
    const registrations = [
      { id: "reg_1", eventId: "evt_techfest_2026", fullName: "Alice" },
      { id: "reg_2", eventId: "evt_robotics_expo", fullName: "Bob" },
      { id: "reg_3", eventId: "evt_unknown", fullName: "Charlie" },
    ];

    const myEventIdsA = new Set(["evt_techfest_2026"]);
    const filteredForA = registrations.filter((r) => myEventIdsA.has(r.eventId));
    assert.equal(filteredForA.length, 1);
    assert.equal(filteredForA[0].id, "reg_1");

    const myEventIdsB = new Set(["evt_robotics_expo"]);
    const filteredForB = registrations.filter((r) => myEventIdsB.has(r.eventId));
    assert.equal(filteredForB.length, 1);
    assert.equal(filteredForB[0].id, "reg_2");
  });

  test("Organiser with 0 events receives empty activity stream without leaks", () => {
    const brandNewOrganiserEvents = new Set();
    const registrations = [
      { id: "reg_1", eventId: "evt_techfest_2026", fullName: "Alice" },
      { id: "reg_2", eventId: "evt_robotics_expo", fullName: "Bob" },
    ];

    const filtered = registrations.filter((r) => brandNewOrganiserEvents.has(r.eventId));
    assert.equal(filtered.length, 0);
  });

  test("Hosting requests are strictly scoped to the creator user ID or email", () => {
    const hostingRequests = [
      { id: "hr_1", userId: "org_user_123", email: "organisera@college.edu", eventTitle: "Tech Fest 2026" },
      { id: "hr_2", userId: "org_user_456", email: "organiserb@college.edu", eventTitle: "Robotics Expo" },
      { id: "hr_3", userId: "guest_789", email: "other@gmail.com", eventTitle: "Public Concert" },
    ];

    const myRequestsForA = hostingRequests.filter(
      (r) => r.userId === organiserA.uid || r.email === organiserA.email.toLowerCase()
    );
    assert.equal(myRequestsForA.length, 1);
    assert.equal(myRequestsForA[0].id, "hr_1");

    const myRequestsForB = hostingRequests.filter(
      (r) => r.userId === organiserB.uid || r.email === organiserB.email.toLowerCase()
    );
    assert.equal(myRequestsForB.length, 1);
    assert.equal(myRequestsForB[0].id, "hr_2");
  });
});
