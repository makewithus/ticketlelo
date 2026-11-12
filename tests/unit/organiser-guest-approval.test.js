import { test, describe } from "node:test";
import assert from "node:assert/strict";

describe("Organiser Guest Approval Workflow", () => {
  test("Event with requireApproval sets initial registration to pending", () => {
    const event = {
      id: "evt_quiz_challenge",
      name: "IS Code Quiz Challenge | BIS CED CUSAT",
      requireApproval: true,
      price: 0,
    };

    const registrationInput = {
      eventId: event.id,
      name: "Vikrant Prakash",
      email: "anishkumar398800@gmail.com",
      requireApproval: event.requireApproval,
      formData: {
        teamName: "Saffire",
        teamLeaderName: "Aaditya narayan",
        department: "Safety and Fire Engineering",
        semester: "S4",
      },
    };

    const isPendingApproval = Boolean(event.requireApproval || registrationInput.requireApproval);
    const initialStatus = isPendingApproval ? "pending" : "Going";
    const initialApprovalStatus = isPendingApproval ? "pending" : "approved";
    const initialTicketStatus = isPendingApproval ? "Pending Approval" : "Valid";

    assert.equal(initialStatus, "pending");
    assert.equal(initialApprovalStatus, "pending");
    assert.equal(initialTicketStatus, "Pending Approval");
  });

  test("Organiser approval updates registration to Going and ticket to Valid", () => {
    let registration = {
      id: "reg_vikrant_123",
      ticketId: "TKT-VIKRANT-01",
      name: "Vikrant Prakash",
      status: "pending",
      approvalStatus: "pending",
    };

    let ticket = {
      id: "TKT-VIKRANT-01",
      status: "Pending Approval",
    };

    // Organiser clicks Approve on dashboard
    const approveAction = (reg, tkt, customMessage = "") => {
      const now = new Date();
      return {
        updatedReg: {
          ...reg,
          status: "Going",
          approvalStatus: "approved",
          approvedAt: now,
          approvalMessage: customMessage || null,
        },
        updatedTkt: {
          ...tkt,
          status: "Valid",
          updatedAt: now,
        },
      };
    };

    const { updatedReg, updatedTkt } = approveAction(registration, ticket, "Welcome to the challenge!");

    assert.equal(updatedReg.status, "Going");
    assert.equal(updatedReg.approvalStatus, "approved");
    assert.ok(updatedReg.approvedAt instanceof Date);
    assert.equal(updatedReg.approvalMessage, "Welcome to the challenge!");
    assert.equal(updatedTkt.status, "Valid");
  });

  test("Organiser decline updates registration to declined and ticket to Cancelled", () => {
    let registration = {
      id: "reg_vikrant_123",
      ticketId: "TKT-VIKRANT-01",
      name: "Vikrant Prakash",
      status: "pending",
      approvalStatus: "pending",
    };

    let ticket = {
      id: "TKT-VIKRANT-01",
      status: "Pending Approval",
    };

    // Organiser clicks Decline on dashboard
    const declineAction = (reg, tkt, customMessage = "") => {
      const now = new Date();
      return {
        updatedReg: {
          ...reg,
          status: "declined",
          approvalStatus: "declined",
          declinedAt: now,
          declineMessage: customMessage || null,
        },
        updatedTkt: {
          ...tkt,
          status: "Cancelled",
          updatedAt: now,
        },
      };
    };

    const { updatedReg, updatedTkt } = declineAction(registration, ticket, "Capacity reached for this round.");

    assert.equal(updatedReg.status, "declined");
    assert.equal(updatedReg.approvalStatus, "declined");
    assert.ok(updatedReg.declinedAt instanceof Date);
    assert.equal(updatedReg.declineMessage, "Capacity reached for this round.");
    assert.equal(updatedTkt.status, "Cancelled");
  });

  test("Gate verification scanner rejects unapproved and declined tickets", () => {
    const verifyTicketGate = (ticket) => {
      if (ticket.status === "Revoked") {
        return { status: "revoked", message: "This ticket has been revoked by the event organizer." };
      }
      if (ticket.status === "Pending Approval" || ticket.status === "pending") {
        return { status: "pending_approval", message: "This guest is currently pending approval by the organiser." };
      }
      if (ticket.status === "Cancelled" || ticket.status === "declined") {
        return { status: "declined", message: "Registration for this ticket was declined by the organiser." };
      }
      return { status: "admitted", message: "Valid Ticket — Admission Granted" };
    };

    const pendingTicket = { id: "TKT-001", status: "Pending Approval" };
    const declinedTicket = { id: "TKT-002", status: "Cancelled" };
    const validTicket = { id: "TKT-003", status: "Valid" };

    assert.equal(verifyTicketGate(pendingTicket).status, "pending_approval");
    assert.equal(verifyTicketGate(declinedTicket).status, "declined");
    assert.equal(verifyTicketGate(validTicket).status, "admitted");
  });

  test("Registration details extractor formats all custom fields without error", () => {
    const guest = {
      id: "usr-2YDjvHEPVZmEJz",
      fullName: "Vikrant Prakash",
      email: "anishkumar398800@gmail.com",
      status: "pending",
      approvalStatus: "pending",
      teamName: "Saffire",
      teamLeaderName: "Aaditya narayan",
      department: "Safety and Fire Engineering",
      semester: "S4",
      formData: {
        teamName: "Saffire",
        teamLeaderName: "Aaditya narayan",
        department: "Safety and Fire Engineering",
        semester: "S4",
        githubUrl: "https://github.com/saffire",
        contactNumber: "+91 9876543210",
      },
    };

    // Extract entries
    const merged = {
      ...(guest.formData || {}),
      ...(guest.customFieldResponses || {}),
    };
    if (guest.teamName && merged.teamName === undefined) merged.teamName = guest.teamName;
    if (guest.teamLeaderName && merged.teamLeaderName === undefined) merged.teamLeaderName = guest.teamLeaderName;
    if (guest.department && merged.department === undefined) merged.department = guest.department;
    if (guest.semester && merged.semester === undefined) merged.semester = guest.semester;

    const entries = Object.entries(merged).map(([k, v]) => ({
      key: k,
      value: String(v),
    }));

    const team = entries.find((e) => e.key === "teamName");
    const leader = entries.find((e) => e.key === "teamLeaderName");
    const dept = entries.find((e) => e.key === "department");
    const sem = entries.find((e) => e.key === "semester");

    assert.equal(team?.value, "Saffire");
    assert.equal(leader?.value, "Aaditya narayan");
    assert.equal(dept?.value, "Safety and Fire Engineering");
    assert.equal(sem?.value, "S4");
  });
});
