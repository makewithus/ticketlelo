import test from "node:test";
import assert from "node:assert/strict";
import { formatTicketId, generateTicketId, cleanTicketId } from "../../lib/ticket-id.js";

test("Ticket ID Format (XXXX-XXXX)", async (t) => {
  await t.test("formats legacy TKT-... IDs into XXXX-XXXX", () => {
    // From Image 2: TKT-7ABAD7225DCADFF877469BC3B5FA
    const formatted = formatTicketId("TKT-7ABAD7225DCADFF877469BC3B5FA");
    assert.equal(formatted, "7ABA-D722");
  });

  await t.test("keeps existing XXXX-XXXX format intact", () => {
    assert.equal(formatTicketId("ABCD-1234"), "ABCD-1234");
    assert.equal(formatTicketId("abcd-1234"), "ABCD-1234");
  });

  await t.test("formats short strings and pads if needed", () => {
    const formatted = formatTicketId("A1B2C3D4");
    assert.equal(formatted, "A1B2-C3D4");
  });

  await t.test("cleanTicketId removes non-alphanumeric chars and normalizes to uppercase", () => {
    assert.equal(cleanTicketId("7aba-d722"), "7ABAD722");
    assert.equal(cleanTicketId("TKT-7ABA-D722"), "7ABAD722");
  });

  await t.test("generateTicketId produces 9-character XXXX-XXXX format matching regex", () => {
    const id = generateTicketId();
    assert.match(id, /^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    assert.equal(id.length, 9);
  });
});
