import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

describe("User Portal Role Consistency Suite", () => {
  test("Account page does NOT treat isAdmin as SuperAdmin", () => {
    const accountPagePath = path.join(
      projectRoot,
      "src/app/(app)/(user)/account/page.jsx"
    );
    assert.ok(fs.existsSync(accountPagePath), "account/page.jsx must exist");
    const content = fs.readFileSync(accountPagePath, "utf-8");

    // Extract isSuperAdmin definition
    const isSuperAdminBlock = content.match(
      /const isSuperAdmin =\s*([\s\S]*?);/
    );
    assert.ok(isSuperAdminBlock, "Must define isSuperAdmin");
    assert.ok(
      !isSuperAdminBlock[1].includes("user?.isAdmin"),
      "isSuperAdmin MUST NOT check user?.isAdmin (organisers have isAdmin=true)"
    );

    // Verify profile badge uses Organiser instead of plan name or SuperAdmin for organisers
    assert.ok(
      content.includes('isSuperAdmin\n                      ? "Super Admin"\n                      : isOrganiser\n                      ? "Organiser"\n                      : "Attendee"'),
      "Profile card badge must distinguish Super Admin, Organiser, and Attendee cleanly"
    );
  });

  test("User portal pages have consistent role definitions", () => {
    const portalPages = [
      "src/app/(app)/(user)/account/page.jsx",
      "src/app/(app)/(user)/dashboard/page.jsx",
      "src/app/(app)/(user)/my-tickets/page.jsx",
    ];

    for (const relPath of portalPages) {
      const filePath = path.join(projectRoot, relPath);
      assert.ok(fs.existsSync(filePath), `${relPath} must exist`);
      const content = fs.readFileSync(filePath, "utf-8");

      const isSuperAdminBlock = content.match(
        /const isSuperAdmin =\s*([\s\S]*?);/
      );
      assert.ok(isSuperAdminBlock, `${relPath} must define isSuperAdmin`);
      assert.ok(
        !isSuperAdminBlock[1].includes("user?.isAdmin"),
        `${relPath} isSuperAdmin MUST NOT check user?.isAdmin`
      );

      // Verify dropdown role label
      assert.ok(
        content.includes('{isSuperAdmin ? "Super Admin" : hasOrganiserAccess ? "Organiser" : "User"}'),
        `${relPath} dropdown badge must display Organiser for organisers`
      );
    }
  });

  test("Organiser shell correctly distinguishes Super Admin and Organiser", () => {
    const shellPath = path.join(
      projectRoot,
      "components/layout/organiser-shell.jsx"
    );
    assert.ok(fs.existsSync(shellPath), "organiser-shell.jsx must exist");
    const content = fs.readFileSync(shellPath, "utf-8");

    const isSuperAdminBlock = content.match(
      /const isSuperAdmin =\s*([\s\S]*?);/
    );
    assert.ok(isSuperAdminBlock, "Must define isSuperAdmin in shell");
    assert.ok(
      !isSuperAdminBlock[1].includes("user?.isAdmin"),
      "isSuperAdmin in organiser shell MUST NOT check user?.isAdmin"
    );

    assert.ok(
      content.includes('{isSuperAdmin ? "Super Admin" : "Organiser"}'),
      "Organiser shell dropdown badge must show Organiser for organisers"
    );
  });
});
