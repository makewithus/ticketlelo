import { getEffectivePlanLimits, getPlan } from "./plans.js";

/**
 * Super Admin authorization guard helper
 */
function isAuthorizedSuperAdmin(caller) {
  if (!caller) return false;
  const emailLower = (caller.email || "").toLowerCase().trim();
  const superAdminEnv = (process.env.SUPER_ADMIN_EMAIL || "").toLowerCase().trim();
  return (
    caller.role === "superAdmin" ||
    caller.isAdmin === true ||
    emailLower === "adil4ticketlelo@gmail.com" ||
    emailLower === "superadmin@ticketlelo.com" ||
    (superAdminEnv && emailLower === superAdminEnv)
  );
}

/**
 * Authoritatively calculates an organizer's actual non-deleted event usage
 * by scanning the Firestore events collection across all ownership identifier fields.
 *
 * @param {Object} adminDb - Firestore admin database instance
 * @param {string} userId - Organizer's user UID
 * @param {string} userEmail - Organizer's email address
 * @returns {Promise<{ totalEvents: number, activeEvents: number, events: Array }>}
 */
export async function getOrganizerUsage(adminDb, userId, userEmail = null) {
  if (!adminDb || !userId) {
    return { totalEvents: 0, activeEvents: 0, events: [] };
  }

  const emailClean = (userEmail || "").toLowerCase().trim();
  const eventsMap = new Map();

  const addEventDoc = (doc) => {
    const data = doc.data();
    // Exclude deleted events (hard or soft deleted)
    if (data.isDeleted === true || data.deleted === true || data.status === "deleted") {
      return;
    }
    if (!eventsMap.has(doc.id)) {
      eventsMap.set(doc.id, { id: doc.id, ...data });
    }
  };

  const queries = [
    adminDb.collection("events").where("createdBy", "==", userId).get(),
    adminDb.collection("events").where("userId", "==", userId).get(),
    adminDb.collection("events").where("organiserId", "==", userId).get(),
    adminDb.collection("events").where("organizerId", "==", userId).get(),
  ];

  if (emailClean) {
    queries.push(
      adminDb.collection("events").where("organiserEmail", "==", emailClean).get(),
      adminDb.collection("events").where("organizerEmail", "==", emailClean).get(),
      adminDb.collection("events").where("createdByEmail", "==", emailClean).get(),
    );
  }

  const results = await Promise.allSettled(queries);
  for (const res of results) {
    if (res.status === "fulfilled" && res.value && res.value.docs) {
      res.value.docs.forEach(addEventDoc);
    }
  }

  const events = Array.from(eventsMap.values());
  const activeEvents = events.filter(
    (e) =>
      e.status === "published" ||
      e.status === "live" ||
      e.isPublished === true ||
      e.published === true ||
      e.isActive === true
  ).length;

  return {
    totalEvents: events.length,
    activeEvents,
    events,
  };
}

/**
 * Backend limit assertion when an organizer creates an event.
 * Enforces canonical plan limits, preserves custom overrides, and prevents API bypass.
 *
 * @param {Object} adminDb
 * @param {Object} caller - Authenticated user object ({ uid, email, role, ... })
 * @param {string} targetUserId - Target organizer ID
 * @returns {Promise<{ allowed: boolean, code?: string, reason?: string, limit?: number, current?: number }>}
 */
export async function assertCanCreateEvent(adminDb, caller, targetUserId = null) {
  if (isAuthorizedSuperAdmin(caller)) {
    return { allowed: true, isSuperAdmin: true };
  }

  const userId = targetUserId || caller?.uid;
  if (!userId) {
    return {
      allowed: false,
      code: "UNAUTHENTICATED",
      reason: "Authentication required to create event",
    };
  }

  const userDoc = await adminDb.collection("users").doc(userId).get();
  if (!userDoc.exists) {
    return {
      allowed: false,
      code: "USER_NOT_FOUND",
      reason: "User account not found",
    };
  }

  const userData = userDoc.data();
  if (userData.role === "superAdmin") {
    return { allowed: true, isSuperAdmin: true };
  }

  const limits = getEffectivePlanLimits(userData);
  const userEmail = userData.email || caller?.email || null;
  const usage = await getOrganizerUsage(adminDb, userId, userEmail);

  // Unlimited events allowed
  if (limits.eventsAllowed === -1) {
    return {
      allowed: true,
      limit: -1,
      current: usage.totalEvents,
      plan: limits.planId,
      planName: limits.planName,
    };
  }

  if (usage.totalEvents >= limits.eventsAllowed) {
    const overrideNote = limits.hasCustomEvents ? ` (custom limit: ${limits.eventsAllowed})` : "";
    return {
      allowed: false,
      code: "EVENT_LIMIT_REACHED",
      reason: `You have reached your event limit (${usage.totalEvents}/${limits.eventsAllowed} events) on the ${limits.planName} plan${overrideNote}. Upgrade your plan to create more events.`,
      limit: limits.eventsAllowed,
      current: usage.totalEvents,
      standardLimit: limits.standardEventsAllowed,
      hasCustomOverride: limits.hasCustomEvents,
      plan: limits.planId,
      planName: limits.planName,
      upgradeRequired: true,
    };
  }

  return {
    allowed: true,
    limit: limits.eventsAllowed,
    current: usage.totalEvents,
    plan: limits.planId,
    planName: limits.planName,
  };
}

/**
 * Backend limit assertion when an organizer publishes a draft or private event.
 * Prevents activating/publishing events if the organizer's active event count exceeds quota.
 *
 * @param {Object} adminDb
 * @param {Object} caller
 * @param {string} eventId
 * @returns {Promise<{ allowed: boolean, code?: string, reason?: string, limit?: number, current?: number }>}
 */
export async function assertCanPublishEvent(adminDb, caller, eventId) {
  if (isAuthorizedSuperAdmin(caller)) {
    return { allowed: true, isSuperAdmin: true };
  }

  if (!eventId) {
    return { allowed: false, code: "INVALID_EVENT", reason: "Event ID required" };
  }

  const eventDoc = await adminDb.collection("events").doc(eventId).get();
  if (!eventDoc.exists) {
    return { allowed: false, code: "EVENT_NOT_FOUND", reason: "Event not found" };
  }

  const eventData = eventDoc.data();

  // If already published, publishing is idempotent
  if (
    eventData.status === "published" ||
    eventData.isPublished === true ||
    eventData.published === true
  ) {
    return { allowed: true, alreadyPublished: true };
  }

  const organizerId =
    eventData.createdBy || eventData.userId || eventData.organiserId || eventData.organizerId || caller?.uid;

  const userDoc = await adminDb.collection("users").doc(organizerId).get();
  if (!userDoc.exists) {
    return { allowed: false, code: "USER_NOT_FOUND", reason: "Organizer not found" };
  }

  const userData = userDoc.data();
  if (userData.role === "superAdmin") {
    return { allowed: true, isSuperAdmin: true };
  }

  const limits = getEffectivePlanLimits(userData);
  if (limits.eventsAllowed === -1) {
    return { allowed: true, limit: -1 };
  }

  const usage = await getOrganizerUsage(adminDb, organizerId, userData.email);

  // If total non-deleted events exceeds allowed, block publish
  if (usage.totalEvents > limits.eventsAllowed) {
    return {
      allowed: false,
      code: "EVENT_LIMIT_EXCEEDED",
      reason: `Cannot publish event. Your plan allows ${limits.eventsAllowed} event(s), but you currently have ${usage.totalEvents} event(s). Please upgrade your subscription.`,
      limit: limits.eventsAllowed,
      current: usage.totalEvents,
      upgradeRequired: true,
    };
  }

  return {
    allowed: true,
    limit: limits.eventsAllowed,
    current: usage.totalEvents,
  };
}

