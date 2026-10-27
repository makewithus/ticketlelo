/**
 * Hybrid Webinars & Protected Virtual Sessions Engine (P14, WEBINAR-001–015)
 * Enforces authenticated ticket entitlement and the 15-minute release window
 * before unveiling protected Zoom/Meet/YouTube Live streaming links.
 */

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

/**
 * Calculates whether the virtual session access window is open (<= 15 mins before start)
 * @param {Date|string|number} startTime
 * @param {Date|string|number} [currentTime=new Date()]
 * @returns {{ isOpen: boolean, minutesUntilOpen: number, isExpired: boolean }}
 */
export function getWebinarAccessWindow(startTime, currentTime = new Date()) {
  const startMs = new Date(startTime?.toDate ? startTime.toDate() : startTime).getTime();
  const currentMs = new Date(currentTime).getTime();

  if (isNaN(startMs)) {
    return { isOpen: false, minutesUntilOpen: 0, isExpired: false, error: "Invalid start time" };
  }

  const timeDiff = startMs - currentMs;
  const isOpen = timeDiff <= FIFTEEN_MINUTES_MS;
  const minutesUntilOpen = Math.max(0, Math.ceil((timeDiff - FIFTEEN_MINUTES_MS) / 60000));
  const isExpired = timeDiff < -6 * 60 * 60 * 1000; // Expired if older than 6 hours

  return {
    isOpen: isOpen && !isExpired,
    minutesUntilOpen,
    isExpired,
    startsAt: new Date(startMs).toISOString(),
  };
}

// Persisted sub-events use a date, local clock time and IANA timezone.
export function getSubEventStart(subEvent) {
  const raw = subEvent.startTime || subEvent.date;
  if (raw?.toDate) return raw.toDate();
  if (raw instanceof Date || typeof raw === "number") return new Date(raw);
  const clock = typeof raw === "string" && raw.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!clock) return new Date(raw);
  const date = subEvent.date?.toDate ? subEvent.date.toDate().toISOString().slice(0, 10) : String(subEvent.date || "").slice(0, 10);
  let hour = Number(clock[1]);
  const minute = Number(clock[2]);
  if (minute > 59 || (clock[3] ? hour < 1 || hour > 12 : hour > 23) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return new Date(NaN);
  if (clock[3]) hour = hour % 12 + (clock[3].toUpperCase() === "PM" ? 12 : 0);
  const wallTime = Date.parse(`${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00Z`);
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: subEvent.timezone || "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    });
    let instant = wallTime;
    for (let i = 0; i < 3; i++) {
      const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).map(({type,value}) => [type,value]));
      const represented = Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`);
      instant += wallTime - represented;
    }
    return new Date(instant);
  } catch { return new Date(NaN); }
}

/**
 * Verifies attendee entitlement and returns protected meeting credentials if permitted
 * @param {Object} params
 * @param {Object} params.ticket - Ticket record
 * @param {Object} params.subEvent - Sub-event record
 * @param {Date} [params.currentTime=new Date()]
 * @returns {Object} Access decision and credentials
 */
export function verifyWebinarAccess({ ticket, subEvent, currentTime = new Date() }) {
  if (!ticket) {
    return { authorized: false, reason: "Ticket record required." };
  }

  if (ticket.status === "Revoked") {
    return { authorized: false, reason: "This ticket has been revoked." };
  }

  if (!subEvent) {
    return { authorized: false, reason: "Sub-event record not found." };
  }

  // 1. Verify Sub-Event Entitlement
  const entitled =
    Array.isArray(ticket.entitledSubEventIds) &&
    ticket.entitledSubEventIds.includes(subEvent.id);

  if (!entitled) {
    return {
      authorized: false,
      reason: "Your ticket does not include access to this webinar track.",
    };
  }

  // 2. Verify Session Format
  const isVirtual =
    subEvent.isOnline || subEvent.isVirtual ||
    subEvent.locationType === "virtual" ||
    subEvent.trackType === "webinar" ||
    Boolean(subEvent.meetingUrl || subEvent.virtualMeetingUrl);

  if (!isVirtual) {
    return {
      authorized: false,
      reason: "This sub-event is scheduled as an in-person physical session.",
    };
  }

  // 3. Verify 15-Minute Release Window
  const windowStatus = getWebinarAccessWindow(getSubEventStart(subEvent), currentTime);

  if (windowStatus.isExpired) {
    return {
      authorized: false,
      reason: "This webinar session has concluded.",
    };
  }

  if (!windowStatus.isOpen) {
    return {
      authorized: false,
      isScheduled: true,
      minutesUntilOpen: windowStatus.minutesUntilOpen,
      startsAt: windowStatus.startsAt,
      reason: `Protected meeting link will unlock 15 minutes before the session starts (${windowStatus.minutesUntilOpen} minutes remaining).`,
    };
  }

  // 4. Return Authorized Protected Meeting Credentials
  return {
    authorized: true,
    provider: subEvent.virtualPlatform || "google_meet", // "zoom" | "google_meet" | "youtube" | "custom"
    meetingUrl: subEvent.meetingUrl || subEvent.virtualMeetingUrl || "",
    meetingPasscode: subEvent.meetingPasscode || subEvent.virtualMeetingPasscode || null,
    sessionTitle: subEvent.title,
    instructions: subEvent.virtualInstructions || "Please join with your registered name.",
  };
}
