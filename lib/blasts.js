import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { updateEvent } from "./firestore";

/**
 * Fetch all blasts for a specific event with realtime and fallback support.
 */
export async function getBlastsForEvent(eventId) {
  if (!eventId) return [];
  try {
    const q = query(
      collection(db, "messages"),
      where("eventId", "==", eventId)
    );
    const snap = await getDocs(q);
    const list = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    // Sort by createdAt descending
    list.sort((a, b) => {
      const timeA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
      const timeB = b.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
      return timeB - timeA;
    });

    return list;
  } catch (err) {
    console.warn("Client getBlastsForEvent notice, trying fallback API:", err.message);
    try {
      const res = await fetch(`/api/messages/${eventId}`, { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        if (json.messages) return json.messages;
      }
    } catch {}
    return [];
  }
}

/**
 * Live subscribe to blasts for an event.
 */
export function subscribeBlastsForEvent(eventId, onUpdate, onError) {
  if (!eventId) return () => {};
  try {
    const q = query(
      collection(db, "messages"),
      where("eventId", "==", eventId)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        list.sort((a, b) => {
          const timeA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
          const timeB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
          return timeB - timeA;
        });
        onUpdate(list);
      },
      (err) => {
        console.warn("subscribeBlastsForEvent onSnapshot warning:", err.message);
        if (onError) onError(err);
      }
    );
    return unsub;
  } catch (err) {
    console.warn("Failed to subscribe to blasts:", err);
    return () => {};
  }
}

/**
 * Create a new blast message (can be sent immediately or scheduled).
 */
export async function createBlastMessage({
  eventId,
  eventName = "Event",
  title,
  body,
  status = "sent",
  scheduledAt = null,
  targetAudience = "all",
  channel = "email",
  recipientCount = 0,
  userId = null,
}) {
  if (!eventId || !title || !body) {
    throw new Error("Missing required blast fields: eventId, title, body");
  }

  const messageRef = doc(collection(db, "messages"));
  const isScheduled = status === "scheduled" && scheduledAt;

  const messageData = {
    id: messageRef.id,
    eventId,
    eventName,
    title: title.trim(),
    subject: title.trim(),
    body: body.trim(),
    content: body.trim(),
    status: isScheduled ? "scheduled" : status,
    scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
    targetAudience,
    channel,
    recipientCount: Number(recipientCount) || 0,
    successCount: isScheduled ? 0 : Number(recipientCount) || 0,
    failureCount: 0,
    createdBy: userId || null,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    sentAt: isScheduled ? null : Timestamp.now(),
  };

  try {
    await setDoc(messageRef, messageData);
    return messageData;
  } catch (err) {
    console.warn("Client setDoc for message failed, attempting fallback:", err);
    try {
      const res = await fetch("/api/messages/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          title,
          content: body,
          scheduledAt,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        return json.message || messageData;
      }
    } catch (fallbackErr) {
      console.error("Fallback message create error:", fallbackErr);
    }
    throw err;
  }
}

/**
 * Send an existing or manual blast immediately (e.g. for rain delays, emergency schedule adjustments).
 */
export async function sendManualBlastNow({
  eventId,
  eventName,
  blastId = null,
  title,
  body,
  type = "manual_alert",
  recipientCount = 0,
  userId = null,
}) {
  if (blastId) {
    try {
      const messageRef = doc(db, "messages", blastId);
      await updateDoc(messageRef, {
        status: "sent",
        sentAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        successCount: recipientCount || 1,
      });
      return { id: blastId, status: "sent" };
    } catch (err) {
      console.warn("Direct updateDoc blast failed, trying /api/messages/send:", err);
    }
  }

  // Create new dispatched blast
  return createBlastMessage({
    eventId,
    eventName,
    title,
    body,
    status: "sent",
    scheduledAt: null,
    recipientCount,
    userId,
  });
}

/**
 * Save Event Reminders Configuration (autoRemindersEnabled + reminder schedule).
 */
export async function saveEventReminders(eventId, { autoRemindersEnabled, reminders }) {
  if (!eventId) throw new Error("Event ID required");
  const updates = {
    autoRemindersEnabled: Boolean(autoRemindersEnabled),
    reminders: reminders || [],
  };

  try {
    await updateEvent(eventId, updates);
    return updates;
  } catch (err) {
    console.warn("saveEventReminders client update error, using API fallback:", err);
    const res = await fetch(`/api/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error("Failed to save event reminders");
    return updates;
  }
}

/**
 * Save Post-Event Feedback Schedule for this event.
 */
export async function saveEventFeedbackSchedule(eventId, feedbackData) {
  if (!eventId) throw new Error("Event ID required");
  const updates = {
    feedbackSchedule: {
      enabled: true,
      scheduledAt: feedbackData.scheduledAt,
      subject: feedbackData.subject,
      body: feedbackData.body,
      updatedAt: new Date().toISOString(),
    },
  };

  try {
    await updateEvent(eventId, updates);
  } catch (err) {
    console.warn("saveEventFeedbackSchedule client update error, using API fallback:", err);
    await fetch(`/api/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
  }

  // Also record in messages collection so it appears under "Scheduled"
  try {
    await createBlastMessage({
      eventId,
      eventName: feedbackData.eventName || "Event",
      title: feedbackData.subject || "Post-Event Feedback",
      body: feedbackData.body || "Please share your feedback.",
      status: "scheduled",
      scheduledAt: feedbackData.scheduledAt,
      recipientCount: feedbackData.recipientCount || 0,
      userId: feedbackData.userId,
    });
  } catch (err) {
    console.warn("Notice: could not log feedback message in messages:", err);
  }

  return updates.feedbackSchedule;
}
