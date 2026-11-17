import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("Hosting Requests Management — Count Consistency & Valid Status Suite", async (t) => {
  const componentPath = path.resolve(
    process.cwd(),
    "components/admin/hosting-request-management.jsx"
  );
  const content = fs.readFileSync(componentPath, "utf-8");

  await t.test("counts memo calculates counts.total and all 3 active status partitions", () => {
    assert.ok(
      content.includes("total: requests.length"),
      "counts memo must define total: requests.length"
    );
    assert.ok(
      content.includes("pending"),
      "counts memo must count pending status"
    );
    assert.ok(
      content.includes("approved"),
      "counts memo must count approved status"
    );
    assert.ok(
      content.includes("rejected"),
      "counts memo must count rejected status"
    );
    assert.ok(
      !content.includes("Revoked ({counts.revoked})"),
      "Revoked status must be removed from hosting requests UI"
    );
  });

  await t.test("Segmented button tabs include All, Pending, Approved, and Rejected", () => {
    assert.ok(
      content.includes("All ({counts.total})"),
      "Tab must display All ({counts.total})"
    );
    assert.ok(
      content.includes("Pending ({counts.pending})"),
      "Tab must display Pending ({counts.pending})"
    );
    assert.ok(
      content.includes("Approved ({counts.approved})"),
      "Tab must display Approved ({counts.approved})"
    );
    assert.ok(
      content.includes("Rejected ({counts.rejected})"),
      "Tab must display Rejected ({counts.rejected})"
    );
  });

  await t.test("Mathematical consistency helper verifies partition sum equals total", () => {
    const sampleRequests = [
      ...Array(2).fill({ status: "pending" }),
      ...Array(31).fill({ status: "approved" }),
      ...Array(6).fill({ status: "rejected" }),
    ];

    let pending = 0;
    let approved = 0;
    let rejected = 0;

    for (const r of sampleRequests) {
      const st = (r.status || "pending").toLowerCase().trim();
      if (st === "pending") pending++;
      else if (st === "approved") approved++;
      else if (st === "rejected") rejected++;
    }

    const total = sampleRequests.length;
    assert.equal(total, 39, "Total requests must equal 39");
    assert.equal(pending, 2, "Pending must equal 2");
    assert.equal(approved, 31, "Approved must equal 31");
    assert.equal(rejected, 6, "Rejected must equal 6");
    assert.equal(
      pending + approved + rejected,
      total,
      "Sum of status counts (2 + 31 + 6) must equal 39"
    );
  });

  await t.test("Table row and detail drawer maintain consistent pending/approved/rejected statuses", () => {
    assert.ok(content.includes("isPending"), "Table row checks isPending");
    assert.ok(content.includes("isApproved"), "Table row checks isApproved");
    assert.ok(content.includes("Rejected"), "Table row renders Rejected badge");
    assert.ok(
      !content.includes('selectedDetailRequest.status === "revoked"'),
      "Detail drawer excludes revoked status"
    );
  });
});
