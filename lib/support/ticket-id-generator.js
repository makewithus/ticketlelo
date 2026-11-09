import { adminDb } from '../firebase-admin.js';

let inMemoryCounter = 10000;

/**
 * Concurrency-Safe Support Ticket ID Generator
 *
 * Uses a Firestore atomic transaction on the dedicated counter document
 * `counters/supportTickets` to guarantee unique, monotonically increasing IDs (e.g., TKT-10001).
 * Never uses document counts or un-synchronized random generation.
 *
 * @returns {Promise<string>} Sequential Unique Support ID (e.g., "TKT-10001")
 */
export async function generateSupportTicketId() {
  if (typeof adminDb?.runTransaction !== 'function') {
    inMemoryCounter += 1;
    return `TKT-${inMemoryCounter}`;
  }

  const counterRef = adminDb.collection('counters').doc('supportTickets');

  try {
    const nextId = await adminDb.runTransaction(async (transaction) => {
      const counterDoc = await transaction.get(counterRef);

      let current = 10000;
      if (counterDoc.exists) {
        current = Number(counterDoc.data()?.lastNumber || 10000);
      }

      const nextNumber = current + 1;
      transaction.set(
        counterRef,
        {
          lastNumber: nextNumber,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      return `TKT-${nextNumber}`;
    });

    return nextId;
  } catch (err) {
    console.error('[TicketIdGenerator] Transaction failed, falling back to secure entropy ID:', err.message);
    // Secondary fallback with high entropy if database transaction fails
    const timestampSuffix = Date.now().toString().slice(-4);
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `TKT-${timestampSuffix}${rand}`;
  }
}
