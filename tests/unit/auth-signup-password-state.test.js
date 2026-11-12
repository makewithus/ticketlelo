import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Auth Signup & Account Password State (BUG-3, R50)", () => {
  const root = process.cwd();
  const authPath = path.join(root, "lib/auth.js");
  const authContent = fs.readFileSync(authPath, "utf-8");

  test("signup helper defaults hasSetPassword: true for users registering with password (BUG-3)", () => {
    // When options is omitted or hasSetPassword is not explicitly false, must default to true
    assert.match(
      authContent,
      /hasSetPassword:\s*options\.hasSetPassword !== undefined \? Boolean\(options\.hasSetPassword\) : true/,
      "signup must set hasSetPassword: true when user provides a password"
    );
    assert.match(
      authContent,
      /isFirstTimeUser:\s*options\.isFirstTimeUser !== undefined \? Boolean\(options\.isFirstTimeUser\) : false/,
      "signup must set isFirstTimeUser: false when user creates an account with a password"
    );
  });

  test("dynamic registration form explicitly marks user as having password on inline signup (BUG-3)", () => {
    const formPath = path.join(root, "components/forms/dynamic-registration-form.jsx");
    const formContent = fs.readFileSync(formPath, "utf-8");

    assert.match(
      formContent,
      /hasSetPassword:\s*true/,
      "Form inline account creation must pass hasSetPassword: true"
    );
    assert.match(
      formContent,
      /isFirstTimeUser:\s*false/,
      "Form inline account creation must pass isFirstTimeUser: false"
    );
  });

  test("establishServerSession is exported and called upon password setup auto-login (R54)", () => {
    assert.match(
      authContent,
      /export const establishServerSession/,
      "establishServerSession must be exported for use in custom-token auto-login"
    );

    const setupPagePath = path.join(root, "src/app/(app)/(public)/setup-password/page.jsx");
    const setupPageContent = fs.readFileSync(setupPagePath, "utf-8");

    assert.match(
      setupPageContent,
      /establishServerSession\(userCredential\.user\)/,
      "setup-password page must call establishServerSession on custom token login"
    );
  });
});
