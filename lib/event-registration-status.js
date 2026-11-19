/**
 * Comprehensive Event Lifecycle, Registration Status, Capacity & Organiser Evaluator
 * 
 * Provides single source of truth for:
 * 1. Event lifecycle states (draft, published, upcoming, live, completed, cancelled)
 * 2. Registration status (open vs closed with exact reason)
 * 3. Authoritative event capacity (unified field, explicit unlimited vs finite)
 * 4. Authoritative organiser display identity (consistent across Admin and Public views)
 * 5. Authoritative registered attendee count
 */

import { getEventDateRange, parseFirestoreDate } from "./date-utils.js";
export { getEventDateRange, parseFirestoreDate };

/**
 * Authoritative Event Lifecycle State Evaluator
 * 
 * Defines 6 canonical states:
 * - 'cancelled': Explicitly cancelled or cancellation approved.
 * - 'draft': In draft mode, private, unlisted, or unpublished.
 * - 'completed': Event has concluded (end date/time passed or marked ended/completed).
 * - 'live': Event is currently taking place (start <= now <= end).
 * - 'upcoming': Event is published and scheduled for a future date (now < start).
 * - 'published': Base published state (e.g. date announced soon).
 */
export function getEventLifecycleState(event, now = new Date()) {
  if (!event || typeof event !== "object") {
    return {
      state: "draft",
      label: "Draft",
      isDraft: true,
      isPublished: false,
      isUpcoming: false,
      isLive: false,
      isCompleted: false,
      isCancelled: false,
      registrationClosed: true,
      registrationClosedReason: "invalid_event",
      start: null,
      end: null,
    };
  }

  // 1. Cancelled takes absolute precedence
  if (
    event.status === "cancelled" ||
    event.isCancelled === true ||
    event.cancellationStatus === "approved"
  ) {
    return {
      state: "cancelled",
      label: "Cancelled",
      isDraft: false,
      isPublished: false,
      isUpcoming: false,
      isLive: false,
      isCompleted: false,
      isCancelled: true,
      registrationClosed: true,
      registrationClosedReason: "cancelled",
      start: null,
      end: null,
    };
  }

  // 2. Draft / Private / Unpublished
  const isDraftOrPrivate = Boolean(
    event.status === "draft" ||
    event.status === "private" ||
    event.status === "unlisted" ||
    event.isPrivate === true ||
    event.visibility === "private" ||
    event.visibility === "draft" ||
    event.isActive === false ||
    (event.published === false && event.isPublished === false) ||
    event.status === "inactive"
  );

  if (isDraftOrPrivate) {
    return {
      state: "draft",
      label: "Draft",
      isDraft: true,
      isPublished: false,
      isUpcoming: false,
      isLive: false,
      isCompleted: false,
      isCancelled: false,
      registrationClosed: true,
      registrationClosedReason: "draft_or_private",
      start: null,
      end: null,
    };
  }

  // 3. Date Range and Time Evaluation
  const { start, end } = getEventDateRange(event);
  const nowMs = now instanceof Date && !isNaN(now.getTime()) ? now.getTime() : Date.now();

  // 4. Completed / Ended check
  // If explicitly marked completed/ended, or if the event end time has passed
  const isExplicitlyEnded = Boolean(
    event.status === "ended" ||
    event.status === "completed" ||
    event.isEnded === true
  );

  if (isExplicitlyEnded || (end && nowMs > end.getTime())) {
    return {
      state: "completed",
      label: "Completed",
      isDraft: false,
      isPublished: true,
      isUpcoming: false,
      isLive: false,
      isCompleted: true,
      isCancelled: false,
      registrationClosed: true,
      registrationClosedReason: "ended",
      start,
      end,
    };
  }

  // 5. Live check
  // Currently between start and end (or manual live trigger if end time has not elapsed)
  const isCurrentlyRunning = Boolean(
    (start && nowMs >= start.getTime() && (!end || nowMs <= end.getTime())) ||
    ((event.isLive === true || event.status === "live") && (!end || nowMs <= end.getTime()))
  );

  if (isCurrentlyRunning) {
    return {
      state: "live",
      label: "Live",
      isDraft: false,
      isPublished: true,
      isUpcoming: false,
      isLive: true,
      isCompleted: false,
      isCancelled: false,
      registrationClosed: false,
      start,
      end,
    };
  }

  // 6. Upcoming check
  // Starts in the future
  if (start && nowMs < start.getTime()) {
    return {
      state: "upcoming",
      label: "Upcoming",
      isDraft: false,
      isPublished: true,
      isUpcoming: true,
      isLive: false,
      isCompleted: false,
      isCancelled: false,
      registrationClosed: false,
      start,
      end,
    };
  }

  // 7. Published with date unannounced or missing
  return {
    state: "upcoming",
    label: "Upcoming",
    isDraft: false,
    isPublished: true,
    isUpcoming: true,
    isLive: false,
    isCompleted: false,
    isCancelled: false,
    registrationClosed: false,
    start,
    end,
  };
}

/**
 * Determines whether an event is currently open or closed for registrations.
 */
export function checkEventRegistrationStatus(event, liveTakenSeats = null, now = new Date()) {
  if (!event || typeof event !== "object") {
    return { isClosed: true, reason: "invalid_event" };
  }

  // 1. Cancelled
  if (
    event.status === "cancelled" ||
    event.isCancelled === true ||
    event.cancellationStatus === "approved"
  ) {
    return { isClosed: true, reason: "cancelled" };
  }

  // 2. Draft / Private / Inactive / Unpublished Mode
  const isDraftOrPrivate = Boolean(
    event.status === "draft" ||
    event.status === "private" ||
    event.status === "unlisted" ||
    event.isPrivate === true ||
    event.visibility === "private" ||
    event.visibility === "draft" ||
    event.isActive === false ||
    (event.published === false && event.isPublished === false) ||
    event.status === "inactive"
  );

  if (isDraftOrPrivate) {
    return { isClosed: true, reason: "draft_or_private" };
  }

  // 3. Ended / Completed status or past date
  const nowMs = now instanceof Date && !isNaN(now.getTime()) ? now.getTime() : Date.now();
  const { end } = getEventDateRange(event);

  if (
    event.status === "ended" ||
    event.status === "completed" ||
    event.isEnded === true ||
    (end && nowMs > end.getTime())
  ) {
    return { isClosed: true, reason: "ended" };
  }

  // 4. Registration Deadline Passed
  const rawDeadline =
    event.registrationDeadline ||
    event.registrationEndDate ||
    event.registrationCloseDate ||
    event.closeRegistrationDate;
  if (rawDeadline) {
    const deadlineDate = parseFirestoreDate(rawDeadline);
    if (deadlineDate && !isNaN(deadlineDate.getTime()) && nowMs > deadlineDate.getTime()) {
      return { isClosed: true, reason: "deadline_passed" };
    }
  }

  // 5. Explicit Registration Closure Flags
  const isExplicitlyClosed = Boolean(
    event.status === "closed" ||
    event.registrationStatus === "Closed" ||
    event.registrationStatus === "closed" ||
    event.registrationClosed === true ||
    event.isRegistrationClosed === true ||
    (event.closeRegistrationEnabled === true &&
      (event.closeRegistrationMode === "now" || event.registrationClosed === true))
  );

  if (isExplicitlyClosed) {
    return { isClosed: true, reason: "explicitly_closed" };
  }

  // 6. Capacity Checks
  const currentSeats =
    typeof liveTakenSeats === "number"
      ? liveTakenSeats
      : Math.max(Number(event.allocatedSeats || 0), Number(event.registrationsCount || 0), 0);

  // 6a. Explicit Close Registration by Capacity
  if (
    event.closeRegistrationEnabled === true &&
    event.closeRegistrationMode === "capacity" &&
    typeof event.closeRegistrationCapacity === "number" &&
    Number(event.closeRegistrationCapacity) > 0 &&
    currentSeats >= Number(event.closeRegistrationCapacity)
  ) {
    return { isClosed: true, reason: "capacity_reached" };
  }

  // 6b. Authoritative Event Capacity
  const { isUnlimited, capacity } = getAuthoritativeEventCapacity(event);
  if (!isUnlimited && capacity > 0 && currentSeats >= capacity) {
    return { isClosed: true, reason: "capacity_reached" };
  }

  return { isClosed: false, reason: "open" };
}

export function isEventRegistrationClosed(event, liveTakenSeats = null, now = new Date()) {
  return checkEventRegistrationStatus(event, liveTakenSeats, now).isClosed;
}

/**
 * Authoritative Single-Source Capacity Parser
 * Consistently returns { isUnlimited: boolean, capacity: number, display: string, label: string }
 * Prevents phantom hardcoded 150 caps when events are unlimited or unspecified.
 */
export function getAuthoritativeEventCapacity(event) {
  if (!event || typeof event !== "object") {
    return { isUnlimited: true, capacity: 0, display: "∞", label: "Unlimited" };
  }

  if (event.isUnlimitedCapacity === true || event.limitCapacity === false) {
    return { isUnlimited: true, capacity: 0, display: "∞", label: "Unlimited" };
  }

  // Unified priority: globalCapacity is primary, then capacity, totalTickets, maxCapacity
  const raw = event.globalCapacity ?? event.capacity ?? event.totalTickets ?? event.maxCapacity;

  if (raw === undefined || raw === null || raw === "") {
    return { isUnlimited: true, capacity: 0, display: "∞", label: "Unlimited" };
  }

  if (typeof raw === "string") {
    const clean = raw.trim().toLowerCase();
    if (clean.includes("unlimited") || clean.includes("open") || clean === "∞") {
      return { isUnlimited: true, capacity: 0, display: "∞", label: "Unlimited" };
    }
    const digits = clean.replace(/[^\d]/g, "");
    const parsed = digits ? parseInt(digits, 10) : 0;
    if (parsed > 0 && parsed !== 9999) {
      return { isUnlimited: false, capacity: parsed, display: String(parsed), label: String(parsed) };
    }
    return { isUnlimited: true, capacity: 0, display: "∞", label: "Unlimited" };
  }

  if (typeof raw === "number") {
    if (raw > 0 && raw !== 9999) {
      return { isUnlimited: false, capacity: raw, display: String(raw), label: String(raw) };
    }
    return { isUnlimited: true, capacity: 0, display: "∞", label: "Unlimited" };
  }

  return { isUnlimited: true, capacity: 0, display: "∞", label: "Unlimited" };
}

/**
 * Authoritative Organiser Identity Resolver
 * Resolves the genuine creator of the event, keeps internal role names out of public labels,
 * and prevents Super Administrator viewing another organizer's event from overriding the host display.
 */
export function getAuthoritativeOrganiser(event, currentUser = null) {
  if (!event || typeof event !== "object") {
    return {
      name: "Event Organiser",
      email: "",
      photoURL: "",
      role: "Creator",
    };
  }

  const isGeneric = (val) => {
    if (!val) return true;
    const s = String(val).trim().toLowerCase();
    return (
      s === "school of engineering" ||
      s === "host" ||
      s === "organizer" ||
      s === "organiser" ||
      s === "super administrator" ||
      s === "superadmin" ||
      s === "admin"
    );
  };

  const isGenericEmail = (val) => {
    if (!val) return true;
    const s = String(val).trim().toLowerCase();
    return s === "support@ticketlelo.com";
  };

  let name = "";
  if (typeof event.organizer === "object" && event.organizer?.name && !isGeneric(event.organizer.name)) {
    name = event.organizer.name.trim();
  } else if (typeof event.organiser === "object" && event.organiser?.name && !isGeneric(event.organiser.name)) {
    name = event.organiser.name.trim();
  } else if (event.creatorName && !isGeneric(event.creatorName)) {
    name = event.creatorName.trim();
  } else if (event.createdByName && !isGeneric(event.createdByName)) {
    name = event.createdByName.trim();
  } else if (event.organizerName && !isGeneric(event.organizerName)) {
    name = event.organizerName.trim();
  } else if (event.organiserName && !isGeneric(event.organiserName)) {
    name = event.organiserName.trim();
  } else if (event.hostName && !isGeneric(event.hostName)) {
    name = event.hostName.trim();
  } else if (typeof event.organizer === "string" && !isGeneric(event.organizer)) {
    name = event.organizer.trim();
  } else if (typeof event.organiser === "string" && !isGeneric(event.organiser)) {
    name = event.organiser.trim();
  }

  let email = "";
  if (typeof event.organizer === "object" && event.organizer?.email && !isGenericEmail(event.organizer.email)) {
    email = event.organizer.email.trim();
  } else if (typeof event.organiser === "object" && event.organiser?.email && !isGenericEmail(event.organiser.email)) {
    email = event.organiser.email.trim();
  } else if (event.creatorEmail && !isGenericEmail(event.creatorEmail)) {
    email = event.creatorEmail.trim();
  } else if (event.createdByEmail && !isGenericEmail(event.createdByEmail)) {
    email = event.createdByEmail.trim();
  } else if (event.organizerEmail && !isGenericEmail(event.organizerEmail)) {
    email = event.organizerEmail.trim();
  } else if (event.organiserEmail && !isGenericEmail(event.organiserEmail)) {
    email = event.organiserEmail.trim();
  } else if (event.hostEmail && !isGenericEmail(event.hostEmail)) {
    email = event.hostEmail.trim();
  } else if (event.contactEmail && !isGenericEmail(event.contactEmail)) {
    email = event.contactEmail.trim();
  }

  // If currentUser is the true creator of the event, fallback to their details
  if (
    !name &&
    currentUser &&
    (currentUser.uid === event.createdBy ||
      currentUser.id === event.createdBy ||
      currentUser.uid === event.organizerId)
  ) {
    const uName = currentUser.fullName || currentUser.displayName || currentUser.name;
    if (uName && !isGeneric(uName)) {
      name = uName.trim();
    }
    if (!email && currentUser.email && !isGenericEmail(currentUser.email)) {
      email = currentUser.email.trim();
    }
  }

  if (!name && email) {
    const prefix = email.split("@")[0];
    name = prefix.charAt(0).toUpperCase() + prefix.slice(1);
  }

  if (!name) {
    name = event.organizerName || event.hostName || "Event Organiser";
  }

  // Ensure internal roles are never shown as the organizer's public name
  if (name.toLowerCase() === "super administrator" || name.toLowerCase() === "superadmin") {
    name = "Event Organiser";
  }

  const photoURL = event.organizerPhotoUrl || event.hostPhotoUrl || "";

  return {
    name,
    email,
    photoURL,
    role: "Creator",
  };
}

/**
 * Authoritative Attendee Count
 * Reconciles registrationsCount, allocatedSeats, ticketsSold and array length
 */
export function getAuthoritativeRegisteredCount(event, liveRegistrations = []) {
  if (!event) return Array.isArray(liveRegistrations) ? liveRegistrations.length : 0;
  const fromEvent = Math.max(
    Number(event.registrationsCount || 0),
    Number(event.allocatedSeats || 0),
    Number(event.ticketsSold || 0)
  );
  const fromRegs = Array.isArray(liveRegistrations) ? liveRegistrations.length : 0;
  return Math.max(fromEvent, fromRegs);
}
