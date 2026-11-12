import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

describe("Super Admin Modules & Event Creation Permission Suite", () => {
  test("SuperAdmin Organisers API & UI End-to-End Resilience", () => {
    const routePath = path.join(projectRoot, "src/app/api/superadmin/organisers/route.js");
    const compPath = path.join(projectRoot, "components/admin/organisers-management.jsx");

    assert.ok(fs.existsSync(routePath), "Organisers API route must exist");
    assert.ok(fs.existsSync(compPath), "OrganisersManagement component must exist");

    const routeContent = fs.readFileSync(routePath, "utf-8");
    const compContent = fs.readFileSync(compPath, "utf-8");

    // Route supports SuperAdmin role, isAdmin flag, and SUPER_ADMIN_EMAIL
    assert.match(routeContent, /isSuperAdmin/, "Route must verify super admin privileges");
    assert.match(routeContent, /SUPER_ADMIN_EMAIL/, "Route must respect SUPER_ADMIN_EMAIL env variable");
    assert.match(routeContent, /caller\?\.isAdmin\s*===\s*true/, "Route must accept caller.isAdmin flag");

    // Route merges hosting requests AND registered users
    assert.match(routeContent, /hostingRequests/, "Route must fetch hostingRequests");
    assert.match(routeContent, /users/, "Route must fetch registered users");
    assert.match(routeContent, /organiser|organizer/, "Route must recognize both organiser and organizer roles");

    // UI component passes Firebase ID token in Authorization header
    assert.match(compContent, /auth\.currentUser\.getIdToken\(\)/, "Component must retrieve current user ID token");
    assert.match(compContent, /Authorization\s*=\s*`Bearer \$\{token\}`/, "Component must pass Bearer token in fetch");
    assert.match(compContent, /\/api\/superadmin\/organisers/, "Component must call organisers API");
  });

  test("SuperAdmin Site Settings API & UI End-to-End Resilience", () => {
    const countdownRoutePath = path.join(projectRoot, "src/app/api/site-settings/countdown/route.js");
    const generalRoutePath = path.join(projectRoot, "src/app/api/site-settings/route.js");
    const compPath = path.join(projectRoot, "components/admin/site-settings-manager.jsx");

    assert.ok(fs.existsSync(countdownRoutePath), "Site settings countdown route must exist");
    assert.ok(fs.existsSync(generalRoutePath), "Site settings general route must exist");
    assert.ok(fs.existsSync(compPath), "SiteSettingsManager component must exist");

    const countdownContent = fs.readFileSync(countdownRoutePath, "utf-8");
    const generalContent = fs.readFileSync(generalRoutePath, "utf-8");
    const compContent = fs.readFileSync(compPath, "utf-8");

    // Routes handle both countdownAt AND siteConfig
    assert.match(countdownContent, /countdownAt/, "Countdown route must handle countdownAt");
    assert.match(countdownContent, /siteConfig/, "Countdown route must handle siteConfig");
    assert.match(generalContent, /countdownAt/, "General route must handle countdownAt");
    assert.match(generalContent, /siteConfig/, "General route must handle siteConfig");

    // UI component loads and updates both countdown and siteConfig
    assert.match(compContent, /siteConfig/, "Component must manage siteConfig state");
    assert.match(compContent, /auth\.currentUser\.getIdToken\(\)/, "Component must retrieve Firebase ID token");
    assert.match(compContent, /Authorization\s*=\s*`Bearer \$\{token\}`/, "Component must pass Bearer token on requests");
  });

  test("SuperAdmin Email Monitoring API & UI End-to-End Resilience", () => {
    const emailRoutePath = path.join(projectRoot, "src/app/api/admin/emails/route.js");
    const retryRoutePath = path.join(projectRoot, "src/app/api/admin/emails/retry/route.js");
    const compPath = path.join(projectRoot, "components/admin/email-monitoring.jsx");

    assert.ok(fs.existsSync(emailRoutePath), "Email monitoring route must exist");
    assert.ok(fs.existsSync(retryRoutePath), "Email retry route must exist");
    assert.ok(fs.existsSync(compPath), "EmailMonitoringDashboard component must exist");

    const emailContent = fs.readFileSync(emailRoutePath, "utf-8");
    const compContent = fs.readFileSync(compPath, "utf-8");

    // Route supports SuperAdmin verification
    assert.match(emailContent, /isSuperAdmin/, "Email route must verify superadmin");
    assert.match(emailContent, /SUPER_ADMIN_EMAIL/, "Email route must check SUPER_ADMIN_EMAIL");

    // UI component has defensive defaults for quota, stats, jobs
    assert.match(compContent, /quota\s*=\s*data\?\.quota/, "Component must access quota safely");
    assert.match(compContent, /stats\s*=\s*data\?\.stats/, "Component must access stats safely");
    assert.match(compContent, /auth\.currentUser\.getIdToken\(\)/, "Component must retrieve Firebase ID token");
    assert.match(compContent, /Authorization\s*=\s*`Bearer \$\{token\}`/, "Component must pass Bearer token in fetch");
  });

  test("Event Creation & Update Permission Denied Resolution", () => {
    const eventCreateApi = path.join(projectRoot, "src/app/api/events/create/route.js");
    const firestoreLib = path.join(projectRoot, "lib/firestore.js");
    const firestoreRules = path.join(projectRoot, "firestore.rules");
    const authContext = path.join(projectRoot, "context/auth-context.jsx");

    assert.ok(fs.existsSync(eventCreateApi), "Event create API must exist");
    assert.ok(fs.existsSync(firestoreLib), "Firestore lib must exist");
    assert.ok(fs.existsSync(firestoreRules), "Firestore rules must exist");
    assert.ok(fs.existsSync(authContext), "AuthContext must exist");

    const apiContent = fs.readFileSync(eventCreateApi, "utf-8");
    const libContent = fs.readFileSync(firestoreLib, "utf-8");
    const rulesContent = fs.readFileSync(firestoreRules, "utf-8");
    const authContent = fs.readFileSync(authContext, "utf-8");

    // 1. API maps creator ID to all creator aliases
    assert.match(apiContent, /createdBy:\s*creatorId/, "API must set createdBy");
    assert.match(apiContent, /userId:\s*creatorId/, "API must set userId");
    assert.match(apiContent, /organiserId:\s*creatorId/, "API must set organiserId");
    assert.match(apiContent, /organizerId:\s*creatorId/, "API must set organizerId");

    // 2. Client firestore.js resolves current user ID and passes Bearer token on fallback
    assert.match(libContent, /auth\?\.currentUser\?\.uid/, "lib/firestore.js must resolve auth.currentUser.uid");
    assert.match(libContent, /Authorization\s*=\s*`Bearer \$\{token\}`/, "createEvent fallback must pass Bearer token");
    assert.match(libContent, /method:\s*"PATCH"/, "updateEvent must have fallback to server route on permission failure");

    // 3. AuthContext ensures user profile always has both id and uid
    assert.match(authContent, /uid:\s*firebaseUser\.uid/, "AuthContext must expose uid");
    assert.match(authContent, /id:\s*firebaseUser\.uid/, "AuthContext must expose id");

    // 4. firestore.rules allows event creation by authenticated creator with aliases
    assert.match(rulesContent, /request\.resource\.data\.get\('createdBy', ''\) == request\.auth\.uid/, "Rules must allow createdBy == auth.uid");
    assert.match(rulesContent, /request\.resource\.data\.get\('userId', ''\) == request\.auth\.uid/, "Rules must allow userId == auth.uid");
    assert.match(rulesContent, /request\.resource\.data\.get\('organiserId', ''\) == request\.auth\.uid/, "Rules must allow organiserId == auth.uid");
    assert.match(rulesContent, /request\.resource\.data\.get\('organizerId', ''\) == request\.auth\.uid/, "Rules must allow organizerId == auth.uid");

    // 5. firestore.rules recognizes both 'organiser' and 'organizer' conventions
    assert.match(rulesContent, /request\.auth\.token\.role == "organiser"/, "Rules must recognize 'organiser'");
    assert.match(rulesContent, /request\.auth\.token\.role == "organizer"/, "Rules must recognize 'organizer'");
  });
});
