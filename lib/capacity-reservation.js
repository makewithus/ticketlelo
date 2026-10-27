import { db } from "./firebase.js";
import {
  doc as clientDoc,
  collection as clientCollection,
  runTransaction as clientRunTransaction,
  Timestamp as ClientTimestamp,
} from "firebase/firestore";
import admin from "firebase-admin";

/**
 * Server-Authoritative Capacity Reservation & Atomic Seat Locking
 * Guarantees zero overselling across parent, sub-event, and combo bottlenecks (P05, P06, CAPACITY-001–010).
 * Supports both Firebase Admin SDK (privileged server writes) and Client SDK (isolated algorithm tests).
 */

function getStore() {
  if (admin.apps && admin.apps.length > 0) {
    const adminDb = admin.firestore();
    return {
      type: "admin",
      runTransaction: (fn) => adminDb.runTransaction(fn),
      doc: (coll, id) => (id ? adminDb.collection(coll).doc(id) : adminDb.collection(coll).doc()),
      now: () => admin.firestore.Timestamp.now(),
      fromDate: (d) => admin.firestore.Timestamp.fromDate(d),
    };
  }
  return {
    type: "client",
    runTransaction: (fn) => clientRunTransaction(db, fn),
    doc: (coll, id) => (id ? clientDoc(db, coll, id) : clientDoc(clientCollection(db, coll))),
    now: () => ClientTimestamp.now(),
    fromDate: (d) => ClientTimestamp.fromDate(d),
  };
}

function docExists(snap) {
  if (!snap) return false;
  return typeof snap.exists === "function" ? snap.exists() : Boolean(snap.exists);
}

export const reserveTicketCapacity = async ({
  parentEventId,
  ticketConfig,
  quantity = 1,
  buyerEmail,
}) => {
  try {
    if (!parentEventId || !ticketConfig) {
      throw new Error("Missing parameters for capacity reservation");
    }

    const qty = Number(quantity);
    if (!Number.isSafeInteger(qty) || qty < 1) throw new Error("Reservation quantity must be a positive integer");
    const includedSubEventIds = Array.isArray(ticketConfig.includedSubEventIds)
      ? ticketConfig.includedSubEventIds
      : ticketConfig.subEventId
      ? [ticketConfig.subEventId]
      : [];

    const store = getStore();
    const reservationRef = store.doc("reservations");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15-minute reservation window

    // Execute atomic Firestore transaction
    const result = await store.runTransaction(async (transaction) => {
      // 1. Read Parent Event
      const parentRef = store.doc("events", parentEventId);
      const parentDoc = await transaction.get(parentRef);
      if (!docExists(parentDoc)) {
        throw new Error("Major Event not found");
      }
      const parentData = parentDoc.data();

      // DEF-020: Enforce global major-event capacity limit across all tickets
      if (typeof parentData.globalCapacity === "number" && parentData.globalCapacity > 0) {
        const remGlobal = parentData.globalCapacity - (parentData.allocatedSeats || 0);
        if (remGlobal < qty) {
          throw new Error("Major Event has reached maximum global capacity.");
        }
      }

      // 2. Read Combo document if applicable
      let comboDoc = null;
      let comboRef = null;
      if (ticketConfig.id && ticketConfig.tierType) {
        comboRef = store.doc("combos", ticketConfig.id);
        comboDoc = await transaction.get(comboRef);
        if (docExists(comboDoc)) {
          const comboData = comboDoc.data();
          const remCombo = (comboData.dedicatedQuota || 0) - (comboData.allocatedCount || 0);
          if (remCombo < qty) {
            throw new Error(`Combo ${comboData.title} is sold out (Dedicated quota reached).`);
          }
        }
      }

      // 3. Read and check each included sub-event
      const subDocsToUpdate = [];
      for (const subId of includedSubEventIds) {
        const subRef = store.doc("subEvents", subId);
        const subDoc = await transaction.get(subRef);
        if (!docExists(subDoc)) {
          throw new Error(`Sub-event ${subId} included in ticket was not found.`);
        }
        const subData = subDoc.data();
        const remCap = (subData.capacity || 0) - (subData.allocatedSeats || 0);
        if (remCap < qty) {
          throw new Error(`Sub-event track "${subData.title}" has reached full capacity.`);
        }
        subDocsToUpdate.push({ ref: subRef, currentAllocated: subData.allocatedSeats || 0 });
      }

      // 4. All checks passed: perform atomic writes inside transaction
      if (typeof parentData.globalCapacity === "number" && parentData.globalCapacity > 0) {
        transaction.update(parentRef, {
          allocatedSeats: (parentData.allocatedSeats || 0) + qty,
          updatedAt: store.now(),
        });
      }

      for (const item of subDocsToUpdate) {
        transaction.update(item.ref, {
          allocatedSeats: item.currentAllocated + qty,
          updatedAt: store.now(),
        });
      }

      if (comboRef && docExists(comboDoc)) {
        transaction.update(comboRef, {
          allocatedCount: (comboDoc.data().allocatedCount || 0) + qty,
          updatedAt: store.now(),
        });
      }

      const reservationData = {
        id: reservationRef.id,
        parentEventId,
        ticketId: ticketConfig.id || null,
        ticketTitle: ticketConfig.title,
        includedSubEventIds,
        quantity: qty,
        buyerEmail: (buyerEmail || "").toLowerCase().trim(),
        status: "reserved", // "reserved" | "finalized" | "released"
        expiresAt: store.fromDate(expiresAt),
        createdAt: store.now(),
      };

      transaction.set(reservationRef, reservationData);
      return reservationData;
    });

    return result;
  } catch (error) {
    console.error("[capacity-reservation] reserveTicketCapacity error:", error.message);
    throw error;
  }
};

export const releaseCapacityReservation = async (reservationId) => {
  try {
    if (!reservationId) return false;

    const store = getStore();

    await store.runTransaction(async (transaction) => {
      const resRef = store.doc("reservations", reservationId);
      const resDoc = await transaction.get(resRef);
      if (!docExists(resDoc)) return;

      const resData = resDoc.data();
      if (resData.status !== "reserved") return; // Already finalized or released

      const qty = Number(resData.quantity || 1);

      // Firestore transactions require all reads before the first write.
      // 1. Read Parent Event
      let parentRef = null;
      let parentDoc = null;
      if (resData.parentEventId) {
        parentRef = store.doc("events", resData.parentEventId);
        parentDoc = await transaction.get(parentRef);
      }

      // 2. Read included sub-events
      const pendingSub = [];
      for (const subId of resData.includedSubEventIds || []) {
        const subRef = store.doc("subEvents", subId);
        const subDoc = await transaction.get(subRef);
        if (docExists(subDoc)) {
          pendingSub.push({ ref: subRef, current: subDoc.data().allocatedSeats || 0 });
        }
      }

      // 3. Read combo if applicable
      let comboRef = null;
      let comboDoc = null;
      if (resData.ticketId) {
        comboRef = store.doc("combos", resData.ticketId);
        comboDoc = await transaction.get(comboRef);
      }

      // 4. All reads complete: execute writes
      if (parentRef && docExists(parentDoc)) {
        const pData = parentDoc.data();
        if (typeof pData.globalCapacity === "number" && pData.globalCapacity > 0) {
          transaction.update(parentRef, {
            allocatedSeats: Math.max(0, (pData.allocatedSeats || 0) - qty),
            updatedAt: store.now(),
          });
        }
      }

      for (const item of pendingSub) {
        transaction.update(item.ref, {
          allocatedSeats: Math.max(0, item.current - qty),
          updatedAt: store.now(),
        });
      }

      if (comboRef && comboDoc && comboDoc.exists()) {
        transaction.update(comboRef, {
          allocatedCount: Math.max(0, (comboDoc.data().allocatedCount || 0) - qty),
          updatedAt: store.now(),
        });
      }

      transaction.update(resRef, {
        status: "released",
        releasedAt: store.now(),
      });
    });

    return true;
  } catch (error) {
    console.error("[capacity-reservation] releaseCapacityReservation error:", error.message);
    return false;
  }
};

export const releaseTicketCapacity = releaseCapacityReservation;
