import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  PLANS,
  PLAN_ALIASES,
  FACILITY_DEFINITIONS,
  getPlan,
  getFacilitiesForPlan,
  hasFeature,
  canCreateEvent,
  canAddParticipant,
} from "../../lib/plans.js";

test("Super Admin Plans & Facilities Suite — Plan Definitions & Core Rules", async (t) => {
  await t.test("PLANS definition includes Free, Starter, Pro, and Fest tiers", () => {
    assert.ok(PLANS.free, "Free tier must exist");
    assert.ok(PLANS.starter, "Starter tier must exist");
    assert.ok(PLANS.pro, "Pro tier must exist");
    assert.ok(PLANS.fest, "Fest tier must exist");

    assert.equal(PLANS.free.price, 0);
    assert.equal(PLANS.free.eventsAllowed, 1);
    assert.equal(PLANS.free.platformFeeRate, 5.0);

    assert.equal(PLANS.starter.price, 999);
    assert.equal(PLANS.starter.eventsAllowed, 3);
    assert.equal(PLANS.starter.participantsPerEvent, 1000);

    assert.equal(PLANS.pro.eventsAllowed, 10);
    assert.equal(PLANS.pro.participantsPerEvent, -1, "Pro has unlimited participants");

    assert.equal(PLANS.fest.eventsAllowed, -1, "Fest has unlimited events");
    assert.equal(PLANS.fest.participantsPerEvent, -1, "Fest has unlimited participants");
    assert.equal(PLANS.fest.platformFeeRate, 3.5, "Fest has 3.5% fee");
  });

  await t.test("getPlan accurately handles plan IDs, aliases, and user objects", () => {
    assert.equal(getPlan("free").id, "free");
    assert.equal(getPlan("starter").id, "starter");
    assert.equal(getPlan("start").id, "starter", "Alias 'start' maps to starter");
    assert.equal(getPlan("campus").id, "pro", "Alias 'campus' maps to pro");
    assert.equal(getPlan("fest").id, "fest");
    assert.equal(getPlan("enterprise").id, "fest", "Alias 'enterprise' maps to fest");

    // Object resolution
    assert.equal(getPlan({ plan: "pro" }).id, "pro");
    assert.equal(getPlan({ subscriptionPlan: "CAMPUS" }).id, "pro");
    assert.equal(getPlan(null).id, "free", "Null fallback is free");
  });

  await t.test("getFacilitiesForPlan extracts complete boolean facility mapping", () => {
    const freeFacilities = getFacilitiesForPlan("free");
    assert.equal(freeFacilities.paymentIntegration, false);
    assert.equal(freeFacilities.customBranding, false);
    assert.equal(freeFacilities.prioritySupport, false);

    const starterFacilities = getFacilitiesForPlan("starter");
    assert.equal(starterFacilities.paymentIntegration, true);
    assert.equal(starterFacilities.customBranding, true);
    assert.equal(starterFacilities.prioritySupport, false);

    const festFacilities = getFacilitiesForPlan("fest");
    assert.equal(festFacilities.paymentIntegration, true);
    assert.equal(festFacilities.customBranding, true);
    assert.equal(festFacilities.prioritySupport, true);
    assert.equal(festFacilities.dedicatedManager, true);
    assert.equal(festFacilities.instantPayouts, true);
  });

  await t.test("canCreateEvent handles standard limits, unlimited (-1), and custom overrides", () => {
    // Free: 1 event allowed
    assert.equal(canCreateEvent("free", 0), true);
    assert.equal(canCreateEvent("free", 1), false);

    // Starter: 3 events allowed
    assert.equal(canCreateEvent("starter", 2), true);
    assert.equal(canCreateEvent("starter", 3), false);

    // Fest: unlimited (-1)
    assert.equal(canCreateEvent("fest", 100), true);

    // User object with custom eventsAllowed override
    assert.equal(canCreateEvent({ plan: "starter", eventsAllowed: 7 }, 5), true);
    assert.equal(canCreateEvent({ plan: "starter", eventsAllowed: 7 }, 7), false);
    assert.equal(canCreateEvent({ plan: "starter", eventsAllowed: -1 }, 999), true);
  });

  await t.test("canAddParticipant handles attendee caps and unlimited (-1)", () => {
    assert.equal(canAddParticipant("free", 299), true);
    assert.equal(canAddParticipant("free", 300), false);

    assert.equal(canAddParticipant("starter", 999), true);
    assert.equal(canAddParticipant("starter", 1000), false);

    assert.equal(canAddParticipant("pro", 50000), true, "Pro is unlimited");
    assert.equal(canAddParticipant("fest", 100000), true, "Fest is unlimited");
  });

  await t.test("hasFeature supports plan defaults and fine-grained custom facility overrides", () => {
    // Starter has customBranding = true, prioritySupport = false
    assert.equal(hasFeature("starter", "customBranding"), true);
    assert.equal(hasFeature("starter", "prioritySupport"), false);

    // User object with custom facility override granted by Super Admin
    const userWithPerk = {
      plan: "starter",
      facilities: {
        customBranding: true,
        prioritySupport: true, // granted by Super Admin override
      },
    };
    assert.equal(hasFeature(userWithPerk, "prioritySupport"), true);

    const userWithRevokedFeature = {
      plan: "pro",
      facilities: {
        customBranding: false, // explicitly revoked
      },
    };
    assert.equal(hasFeature(userWithRevokedFeature, "customBranding"), false);
  });
});

test("Super Admin Plans & Facilities Suite — UI & Route Verification", async (t) => {
  const root = process.cwd();

  await t.test("SuperAdmin layout includes Plans navigation link with icon", () => {
    const layoutPath = path.join(root, "src/app/(app)/superadmin/layout.jsx");
    const content = fs.readFileSync(layoutPath, "utf-8");

    assert.match(content, /\/superadmin\/plans/, "Layout must include /superadmin/plans link");
    assert.match(content, /label:\s*"Plans"/, "Layout must label the tab 'Plans'");
    assert.match(content, /Layers|Sparkles/, "Layout must import and use logical icon for Plans");
  });

  await t.test("Dedicated route /superadmin/plans exists and renders SuperAdminPlansView", () => {
    const pagePath = path.join(root, "src/app/(app)/superadmin/plans/page.jsx");
    assert.ok(fs.existsSync(pagePath), "/superadmin/plans/page.jsx must exist");

    const content = fs.readFileSync(pagePath, "utf-8");
    assert.match(content, /SuperAdminPlansView/, "Page must render SuperAdminPlansView");
  });

  await t.test("Backend API routes exist and support CRUD operations", () => {
    const mainApiPath = path.join(root, "src/app/api/superadmin/plans/route.js");
    const onboardApiPath = path.join(root, "src/app/api/superadmin/plans/onboard/route.js");

    assert.ok(fs.existsSync(mainApiPath), "Main API route must exist");
    assert.ok(fs.existsSync(onboardApiPath), "Onboard API route must exist");

    const mainContent = fs.readFileSync(mainApiPath, "utf-8");
    assert.match(mainContent, /export async function GET/, "API must implement GET");
    assert.match(mainContent, /export async function POST/, "API must implement POST (update)");
    assert.match(mainContent, /export async function DELETE/, "API must implement DELETE (revoke)");

    const onboardContent = fs.readFileSync(onboardApiPath, "utf-8");
    assert.match(onboardContent, /export async function POST/, "Onboard API must implement POST");
  });

  await t.test("SuperAdmin dashboard view provides interactive Plans tab", () => {
    const dashboardViewPath = path.join(root, "components/admin/superadmin-dashboard-view.jsx");
    const content = fs.readFileSync(dashboardViewPath, "utf-8");

    assert.match(content, /id:\s*"plans"/, "Dashboard tabs must have plans");
    assert.match(content, /<SuperAdminPlansView/, "Dashboard must embed SuperAdminPlansView");
  });
});

