/**
 * Offline Gate Check-In & Synchronization Engine (P08, CHECKIN-015)
 * Enables gate devices to securely validate and queue admissions when offline,
 * and deterministically sync with server-side conflict detection upon reconnection.
 */

const OFFLINE_QUEUE_KEY = "tl_offline_scans_queue";
const OFFLINE_CACHE_KEY = "tl_offline_admitted_cache";

/**
 * Gets a persistent unique device identifier for this gate terminal
 */
export function getGateDeviceId() {
  if (typeof window === "undefined") return "server_device";
  let deviceId = localStorage.getItem("tl_gate_device_id");
  if (!deviceId) {
    deviceId = `gate_dev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    localStorage.setItem("tl_gate_device_id", deviceId);
  }
  return deviceId;
}

/**
 * Retrieves the local queue of un-synced offline scans
 */
export function getPendingOfflineScans() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn("[offline-checkin] Failed to read queue:", e);
    return [];
  }
}

/**
 * Enqueues an offline check-in scan locally
 * @param {Object} scan
 * @param {string} scan.ticketId
 * @param {string} scan.rawQRData
 * @param {string} scan.gateStationSubEventId
 * @param {string} [scan.attendeeName]
 * @param {string} [scan.ticketTitle]
 * @returns {Object} Provisional offline scan record
 */
export function queueOfflineScan(scan) {
  if (typeof window === "undefined") return null;

  const deviceId = getGateDeviceId();
  const queue = getPendingOfflineScans();
  const scanKey = `${scan.gateStationSubEventId}:${scan.ticketId}`;

  // Check local offline cache for immediate duplicate detection at this gate
  let admittedCache = [];
  try {
    const rawCache = localStorage.getItem(OFFLINE_CACHE_KEY);
    admittedCache = rawCache ? JSON.parse(rawCache) : [];
  } catch {}

  const isDuplicate = admittedCache.includes(scanKey);

  const scanRecord = {
    id: `offscan_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    ticketId: scan.ticketId,
    rawQRData: scan.rawQRData,
    gateStationSubEventId: scan.gateStationSubEventId || "main_gate",
    deviceId,
    scannedAt: new Date().toISOString(),
    status: isDuplicate ? "offline_duplicate" : "offline_provisional_admitted",
    attendeeName: scan.attendeeName || "Attendee (Offline)",
    ticketTitle: scan.ticketTitle || "Ticket",
  };

  // If not duplicate, add to admitted cache
  if (!isDuplicate) {
    admittedCache.push(scanKey);
    try {
      localStorage.setItem(OFFLINE_CACHE_KEY, JSON.stringify(admittedCache));
    } catch {}
  }

  // Push to pending sync queue
  queue.push(scanRecord);
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error("[offline-checkin] Failed to save queue:", e);
  }

  return scanRecord;
}

/**
 * Removes successfully synchronized scans from the local queue
 */
export function removeSyncedScans(syncedScanIds = []) {
  if (typeof window === "undefined" || !syncedScanIds.length) return;
  const queue = getPendingOfflineScans();
  const remaining = queue.filter((item) => !syncedScanIds.includes(item.id));
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
  } catch {}
}

/**
 * Synchronizes pending offline queue with the server endpoint
 * @param {string} [endpoint="/api/verify-ticket/batch-sync"]
 * @returns {Promise<{ success: boolean, syncedCount: number, conflictCount: number, conflicts: Array }>}
 */
export async function syncOfflineQueue(endpoint = "/api/verify-ticket/batch-sync") {
  const queue = getPendingOfflineScans();
  if (!queue.length) {
    return { success: true, syncedCount: 0, conflictCount: 0, conflicts: [] };
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scans: queue }),
    });

    if (!response.ok) {
      throw new Error(`Sync request failed with status ${response.status}`);
    }

    const data = await response.json();
    if (data.success) {
      const syncedIds = queue.map((s) => s.id);
      removeSyncedScans(syncedIds);
    }

    return data;
  } catch (err) {
    console.error("[offline-checkin] Sync failed:", err.message);
    return {
      success: false,
      error: err.message,
      syncedCount: 0,
      conflictCount: 0,
      conflicts: [],
    };
  }
}
