import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Ticket Detail Endpoint Authorization & Data Privacy (SEC-2, R63, R65, R66, GAP-3)", () => {
  const root = process.cwd();
  const routePath = path.join(root, "src/app/api/tickets/[ticketId]/route.js");
  const content = fs.readFileSync(routePath, "utf-8");

  test("Ticket details route enforces authentication (SEC-2, R65)", () => {
    assert.match(content, /getAuthenticatedUser/, "Must authenticate caller using server helper");
    assert.match(content, /if\s*\(!caller\)/, "Must check if caller is present");
    assert.match(content, /status:\s*401/, "Must return 401 when unauthenticated");
  });

  test("Ticket details route validates ownership and role authorization (SEC-2, R65, R66)", () => {
    assert.match(content, /isOwner/, "Must evaluate isOwner");
    assert.match(content, /ticketOwnerUid === caller\.uid/, "Must match caller.uid against ticket.userId");
    assert.match(content, /callerEmailVerified/, "Must verify caller's email is verified before matching on email");
    assert.match(content, /canManageEventId/, "Must allow authorized event organizer");
    assert.match(content, /caller\.role === "superAdmin"/, "Must allow superAdmin");
    assert.match(content, /status:\s*403/, "Must return 403 Forbidden for unauthorized callers");
  });

  test("Ticket details route removes fake demo defaults (GAP-3)", () => {
    assert.strictEqual(
      content.includes('"Main Auditorium"'),
      false,
      "Must not hardcode 'Main Auditorium' fallback"
    );
    assert.match(
      content,
      /Venue details to be announced|regData\.venue|regData\.location/,
      "Must provide truthful neutral fallback when location is not specified"
    );
  });

  test("Frontend ticket view page handles 401 unauthenticated state with login redirect", () => {
    const pagePath = path.join(root, "src/app/(app)/tickets/[ticketId]/page.jsx");
    const pageContent = fs.readFileSync(pagePath, "utf-8");

    assert.match(pageContent, /authErrorType === "401"/, "Must handle 401 state");
    assert.match(pageContent, /Authentication Required/, "Must display authentication required heading");
    assert.match(pageContent, /Log In to View Ticket/, "Must provide login CTA button");
    assert.match(pageContent, /redirect=/, "Must preserve return redirect URL to ticket");
  });

  test("Frontend ticket view page handles 403 access denied state", () => {
    const pagePath = path.join(root, "src/app/(app)/tickets/[ticketId]/page.jsx");
    const pageContent = fs.readFileSync(pagePath, "utf-8");

    assert.match(pageContent, /authErrorType === "403"/, "Must handle 403 state");
    assert.match(pageContent, /Access Denied/, "Must display access denied heading");
  });
});
