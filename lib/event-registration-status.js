/**
 * Comprehensive Event Registration Status Evaluator
 * 
 * Determines whether an event is currently open or closed for registrations.
 * Evaluates:
 * 1. Cancelled event status
 * 2. Ended / Completed event status
 * 3. Draft / Private / Unlisted / Inactive mode
 * 4. Explicit registration closed flags (registrationClosed, registrationStatus === 'Closed', status === 'closed', closeRegistrationMode === 'now')
 * 5. Capacity limits (explicit closeRegistrationCapacity and globalCapacity)
 */

export function checkEventRegistrationStatus(event, liveTakenSeats = null) {
  if (!event || typeof event !== "object") {
    return { isClosed: true, reason: "invalid_event" };
  }

  // 1. Cancelled
  if (event.status === "cancelled" || event.isCancelled === true) {
    return { isClosed: true, reason: "cancelled" };
  }

  // 2. Ended / Completed
  if (
    event.status === "ended" ||
    event.status === "completed" ||
    event.isEnded === true
  ) {
    return { isClosed: true, reason: "ended" };
  }

  // 3. Draft / Private / Inactive / Unpublished Mode
  // If an event is in Draft mode, Private, Unlisted, or not active, public registration is closed.
  const isDraftOrPrivate = Boolean(
    event.status === "draft" ||
    event.status === "private" ||
    event.status === "unlisted" ||
    event.isPrivate === true ||
    event.visibility === "private" ||
    event.isActive === false ||
    (event.published === false && event.isPublished === false) ||
    event.status === "inactive"
  );

  if (isDraftOrPrivate) {
    return { isClosed: true, reason: "draft_or_private" };
  }

  // 4. Explicit Registration Closure Flags
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

  // 5. Capacity Checks
  const currentSeats =
    typeof liveTakenSeats === "number"
      ? liveTakenSeats
      : Math.max(Number(event.allocatedSeats || 0), 0);

  // 5a. Explicit Close Registration by Capacity
  if (
    event.closeRegistrationEnabled === true &&
    event.closeRegistrationMode === "capacity" &&
    typeof event.closeRegistrationCapacity === "number" &&
    Number(event.closeRegistrationCapacity) > 0 &&
    currentSeats >= Number(event.closeRegistrationCapacity)
  ) {
    return { isClosed: true, reason: "capacity_reached" };
  }

  // 5b. Global Event Capacity
  const rawSeats = event.globalCapacity ?? event.capacity ?? event.maxCapacity;
  const isUnlimited =
    typeof rawSeats === "string"
      ? rawSeats.toLowerCase().includes("unlimited") ||
        rawSeats.toLowerCase().includes("open")
      : event.isUnlimitedCapacity === true || event.limitCapacity === false;

  if (!isUnlimited) {
    const digits = String(rawSeats || "").replace(/[^\d]/g, "");
    const parsedCap = digits ? parseInt(digits, 10) : 0;
    if (parsedCap > 0 && currentSeats >= parsedCap) {
      return { isClosed: true, reason: "capacity_reached" };
    }
  }

  return { isClosed: false, reason: "open" };
}

export function isEventRegistrationClosed(event, liveTakenSeats = null) {
  return checkEventRegistrationStatus(event, liveTakenSeats).isClosed;
}

