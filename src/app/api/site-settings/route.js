import { NextResponse } from "next/server";
import { adminDb, isFirebaseAdminReady } from "@/lib/firebase-admin";
import { getAuthenticatedUser } from "@/lib/auth-server";

const SETTINGS_REF = () => adminDb.collection("siteSettings").doc("homepage");

const DEFAULT_SITE_CONFIG = {
  platformName: "TicketLelo",
  supportEmail: "support@ticketlelo.com",
  serviceFeePercent: "2.5",
  maintenanceMode: false,
  publicDiscovery: true,
};

export async function GET() {
  try {
    if (!isFirebaseAdminReady() || !adminDb) {
      return NextResponse.json({
        countdownAt: null,
        countdownEnabled: false,
        siteConfig: DEFAULT_SITE_CONFIG,
        updatedAt: null,
      });
    }

    const snapshot = await SETTINGS_REF().get();
    const data = snapshot.exists ? snapshot.data() : {};
    const stored = data?.countdownAt;
    const storedEnabled = data?.countdownEnabled;
    const updatedAt = data?.updatedAt || null;

    const parsedDate = typeof stored === "string" ? Date.parse(stored) : NaN;
    const isValidDate = !Number.isNaN(parsedDate);
    const isFuture = isValidDate && parsedDate > Date.now();
    const countdownEnabled = storedEnabled === false ? false : (isValidDate && isFuture);

    const siteConfig = {
      platformName: data?.siteConfig?.platformName || data?.platformName || DEFAULT_SITE_CONFIG.platformName,
      supportEmail: data?.siteConfig?.supportEmail || data?.supportEmail || DEFAULT_SITE_CONFIG.supportEmail,
      serviceFeePercent: String(data?.siteConfig?.serviceFeePercent || data?.serviceFeePercent || DEFAULT_SITE_CONFIG.serviceFeePercent),
      maintenanceMode: Boolean(data?.siteConfig?.maintenanceMode ?? data?.maintenanceMode ?? DEFAULT_SITE_CONFIG.maintenanceMode),
      publicDiscovery: Boolean(data?.siteConfig?.publicDiscovery ?? data?.publicDiscovery ?? DEFAULT_SITE_CONFIG.publicDiscovery),
    };

    return NextResponse.json(
      {
        countdownAt: isValidDate ? stored : null,
        countdownEnabled: Boolean(countdownEnabled),
        isExpired: isValidDate && !isFuture,
        siteConfig,
        updatedAt,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Failed to read site settings:", error);
    return NextResponse.json({ error: "Could not load site settings" }, { status: 500 });
  }
}

export async function POST(request) {
  return handleUpdate(request);
}

export async function PUT(request) {
  return handleUpdate(request);
}

async function handleUpdate(request) {
  try {
    if (!isFirebaseAdminReady() || !adminDb) {
      return NextResponse.json({ error: "Site settings are unavailable" }, { status: 503 });
    }

    const caller = await getAuthenticatedUser(request);
    if (!caller) return NextResponse.json({ error: "Sign in as a super administrator" }, { status: 401 });

    const emailLower = (caller?.email || "").toLowerCase().trim();
    const superAdminEnv = (process.env.SUPER_ADMIN_EMAIL || "").toLowerCase().trim();
    const isSuperAdmin =
      caller?.role === "superAdmin" ||
      caller?.role === "superadmin" ||
      caller?.role === "admin" ||
      caller?.isAdmin === true ||
      emailLower === "adil4ticketlelo@gmail.com" ||
      emailLower === "superadmin@ticketlelo.com" ||
      (superAdminEnv && emailLower === superAdminEnv);

    if (!isSuperAdmin) {
      return NextResponse.json({ error: "Super administrator access required" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { countdownAt, countdownEnabled, siteConfig } = body;

    const nowIso = new Date().toISOString();
    const updatePayload = {
      updatedAt: nowIso,
      updatedBy: caller.uid || caller.id,
    };

    // Explicitly handle disable / clear
    if (countdownEnabled === false || countdownAt === null || countdownAt === "") {
      updatePayload.countdownEnabled = false;
      updatePayload.countdownAt = null;
    } else if (countdownAt !== undefined) {
      // Validate countdown date
      if (typeof countdownAt !== "string" || Number.isNaN(Date.parse(countdownAt))) {
        return NextResponse.json(
          { error: "Invalid countdown date: Please provide a valid date and time string." },
          { status: 400 }
        );
      }
      const parsedMs = new Date(countdownAt).getTime();
      if (parsedMs <= Date.now()) {
        return NextResponse.json(
          { error: "Countdown target date cannot be in the past. Please select a future date and time." },
          { status: 400 }
        );
      }
      updatePayload.countdownAt = new Date(countdownAt).toISOString();
      updatePayload.countdownEnabled = true;
    }

    if (siteConfig && typeof siteConfig === "object") {
      updatePayload.siteConfig = {
        platformName: typeof siteConfig.platformName === "string" ? siteConfig.platformName.trim() : DEFAULT_SITE_CONFIG.platformName,
        supportEmail: typeof siteConfig.supportEmail === "string" ? siteConfig.supportEmail.trim() : DEFAULT_SITE_CONFIG.supportEmail,
        serviceFeePercent: String(siteConfig.serviceFeePercent || DEFAULT_SITE_CONFIG.serviceFeePercent),
        maintenanceMode: Boolean(siteConfig.maintenanceMode),
        publicDiscovery: siteConfig.publicDiscovery !== false,
      };
      updatePayload.platformName = updatePayload.siteConfig.platformName;
      updatePayload.supportEmail = updatePayload.siteConfig.supportEmail;
      updatePayload.serviceFeePercent = updatePayload.siteConfig.serviceFeePercent;
      updatePayload.maintenanceMode = updatePayload.siteConfig.maintenanceMode;
      updatePayload.publicDiscovery = updatePayload.siteConfig.publicDiscovery;
    }

    await SETTINGS_REF().set(updatePayload, { merge: true });

    return NextResponse.json({
      success: true,
      countdownAt: updatePayload.countdownAt ?? null,
      countdownEnabled: updatePayload.countdownEnabled ?? Boolean(countdownEnabled),
      siteConfig: updatePayload.siteConfig || siteConfig,
      updatedAt: nowIso,
    });
  } catch (error) {
    console.error("Failed to update site settings:", error);
    const status = error?.code === "auth/id-token-expired" || error?.code === "auth/argument-error" ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? "Your session has expired. Sign in again." : "Could not save site settings" }, { status });
  }
}
