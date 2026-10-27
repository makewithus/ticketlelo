import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { getAuthenticatedUser, canManageEventId } from "@/lib/auth-server";

/** Reconcile offline check-ins against authoritative ticket state. */
export async function POST(request) {
  try {
    const caller = await getAuthenticatedUser(request);
    if (!caller) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    if (!adminDb) return NextResponse.json({ error: "Check-in service unavailable" }, { status: 503 });
    if (!["organiser", "superadmin"].includes(String(caller.role).toLowerCase())) {
      return NextResponse.json({ error: "Gate operator permission required" }, { status: 403 });
    }

    const body = await request.json();
    const scans = Array.isArray(body.scans) ? body.scans.slice(0, 100) : [];
    if (body.scans && (!Array.isArray(body.scans) || body.scans.length > 100)) {
      return NextResponse.json({ error: "scans must be an array of at most 100 records" }, { status: 400 });
    }
    let syncedCount = 0;
    let conflictCount = 0;
    const conflicts = [];
    const results = [];

    for (const scan of scans) {
      const ticketId = typeof scan.ticketId === "string" ? scan.ticketId.trim() : "";
      const station = typeof scan.gateStationSubEventId === "string" && scan.gateStationSubEventId
        ? scan.gateStationSubEventId
        : "main_gate";
      const scanId = typeof scan.id === "string" ? scan.id.trim() : "";
      if (!ticketId || ticketId.length > 160 || ticketId.includes("/") || !scanId || scanId.length > 160 || scanId.includes("/")) {
        conflictCount++;
        conflicts.push({ scanId: scanId || null, ticketId: ticketId || null, reason: "Invalid offline scan record" });
        continue;
      }
      if (station !== "main_gate" && !/^[A-Za-z0-9_-]{1,150}$/.test(station)) {
        conflictCount++;
        conflicts.push({ scanId, ticketId, reason: "Invalid gate station" });
        continue;
      }

      const ticketRef = adminDb.collection("tickets").doc(ticketId);
      const syncId = crypto.createHash("sha256").update(`${caller.uid}:${scanId}`).digest("hex");
      const syncRef = adminDb.collection("offlineScanSyncs").doc(syncId);
      let result;
      await adminDb.runTransaction(async (tx) => {
        const stationRef = station === "main_gate" ? null : adminDb.collection("subEvents").doc(station);
        const [ticketSnap, syncSnap, stationSnap] = await Promise.all([
          tx.get(ticketRef),
          tx.get(syncRef),
          stationRef ? tx.get(stationRef) : Promise.resolve(null),
        ]);
        if (syncSnap.exists) {
          result = syncSnap.data().result;
          return;
        }
        if (!ticketSnap.exists) {
          result = { status: "conflict", reason: "Ticket not found in system database." };
          tx.create(syncRef, { scanId, ticketId, operatorUid: caller.uid, result, syncedAt: Timestamp.now() });
          return;
        }
        const ticket = ticketSnap.data();
        if (!await canManageEventId(caller, ticket.eventId)) {
          result = { status: "conflict", reason: "Forbidden: event access required" };
          tx.create(syncRef, { scanId, ticketId, operatorUid: caller.uid, eventId: ticket.eventId, result, syncedAt: Timestamp.now() });
          return;
        }
        if (ticket.status === "Revoked" || ticket.status === "Refunded") {
          result = { status: "conflict", reason: "Ticket is revoked or refunded." };
        } else if (stationRef && (!stationSnap?.exists || stationSnap.data().parentEventId !== ticket.eventId)) {
          result = { status: "conflict", reason: "Gate station does not belong to this event" };
        } else if (station !== "main_gate" && !(ticket.entitledSubEventIds || []).includes(station)) {
          result = { status: "conflict", reason: "Ticket does not include this sub-event" };
        } else if (ticket.checkIns?.[station]) {
          const prior = ticket.checkIns[station];
          result = {
            status: "conflict",
            reason: "Duplicate admission detected across offline terminals.",
            priorAdmissionTime: prior.time?.toDate?.().toISOString() || "Earlier",
            priorDeviceId: prior.deviceId || "unknown",
          };
        } else {
          const now = Timestamp.now();
          const rawClientTime = scan.scannedAt ? new Date(scan.scannedAt) : null;
          const clientTime = rawClientTime && Number.isFinite(rawClientTime.getTime())
            ? Timestamp.fromDate(rawClientTime)
            : null;
          const checkIn = {
            time: now,
            station,
            deviceId: typeof scan.deviceId === "string" ? scan.deviceId.slice(0, 120) : "unknown_device",
            scannedBy: caller.uid,
            syncedAt: now,
            clientScannedAt: clientTime,
          };
          tx.update(ticketRef, { [`checkIns.${station}`]: checkIn, status: "Used", usedAt: now, updatedAt: now });
          result = { status: "admitted" };
        }
        tx.create(syncRef, { scanId, ticketId, operatorUid: caller.uid, eventId: ticket.eventId, station, result, syncedAt: Timestamp.now() });
      });

      if (result?.status === "admitted") {
        syncedCount++;
        results.push({ scanId, ticketId, status: "admitted" });
      } else {
        conflictCount++;
        conflicts.push({ scanId, ticketId, station, reason: result?.reason || "Scan conflict" });
      }
    }
    return NextResponse.json({ success: true, syncedCount, conflictCount, conflicts, results });
  } catch (error) {
    console.error("[batch-sync] Reconciliation failed:", error.code || "unexpected-error");
    return NextResponse.json({ success: false, error: "Failed to synchronize offline batch" }, { status: 500 });
  }
}
