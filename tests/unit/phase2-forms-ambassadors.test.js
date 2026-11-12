const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

describe("Phase 2: Unified Form Engine & Campus Ambassador System", () => {
  const {
    validateFormSubmission,
    filterFormFieldsForEntitlements,
  } = require("../../lib/form-validator.js");
  const {
    calculateCommissionAmount,
    isSelfReferral,
  } = require("../../lib/commissions.js");

  describe("Form Engine & Conditional Fields", () => {
    const testFields = [
      { id: "fullName", label: "Full Name", type: "text", required: true },
      { id: "email", label: "Email Address", type: "email", required: true },
      {
        id: "githubUrl",
        label: "GitHub Profile",
        type: "text",
        required: true,
        conditionalOnSubEventIds: ["sub_hackathon_123"],
      },
    ];

    test("Conditional questions only display when matching sub-event is selected", () => {
      // General attendee without hackathon
      const generalFields = filterFormFieldsForEntitlements(testFields, ["sub_workshop_456"]);
      assert.equal(generalFields.length, 2);
      assert.equal(generalFields.some((f) => f.id === "githubUrl"), false);

      // Hackathon attendee
      const hackathonFields = filterFormFieldsForEntitlements(testFields, ["sub_hackathon_123"]);
      assert.equal(hackathonFields.length, 3);
      assert.equal(hackathonFields.some((f) => f.id === "githubUrl"), true);
    });

    test("Form submission validator rejects invalid email and missing required fields", () => {
      const invalidSubmission = {
        fullName: "",
        email: "not-an-email",
      };

      const result = validateFormSubmission(testFields, invalidSubmission, []);
      assert.equal(result.isValid, false);
      assert.ok(result.errors.fullName);
      assert.ok(result.errors.email);
    });

    test("Form submission validator accepts valid data", () => {
      const validSubmission = {
        fullName: "Rahul Sharma",
        email: "rahul@iit.ac.in",
        githubUrl: "https://github.com/rahul",
      };

      const result = validateFormSubmission(testFields, validSubmission, ["sub_hackathon_123"]);
      assert.equal(result.isValid, true);
      assert.equal(Object.keys(result.errors).length, 0);
    });
  });

  describe("Ambassador Commission & Self-Referral Prevention", () => {
    const percentageProgram = {
      isActive: true,
      commissionType: "percentage",
      commissionRate: 10, // 10%
    };

    const fixedProgram = {
      isActive: true,
      commissionType: "fixed",
      commissionRate: 50, // ₹50 per ticket
    };

    test("Percentage commission calculates accurately", () => {
      const commission = calculateCommissionAmount(percentageProgram, 449.1, 1);
      assert.equal(commission, 44.91);
    });

    test("Fixed tier commission scales by ticket count", () => {
      const commission = calculateCommissionAmount(fixedProgram, 1000, 3);
      assert.equal(commission, 150);
    });

    test("Self-referral detection catches matching email", () => {
      const ambassador = {
        email: "sarah.ambassador@college.edu",
        whatsappPhone: "9876543210",
      };
      const buyer = {
        email: "sarah.ambassador@college.edu",
        whatsappPhone: "9123456789",
      };

      assert.equal(isSelfReferral(buyer, ambassador), true);
    });

    test("Self-referral detection catches matching phone number", () => {
      const ambassador = {
        email: "sarah@college.edu",
        whatsappPhone: "+91 98765 43210",
      };
      const buyer = {
        email: "another.student@gmail.com",
        whatsappPhone: "9876543210",
      };

      assert.equal(isSelfReferral(buyer, ambassador), true);
    });

    test("Legitimate peer referral passes self-referral check", () => {
      const ambassador = {
        email: "sarah@college.edu",
        whatsappPhone: "9876543210",
      };
      const buyer = {
        email: "alex@college.edu",
        whatsappPhone: "9123456780",
      };

      assert.equal(isSelfReferral(buyer, ambassador), false);
    });
  });
});
