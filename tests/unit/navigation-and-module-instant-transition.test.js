import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

describe("Navigation & Module Instant Transition Suite", () => {
  test("Client Cache exports comprehensive domain helpers for instant hydration", async () => {
    const cachePath = path.join(projectRoot, "lib/client-cache.js");
    assert.ok(fs.existsSync(cachePath), "client-cache.js must exist");
    const content = fs.readFileSync(cachePath, "utf-8");

    assert.ok(content.includes("export function getCachedPrograms"), "Must export getCachedPrograms");
    assert.ok(content.includes("export function setCachedPrograms"), "Must export setCachedPrograms");
    assert.ok(content.includes("export function getCachedProgram"), "Must export getCachedProgram");
    assert.ok(content.includes("export function setCachedProgram"), "Must export setCachedProgram");
    assert.ok(content.includes("export function getCachedOrganizerPayments"), "Must export getCachedOrganizerPayments");
    assert.ok(content.includes("export function setCachedOrganizerPayments"), "Must export setCachedOrganizerPayments");
    assert.ok(content.includes("export function getCachedEvent"), "Must export getCachedEvent");
    assert.ok(content.includes("export function getCachedOrganiserEvents"), "Must export getCachedOrganiserEvents");
    assert.ok(content.includes("export function getCachedRegistrations"), "Must export getCachedRegistrations");
  });

  test("Navigation shells eliminate prefetch={false} and enable eager preheating", () => {
    const filesToCheck = [
      "components/Header.jsx",
      "components/layout/organiser-shell.jsx",
      "components/admin/event-control-header.jsx",
      "src/app/(app)/superadmin/layout.jsx",
      "src/app/(app)/(user)/account/page.jsx",
      "src/app/(app)/(user)/dashboard/page.jsx",
      "src/app/(app)/(user)/my-tickets/page.jsx",
      "src/app/(app)/(public)/host-event/page.jsx",
    ];

    for (const relPath of filesToCheck) {
      const fullPath = path.join(projectRoot, relPath);
      assert.ok(fs.existsSync(fullPath), `${relPath} must exist`);
      const content = fs.readFileSync(fullPath, "utf-8");
      assert.ok(
        !content.includes("prefetch={false}"),
        `${relPath} must not contain prefetch={false}`
      );
    }
  });

  test("EventControlHeader preheats subtabs on hover and touch", () => {
    const headerPath = path.join(projectRoot, "components/admin/event-control-header.jsx");
    const content = fs.readFileSync(headerPath, "utf-8");

    assert.ok(content.includes("prefetch={true}"), "Subtabs must include prefetch={true}");
    assert.ok(content.includes("router.prefetch(tab.href)"), "Subtabs must call router.prefetch on hover");
    assert.ok(content.includes("onTouchStart"), "Subtabs must preheat on touch devices");
  });

  test("SuperAdminLayout preheats top navigation tabs on hover and touch", () => {
    const layoutPath = path.join(projectRoot, "src/app/(app)/superadmin/layout.jsx");
    const content = fs.readFileSync(layoutPath, "utf-8");

    assert.ok(content.includes("prefetch={true}"), "Top tabs must include prefetch={true}");
    assert.ok(content.includes("router.prefetch(item.href)"), "Top tabs must call router.prefetch on hover");
  });

  test("Organizer Overview page uses synchronous cache hydration to eliminate skeleton flicker", () => {
    const pagePath = path.join(projectRoot, "src/app/(app)/admin/overview/page.jsx");
    const content = fs.readFileSync(pagePath, "utf-8");

    assert.ok(content.includes("getCachedEvent"), "Must import getCachedEvent");
    assert.ok(
      content.includes("const [event, setEvent] = useState(() =>"),
      "Event state must be initialized with synchronous factory function"
    );
    assert.ok(
      content.includes("const [loading, setLoading] = useState(() =>"),
      "Loading state must be initialized synchronously based on cache presence"
    );
  });

  test("Organizer Registrations page uses synchronous cache hydration", () => {
    const pagePath = path.join(projectRoot, "src/app/(app)/admin/registrations/page.jsx");
    const content = fs.readFileSync(pagePath, "utf-8");

    assert.ok(content.includes("getCachedEvent"), "Must import getCachedEvent");
    assert.ok(
      content.includes("const [event, setEvent] = useState(() =>"),
      "Event state must be initialized with synchronous factory function"
    );
    assert.ok(
      content.includes("const [loading, setLoading] = useState(() =>"),
      "Loading state must be initialized synchronously"
    );
  });

  test("Organizer Analytics page uses synchronous cache hydration", () => {
    const pagePath = path.join(projectRoot, "src/app/(app)/admin/analytics/page.jsx");
    const content = fs.readFileSync(pagePath, "utf-8");

    assert.ok(content.includes("getCachedEvent"), "Must import getCachedEvent");
    assert.ok(
      content.includes("const [event, setEvent] = useState(() =>"),
      "Event state must be initialized synchronously"
    );
    assert.ok(
      content.includes("const [loading, setLoading] = useState(() =>"),
      "Loading state must be initialized synchronously"
    );
  });

  test("Organizer Customize / More Settings page uses synchronous cache hydration", () => {
    const pagePath = path.join(projectRoot, "src/app/(app)/admin/customize/page.jsx");
    const content = fs.readFileSync(pagePath, "utf-8");

    assert.ok(content.includes("getCachedEvent"), "Must import getCachedEvent");
    assert.ok(
      content.includes("const [currentEvent, setCurrentEvent] = useState(() =>"),
      "Current event state must be initialized synchronously"
    );
    assert.ok(
      content.includes("const [loadingEvent, setLoadingEvent] = useState(() =>"),
      "LoadingEvent state must be initialized synchronously"
    );
  });

  test("Organizer Programs & Program Hub pages use synchronous cache hydration", () => {
    const listPath = path.join(projectRoot, "src/app/(app)/admin/programs/page.jsx");
    const listContent = fs.readFileSync(listPath, "utf-8");
    assert.ok(listContent.includes("getCachedPrograms"), "List must import getCachedPrograms");
    assert.ok(
      listContent.includes("const [programs, setPrograms] = useState(() =>"),
      "Programs state must be initialized synchronously"
    );

    const hubPath = path.join(projectRoot, "src/app/(app)/admin/programs/[programId]/page.jsx");
    const hubContent = fs.readFileSync(hubPath, "utf-8");
    assert.ok(hubContent.includes("getCachedProgram"), "Hub must import getCachedProgram");
    assert.ok(
      hubContent.includes("const [program, setProgram] = useState(() =>"),
      "Program state must be initialized synchronously"
    );
  });

  test("SuperAdmin Payments page uses synchronous cache hydration to eliminate skeleton flash", () => {
    const pagePath = path.join(projectRoot, "src/app/(app)/superadmin/payments/page.jsx");
    const content = fs.readFileSync(pagePath, "utf-8");

    assert.ok(
      content.includes("const [summary, setSummary] = useState(() =>"),
      "Payments summary state must be initialized synchronously"
    );
    assert.ok(
      content.includes("const [loading, setLoading] = useState(() =>"),
      "Loading state must be initialized synchronously based on cache presence"
    );
  });

  test("Site Settings Manager uses synchronous cache hydration for instant interactivity", () => {
    const compPath = path.join(projectRoot, "components/admin/site-settings-manager.jsx");
    const content = fs.readFileSync(compPath, "utf-8");

    assert.ok(content.includes("getCachedItem"), "Must import getCachedItem");
    assert.ok(content.includes("superadmin_site_settings"), "Must use superadmin_site_settings cache key");
    assert.ok(
      content.includes("const [loading, setLoading] = useState(() => !cachedSettings)"),
      "Loading state must reflect cache availability immediately"
    );
  });
});

